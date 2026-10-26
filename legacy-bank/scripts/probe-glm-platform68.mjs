import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';
import {initialState,operate} from '../worker/bank-engine.mjs';
import {cloudChat62} from '../worker/bank-cloud-ai62.mjs';
import {acceptAI} from '../worker/bank-ai.mjs';
const file=process.argv.find(a=>a.startsWith('--key-file='))?.slice(11);if(!file)throw Error('Local key file required');
const db=new DatabaseSync('<LOCAL_USER>/.bank-local-secrets/glm-paid-test-budget.sqlite');
for(const f of ['0015_bank_ai_budget.sql','0016_bank_glm_queue.sql','0017_bank_glm_paid_budget.sql'])db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
const env={BANK_GLM_FREE:'enabled',BANK_GLM_TRIAL:'verified-5m',BANK_GLM_MODEL:process.argv.find(a=>a.startsWith('--model='))?.slice(8)||'glm-4.7-flash',GLM_API_KEY:readFileSync(file,'utf8').trim(),DB:{prepare(sql){return{bind(...args){return{async run(){return{meta:db.prepare(sql).run(...args)}},async first(){return db.prepare(sql).get(...args)}}}}}}};
const cases=[['缴费','用日常生活卡交水费，使用默认户号，先给我确认，不要直接扣款','lifeBill'],['转账','用日常生活卡给林晓转账20元，先给我确认','transfer'],['查询余额','查询银行卡余额',null],['理财目录','查看理财产品',null],['查询订单','查询生活订单',null],['订票创建','选择测试报价 offer-test，为 TEST-ABC 成人创建虚拟机票订单，先让我确认，不要付款','virtualFlightCreate']];
let failed=false;
try{for(const [name,text,operation] of cases.filter(c=>!process.argv.some(a=>a.startsWith('--case='))||c[0]===process.argv.find(a=>a.startsWith('--case=')).slice(7))){
 const s=initialState();s.testMode=true;if(operation==='virtualFlightCreate')s.virtualFlightOffers=[{id:'offer-test',flight:{number:'TEST000',from:'SZX',to:'SHA',departure:'2026-11-01'},cabin:{name:'经济舱'},unit:10000,expires:Date.now()+600000}];const before=s.balance;const start=Date.now();
 await cloudChat62(s,env,'isolated-test',text);
 const status=s.ai.lastStatus;
 if(status!=='已返回'){console.log(JSON.stringify({name,ok:false,status,message:s.messages.at(-1)?.text,ms:Date.now()-start}));failed=true;continue;}
 assert.equal(s.balance,before);assert.equal(s.pending,null);
 if(operation){assert.equal(s.ai.draft?.operation.type,operation);acceptAI(s,s.ai.draft.id);assert.equal(s.balance,before);operate(s,{action:'confirm',id:s.pending.id,pin:true});if(operation==='virtualFlightCreate'){assert.equal(s.balance,before);assert.equal(s.virtualFlightOrders.length,1);assert.equal(s.virtualFlightOrders[0].status,'pending');}else assert.ok(s.balance<before);assert.ok(s.receipts.length>0);}
 console.log(JSON.stringify({name,ok:true,virtualOnly:true,ms:Date.now()-start}));
}}
catch(e){failed=true;console.log(JSON.stringify({ok:false,error:e.name==='AssertionError'?'业务断言失败':e.message}));}
finally{console.log(JSON.stringify({budgetReservedFen:db.prepare('SELECT reserved_fen FROM bank_glm_paid_budget WHERE id=1').get().reserved_fen}));db.close();}process.exitCode=failed?1:0;
