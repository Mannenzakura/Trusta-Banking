import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {glmRequest68} from '../worker/bank-glm68.mjs';
const toolResponse=()=>({choices:[{message:{tool_calls:[{function:{name:'accounts',arguments:'{}'}}]}}]});
function fixture(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0016_bank_glm_queue.sql',import.meta.url),'utf8'));return{db,env:{BANK_GLM_FREE:'enabled',GLM_API_KEY:'test',DB:{prepare(sql){return{bind(...a){return{async run(){return db.prepare(sql).run(...a)},async first(){return db.prepare(sql).get(...a)}}}}}}}};}
test('shared queue admits head only and releases without storing prompts or keys',async()=>{
 const {db,env}=fixture();let calls=0;
 const result=await glmRequest68(env,[{role:'user',content:'test'}],{now:()=>100,fetcher:async(url,o)=>{calls++;assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');assert.equal(o.redirect,'manual');assert.equal(JSON.parse(o.body).model,'glm-4.7-flash');assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_glm_queue').get().n,1);return Response.json(toolResponse());}});
 assert.deepEqual(JSON.parse(result.choices[0].message.content),{tool:'accounts',args:{}});assert.equal(calls,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_glm_queue').get().n,0);assert.equal(db.prepare('SELECT until_ms FROM bank_glm_gate').get().until_ms,60100);db.close();
});
test('other instance lease blocks request and wait is bounded',async()=>{
 const {db,env}=fixture();db.exec("UPDATE bank_glm_gate SET owner='other',until_ms=90000");let t=0,calls=0;
 await assert.rejects(glmRequest68(env,[],{now:()=>t,sleep:async ms=>t+=ms,fetcher:async()=>calls++}),/排队/);assert.equal(calls,0);assert.equal(db.prepare('SELECT owner FROM bank_glm_gate').get().owner,'other');assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_glm_queue').get().n,0);db.close();
});
test('overload does not retry and starts five minute cooldown, never falls back or leaks response',async()=>{
 const {db,env}=fixture();let t=0,calls=0;
 await assert.rejects(glmRequest68(env,[],{now:()=>t,sleep:async ms=>t+=ms,fetcher:async()=>{calls++;return Response.json({error:{code:'1305',message:'secret upstream'}},{status:429});}}),e=>/过载/.test(e.message)&&!e.message.includes('secret'));
 assert.equal(calls,1);assert.equal(db.prepare('SELECT until_ms FROM bank_glm_gate').get().until_ms,300000);db.close();
});
test('expired jobs are reclaimed; full queue rejected without model call',async()=>{
 const {db,env}=fixture();for(let i=0;i<8;i++)db.prepare('INSERT INTO bank_glm_queue(id,expires) VALUES(?,?)').run('q'+i,99999);
 await assert.rejects(glmRequest68(env,[],{now:()=>1}),/已满/);db.exec('UPDATE bank_glm_queue SET expires=0');
 await glmRequest68(env,[],{now:()=>1,fetcher:async()=>Response.json(toolResponse())});assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_glm_queue').get().n,0);db.close();
});

test('paid model is blocked before fetch and malformed tool output fails closed',async()=>{
 const {db,env}=fixture();let calls=0;
 await assert.rejects(glmRequest68({...env,BANK_GLM_MODEL:'glm-5'},[],{fetcher:async()=>calls++}),/免费/);assert.equal(calls,0);
 await assert.rejects(glmRequest68(env,[],{fetcher:async()=>Response.json({choices:[{message:{tool_calls:[{function:{name:'unauthorized',arguments:'{}'}}]}}]})}),/有效/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM bank_glm_queue').get().n,0);db.close();
});

test('previous paid opt-in cannot enable paid model in free deployment',async()=>{const {db,env}=fixture();let calls=0;await assert.rejects(glmRequest68({...env,BANK_GLM_MODEL:'glm-5.3-flash',BANK_GLM_PAID:'budget-1yuan'},[],{fetcher:async()=>calls++}),/免费/);assert.equal(calls,0);db.close();});

test('trial token reservation persists and blocks beyond token cap',async()=>{const {db,env}=fixture();db.exec(readFileSync(new URL('../drizzle/0018_bank_glm_token_budget.sql',import.meta.url),'utf8'));const e={...env,BANK_GLM_MODEL:'glm-5.3-flash',BANK_GLM_TRIAL:'verified-5m'};let calls=0;await glmRequest68(e,[],{now:()=>1,fetcher:async()=>{calls++;return Response.json(toolResponse())}});assert.ok(db.prepare('SELECT reserved FROM bank_glm_token_budget').get().reserved>0);db.exec('UPDATE bank_glm_token_budget SET reserved=4000000');await assert.rejects(glmRequest68(e,[],{now:()=>70000,fetcher:async()=>calls++}),/Token/);assert.equal(calls,1);db.close();});

test('edge-compatible redirect handling never follows credential redirects',async()=>{const {db,env}=fixture();let calls=0;await assert.rejects(glmRequest68(env,[],{fetcher:async(url,o)=>{calls++;assert.equal(o.redirect,'manual');const body=JSON.parse(o.body);assert.equal(body.tools.find(t=>t.function.name==='transfer').function.parameters.additionalProperties,false);return new Response('',{status:302,headers:{location:'https://example.invalid'}})}}),/重定向/);assert.equal(calls,1);db.close();});
