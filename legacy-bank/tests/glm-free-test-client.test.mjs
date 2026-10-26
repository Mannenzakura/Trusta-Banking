import test from 'node:test';
import assert from 'node:assert/strict';
import {createFreeTestClient} from '../scripts/glm-free-test-client.mjs';
const reply=(status,data)=>new Response(JSON.stringify(data),{status});
test('test queue serializes calls and fixes free model and official endpoint',async()=>{
 let active=0,peak=0,calls=0;
 const request=createFreeTestClient({key:'fixture',sleep:async()=>{},fetcher:async(url,opts)=>{
  assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');assert.equal(JSON.parse(opts.body).model,'glm-4.7-flash');
  active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;calls++;return reply(200,{choices:[]});
 }});
 await Promise.all([request([]),request([]),request([])]);assert.equal(peak,1);assert.equal(calls,3);
});
test('provider overload retries finitely then fails without paid fallback',async()=>{
 let calls=0;const delays=[];
 const request=createFreeTestClient({key:'fixture',sleep:async ms=>delays.push(ms),fetcher:async()=>{calls++;return reply(429,{error:{code:'1305'}});}});
 await assert.rejects(request([]),/1305.*供应商模型过载/);assert.equal(calls,3);assert.deepEqual(delays.slice(0,2),[15000,30000]);
});
test('invalid credentials are never retried and queue recovers',async()=>{
 let calls=0;const request=createFreeTestClient({key:'fixture',sleep:async()=>{},fetcher:async()=>++calls===1?reply(401,{error:{code:'1000'}}):reply(200,{ok:true})});
 await assert.rejects(request([]),/401/);assert.deepEqual(await request([]),{ok:true});assert.equal(calls,2);
});
