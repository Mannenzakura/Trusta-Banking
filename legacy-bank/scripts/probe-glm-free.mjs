// Isolated compatibility probe. Never deploys or touches an online account.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initialState} from '../worker/bank-engine.mjs';
import {messages62,parse62} from '../worker/bank-cloud-ai62.mjs';
import {applyAIPlan} from '../worker/bank-ai.mjs';
import {createFreeTestClient} from './glm-free-test-client.mjs';

const offline=process.argv.includes('--offline');
const selected=process.argv.find(x=>x.startsWith('--case='))?.slice(7);
const keyPath=process.argv.find(x=>x.startsWith('--key-file='))?.slice(11);
if(!offline&&!keyPath)throw Error('Provide --key-file=<local ordinary API key file> or --offline; never paste a key as an argument.');
const key=offline?'':(await readFile(keyPath,'utf8')).trim();
if(!offline&&(!key||/\s/.test(key)))throw Error('Key file must contain only the API key.');
const request=createFreeTestClient({key});
const cases=[
 {name:'balance',text:'查一下我的银行卡余额',plan:{tool:'accounts',args:{}},tool:'accounts'},
 {name:'flight-clarification',text:'帮我订一张机票',plan:{tool:'clarify',args:{question:'请告诉我出发城市、目的地和出发日期。'}},tool:'clarify'},
 {name:'payment-draft',text:'用日常生活卡交水费，使用默认户号，先给我确认，不要直接扣款',plan:{tool:'lifeBill',args:{biller:'water',source:'card-main'}},tool:'lifeBill'},
];
let failed=0;
for(const c of cases){
 if(selected&&c.name!==selected)continue;
 const s=initialState();s.testMode=true;
 const before=JSON.stringify({balance:s.balance,cards:s.cards,transactions:s.transactions,receipts:s.receipts,pending:s.pending});
 const start=Date.now();
 try{
  let result;
  if(offline)result={choices:[{message:{content:JSON.stringify(c.plan)}}]};
  else{
   result=await request(messages62(s,c.text));
  }
  const p=parse62(result);assert.equal(p.tool,c.tool);
  applyAIPlan(s,p);
  assert.equal(JSON.stringify({balance:s.balance,cards:s.cards,transactions:s.transactions,receipts:s.receipts,pending:s.pending}),before);
  if(c.tool==='lifeBill')assert.equal(s.ai.draft.operation.type,'lifeBill');
  console.log(JSON.stringify({case:c.name,mode:offline?'fixture-only':'live-free-model',ok:true,tool:p.tool,ms:Date.now()-start}));
 }catch(e){failed++;console.log(JSON.stringify({case:c.name,ok:false,error:e.name==='AssertionError'?'compatibility assertion failed':e.message,ms:Date.now()-start}));if(!offline)break;}
}
process.exitCode=failed?1:0;
