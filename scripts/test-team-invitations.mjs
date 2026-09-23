import assert from "node:assert/strict";
import { onRequestGet as listInvites, onRequestPost as createInvite } from "../functions/api/team/invitations.js";
import { onRequestPost as acceptInvite } from "../functions/api/team/invitations/accept.js";
import { onRequestPost as revokeInvite } from "../functions/api/team/invitations/revoke.js";
import { sha256Hex } from "../functions/_shared/webhook.js";

const HOTEL="11111111-1111-4111-8111-111111111111";
const OWNER="22222222-2222-4222-8222-222222222222";
const MANAGER="33333333-3333-4333-8333-333333333333";
const INVITE="44444444-4444-4444-8444-444444444444";
const env={SUPABASE_URL:"https://mock.supabase.test",SUPABASE_SECRET_KEY:"server-key",TEAM_INVITES_ENABLED:"true"};

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const read=async r=>JSON.parse(await r.text());
async function withFetch(mock,fn){const old=globalThis.fetch;globalThis.fetch=mock;try{return await fn()}finally{globalThis.fetch=old}}
function post(url,body,token="owner-session"){return new Request("https://staypilot.test"+url,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify(body)})}
function ownerFetch(onRpc){
  return async (url,options={})=>{
    const parsed=new URL(String(url));
    if(parsed.pathname==="/auth/v1/user") return json({id:OWNER,email:"owner@example.com",email_confirmed_at:"2026-09-24T00:00:00Z"});
    if(parsed.pathname==="/rest/v1/hotel_members") return json([{hotel_id:HOTEL,user_id:OWNER,role:"owner"}]);
    if(parsed.pathname.startsWith("/rest/v1/rpc/")) return onRpc(parsed.pathname,JSON.parse(options.body||"{}"));
    throw new Error("unexpected fetch "+parsed.pathname);
  };
}

// Disabled rollout fails closed before auth/database.
{
  let fetched=false;
  const r=await withFetch(async()=>{fetched=true;throw new Error("must not fetch")},()=>createInvite({request:post("/api/team/invitations",{hotel_id:HOTEL,email:"manager@example.com",role:"manager"}),env:{...env,TEAM_INVITES_ENABLED:"false"}}));
  assert.equal(r.status,503); assert.equal((await read(r)).error,"team_invitations_disabled"); assert.equal(fetched,false);
}

// Client can never create an Owner invite.
{
  let fetched=false;
  const r=await withFetch(async()=>{fetched=true;throw new Error("must not fetch")},()=>createInvite({request:post("/api/team/invitations",{hotel_id:HOTEL,email:"owner2@example.com",role:"owner"}),env}));
  assert.equal(r.status,400); assert.equal((await read(r)).error,"invalid_invite_role"); assert.equal(fetched,false);
}

// Owner creates a manager invite; raw token is returned once, only hash reaches persistence.
{
  let persistedHash="";
  const r=await withFetch(ownerFetch((path,body)=>{
    assert.equal(path,"/rest/v1/rpc/create_hotel_invitation");
    assert.equal(body.hotel_uuid,HOTEL); assert.equal(body.inviter_uuid,OWNER);
    assert.equal(body.invite_email,"manager@example.com"); assert.equal(body.invite_role,"manager");
    assert.match(body.invite_token_hash,/^[a-f0-9]{64}$/); persistedHash=body.invite_token_hash;
    return json({id:INVITE,hotel_id:HOTEL,email:"manager@example.com",role:"manager",status:"pending",expires_at:"2026-10-01T00:00:00Z",created_at:"2026-09-24T00:00:00Z"});
  }),()=>createInvite({request:post("/api/team/invitations",{hotel_id:HOTEL,email:"Manager@Example.com",role:"manager"}),env}));
  assert.equal(r.status,201);
  const body=await read(r);
  assert.match(body.invite_token,/^[a-f0-9]{64}$/);
  assert.equal(await sha256Hex(body.invite_token),persistedHash);
  assert.notEqual(body.invite_token,persistedHash);
  assert.equal(body.delivery,"manual_copy");
  assert.equal(body.invitation.role,"manager");
}

// Owner list returns non-secret invitation metadata only.
{
  const request=new Request("https://staypilot.test/api/team/invitations?hotel_id="+HOTEL,{headers:{authorization:"Bearer owner-session"}});
  const r=await withFetch(ownerFetch((path,body)=>{
    assert.equal(path,"/rest/v1/rpc/list_hotel_invitations"); assert.equal(body.hotel_uuid,HOTEL); assert.equal(body.owner_uuid,OWNER);
    return json([{id:INVITE,email:"manager@example.com",role:"manager",status:"pending",expires_at:"2026-10-01T00:00:00Z"}]);
  }),()=>listInvites({request,env}));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.invitations.length,1);
  assert.equal("token_hash" in body.invitations[0],false);
  assert.equal("invite_token" in body.invitations[0],false);
}

// Confirmed invited account accepts; identity/email come from auth and role comes from server invitation.
{
  const raw="ab".repeat(32); const expectedHash=await sha256Hex(raw);
  const r=await withFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json({id:MANAGER,email:"manager@example.com",email_confirmed_at:"2026-09-24T00:00:00Z"});
    if(p==="/rest/v1/rpc/accept_hotel_invitation"){
      const b=JSON.parse(options.body);
      assert.equal(b.user_uuid,MANAGER); assert.equal(b.user_email,"manager@example.com"); assert.equal(b.invite_token_hash,expectedHash);
      assert.equal(b.role,undefined);
      return json({accepted:true,replayed:false,hotel_id:HOTEL,role:"manager",invitation_id:INVITE});
    }
    throw new Error("unexpected "+p);
  },()=>acceptInvite({request:post("/api/team/invitations/accept",{token:raw},"manager-session"),env}));
  assert.equal(r.status,201);
  const body=await read(r); assert.equal(body.accepted,true); assert.equal(body.role,"manager");
}

// Unconfirmed invitee cannot accept.
{
  const raw="cd".repeat(32);
  const r=await withFetch(async url=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json({id:MANAGER,email:"manager@example.com"});
    throw new Error("RPC must not run");
  },()=>acceptInvite({request:post("/api/team/invitations/accept",{token:raw},"manager-session"),env}));
  assert.equal(r.status,403); assert.equal((await read(r)).error,"account_verification_required");
}

// Email mismatch is a stable conflict and never lets client choose another role.
{
  const raw="ef".repeat(32);
  const r=await withFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json({id:MANAGER,email:"other@example.com",confirmed_at:"2026-09-24T00:00:00Z"});
    if(p==="/rest/v1/rpc/accept_hotel_invitation") return json({message:"invite_email_mismatch"},400);
    throw new Error("unexpected");
  },()=>acceptInvite({request:post("/api/team/invitations/accept",{token:raw,role:"owner"},"manager-session"),env}));
  assert.equal(r.status,409); assert.equal((await read(r)).error,"invite_email_mismatch");
}

// Owner revocation is server-authorized and idempotency metadata is preserved.
{
  const r=await withFetch(ownerFetch((path,body)=>{
    assert.equal(path,"/rest/v1/rpc/revoke_hotel_invitation");
    assert.equal(body.hotel_uuid,HOTEL); assert.equal(body.owner_uuid,OWNER); assert.equal(body.invitation_uuid,INVITE);
    return json({id:INVITE,status:"revoked",replayed:false});
  }),()=>revokeInvite({request:post("/api/team/invitations/revoke",{hotel_id:HOTEL,invitation_id:INVITE}),env}));
  assert.equal(r.status,200);
  const body=await read(r); assert.equal(body.status,"revoked"); assert.equal(body.replayed,false);
}

console.log("StayPilot team invitation HTTP tests passed.");
