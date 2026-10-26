import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,prepare,confirm,tick} from '../worker/bank-engine.mjs';
import {ensureBook,postBook,verifyBook} from '../worker/bank-book.mjs';
import {applyAIPlan,acceptAI,nextAI} from '../worker/bank-ai.mjs';
import {businessRecords,recordState} from '../public/bank/business32.js';
const fresh=()=>{const s=initialState(Date.UTC(2026,9,12));s.risk=5;s.riskAt=s.now;s.riskAssessment={answers:Array(10).fill(5)};s.subscriptions=[];ensureBook(s);return s;};
const run=(s,i)=>{const r=confirm(s,prepare(s,i).id,true);postBook(s,i.type,r.receipt.id);return r;};
test('FX purchase, partial sale, complete sale preserve segregated currency and balanced cost ledger',()=>{
 const s=fresh(),cash=s.balance;run(s,{type:'fxTrade',currency:'USD',side:'buy',amount:100});assert.equal(s.balance,cash-72000);assert.equal(s.fxWallets[0].units,10000);
 run(s,{type:'fxTrade',currency:'USD',side:'sell',amount:40});assert.equal(s.fxWallets[0].cost,43200);const r=run(s,{type:'fxTrade',currency:'USD',side:'sell',amount:60});assert.equal(s.balance,cash);assert.equal(s.fxWallets[0].units,0);assert.equal(confirm(s,r.receipt.id,true).duplicate,true);verifyBook(s);
 assert.throws(()=>prepare(s,{type:'fxTrade',currency:'USD',side:'sell',amount:1}));assert.throws(()=>prepare(s,{type:'fxTrade',currency:'__proto__',side:'buy',amount:1}));
});
test('FX rechecks quote, credentials and card lock before any debit',()=>{
 const s=fresh(),cash=s.balance;const p=prepare(s,{type:'fxTrade',currency:'EUR',side:'buy',amount:100});assert.throws(()=>confirm(s,p.id,false));s.card.status='locked';assert.throws(()=>confirm(s,p.id,true));assert.equal(s.balance,cash);
});
test('Fund application is cancellable pending asset and cancellation returns full amount once',()=>{
 const s=fresh(),cash=s.balance;const r=run(s,{type:'buy',product:'index',amount:100});assert.equal(r.receipt.status,'待确认份额');assert.equal(s.fundOrders[0].status,'pending');assert.equal(s.holdings.length,1);assert.equal(s.balance,cash-10000);verifyBook(s);
 run(s,{type:'fundCancel',order:s.fundOrders[0].id});assert.equal(s.balance,cash);assert.throws(()=>prepare(s,{type:'fundCancel',order:s.fundOrders[0].id}));verifyBook(s);
});
test('Fund settlement and partial/full redemption charge disclosed fees, never mint principal',()=>{
 const s=fresh(),cash=s.balance;run(s,{type:'fundBuy',product:'index',amount:1000});const o=s.fundOrders[0];s.now=o.dueAt;tick(s);postBook(s,'settlement');assert.equal(o.status,'settled');const h=s.holdings.find(h=>h.id===o.holding);assert.equal(h.amount,99500);assert.equal(h.fundUnits,7960000);assert.throws(()=>prepare(s,{type:'fundCancel',order:o.id}));
 run(s,{type:'redeem',holding:h.id,amount:500});assert.equal(h.amount,49500);run(s,{type:'redeem',holding:h.id});assert.equal(s.holdings.some(x=>x.id===h.id),false);assert.ok(s.balance<cash);assert.equal(s.fundSales.length,2);verifyBook(s);tick(s);assert.equal(s.holdings.length,1);
});
test('Fund suitability, holding period and cross-account IDs remain enforced',()=>{
 const s=fresh();s.risk=1;assert.throws(()=>prepare(s,{type:'fundBuy',product:'index',amount:100}));s.risk=5;run(s,{type:'fundBuy',product:'bond',amount:100});s.now+=86400000;tick(s);postBook(s,'settlement');assert.throws(()=>prepare(s,{type:'fundRedeem',holding:s.fundOrders[0].holding,amount:10}));assert.throws(()=>prepare(s,{type:'fundCancel',order:'other-account'}));
});
test('Booking specific seats refunds before start and rejects duplicate seat/order replay',()=>{
 const s=fresh(),cash=s.balance;run(s,{type:'bookingCreate',product:'movie',date:'2026-10-14',slot:'A1'});const o=s.bookings[0];assert.equal(s.balance,cash-3900);assert.throws(()=>prepare(s,{type:'bookingCreate',product:'movie',date:'2026-10-14',slot:'A1'}));assert.throws(()=>prepare(s,{type:'bookingUse',order:o.id}));const r=run(s,{type:'bookingCancel',order:o.id});assert.equal(s.balance,cash);assert.equal(confirm(s,r.receipt.id,true).duplicate,true);assert.throws(()=>prepare(s,{type:'bookingUse',order:o.id}));verifyBook(s);
});
test('Every service fixture supports create then dated fulfillment with history',()=>{
 for(const [product,slot] of [['hotel','标准房'],['car','10:00'],['flight','12A'],['social','09:00'],['medical','09:00'],['housing','09:00']]){const s=fresh();run(s,{type:'bookingCreate',product,date:'2026-10-14',slot});const o=s.bookings[0];s.now=o.at;assert.throws(()=>prepare(s,{type:'bookingCancel',order:o.id}));run(s,{type:'bookingUse',order:o.id});assert.equal(o.status,'used');assert.equal(o.history.length,2);assert.throws(()=>prepare(s,{type:'bookingUse',order:o.id}));verifyBook(s);}
});
test('Booking refuses invalid date, slot, overdraw, unavailable card and foreign order',()=>{
 const s=fresh();assert.throws(()=>prepare(s,{type:'bookingCreate',product:'movie',date:'2026-02-31',slot:'A1'}));assert.throws(()=>prepare(s,{type:'bookingCreate',product:'movie',date:'2026-10-14',slot:'Z9'}));assert.throws(()=>prepare(s,{type:'bookingCancel',order:'foreign'}));s.card.balance=0;assert.throws(()=>prepare(s,{type:'bookingCreate',product:'flight',date:'2026-10-14',slot:'12A'}));
});
test('Points parcel cancels before dispatch, then shipping/receipt are one-way and no cash effect',()=>{
 const s=fresh(),cash=s.balance;s.life={orders:[],observations:[],points:[{amount:100}]};run(s,{type:'parcelClaim',destination:'TEST-HOME-001'});let o=s.parcels[0];run(s,{type:'parcelCancel',order:o.id});assert.equal(s.life.points.reduce((a,p)=>a+p.amount,0),100);assert.throws(()=>prepare(s,{type:'parcelCancel',order:o.id}));run(s,{type:'parcelClaim',destination:'TEST-HOME-001'});o=s.parcels[0];run(s,{type:'parcelAdvance',order:o.id});assert.throws(()=>prepare(s,{type:'parcelCancel',order:o.id}));run(s,{type:'parcelAdvance',order:o.id});assert.equal(o.status,'received');assert.throws(()=>prepare(s,{type:'parcelAdvance',order:o.id}));assert.equal(s.balance,cash);
});
test('Case can be reviewed with linked receipt, closed history is immutable through ordinary reply',()=>{
 const s=fresh();const receipt=run(s,{type:'fxTrade',currency:'USD',side:'buy',amount:1}).receipt;run(s,{type:'serviceCase',topic:'存款理财黄金',message:'核查',receipt:receipt.id});const c=s.cases[0];run(s,{type:'caseReview',caseId:c.id});assert.equal(c.status,'reviewed');assert.ok(c.history.at(-1).message.includes('购入外币'));assert.throws(()=>prepare(s,{type:'serviceReply',caseId:c.id,message:'改动'}));
});
test('AI sequence never executes, requires confirmed current receipt and revalidates following step',()=>{
 const s=fresh(),cash=s.balance;s.ai={};applyAIPlan(s,{steps:[{tool:'fxTrade',args:{cardId:'card-main',currency:'USD',side:'buy',amount:1}},{tool:'depositOpen',args:{cardId:'card-main',amount:1000,term:30}}]});assert.equal(s.balance,cash);assert.throws(()=>nextAI(s));const p=acceptAI(s,s.ai.draft.id).pending;assert.throws(()=>nextAI(s));confirm(s,p.id,true);nextAI(s);assert.equal(s.ai.sequence.index,1);assert.equal(s.balance,cash-720);const p2=acceptAI(s,s.ai.draft.id).pending;assert.throws(()=>confirm(s,p2.id,false));confirm(s,p2.id,true);nextAI(s);assert.equal(s.ai.sequence,undefined);assert.equal(s.deposits.length,1);
});
test('AI sequence rejects execution tool, unexpected parameters and stale plan without side effects',()=>{
 const s=fresh(),cash=s.balance;s.ai={};assert.throws(()=>applyAIPlan(s,{steps:[{tool:'confirm',args:{}}]}));assert.throws(()=>applyAIPlan(s,{steps:[{tool:'fxTrade',args:{cardId:'card-main',currency:'USD',side:'buy',amount:1,pin:'bad'}}]}));assert.throws(()=>applyAIPlan(s,{steps:Array(6).fill({tool:'depositOpen',args:{cardId:'card-main',amount:1000,term:30}})}));assert.equal(s.balance,cash);
});
test('Business records follow current fund and booking states while original receipts remain preserved',()=>{
 const s=fresh();const r=run(s,{type:'fundBuy',product:'index',amount:100});assert.equal(recordState(businessRecords(s).find(x=>x.id===r.receipt.id).status),'待确认份额');s.now+=86400000;tick(s);postBook(s,'settlement');assert.equal(recordState(businessRecords(s).find(x=>x.id===r.receipt.id).status),'已确认份额');assert.equal(r.receipt.status,'待确认份额');
 const h=s.holdings.find(h=>h.fundUnits),sale=run(s,{type:'fundRedeem',holding:h.id,amount:99.5}).receipt;assert.equal(sale.amount,9940);assert.equal(sale.fee,10);
 const b=run(s,{type:'bookingCreate',product:'movie',date:'2026-10-14',slot:'A1'}).receipt;run(s,{type:'bookingCancel',order:b.id});assert.equal(recordState(businessRecords(s).find(x=>x.id===b.id).status),'已取消');verifyBook(s);
});
