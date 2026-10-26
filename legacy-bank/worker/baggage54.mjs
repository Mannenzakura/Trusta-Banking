import {BankError} from './bank-engine.mjs';
import {unwrap52,query52} from './variflight52.mjs';
const strings=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,1200)):[];
export const baggageKey54=(q,n)=>'baggage54:'+q.from+':'+q.to+':'+q.date+':'+n;
export function matchBaggage54(raw,q,flight,cabin){
 const rows=raw.data.filter(r=>r.FlightNo===flight&&r.FlightDate===q.date&&r.FlightDepcode===q.from&&r.FlightArrcode===q.to);
 const exact=rows.flatMap(r=>(r.SubCabin||[]).filter(s=>s.Cabin===cabin.code).map(s=>({r,s})));
 let row,bag,basis;
 if(exact.length===1){row=exact[0].r;bag=exact[0].s.Luggage||row.Luggage;basis=exact[0].s.Luggage?'订座舱位 '+cabin.code+' 专属规则':'订座舱位 '+cabin.code+' 属于 '+row.Cabin+' 舱等；使用该舱等参考规则';}
 else if(exact.length===0){const codes={business:['J','C'],economy:['Y'],premium_economy:['W'],first:['F']}[cabin.group]||[];const matched=rows.filter(r=>codes.includes(r.Cabin));if(matched.length===1){row=matched[0];bag=row.Luggage;basis=row.Cabin+' 舱等参考规则；供应商未确认订座代码 '+cabin.code+' 的专属权益';}}
 if(!row)return {checked:[],carry:[],basis:'未返回可唯一匹配此舱位的行李规则',at:raw.timestamp||'',source:'飞常准 flightHappinessIndex'};
 const filter=xs=>strings(xs).filter(x=>row.IsInt==='0'?!x.startsWith('国际航线'):row.IsInt==='1'?!x.startsWith('国内航线'):true);
 return {comfort:Object.fromEntries(['FtypeDetail','Seatlayout','SeatSpace','SeatWidth','SeatTilt','Food','Media','Socket','WiFi'].filter(k=>typeof row[k]==='string'&&row[k]).map(k=>[k,row[k].slice(0,200)])),checked:filter(bag?.['托运']),carry:filter(bag?.['手提']),basis,conditional:row.IsInt==='1',at:raw.timestamp||'',source:'飞常准 flightHappinessIndex'};
}
export async function cachedBaggage54(env,q,n){const r=await env.DB.prepare('SELECT data,expires FROM bank_real_flight_cache WHERE id=?').bind(baggageKey54(q,n)).first();return r?.data&&r.expires>Date.now()?JSON.parse(r.data):null;}
export async function baggage54(env,session,body,fetcher=fetch){
 const q=query52(body.query||{}),n=String(body.flight||'');if(!/^[A-Z0-9]{2}\d{1,5}[A-Z]?$/.test(n))throw new BankError('航班号无效');
 const route=await env.DB.prepare('SELECT data,expires FROM bank_real_flight_cache WHERE id=?').bind([q.from,q.to,q.date].join(':')).first();
 if(!route?.data||route.expires<Date.now())throw new BankError('请先重新查询航班');const data=JSON.parse(route.data),flight=data.rows.find(f=>f.number===n);if(!flight)throw new BankError('航班不在查询结果中');
 let raw=await cachedBaggage54(env,q,n);const now=Date.now(),id=baggageKey54(q,n);
 if(!raw){
 if(!env.VARIFLIGHT_API_KEY||env.VARIFLIGHT_ENABLED!=='true'||now>Date.parse('2026-10-20T00:00:00+08:00'))throw new BankError('赠送额度查询未启用或试用窗口已结束',503);
 const rate=await env.DB.prepare('INSERT INTO bank_real_flight_rate(id,at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at WHERE bank_real_flight_rate.at<? RETURNING id').bind('bag:'+session,now,now-5000).first();if(!rate)throw new BankError('请稍候再查询行李',429);
 const lock=await env.DB.prepare('INSERT INTO bank_real_flight_cache(id,data,expires,locked_until) VALUES(?,NULL,0,?) ON CONFLICT(id) DO UPDATE SET locked_until=excluded.locked_until WHERE bank_real_flight_cache.locked_until<? RETURNING id').bind(id,now+45000,now).first();if(!lock)throw new BankError('行李规则正在查询，请稍后重试',409);
 try{
 const budget=await env.DB.prepare("UPDATE bank_real_flight_budget SET reserved=reserved+25 WHERE id='gift52' AND reserved+25<=1000 RETURNING reserved").bind().first();if(!budget)throw new BankError('赠送额度保护上限已达到，未充值',503);
 try{const r=await fetcher('https://ai.variflight.com/servers/aviation/mcp',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(35000),headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','X-API-Key':env.VARIFLIGHT_API_KEY},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'flightHappinessIndex',arguments:{fnum:n,date:q.date,dep:q.from,arr:q.to}}})});if(!r.ok)throw Error();const text=await r.text();if(text.length>2000000)throw Error();raw=unwrap52(JSON.parse(text));}catch{throw new BankError('行李接口暂不可用，请稍后重试；未用默认额度替代',503);}
 await env.DB.prepare('UPDATE bank_real_flight_cache SET data=?,expires=?,locked_until=0 WHERE id=?').bind(JSON.stringify(raw),now+86400000,id).run();
 }finally{await env.DB.prepare('UPDATE bank_real_flight_cache SET locked_until=0 WHERE id=?').bind(id).run();}
 }
 flight.cabins=flight.cabins.map(c=>({...c,baggage:matchBaggage54(raw,q,n,c)}));
 await env.DB.prepare('UPDATE bank_real_flight_cache SET data=? WHERE id=?').bind(JSON.stringify(data),[q.from,q.to,q.date].join(':')).run();
 return {realFlights:{...data,cached:true}};
}
