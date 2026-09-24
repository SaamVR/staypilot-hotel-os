import assert from "node:assert/strict";
import { onRequestPost as createInvite, onRequestGet as listInvites, onRequest as invitationsFallback } from "../functions/api/team/invitations.js";
import { onRequestPost as acceptInvite, onRequest as acceptFallback } from "../functions/api/team/invitations/accept.js";
import { onRequestPost as revokeInvite, onRequest as revokeFallback } from "../functions/api/team/invitations/revoke.js";
import { hashInviteToken } from "../functions/_shared/team.js";

const HOTEL_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const INVITE_ID = "44444444-4444-4444-8444-444444444444";
const baseEnv = {
  SUPABASE_URL:"https://mock.supabase.test",
  SUPABASE_SECRET_KEY:"server-key",
};
const enabledEnv = { ...baseEnv, TEAM_ONBOARDING_ENABLED:"true" };

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}})}
async function read(r){return JSON.parse(await r.text())}
async function withFetch(mock,fn){const old=globalThis.fetch;globalThis.fetch=mock;try{return await fn()}finally{globalThis.fetch=old}}

function ownerUser(overrides={}) {
  return { id:OWNER_ID, email:"owner@example.com", email_confirmed_at:"2026-09-24T00:00:00Z", ...overrides };
}
function memberUser(overrides={}) {
  return { id:USER_ID, email:"manager@example.com", email_confirmed_at:"2026-09-24T00:00:00Z", ...overrides };
}
function createReq(body={},headers={}) {
  return new Request("https://staypilot.test/api/team/invitations",{
    method:"POST",
    headers:{"content-type":"application/json",authorization:"Bearer owner-session",...headers},
    body:JSON.stringify({hotel_id:HOTEL_ID,email:"Manager@Example.com",role:"manager",...body}),
  });
}
function acceptReq(body={},headers={}) {
  return new Request("https://staypilot.test/api/team/invitations/accept",{
    method:"POST",
    headers:{"content-type":"application/json",authorization:"Bearer member-session",...headers},
    body:JSON.stringify(body),
  });
}
function revokeReq(body={},headers={}) {
  return new Request("https://staypilot.test/api/team/invitations/revoke",{
    method:"POST",
    headers:{"content-type":"application/json",authorization:"Bearer owner-session",...headers},
    body:JSON.stringify({hotel_id:HOTEL_ID,invite_id:INVITE_ID,...body}),
  });
}
function ownerAuthFetch(extra) {
  return async (url,options={}) => {
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json(ownerUser());
    if(p==="/rest/v1/hotel_members") return json([{hotel_id:HOTEL_ID,user_id:OWNER_ID,role:"owner"}]);
    if(extra) return extra(url,options);
    throw new Error("unexpected fetch "+p);
  };
}

// Fail closed without backend and with feature disabled.
{
  let r=await createInvite({request:createReq(),env:{}});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"backend_not_configured");
  r=await createInvite({request:createReq(),env:baseEnv});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"team_onboarding_disabled");
  r=await acceptInvite({request:acceptReq({token:"A".repeat(43)}),env:baseEnv});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"team_onboarding_disabled");
}

// Invalid role/email/lifetime are rejected before authentication or RPC.
{
  const cases=[
    [{role:"owner"},"invalid_invite_role"],
    [{email:"not-an-email"},"invalid_invite_email"],
    [{expires_in_hours:200},"invalid_invite_lifetime"],
  ];
  for(const [body,error] of cases){
    let fetched=false;
    const r=await withFetch(async()=>{fetched=true;throw new Error("must not fetch")},()=>createInvite({request:createReq(body),env:enabledEnv}));
    assert.equal(r.status,400); assert.equal((await read(r)).error,error); assert.equal(fetched,false);
  }
}

// Missing owner session is rejected.
{
  const req=createReq({}, {authorization:""});
  const r=await withFetch(async()=>{throw new Error("must not fetch")},()=>createInvite({request:req,env:enabledEnv}));
  assert.equal(r.status,401); assert.equal((await read(r)).error,"authentication_required");
}

// Non-owner cannot create an invitation.
{
  const r=await withFetch(async (url)=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json(ownerUser());
    if(p==="/rest/v1/hotel_members") return json([]);
    throw new Error("unexpected");
  },()=>createInvite({request:createReq(),env:enabledEnv}));
  assert.equal(r.status,403); assert.equal((await read(r)).error,"owner_role_required");
}

// Confirmed Owner creates invitation; RPC receives only token hash and server-derived normalized inputs.
let rawToken;
{
  let rpcBody=null;
  const before=Date.now();
  const r=await withFetch(ownerAuthFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/rest/v1/rpc/create_team_invitation"){
      rpcBody=JSON.parse(options.body);
      return json({
        id:INVITE_ID,hotel_id:HOTEL_ID,email:"manager@example.com",role:"manager",
        status:"pending",created_at:"2026-09-24T00:00:00Z",expires_at:rpcBody.invite_expires_at
      });
    }
    throw new Error("unexpected "+p);
  }),()=>createInvite({request:createReq(),env:enabledEnv}));

  assert.equal(r.status,201);
  const body=await read(r);
  rawToken=body.invite_token;
  assert.match(rawToken,/^[A-Za-z0-9_-]{32,100}$/);
  assert.equal(body.delivery,"manual_demo");
  assert.equal(rpcBody.owner_uuid,OWNER_ID);
  assert.equal(rpcBody.hotel_uuid,HOTEL_ID);
  assert.equal(rpcBody.invite_email,"manager@example.com");
  assert.equal(rpcBody.invite_role,"manager");
  assert.equal(rpcBody.invite_token,undefined);
  assert.equal(rpcBody.invite_token_hash,await hashInviteToken(rawToken));
  assert.notEqual(rpcBody.invite_token_hash,rawToken);
  const expiry=Date.parse(rpcBody.invite_expires_at);
  assert.ok(expiry >= before + 71*60*60*1000 && expiry <= before + 73*60*60*1000);
}

// Pending duplicate and existing-member conflicts map safely.
{
  for(const [message,error] of [["invite_already_pending","invite_already_pending"],["team_member_already_exists","team_member_already_exists"]]){
    const r=await withFetch(ownerAuthFetch(async (url)=>{
      if(new URL(String(url)).pathname==="/rest/v1/rpc/create_team_invitation") return json({message},400);
      throw new Error("unexpected");
    }),()=>createInvite({request:createReq(),env:enabledEnv}));
    assert.equal(r.status,409); assert.equal((await read(r)).error,error);
  }
}

// Owner can list invite metadata; token/hash never appears in response.
{
  const r=await withFetch(ownerAuthFetch(async (url)=>{
    if(new URL(String(url)).pathname==="/rest/v1/rpc/list_team_invitations"){
      return json([{id:INVITE_ID,hotel_id:HOTEL_ID,email:"manager@example.com",role:"manager",status:"pending",expires_at:"2026-09-27T00:00:00Z"}]);
    }
    throw new Error("unexpected");
  }),()=>listInvites({
    request:new Request(`https://staypilot.test/api/team/invitations?hotel_id=${HOTEL_ID}`,{headers:{authorization:"Bearer owner-session"}}),
    env:enabledEnv
  }));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.invitations.length,1);
  assert.equal(body.invitations[0].role,"manager");
  assert.equal(JSON.stringify(body).includes("token_hash"),false);
  assert.equal(JSON.stringify(body).includes(rawToken),false);
}

// Phone-confirmed / unconfirmed-email account cannot accept an email invitation.
{
  const r=await withFetch(async url=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json({id:USER_ID,email:"manager@example.com",phone_confirmed_at:"2026-09-24T00:00:00Z"});
    throw new Error("unexpected");
  },()=>acceptInvite({request:acceptReq({token:rawToken}),env:enabledEnv}));
  assert.equal(r.status,403); assert.equal((await read(r)).error,"confirmed_email_required");
}

// Confirmed invitee acceptance binds authenticated email and sends no client role to RPC.
{
  let rpcBody=null;
  const r=await withFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json(memberUser());
    if(p==="/rest/v1/rpc/accept_team_invitation"){
      rpcBody=JSON.parse(options.body);
      return json({ok:true,hotel_id:HOTEL_ID,user_id:USER_ID,role:"manager",invite_id:INVITE_ID});
    }
    throw new Error("unexpected "+p);
  },()=>acceptInvite({request:acceptReq({token:rawToken,role:"owner",hotel_id:"99999999-9999-4999-8999-999999999999"}),env:enabledEnv}));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.role,"manager");
  assert.equal(rpcBody.user_uuid,USER_ID);
  assert.equal(rpcBody.user_email,"manager@example.com");
  assert.equal(rpcBody.invite_token_hash,await hashInviteToken(rawToken));
  assert.equal(rpcBody.role,undefined);
  assert.equal(rpcBody.hotel_id,undefined);
}

// Email mismatch / used / member conflict map safely.
{
  const cases=[
    ["invite_email_mismatch",403,"invite_email_mismatch"],
    ["invite_already_used",409,"invite_already_used"],
    ["team_member_already_exists",409,"team_member_already_exists"],
  ];
  for(const [message,status,error] of cases){
    const r=await withFetch(async (url)=>{
      const p=new URL(String(url)).pathname;
      if(p==="/auth/v1/user") return json(memberUser());
      if(p==="/rest/v1/rpc/accept_team_invitation") return json({message},400);
      throw new Error("unexpected");
    },()=>acceptInvite({request:acceptReq({token:rawToken}),env:enabledEnv}));
    assert.equal(r.status,status); assert.equal((await read(r)).error,error);
  }
}

// Expired invitation result maps to 410 without membership success.
{
  const r=await withFetch(async (url)=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json(memberUser());
    if(p==="/rest/v1/rpc/accept_team_invitation") return json({ok:false,error:"invite_expired"});
    throw new Error("unexpected");
  },()=>acceptInvite({request:acceptReq({token:rawToken}),env:enabledEnv}));
  assert.equal(r.status,410); assert.equal((await read(r)).error,"invite_expired");
}

// Owner revoke requires valid Owner session and maps idempotent revoke state.
{
  let rpcBody=null;
  const r=await withFetch(ownerAuthFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/rest/v1/rpc/revoke_team_invitation"){
      rpcBody=JSON.parse(options.body);
      return json({ok:true,revoked:true,id:INVITE_ID,hotel_id:HOTEL_ID,status:"revoked"});
    }
    throw new Error("unexpected");
  }),()=>revokeInvite({request:revokeReq(),env:enabledEnv}));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.revoked,true);
  assert.equal(rpcBody.owner_uuid,OWNER_ID);
  assert.equal(rpcBody.invite_uuid,INVITE_ID);
}

// Invalid token syntax is rejected before authentication.
{
  let fetched=false;
  const r=await withFetch(async()=>{fetched=true;throw new Error("must not fetch")},()=>acceptInvite({request:acceptReq({token:"short"}),env:enabledEnv}));
  assert.equal(r.status,400); assert.equal((await read(r)).error,"invalid_invite_token"); assert.equal(fetched,false);
}

// Method fallbacks remain narrow.
{
  const a=invitationsFallback(); assert.equal(a.status,405); assert.equal(a.headers.get("allow"),"GET, POST");
  const b=acceptFallback(); assert.equal(b.status,405); assert.equal(b.headers.get("allow"),"POST");
  const c=revokeFallback(); assert.equal(c.status,405); assert.equal(c.headers.get("allow"),"POST");
}

console.log("StayPilot secure team onboarding tests passed.");
