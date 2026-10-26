import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:4186';let cookie='';
async function call(body){const r=await fetch(origin+'/api/bank',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();assert.equal(r.status,200,d.error);return d;}
async function run(operation){const p=await call({action:'prepare',operation});const d=await call({action:'confirm',id:p.state.pending.id});assert.equal(d.bookStatus.balanced,true);return d;}
await call({action:'enterTest'});
try {
 let d=await call({action:'init'}),cash=d.state.balance;
 d=await run({type:'fxTrade',currency:'USD',side:'buy',amount:10});assert.equal(d.state.fxWallets[0].units,1000);
 d=await run({type:'fxTrade',currency:'USD',side:'sell',amount:10});assert.equal(d.state.balance,cash);
 await call({action:'risk',answers:Array(10).fill(5)});
 d=await run({type:'buy',product:'index',amount:100});const cancelled=d.state.fundOrders[0].id;
 d=await run({type:'fundCancel',order:cancelled});assert.equal(d.state.balance,cash);
 d=await run({type:'buy',product:'index',amount:100});const order=d.state.fundOrders[0].id;
 d=await run({type:'clock',days:1});assert.equal(d.state.fundOrders.find(o=>o.id===order).status,'settled');
 const h=d.state.holdings.find(h=>h.id===d.state.fundOrders.find(o=>o.id===order).holding);
 d=await run({type:'redeem',holding:h.id});assert.equal(d.receipt.amount,9940);assert.equal(d.receipt.fee,10);assert.equal(d.state.holdings.some(x=>x.id===h.id),false);
 const date=new Date(d.state.now+3*86400000).toISOString().slice(0,10);
 d=await run({type:'bookingCreate',product:'movie',date,slot:'A1'});let booking=d.state.bookings[0];
 d=await run({type:'bookingCancel',order:booking.id});assert.equal(d.state.bookings[0].status,'cancelled');assert.ok(d.receipt.lines.some(x=>x.includes('39.00')));
 d=await run({type:'bookingCreate',product:'hotel',date,slot:'标准房'});booking=d.state.bookings[0];
 d=await run({type:'clock',days:3});d=await run({type:'bookingUse',order:booking.id});assert.equal(d.state.bookings[0].status,'used');
 d=await run({type:'lifeBuy',store:'food'});d=await run({type:'lifeUse',order:d.state.life.orders[0].id});
 d=await run({type:'parcelClaim',destination:'TEST-HOME-001'});d=await run({type:'parcelCancel',order:d.state.parcels[0].id});
 d=await run({type:'parcelClaim',destination:'TEST-HOME-001'});const parcel=d.state.parcels[0].id;await run({type:'parcelAdvance',order:parcel});d=await run({type:'parcelAdvance',order:parcel});assert.equal(d.state.parcels[0].status,'received');
 d=await run({type:'serviceCase',topic:'生活与权益',message:'核查测试订单',receipt:d.receipt.id});d=await run({type:'caseReview',caseId:d.state.cases[0].id});assert.equal(d.state.cases[0].status,'reviewed');
 // Deterministic model-response fixture verifies the bridge protocol, not real inference.
 const pair=await call({action:'aiPair'});await call({action:'chat',text:'测试分步办理'});const job=await call({action:'bridgePoll',token:pair.pairToken});
 d=await call({action:'bridgeResult',token:pair.pairToken,jobId:job.job.id,lease:job.job.lease,plan:{steps:[{tool:'fxTrade',args:{currency:'USD',side:'buy',amount:1}},{tool:'depositOpen',args:{amount:50,term:30}}]}});assert.equal(d.status,'completed');
 d=await call({action:'init'});const before=d.state.balance;d=await call({action:'aiAccept',id:d.state.ai.draft.id});assert.equal(d.state.balance,before);
 d=await call({action:'confirm',id:d.state.pending.id});d=await call({action:'aiNext'});assert.equal(d.state.ai.sequence.index,1);
 d=await call({action:'aiAccept',id:d.state.ai.draft.id});d=await call({action:'confirm',id:d.state.pending.id});d=await call({action:'aiNext'});assert.equal(d.state.ai.sequence,undefined);assert.equal(d.bookStatus.balanced,true);
 console.log('PASS: FX round trip; fund cancellation, settlement and net redemption; booking cancel/use; points shipping; case review; AI bridge sequence fixture; persisted balanced ledger.');
} finally {await call({action:'exitTest'});}
