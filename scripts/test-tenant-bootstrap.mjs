import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "../functions/api/tenant-bootstrap.js";
import { onRequestPost as legacyPost } from "../functions/api/hotels/bootstrap.js";

const baseEnv = {
  SUPABASE_URL:"https://mock.supabase.test",
  SUPABASE_SECRET_KEY:"server-key",
};
const enabledEnv = { ...baseEnv, TENANT_BOOTSTRAP_ENABLED:"true" };

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}})}
async function read(r){return JSON.parse(await r.text())}
async function withFetch(mock,fn){const old=globalThis.fetch;globalThis.fetch=mock;try{return await fn()}finally{globalThis.fetch=old}}

function req(body={},headers={}){
  return new Request("https://staypilot.test/api/tenant-bootstrap",{
    method:"POST",
    headers:{"content-type":"application/json","x-staypilot-idempotency-key":"onboard_test_001",...headers},
    body:JSON.stringify({hotel_slug:"harbor-house",hotel_name:"Harbor House",timezone:"Asia/Dhaka",currency:"BDT",...body})
  });
}

// Fail closed without backend.
{
  const r=await onRequestPost({request:req(),env:{}});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"backend_not_configured");
}

// Credentials alone do not enable onboarding.
{
  const r=await onRequestPost({request:req(),env:baseEnv});
  assert.equal(r.status,503); assert.equal((await read(r)).error,"tenant_bootstrap_disabled");
}

// Missing session is rejected.
{
  const r=await withFetch(async()=>{throw new Error("must not fetch")},()=>onRequestPost({request:req(),env:enabledEnv}));
  assert.equal(r.status,401); assert.equal((await read(r)).error,"authentication_required");
}

// Unconfirmed account cannot create a tenant.
{
  const r=await withFetch(async url=>{
    if(new URL(String(url)).pathname==="/auth/v1/user") return json({id:"11111111-1111-4111-8111-111111111111"});
    throw new Error("unexpected fetch");
  },()=>onRequestPost({request:req({}, {authorization:"Bearer session"}),env:enabledEnv}));
  assert.equal(r.status,403); assert.equal((await read(r)).error,"account_verification_required");
}

// Authenticated confirmed account is the only identity passed to the service-role RPC.
{
  const r=await withFetch(async (url,options={})=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json({id:"11111111-1111-4111-8111-111111111111",email_confirmed_at:"2026-09-24T00:00:00Z"});
    if(p==="/rest/v1/rpc/bootstrap_hotel_owner"){
      const b=JSON.parse(options.body);
      assert.equal(b.user_uuid,"11111111-1111-4111-8111-111111111111");
      assert.equal(b.idempotency_key,"onboard_test_001");
      assert.equal(b.hotel_slug,"harbor-house");
      assert.equal(b.hotel_name,"Harbor House");
      assert.equal(b.hotel_timezone,"Asia/Dhaka");
      assert.equal(b.hotel_currency,"BDT");
      assert.equal(b.role,undefined);
      return json({created:true,hotel:{id:"22222222-2222-4222-8222-222222222222",slug:"harbor-house",name:"Harbor House",timezone:"Asia/Dhaka",currency:"BDT",automation_paused:true},role:"owner",automation_rules_seeded:12});
    }
    throw new Error("unexpected fetch "+p);
  },()=>onRequestPost({
    request:req({user_id:"99999999-9999-4999-8999-999999999999",role:"owner"},{authorization:"Bearer session"}),
    env:enabledEnv
  }));
  assert.equal(r.status,201);
  const body=await read(r);
  assert.equal(body.created,true); assert.equal(body.role,"owner"); assert.equal(body.automation_rules_seeded,12); assert.equal(body.automation_paused,true);
}

// Replay is 200, and reused key with different request maps to 409.
{
  const mockUser={id:"11111111-1111-4111-8111-111111111111",confirmed_at:"2026-09-24T00:00:00Z"};
  const replay=await withFetch(async (url)=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json(mockUser);
    if(p==="/rest/v1/rpc/bootstrap_hotel_owner") return json({created:false,hotel:{id:"22222222-2222-4222-8222-222222222222",automation_paused:true},role:"owner",automation_rules_seeded:0});
    throw new Error("unexpected");
  },()=>onRequestPost({request:req({}, {authorization:"Bearer session"}),env:enabledEnv}));
  assert.equal(replay.status,200); assert.equal((await read(replay)).created,false);

  const conflict=await withFetch(async (url)=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json(mockUser);
    if(p==="/rest/v1/rpc/bootstrap_hotel_owner") return json({message:"idempotency_key_reused"},400);
    throw new Error("unexpected");
  },()=>onRequestPost({request:req({hotel_name:"Different Hotel"},{authorization:"Bearer session"}),env:enabledEnv}));
  assert.equal(conflict.status,409); assert.equal((await read(conflict)).error,"idempotency_key_reused");
}

// Slug collision maps to 409.
{
  const r=await withFetch(async (url)=>{
    const p=new URL(String(url)).pathname;
    if(p==="/auth/v1/user") return json({id:"11111111-1111-4111-8111-111111111111",confirmed_at:"2026-09-24T00:00:00Z"});
    if(p==="/rest/v1/rpc/bootstrap_hotel_owner") return json({message:"hotel_slug_taken"},400);
    throw new Error("unexpected");
  },()=>onRequestPost({request:req({}, {authorization:"Bearer session"}),env:enabledEnv}));
  assert.equal(r.status,409); assert.equal((await read(r)).error,"hotel_slug_taken");
}

// Legacy route is the same hardened handler; non-POST remains closed.
assert.equal(legacyPost,onRequestPost);
const fallback=onRequest(); assert.equal(fallback.status,405); assert.equal(fallback.headers.get("allow"),"POST");

console.log("StayPilot tenant bootstrap HTTP tests passed.");
