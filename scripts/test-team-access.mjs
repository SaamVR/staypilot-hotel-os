import assert from "node:assert/strict";
import { onRequestGet as listMembers, onRequest as membersFallback } from "../functions/api/team/members.js";
import { onRequestPost as updateRole, onRequest as roleFallback } from "../functions/api/team/members/role.js";
import { onRequestPost as removeMember, onRequest as removeFallback } from "../functions/api/team/members/remove.js";

const HOTEL_ID="22222222-2222-4222-8222-222222222222";
const OWNER_ID="11111111-1111-4111-8111-111111111111";
const MEMBER_ID="33333333-3333-4333-8333-333333333333";
const baseEnv={SUPABASE_URL:"https://mock.supabase.test",SUPABASE_SECRET_KEY:"server-key"};
const enabledEnv={...baseEnv,TEAM_ONBOARDING_ENABLED:"true"};

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}})}
async function read(r){return JSON.parse(await r.text())}
async function withFetch(mock,fn){const old=globalThis.fetch;globalThis.fetch=mock;try{return await fn()}finally{globalThis.fetch=old}}
function owner(){return{id:OWNER_ID,email:"owner@example.com",email_confirmed_at:"2026-09-24T00:00:00Z"}}
function ownerFetch(extra){return async (url,options={})=>{const p=new URL(String(url)).pathname;if(p==="/auth/v1/user")return json(owner());if(p==="/rest/v1/hotel_members")return json([{hotel_id:HOTEL_ID,user_id:OWNER_ID,role:"owner"}]);if(extra)return extra(url,options);throw new Error("unexpected "+p)}}
function postReq(path,body,headers={}){return new Request("https://staypilot.test"+path,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer owner-session",...headers},body:JSON.stringify(body)})}

// All access lifecycle endpoints stay fail-closed with no backend / feature gate.
{
  let r=await listMembers({request:new Request(`https://staypilot.test/api/team/members?hotel_id=${HOTEL_ID}`),env:{}});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"backend_not_configured");
  r=await updateRole({request:postReq("/api/team/members/role",{hotel_id:HOTEL_ID,user_id:MEMBER_ID,role:"staff"}),env:baseEnv});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"team_onboarding_disabled");
  r=await removeMember({request:postReq("/api/team/members/remove",{hotel_id:HOTEL_ID,user_id:MEMBER_ID}),env:baseEnv});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"team_onboarding_disabled");
}

// Owner lists roster; server RPC receives authenticated Owner identity only.
{
  let rpcBody=null;
  const r=await withFetch(ownerFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/rest/v1/rpc/list_hotel_members"){
      rpcBody=JSON.parse(options.body);
      return json([
        {user_id:OWNER_ID,role:"owner",email:"owner@example.com",display_name:"Maya",joined_at:"2026-09-24T00:00:00Z"},
        {user_id:MEMBER_ID,role:"manager",email:"manager@example.com",display_name:"Sam",joined_at:"2026-09-24T00:10:00Z"}
      ]);
    }
    throw new Error("unexpected "+p);
  }),()=>listMembers({
    request:new Request(`https://staypilot.test/api/team/members?hotel_id=${HOTEL_ID}`,{headers:{authorization:"Bearer owner-session"}}),
    env:enabledEnv
  }));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.members.length,2);
  assert.equal(body.members[0].role,"owner");
  assert.equal(rpcBody.owner_uuid,OWNER_ID);
  assert.equal(rpcBody.hotel_uuid,HOTEL_ID);
}

// Missing / non-Owner session is denied.
{
  const noSession=await withFetch(async()=>{throw new Error("must not fetch")},()=>listMembers({
    request:new Request(`https://staypilot.test/api/team/members?hotel_id=${HOTEL_ID}`),env:enabledEnv
  }));
  assert.equal(noSession.status,401); assert.equal((await read(noSession)).error,"authentication_required");

  const nonOwner=await withFetch(async url=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user")return json(owner());
    if(p==="/rest/v1/hotel_members")return json([]);
    throw new Error("unexpected");
  },()=>updateRole({
    request:postReq("/api/team/members/role",{hotel_id:HOTEL_ID,user_id:MEMBER_ID,role:"staff"}),
    env:enabledEnv
  }));
  assert.equal(nonOwner.status,403); assert.equal((await read(nonOwner)).error,"owner_role_required");
}

// Owner changes Manager -> Staff; RPC receives only Manager/Staff role.
{
  let rpcBody=null;
  const r=await withFetch(ownerFetch(async (url,options={})=>{
    if(new URL(String(url)).pathname==="/rest/v1/rpc/update_team_member_role"){
      rpcBody=JSON.parse(options.body);
      return json({ok:true,changed:true,hotel_id:HOTEL_ID,user_id:MEMBER_ID,previous_role:"manager",role:"staff"});
    }
    throw new Error("unexpected");
  }),()=>updateRole({
    request:postReq("/api/team/members/role",{hotel_id:HOTEL_ID,user_id:MEMBER_ID,role:"staff"}),
    env:enabledEnv
  }));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.changed,true); assert.equal(body.member.role,"staff");
  assert.equal(rpcBody.owner_uuid,OWNER_ID);
  assert.equal(rpcBody.hotel_uuid,HOTEL_ID);
  assert.equal(rpcBody.member_user_uuid,MEMBER_ID);
  assert.equal(rpcBody.new_role,"staff");
}

// Client cannot promote anyone to Owner through the generic route.
{
  let fetched=false;
  const r=await withFetch(async()=>{fetched=true;throw new Error("must not fetch")},()=>updateRole({
    request:postReq("/api/team/members/role",{hotel_id:HOTEL_ID,user_id:MEMBER_ID,role:"owner"}),
    env:enabledEnv
  }));
  assert.equal(r.status,400); assert.equal((await read(r)).error,"invalid_member_role"); assert.equal(fetched,false);
}

// Owner membership is immutable through generic role/remove RPC mapping.
{
  for(const [handler,path,body] of [
    [updateRole,"/api/team/members/role",{hotel_id:HOTEL_ID,user_id:OWNER_ID,role:"staff"}],
    [removeMember,"/api/team/members/remove",{hotel_id:HOTEL_ID,user_id:OWNER_ID}],
  ]){
    const rpcName=handler===updateRole?"update_team_member_role":"remove_team_member";
    const r=await withFetch(ownerFetch(async url=>{
      if(new URL(String(url)).pathname===`/rest/v1/rpc/${rpcName}`) return json({message:"owner_role_immutable"},400);
      throw new Error("unexpected");
    }),()=>handler({request:postReq(path,body),env:enabledEnv}));
    assert.equal(r.status,409); assert.equal((await read(r)).error,"owner_role_immutable");
  }
}

// Missing member maps 404 and concurrent mutation maps 409.
{
  for(const [message,status,error] of [
    ["team_member_not_found",404,"team_member_not_found"],
    ["team_member_changed_concurrently",409,"team_member_changed_concurrently"],
  ]){
    const r=await withFetch(ownerFetch(async url=>{
      if(new URL(String(url)).pathname==="/rest/v1/rpc/update_team_member_role") return json({message},400);
      throw new Error("unexpected");
    }),()=>updateRole({request:postReq("/api/team/members/role",{hotel_id:HOTEL_ID,user_id:MEMBER_ID,role:"manager"}),env:enabledEnv}));
    assert.equal(r.status,status); assert.equal((await read(r)).error,error);
  }
}

// Owner removes Manager/Staff membership via service RPC.
{
  let rpcBody=null;
  const r=await withFetch(ownerFetch(async (url,options={})=>{
    if(new URL(String(url)).pathname==="/rest/v1/rpc/remove_team_member"){
      rpcBody=JSON.parse(options.body);
      return json({ok:true,removed:true,hotel_id:HOTEL_ID,user_id:MEMBER_ID,previous_role:"manager"});
    }
    throw new Error("unexpected");
  }),()=>removeMember({
    request:postReq("/api/team/members/remove",{hotel_id:HOTEL_ID,user_id:MEMBER_ID}),
    env:enabledEnv
  }));
  assert.equal(r.status,200);
  const body=await read(r);
  assert.equal(body.removed,true); assert.equal(body.member.previous_role,"manager");
  assert.equal(rpcBody.owner_uuid,OWNER_ID);
  assert.equal(rpcBody.member_user_uuid,MEMBER_ID);
}

// Invalid member UUID is rejected before authentication/RPC.
{
  let fetched=false;
  const r=await withFetch(async()=>{fetched=true;throw new Error("must not fetch")},()=>removeMember({
    request:postReq("/api/team/members/remove",{hotel_id:HOTEL_ID,user_id:"not-a-uuid"}),
    env:enabledEnv
  }));
  assert.equal(r.status,400); assert.equal((await read(r)).error,"invalid_member_user_id"); assert.equal(fetched,false);
}

// Method surfaces stay narrow.
{
  const a=membersFallback(); assert.equal(a.status,405); assert.equal(a.headers.get("allow"),"GET");
  const b=roleFallback(); assert.equal(b.status,405); assert.equal(b.headers.get("allow"),"POST");
  const c=removeFallback(); assert.equal(c.status,405); assert.equal(c.headers.get("allow"),"POST");
}

console.log("StayPilot secure team access lifecycle tests passed.");
