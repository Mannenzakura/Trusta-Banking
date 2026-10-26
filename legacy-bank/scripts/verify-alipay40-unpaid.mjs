import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4188';let cookie='';
async function call(body){const r=await fetch(base+'/api/bank',{method:'POST',headers:{origin:base,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const v=await r.json();if(!r.ok)console.log('API result',body.action,r.status,v.error);return {status:r.status,v};}
assert.equal((await call({action:'enterTest'})).status,200);
const created=await call({action:'alipayCreate',requestId:crypto.randomUUID()});assert.equal(created.status,200);assert.equal(new URL(created.v.paymentUrl).hostname,'openapi-sandbox.dl.alipaydev.com');
const query=await call({action:'alipayQuery',id:created.v.order.id});assert.equal(query.status,200);assert.equal(query.v.order.status,'created');
const refund=await call({action:'alipayRefund',id:created.v.order.id});assert.equal(refund.status,400);
console.log('PASS: actual sandbox signed query via bank API; unpaid refund rejected; no payment submitted.');
