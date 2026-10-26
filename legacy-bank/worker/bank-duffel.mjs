import {profile50,travelers50,roster50,bind50} from './flight-travelers50.mjs';
import {flightFX} from './flight-fx49.mjs';
import {duffelTestClient} from './duffel-test-client.mjs';
import {BankError} from './bank-engine.mjs';
const fail=(s,n=400)=>{throw new BankError(s,n);};
export const safeOffer=o=>({id:o.id,amount:o.total_amount,currency:o.total_currency,expires:o.expires_at,airline:o.owner?.name,carrier:o.owner?.iata_code,conditions:o.conditions,passengers:o.passengers?.length||1,base:o.base_amount,tax:o.tax_amount,slices:(o.slices||[]).map(s=>({duration:s.duration,brand:s.fare_brand_name,segments:s.segments.map(g=>({from:g.origin.iata_code,to:g.destination.iata_code,departure:g.departing_at,arrival:g.arriving_at,fromTimezone:g.origin.time_zone,toTimezone:g.destination.time_zone,fromTerminal:g.origin_terminal,toTerminal:g.destination_terminal,aircraft:g.aircraft?.name,carrier:g.marketing_carrier?.iata_code,number:(g.marketing_carrier?.iata_code||'')+' '+g.marketing_carrier_flight_number,cabins:(g.passengers||[]).map(p=>({passengerId:p.passenger_id,class:p.cabin_class,bags:p.baggages||[]}))}))}))});
export async function duffelView(env,owner){if(env.DUFFEL_TEST_ENABLED!=='true')return {ready:false};const rows=await env.DB.prepare('SELECT id,status,data,created FROM bank_duffel_test WHERE owner=? ORDER BY created DESC LIMIT 40').bind(owner).all();return {ready:true,travelers:await travelers50(env.DB,owner),orders:rows.results.map(r=>({...r,data:JSON.parse(r.data)}))};}
export async function duffelAction(env,owner,b){const c=duffelTestClient(env),db=env.DB;
 if(b.action==='duffelTravelerSave'){const p=profile50(b),id=b.id||crypto.randomUUID();if(b.id){const old=await db.prepare('SELECT id FROM bank_flight_travelers WHERE id=? AND owner=?').bind(id,owner).first();if(!old)fail('乘机人不存在',404);await db.prepare('UPDATE bank_flight_travelers SET data=? WHERE id=? AND owner=?').bind(JSON.stringify(p),id,owner).run()}else{if((await travelers50(db,owner)).length>=20)fail('最多保存 20 位测试乘机人');await db.prepare('INSERT INTO bank_flight_travelers(id,owner,data,created) VALUES(?,?,?,?)').bind(id,owner,JSON.stringify(p),Date.now()).run()}return {}}
 if(b.action==='duffelTravelerDelete'){await db.prepare('DELETE FROM bank_flight_travelers WHERE id=? AND owner=?').bind(b.id,owner).run();return {}}
 const get=async()=>db.prepare('SELECT * FROM bank_duffel_test WHERE id=? AND owner=?').bind(b.id,owner).first();
 if(b.action==='duffelSearch'){
  const args={from:b.from,to:b.to,date:b.date,adults:Number(b.adults||1),returnDate:b.trip==='round'?b.returnDate:undefined,...(b.trip==='multi'?{slices:b.slices}:{})};
  if(b.trip==='multi'&&(!Array.isArray(b.slices)||b.slices.length<2))fail('多程需至少两程');
  const last=b.trip==='multi'?b.slices.at(-1)?.date:b.trip==='round'?b.returnDate:b.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(last||''))fail('行程日期无效');const counts=[Number(b.adults??1),Number(b.children??0),Number(b.infants??0)];if(counts.some(n=>!Number.isInteger(n)||n<0)||counts[0]<1||counts.reduce((a,n)=>a+n,0)>6||counts[2]>counts[0])fail('乘机人数无效，婴儿不得多于成人');const roster=b.travelerIds?await roster50(db,owner,b.travelerIds,last,b.guardians):counts.flatMap((n,i)=>Array.from({length:n},()=>({age:[30,8,1][i],anonymous:true})));args.ages=roster.map(p=>p.age);
  const cabins=(b.cabin||'all')==='all'?['economy','premium_economy','business','first']:[b.cabin];
  const [results,fx]=await Promise.all([Promise.allSettled(cabins.map(cabin=>c.search({...args,cabin}))),flightFX()]);
  const ok=results.filter(r=>r.status==='fulfilled');if(!ok.length)throw results[0].reason;
  const unique=new Map();for(const r of ok){const bound=bind50(roster,r.value.passengers),searchId=crypto.randomUUID();await db.prepare('INSERT INTO bank_flight_searches(id,owner,data,expires) VALUES(?,?,?,?)').bind(searchId,owner,JSON.stringify({args,last,roster:bound,offers:(r.value.offers||[]).map(o=>o.id)}),Date.now()+1800000).run();for(const o of r.value.offers||[])unique.set(o.id,{...safeOffer(o),fx,searchId,roster:bound});}const offers=[...unique.values()];
  offers.sort((a,z)=>b.sort==='time'?String(a.slices[0]?.segments[0]?.departure).localeCompare(String(z.slices[0]?.segments[0]?.departure)):a.currency.localeCompare(z.currency)||Number(a.amount)-Number(z.amount));
  return {duffelOffers:offers,duffelSearchWarnings:results.flatMap((r,i)=>r.status==='rejected'?[cabins[i]]:[])};
 }
 if(b.action==='duffelPrepare'){const search=await db.prepare('SELECT data,expires FROM bank_flight_searches WHERE id=? AND owner=?').bind(b.searchId||'',owner).first();if(!search||search.expires<Date.now())fail('搜索已过期，请重新搜索');const snapshot=JSON.parse(search.data);if(!snapshot.offers.includes(b.offer))fail('报价不属于当前搜索');let o=await c.offer(b.offer);let bound=snapshot.roster;if(bound.some(p=>p.anonymous)){const roster=await roster50(db,owner,b.travelerIds,snapshot.last,b.guardians);const category=a=>a<2?'infant':a<12?'child':'adult';if(JSON.stringify(roster.map(p=>category(p.age)).sort())!==JSON.stringify(bound.map(p=>category(p.age)).sort()))fail('所选乘机人类型与搜索人数不一致，请重新搜索');const cabin=o.slices[0]?.segments[0]?.passengers[0]?.cabin_class||'economy';const result=await c.search({...snapshot.args,cabin,ages:roster.map(p=>p.age)});const key=o=>JSON.stringify(o.slices.map(s=>s.segments.map(g=>[g.marketing_carrier?.iata_code,g.marketing_carrier_flight_number,g.departing_at,g.origin.iata_code,g.destination.iata_code])));const match=result.offers?.find(x=>key(x)===key(o)&&x.slices.every((s,i)=>s.fare_brand_name===o.slices[i].fare_brand_name));if(!match)fail('所选航班已无适用乘机人的报价，请重新搜索');o=await c.offer(match.id);bound=bind50(roster,result.passengers)}if(Date.parse(o.expires_at)<=Date.now())fail('报价已过期');const data={quote:{...safeOffer(o),roster:bound,fx:await flightFX()}};const id=crypto.randomUUID();await db.prepare("INSERT OR IGNORE INTO bank_duffel_test(id,owner,offer,status,data,created) VALUES(?,?,?,'quote',?,?)").bind(id,owner,o.id,JSON.stringify(data),Date.now()).run();const prepared=await db.prepare('SELECT id FROM bank_duffel_test WHERE owner=? AND offer=?').bind(owner,o.id).first();return {preparedFlightId:prepared.id};}
 let row=await get();if(!row)fail('订单不存在',404);let data=JSON.parse(row.data);
 const store=async status=>db.prepare('UPDATE bank_duffel_test SET status=?,data=? WHERE id=? AND owner=?').bind(status,JSON.stringify(data),row.id,owner).run();
 const lock=async(from,to)=>{const r=await db.prepare('UPDATE bank_duffel_test SET status=? WHERE id=? AND owner=? AND status=?').bind(to,row.id,owner,from).run();if(r.meta.changes!==1)fail('订单正在处理或状态已变更，请刷新',409);};
 if(b.action==='duffelBook'){
  if(row.status==='booked')return {};if(row.status!=='quote')fail('订单不可重复提交');await lock('quote','booking');
  try{const o=await c.book(row.offer,{amount:data.quote.amount,currency:data.quote.currency,roster:data.quote.roster});data.orderId=o.id;data.reference=o.booking_reference;data.bookedAt=Date.now();await store('booked');}catch(e){data.error='下单结果待核查，请勿重复下单';await store('review');throw e;}return {};
 }
 if(b.action==='duffelRefundQuote'){
  if(row.status!=='booked')fail('订单当前不可申请退款');await lock('booked','quoting');
  try{const q=await c.refundQuote(data.orderId);data.refund={id:q.id,amount:q.refund_amount,currency:q.refund_currency,to:q.refund_to,expires:q.expires_at};await store('refund_quote');}catch(e){await store('booked');throw e;}return {};
 }
 if(b.action==='duffelRefund'){
  if(row.status==='refunded')return {};if(row.status!=='refund_quote')fail('请先获取退款报价');await lock('refund_quote','refunding');
  try{const q=await c.refundConfirm(data.refund.id,{orderId:data.orderId,amount:data.refund.amount,currency:data.refund.currency});data.refundedAt=Date.now();data.refund.amount=q.refund_amount;await store('refunded');}catch(e){await store('refund_review');throw e;}return {};
 }
 fail('不支持的机票操作');
}
