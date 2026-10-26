import {BankError} from './bank-engine.mjs';
// Parse the provider's Python literal envelope without evaluating executable code.
export function literal52(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('Invalid response');let i=0,nodes=0;
 const ws=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
 const value=(depth=0)=>{if(depth>32||++nodes>100000)throw Error('Response too complex');ws();const c=text[i++];
 if(c==='"'||c==="'"){let out='';while(i<text.length){let x=text[i++];if(x===c)return out;if(x==='\\'){x=text[i++];if(x==='u'||x==='x'){const n=x==='u'?4:2,s=text.slice(i,i+n);if(!new RegExp('^[0-9a-f]{'+n+'}$','i').test(s))throw Error('Invalid escape');out+=String.fromCharCode(parseInt(s,16));i+=n;}else {const m={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','\\':'\\',"'":"'",'"':'"','/':'/'};if(!(x in m))throw Error('Invalid escape');out+=m[x];}}else out+=x;}throw Error('Unclosed string');}
 if(c==='['||c==='{'){const obj=c==='{'?Object.create(null):[],end=c==='{'?'}':']';ws();if(text[i]===end){i++;return obj;}while(i<text.length){const a=value(depth+1);ws();if(c==='{'){if(typeof a!=='string'||['__proto__','constructor','prototype'].includes(a)||text[i++]!==':')throw Error('Invalid key');obj[a]=value(depth+1);}else obj.push(a);ws();if(text[i]===end){i++;return obj;}if(text[i++]!==',')throw Error('Invalid separator');ws();if(text[i]===end){i++;return obj;}}throw Error('Unclosed container');}
 i--;for(const [s,v] of [['None',null],['True',true],['False',false],['null',null],['true',true],['false',false]])if(text.startsWith(s,i)){i+=s.length;return v;}
 const m=text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);if(!m)throw Error('Invalid value');i+=m[0].length;const n=Number(m[0]);if(!Number.isFinite(n))throw Error('Invalid number');return n;};
 const out=value();ws();if(i!==text.length)throw Error('Trailing content');return out;
}
export function unwrap52(r){if(r?.error||r?.result?.isError)throw Error('Provider error');const t=r?.result?.content?.find(c=>c.type==='text')?.text;if(!t||t.startsWith('Error executing tool'))throw Error('Provider error');const start=t.indexOf('{');if(start<0)throw Error('No structured data');const d=literal52(t.slice(start));if(d.code!==200||!Array.isArray(d.data))throw Error('Provider error');return d;}
const num=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const str=v=>typeof v==='string'?v.slice(0,200):'';
export const city52=code=>({PVG:'SHA',PEK:'BJS',PKX:'BJS',LHR:'LON',LGW:'LON',LCY:'LON',STN:'LON',LTN:'LON',HND:'TYO',NRT:'TYO',JFK:'NYC',EWR:'NYC',LGA:'NYC',CDG:'PAR',ORY:'PAR',TFU:'CTU',KIX:'OSA',ITM:'OSA'})[code]||code;
export function query52(body,now=Date.now()){
 const q={from:String(body.from||'').toUpperCase(),to:String(body.to||'').toUpperCase(),date:String(body.date||'')};
 if(!/^[A-Z]{3}$/.test(q.from)||!/^[A-Z]{3}$/.test(q.to)||q.from===q.to)throw new BankError('请选择不同的出发与到达机场');
 const date=Date.parse(q.date+'T00:00:00Z'),today=new Date(now+8*3600000).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(q.date)||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==q.date||q.date<today||date-Date.parse(today)>365*86400000)throw new BankError('请选择今天起一年内的有效日期');return q;
}
export function normalize52(schedule,prices,q){
 const fares=prices?.data||[];
 return {source:'飞常准',query:q,fetchedAt:Date.now(),scheduleAt:str(schedule.timestamp),priceAt:str(prices?.timestamp),priceUnavailable:!prices,total:num(schedule.total),rows:schedule.data.filter(f=>f.FlightDepcode===q.from&&f.FlightArrcode===q.to&&String(f.FlightDeptimePlanDate).startsWith(q.date)).map(f=>{
 const p=fares.find(p=>p.flightno===f.FlightNo&&p.flightdepcode===f.FlightDepcode&&p.flightarrcode===f.FlightArrcode&&p.depdate===q.date);
 return {number:str(f.FlightNo),airline:str(f.FlightCompany),from:str(f.FlightDepAirport),to:str(f.FlightArrAirport),fromCode:q.from,toCode:q.to,departure:str(f.FlightDeptimePlanDate),arrival:str(f.FlightArrtimePlanDate),fromTerminal:str(f.FlightHTerminal),toTerminal:str(f.FlightTerminal),fromOffset:num(f.org_timezone),toOffset:f.dst_timezone==null?null:Number(f.dst_timezone),aircraft:str(f.ftype),details:Object.fromEntries(Object.entries(f).filter(([k,v])=>v!==null&&v!==''&&['generic','AircraftNumber','FlightYear','CheckinTable','LastCheckinTime','CheckDoor','BoardGate','ReachExit','BaggageID','BoardState','FlightDeptimeReadyDate','FlightArrtimeReadyDate','FlightDeptimeDate','FlightArrtimeDate','DelayReason','OntimeRate','ArrOntimeRate','distance'].includes(k))),status:str(f.FlightState),share:str(f.ShareFlightNo),shareFlag:String(f.ShareFlag)==='1',stop:String(f.StopFlag)==='1',stopCity:str(f.StopCity),tax:num(p?.tax),fuel:num(p?.oilfee),cabins:(p?.cabins||[]).map(c=>({name:str(c.classname)||'舱位名称未提供',code:str(c.cabincode),group:c.cabinclass==='F'?'first':c.cabinclass==='C'||c.cabinclass==='J'?'business':/明珠|超级|高端|优选/.test(c.classname||'')?'premium_economy':c.cabinclass==='Y'?'economy':'unknown',price:num(c.price),seats:num(c.seatnum),currency:'CNY'}))};
 })};
}
export async function realFlights52(env,session,body,fetcher=fetch){
 if(!env.VARIFLIGHT_API_KEY||env.VARIFLIGHT_ENABLED!=='true')throw new BankError('真实航班数据尚未启用',503);
 const q=query52(body),id=[q.from,q.to,q.date].join(':'),now=Date.now();
 const cached=await env.DB.prepare('SELECT data,expires FROM bank_real_flight_cache WHERE id=?').bind(id).first();if(cached?.data&&cached.expires>now&&JSON.parse(cached.data).rows.every(f=>f.details))return {realFlights:{...JSON.parse(cached.data),cached:true}};
 // A fixed global ceiling, never reset per user/day. Reserve before any billable call.
 if(now>Date.parse('2026-10-20T00:00:00+08:00'))throw new BankError('赠送额度试用窗口已结束，查询已暂停',503);
 const rate=await env.DB.prepare('INSERT INTO bank_real_flight_rate(id,at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at WHERE bank_real_flight_rate.at<? RETURNING id').bind(session,now,now-60000).first();if(!rate)throw new BankError('请稍候一分钟再查询其他航线，避免重复消耗赠送额度',429);
 const lock=await env.DB.prepare('INSERT INTO bank_real_flight_cache(id,data,expires,locked_until) VALUES(?,NULL,0,?) ON CONFLICT(id) DO UPDATE SET locked_until=excluded.locked_until WHERE bank_real_flight_cache.locked_until<? RETURNING id').bind(id,now+90000,now).first();if(!lock)throw new BankError('这条航线正在查询，请稍后重试',409);
 try{
 const reserve=await env.DB.prepare("UPDATE bank_real_flight_budget SET reserved=reserved+75 WHERE id='gift52' AND reserved+75<=1000 RETURNING reserved").bind().first();if(!reserve)throw new BankError('本站赠送额度保护上限已达到，已暂停新查询；未开启充值',503);
 const call=async(name,args)=>{const r=await fetcher('https://ai.variflight.com/servers/aviation/mcp',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(35000),headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','X-API-Key':env.VARIFLIGHT_API_KEY},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});if(!r.ok)throw Error('HTTP_'+r.status);const text=await r.text();if(text.length>2000000)throw Error('Response too large');return unwrap52(JSON.parse(text));};
 let schedule;try{schedule=await call('searchFlightsByDepArr',{date:q.date,dep:q.from,arr:q.to,limit:100,detail:'full'});}catch(error){const reason=/^HTTP_\d{3}$/.test(error.message)?error.message:({'Provider error':'DATA_ERROR','No structured data':'DATA_FORMAT','Invalid response':'DATA_SIZE','Trailing content':'DATA_FORMAT','Invalid value':'DATA_FORMAT','Invalid key':'DATA_FORMAT','fetch failed':'NETWORK'})[error.message]||error.name||'UNAVAILABLE';throw new BankError('飞常准暂未返回有效航班数据（'+reason+'），请稍后再试。未使用测试航班替代。',503);}
 let prices=null;try{prices=await call('getFlightPriceByCities',{dep_date:q.date,dep_city:city52(q.from),arr_city:city52(q.to)});}catch{}
 const data=normalize52(schedule,prices,q);await env.DB.prepare('UPDATE bank_real_flight_cache SET data=?,expires=?,locked_until=0 WHERE id=?').bind(JSON.stringify(data),now+30*60000,id).run();return {realFlights:data};
 }finally{await env.DB.prepare('UPDATE bank_real_flight_cache SET locked_until=0 WHERE id=?').bind(id).run();}
}
