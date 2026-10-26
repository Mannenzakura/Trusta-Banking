const DAY=86400000;
export function goldHistory(raw,now=Date.now()){
 if(raw?.symbol!=='XAUUSD'||raw.currency!=='USD'||raw.unit!=='troy_oz'||!Array.isArray(raw.points))return null;
 const points=[...new Map(raw.points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.d)&&Number.isFinite(p.c)&&p.c>0&&Number.isFinite(Date.parse(p.d))&&Date.parse(p.d)<=now).map(p=>[p.d,{date:p.d,close:p.c}])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(points.length<2)return null;
 const last=points.at(-1),t=Date.parse(last.date),updatedAt=Date.parse(raw.updated_at);
 const stale=!Number.isFinite(updatedAt)||now-updatedAt>2*DAY||updatedAt>now+300000||now-t>7*DAY||raw.data_state?.status==='stale';
 function monthsBack(months){const d=new Date(t),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return d.getTime();}
 const baseAt=target=>{const p=points.filter(p=>Date.parse(p.date)<=target).at(-1);return p&&target-Date.parse(p.date)<=7*DAY?p:null;};
 const change=p=>p?{percent:(last.close/p.close-1)*100,amount:last.close-p.close,baseDate:p.date,base:p.close}:null;
 return {asOf:last.date,close:last.close,updatedAt:Number.isFinite(updatedAt)?updatedAt:null,stale,changes:{day:change(t-Date.parse(points.at(-2).date)<=7*DAY?points.at(-2):null),month:change(baseAt(monthsBack(1))),quarter:change(baseAt(monthsBack(3))),year:change(baseAt(monthsBack(12)))},points:points.filter(p=>Date.parse(p.date)>=monthsBack(12)),source:'XAUS',sourceUrl:'https://xaus.com/api/'};
}
