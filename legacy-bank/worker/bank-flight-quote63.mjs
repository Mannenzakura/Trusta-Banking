import {BankError} from './bank-engine.mjs';
import {baggage54,cachedBaggage54,matchBaggage54} from './baggage54.mjs';
export async function quoteFlight63(state,env,key,body){
if(state.testMode!==true)throw new BankError('仅测试模式可预订');
   const q=body.query;if(!q||![q.from,q.to].every(x=>/^[A-Z]{3}$/.test(x))||!/^\d{4}-\d{2}-\d{2}$/.test(q.date))throw new BankError('航线无效');
   const cached=await env.DB.prepare('SELECT data,expires FROM bank_real_flight_cache WHERE id=?').bind([q.from,q.to,q.date].join(':')).first();
   if(!cached?.data||cached.expires<Date.now())throw new BankError('缓存报价已过期，请重新查询');
   const data=JSON.parse(cached.data),flight=data.rows.find(f=>f.number===body.flight),cabin=flight?.cabins[body.cabin];
   if(!Number.isInteger(body.cabin)||body.cabin<0||!cabin||!(cabin.price>0)||/取消/.test(flight.status))throw new BankError('该航班或舱位没有可用报价');
   let bag=await cachedBaggage54(env,q,flight.number);if(!bag){try{await baggage54(env,key,{query:q,flight:flight.number});bag=await cachedBaggage54(env,q,flight.number);}catch{cabin.baggage={checked:[],carry:[],basis:'行李查询暂未成功，可返回列表重试；虚拟预订仍可继续',source:'飞常准',at:''};}}if(bag)cabin.baggage=matchBaggage54(bag,q,flight.number,cabin);
   const unit=Math.round(cabin.price*100);if(!Number.isSafeInteger(unit))throw new BankError('报价金额无效');
   const offer={id:crypto.randomUUID(),flight,cabin:{...cabin,currency:'CNY'},unit,expires:Math.min(cached.expires,Date.now()+15*60000)};
   state.virtualFlightOffers=[offer,...(state.virtualFlightOffers||[]).filter(o=>o.expires>Date.now()).slice(0,19)];return offer;
}
