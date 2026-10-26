import {booking50} from './flight-travelers50.mjs';
export class DuffelTestError extends Error {}
/** Duffel test-only transport. Never import this module into public assets. */
export function duffelTestClient(env,transport=fetch){
 const token=env.DUFFEL_TEST_TOKEN;
 if(env.DUFFEL_TEST_ENABLED!=='true'||typeof token!=='string'||!/^duffel_test_[A-Za-z0-9_-]+$/.test(token))throw new DuffelTestError('Duffel 测试环境未配置；禁止使用正式密钥');
 const id=(v,prefix)=>{if(typeof v!=='string'||!new RegExp('^'+prefix+'_[A-Za-z0-9]+$').test(v))throw new DuffelTestError('供应商编号无效');return v;};
 const testOnly=data=>{if(!data||data.live_mode!==false)throw new DuffelTestError('供应商未确认测试环境，操作已中止');return data;};
 const call=async(method,path,data)=>{
  let response;try{response=await transport.call(globalThis,'https://api.duffel.com/air/'+path,{method,redirect:'manual',signal:AbortSignal.timeout(25000),headers:{Authorization:'Bearer '+token,'Duffel-Version':'v2',Accept:'application/json','Content-Type':'application/json'},...(data?{body:JSON.stringify({data})}:{})});}catch{throw new DuffelTestError('Duffel 请求结果不确定，请查单；不要重复提交下单');}
  if(!response.ok)throw new DuffelTestError('Duffel 测试请求失败（HTTP '+response.status+'）');
  let result;try{result=await response.json();}catch{throw new DuffelTestError('Duffel 返回格式无效');}return result.data;
 };
 const amount=(n,c)=>{if(!/^\d+(\.\d{1,3})?$/.test(n)||Number(n)<=0||! /^[A-Z]{3}$/.test(c))throw new DuffelTestError('供应商金额或币种无效');};
 return {
  async search({from,to,date,returnDate,slices,cabin='economy',adults=1,ages}){
   const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
   const legs=slices??[{from,to,date},...(returnDate?[{from:to,to:from,date:returnDate}]:[])];
   if(!Array.isArray(legs)||legs.length<1||legs.length>4||!Number.isInteger(adults)||adults<1||adults>6||!['all','economy','premium_economy','business','first'].includes(cabin))throw new DuffelTestError('航班搜索条件无效');
   if(legs.some((l,i)=>!l||! /^[A-Z]{3}$/.test(l.from)||! /^[A-Z]{3}$/.test(l.to)||l.from===l.to||!valid(l.date)||(i>0&&l.date<legs[i-1].date)))throw new DuffelTestError('行程机场或日期无效，请按出行先后排列');
   if(ages&&(!Array.isArray(ages)||!ages.length||ages.length>6||ages.some(a=>!Number.isInteger(a)||a<0||a>110)))throw new DuffelTestError('乘机人年龄无效');
   const r=testOnly(await call('POST','offer_requests?return_offers=true',{slices:legs.map(l=>({origin:l.from,destination:l.to,departure_date:l.date})),passengers:ages?ages.map(age=>({age})):Array.from({length:adults},()=>({type:'adult'})),...(cabin==='all'?{}:{cabin_class:cabin})}));
   for(const o of r.offers||[])testOnly(o);return r;
  },
  async offer(offerId){return testOnly(await call('GET','offers/'+id(offerId,'off')));},
  async book(offerId,expected){
   // Re-fetch server-side; caller must persist a unique attempt before this irreversible API request.
   const o=testOnly(await call('GET','offers/'+id(offerId,'off')));
   if(o.total_amount!==expected.amount||o.total_currency!==expected.currency)throw new DuffelTestError('票价已变化，请重新核对');
   if(!o.expires_at||Date.parse(o.expires_at)<=Date.now())throw new DuffelTestError('报价已过期');amount(o.total_amount,o.total_currency);
   if(!Array.isArray(o.passengers)||!o.passengers.length||o.passengers.length>6)throw new DuffelTestError('乘机人数据无效');
   const passengers=booking50(expected.roster,o.passengers);
   const r=testOnly(await call('POST','orders',{type:'instant',selected_offers:[o.id],passengers,payments:[{type:'balance',amount:o.total_amount,currency:o.total_currency}]}));
   if(r.total_amount!==o.total_amount||r.total_currency!==o.total_currency)throw new DuffelTestError('订单金额待核查，禁止重试下单');return r;
  },
  async order(orderId){return testOnly(await call('GET','orders/'+id(orderId,'ord')));},
  async refundQuote(orderId){const order=id(orderId,'ord');testOnly(await call('GET','orders/'+order));const q=testOnly(await call('POST','order_cancellations',{order_id:order}));if(q.order_id!==order)throw new DuffelTestError('退款订单不匹配');return q;},
  async refundConfirm(cancellationId,expected){
   const path='order_cancellations/'+id(cancellationId,'ore'),q=testOnly(await call('GET',path));
   if(q.order_id!==expected.orderId||q.refund_amount!==expected.amount||q.refund_currency!==expected.currency||q.refund_to!=='balance')throw new DuffelTestError('退款条件变化或非余额退款，请重新核对');
   if(q.confirmed_at)return q;
   if(q.expires_at&&Date.parse(q.expires_at)<=Date.now())throw new DuffelTestError('退款报价已过期');
   if(q.refund_amount===null)throw new DuffelTestError('退款金额未知');
   const r=testOnly(await call('POST',path+'/actions/confirm'));if(!r.confirmed_at||r.order_id!==q.order_id)throw new DuffelTestError('退款状态待核查');return r;
  }
 };
}
