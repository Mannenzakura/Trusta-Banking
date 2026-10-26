export const airports=[{id:'SZX',name:'深圳',zone:'domestic',offset:8},{id:'SHA',name:'上海',zone:'domestic',offset:8},{id:'PEK',name:'北京',zone:'domestic',offset:8},{id:'HKG',name:'香港',zone:'hmt',offset:8},{id:'MFM',name:'澳门',zone:'hmt',offset:8},{id:'TPE',name:'台北',zone:'hmt',offset:8},{id:'NRT',name:'东京',zone:'international',offset:9},{id:'SIN',name:'新加坡',zone:'international',offset:8}];
export function flightSearch(q,now){
 const a=airports.find(x=>x.id===q.from),b=airports.find(x=>x.id===q.to);
 if(!a||!b||a.id===b.id)throw Error('请选择不同的出发地和目的地');
 const zone=a.zone==='international'||b.zone==='international'?'international':a.zone==='hmt'||b.zone==='hmt'?'hmt':'domestic';
 if(q.zone!==zone)throw Error('航线与所选国内、港澳台或国际区域不匹配');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(q.date||''))throw Error('请选择出发日期');
 const base=Date.parse(q.date+'T00:00:00Z');if(!Number.isFinite(base)||new Date(base).toISOString().slice(0,10)!==q.date)throw Error('日期无效');
 return [0,1,2].map(slot=>{const departure=base+(8+slot*5-a.offset)*3600000,duration=zone==='domestic'?150:zone==='hmt'?120:330,arrival=departure+duration*60000,fare=(zone==='domestic'?58000:zone==='hmt'?82000:168000)+slot*12000;
 return {id:`${a.id}-${b.id}-${q.date}-${slot}`,from:a.id,to:b.id,fromName:a.name,toName:b.name,zone,date:q.date,departure,arrival,fromOffset:a.offset,toOffset:b.offset,duration,airline:'云途测试航空',number:'TEST-'+(410+slot),fare,tax:zone==='domestic'?8000:18000,seats:4};}).filter(f=>f.departure>now+2*3600000&&f.departure<now+180*86400000);
}
export function flightById(id,now){const m=/^([A-Z]{3})-([A-Z]{3})-(\d{4}-\d{2}-\d{2})-([0-2])$/.exec(id||'');if(!m)throw Error('航班编号无效');const a=airports.find(a=>a.id===m[1]),b=airports.find(a=>a.id===m[2]);const zone=a?.zone==='international'||b?.zone==='international'?'international':a?.zone==='hmt'||b?.zone==='hmt'?'hmt':'domestic';const f=flightSearch({from:m[1],to:m[2],date:m[3],zone},now).find(f=>f.id===id);if(!f)throw Error('航班已过预订时间或超出180天');return f;}
