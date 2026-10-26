import{readFileSync}from'node:fs';import assert from'node:assert/strict';
const cookie=readFileSync('<LOCAL_USER>/.bank-local-secrets/online-test-cookie.txt','utf8');
async function call(body){const r=await fetch('https://mannenzakura.cn/api/bank',{method:'POST',headers:{Origin:'https://mannenzakura.cn','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});const j=await r.json();if(!r.ok||j.error)throw Error(j.error||('HTTP '+r.status));return j;}
let s=await call({action:'init'});const before=s.state.cards.map(c=>({id:c.id,balance:c.balance}));
if(process.argv.includes('--transfer'))s=await call({action:'chat',text:'用日常生活卡给林晓转账20元，先给我确认，不要直接扣款'});
assert.equal(s.state.ai.lastStatus,'已返回',s.state.messages.at(-1)?.text);assert.ok(s.state.ai.draft);assert.equal(s.state.pending,null);assert.deepEqual(s.state.cards.map(c=>({id:c.id,balance:c.balance})),before);
const type=s.state.ai.draft.operation.type;s=await call({action:'aiAccept',id:s.state.ai.draft.id});assert.deepEqual(s.state.cards.map(c=>({id:c.id,balance:c.balance})),before);assert.ok(s.state.pending);
s=await call({action:'confirm',id:s.state.pending.id});assert.ok(s.receipt);assert.ok(s.state.cards.some((c,i)=>c.balance<before[i].balance));console.log(JSON.stringify({online:true,type,confirmedVirtualOnly:true,receipt:!!s.receipt}));
