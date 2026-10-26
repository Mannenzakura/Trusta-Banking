import {airport44} from './flight-search44.js?v=49';
const name=c=>airport44(c)?.name||c;
export const duration49=s=>s?String(s).replace(/^P(?:(\d+)D)?T/,(_,d)=>d?d+'天':'').replace('H','小时').replace('M','分钟'):'时长待确认';
function instant49(value,zone){
 if(!zone||/[zZ]|[+-]\d{2}:\d{2}$/.test(value))return Date.parse(value);
 try{const target=Date.parse(value+'Z');let time=target;
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(time)).map(p=>[p.type,p.value]));const wall=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);time+=target-wall;}return time;
 }catch{return NaN;}
}
export function wait49(a,b){
 // Same-airport local timestamps share a timezone; cross-airport times need verified timezone metadata.
 if(a.to!==b.from&&(!a.toTimezone||a.toTimezone!==b.fromTimezone))return '等待时间待确认';
 const n=(instant49(b.departure,b.fromTimezone)-instant49(a.arrival,a.toTimezone))/60000;
 return Number.isFinite(n)&&n>=0?`${Math.floor(n/60)}小时${n%60}分钟`:'等待时间待确认';
}
const label=(o,i)=>o.slices.length===1?'单程':`第 ${i+1} 程`;
const time=(g,k,e)=>`<div><b>${e(g[k]?.slice(11,16)||'--:--')}</b><span>${e(name(k==='departure'?g.from:g.to))}${g[k==='departure'?'fromTerminal':'toTerminal']?' T'+e(g[k==='departure'?'fromTerminal':'toTerminal']):''}</span><small>${e(g[k]?.slice(0,10)||'')}</small></div>`;
export function fullRoute49(o,e){return o.slices.map((s,i)=>`<div class="air46-route"><small>${label(o,i)} · ${e(duration49(s.duration))} · ${s.segments.length===1?'直飞':(s.segments.length-1)+' 次中转'}</small>${s.segments.map((g,j)=>`${j?`<aside class="transfer49"><b>中转 ${e(name(g.from))}</b> · ${e(wait49(s.segments[j-1],g))}${s.segments[j-1].to!==g.from?`<strong>需换机场：${e(s.segments[j-1].to)} → ${e(g.from)}，地面交通自行安排</strong>`:''}<small>是否需重新托运行李、办理入境手续，请核实航司和机场规定。</small></aside>`:''}<div class="air46-times">${time(g,'departure',e)}<span class="air46-arrow">→</span>${time(g,'arrival',e)}</div><p>${e(g.number)} · ${e((g.aircraft||'机型待确认').replace('Airbus','空客').replace('Boeing','波音'))}</p>`).join('')}${i<o.slices.length-1&&s.segments.at(-1).to!==o.slices[i+1].segments[0].from?`<aside class="transfer49">缺口行程：下一程从 ${e(name(o.slices[i+1].segments[0].from))} 出发，城市间交通不包含在本订单。</aside>`:''}</div>`).join('');}
export function shortRoute49(o,e){return o.slices.map((s,i)=>{const first=s.segments[0],last=s.segments.at(-1);return `<div class="air46-route"><small>${label(o,i)} · ${e(duration49(s.duration))} · ${s.segments.length===1?'直飞':`${s.segments.length-1} 次中转 · ${s.segments.slice(0,-1).map(g=>e(name(g.to))).join('、')}`}</small><div class="air46-times">${time(first,'departure',e)}<span class="air46-arrow">→</span>${time(last,'arrival',e)}</div><p>${s.segments.map(g=>e(g.number)).join(' / ')}</p></div>`;}).join('')+`<details class="route49-details"><summary>航程详情${o.slices.some(s=>s.segments.length>1)?' · 中转与换乘':''}</summary>${fullRoute49(o,e)}</details>`;}
