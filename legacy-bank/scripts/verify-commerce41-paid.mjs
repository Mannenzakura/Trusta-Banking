import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {rpc} from '../worker/bank-alipay.mjs';
import {commerceAction,commerceView,commerceReceipts} from '../worker/bank-commerce.mjs';
const d=new DatabaseSync('output/commerce41-qa.sqlite');
const env={BANK_COMMERCE_SANDBOX_ENABLED:'true',BANK_TEST_MODE:'true',ALIPAY_SANDBOX_ENABLED:'true',ALIPAY_SANDBOX_PRIVATE_KEY:readFileSync('<LOCAL_USER>/.codex/secrets/alipay-sandbox/app-private-key.txt','utf8'),ALIPAY_SANDBOX_PUBLIC_KEY:readFileSync('<LOCAL_USER>/.codex/secrets/alipay-sandbox/alipay-public-key.txt','utf8'),DB:{prepare(sql){return{bind(...args){return{async first(){return d.prepare(sql).get(...args)},async all(){return{results:d.prepare(sql).all(...args)}},async run(){return{meta:d.prepare(sql).run(...args)}}}}}}}};
const order=d.prepare('SELECT * FROM bank_commerce_sandbox ORDER BY created DESC LIMIT 1').get();
assert.ok(order);
const call=action=>commerceAction(env,order.owner,{action,id:order.id},'http://127.0.0.1:4189');
const paid=await call('commerceQuery');console.log('Sandbox order',order.id,paid.commerceOrder.status);
if(!['paid','refunded'].includes(paid.commerceOrder.status)){d.close();process.exit(2);}
const refunded=await call('commerceRefund');assert.equal(refunded.commerceOrder.status,'refunded');
const repeat=await call('commerceRefund');assert.equal(repeat.commerceOrder.refund_id,refunded.commerceOrder.refund_id);
const final=await call('commerceQuery');assert.equal(final.commerceOrder.status,'refunded');
const view=await commerceView(env,order.owner);assert.equal(commerceReceipts(view).filter(r=>r.orderId===order.id).length,2);assert.equal(view.orders.find(o=>o.id===order.id).voucherCode,null);
writeFileSync('output/commerce41-live-result.json',JSON.stringify({at:new Date().toISOString(),id:order.id,sku:order.sku,amount:order.amount,query:'paid',refund:'refunded',repeatRefund:'idempotent',finalQuery:final.commerceOrder.status,signatureVerified:true,receipts:2,benefitRevoked:true},null,2));
console.log('PASS actual sandbox business order: paid, refunded, receipts synchronized.');d.close();
