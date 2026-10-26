import {virtualDescription53,virtualConfirm53} from './virtual-flight53.mjs';
import {BankError,financeCash} from './bank-engine.mjs';
import {flightById} from './flight-catalog.mjs';
const types=['flightCreate','flightPay','flightIssue','flightCancel','flightRefund'];
const fail=m=>{throw new BankError(m);},cash=n=>'¥'+(n/100).toFixed(2);
export function flightDescription(s,i){
 const v=virtualDescription53(s,i);if(v)return v;
 if(!types.includes(i.type))return null;
 let request={},quote={},title='',lines=[],cardId;
 if(i.type==='flightCreate'){
  let legs;try{legs=[flightById(i.outbound,s.now),...(i.inbound?[flightById(i.inbound,s.now)]:[])];}catch(e){fail(e.message);}
  if(legs.length===2&&(legs[0].from!==legs[1].to||legs[0].to!==legs[1].from||legs[1].departure<legs[0].arrival+2*3600000))fail('返程须为反向航线，且晚于去程抵达至少2小时');
  if(!['economy','business'].includes(i.cabin))fail('请选择舱位');
  const passengers=String(i.passengers||'').toUpperCase().split(',').map(x=>x.trim());if(passengers.length<1||passengers.length>4||new Set(passengers).size!==passengers.length||passengers.some(x=>!/^TEST-[A-Z0-9]{3,16}$/.test(x)))fail('乘机人使用1至4个不重复的TEST-代号，以英文逗号分隔；勿填真实证件');
  const contact=String(i.contact||'').toUpperCase().trim();if(!/^TEST-[A-Z0-9]{3,16}$/.test(contact))fail('联系人使用TEST-代号，勿填真实电话');
  if((s.flightOrders||[]).filter(o=>!['cancelled','refunded'].includes(o.status)&&!(o.status==='pending'&&s.now>=o.expires)).some(o=>o.legs.some(l=>legs.some(f=>f.id===l.id))&&o.passengers.some(p=>passengers.includes(p))))fail('该乘机人已存在同航班订单，请先处理原订单');
  for(const leg of legs){const reserved=(s.flightOrders||[]).filter(o=>!['cancelled','refunded'].includes(o.status)&&!(o.status==='pending'&&s.now>=o.expires)&&o.legs.some(f=>f.id===leg.id)).reduce((n,o)=>n+o.passengers.length,0);if(reserved+passengers.length>leg.seats)fail('当前账户测试余位不足，请选择其他航班');}
  const fare=legs.reduce((n,f)=>n+f.fare,0)*(i.cabin==='business'?2:1)*passengers.length,tax=legs.reduce((n,f)=>n+f.tax,0)*passengers.length;
  request={outbound:i.outbound,inbound:i.inbound||'',cabin:i.cabin,passengers:passengers.join(','),contact};quote={legs,passengers,contact,fare,tax,amount:fare+tax,cabin:i.cabin};title='创建机票订单';lines=[...legs.map(f=>`${f.fromName} → ${f.toName} · ${f.date} · ${f.number}`),`${passengers.length}名成人 · ${i.cabin==='business'?'商务舱':'经济舱'}`,`票价 ${cash(fare)} + 税费 ${cash(tax)} = ${cash(fare+tax)}`,'15个测试分钟内付款；仅测试航班，不实际出票。测试托运额度：经济舱20kg、商务舱30kg；退票扣票价10%，税费全退；暂不改签。'];
 }else{
  const o=(s.flightOrders||[]).find(o=>o.id===i.order);if(!o)fail('机票订单不存在');
  if(i.type==='flightPay'){
   if(o.status!=='pending'||s.now>=o.expires||s.now>=o.legs[0].departure)fail('订单不可付款或已过期');cardId=i.cardId;
   if(!s.cards.find(c=>c.id===cardId)?.online)fail('请开启付款卡线上支付');financeCash(s,cardId,-o.amount,'机票付款','',true);quote={status:o.status,amount:o.amount};title='机票订单付款';lines=[o.id,`从测试银行卡扣款 ${cash(o.amount)}`,'付款后进入出票中，须单独完成测试出票；不调用支付宝或真实供应商。'];
  }else if(i.type==='flightIssue'){
   if(o.status!=='paid'||s.now>=o.legs[0].departure)fail('只有起飞前已付款订单可完成测试出票');quote={status:o.status,amount:0};title='完成测试出票';lines=[o.id,'生成TEST前缀凭证，不是航空公司电子客票，不能值机。'];
  }else if(i.type==='flightCancel'){
   if(o.status!=='pending')fail('仅待付款订单可取消');quote={status:o.status,amount:0};title='取消待付款机票';lines=[o.id,'尚未扣款，无需退款。'];
  }else{
   if(!['paid','ticketed'].includes(o.status)||s.now>=o.legs[0].departure)fail('仅起飞前已付款或已出票订单可退票');const fee=Math.ceil(o.fare/10);cardId=o.cardId;financeCash(s,cardId,o.amount-fee,'机票退票','',true);quote={status:o.status,fee,amount:o.amount-fee};title='机票退票退款';lines=[o.id,`原付 ${cash(o.amount)} · 退票费 ${cash(fee)} · 原卡退回 ${cash(quote.amount)}`,'确认后作废全部航段与乘机人凭证。本站测试即时处理，不提交真实航空公司。'];
  }
  request={order:o.id,...(i.type==='flightPay'?{cardId}:{})};
 }
 return {id:crypto.randomUUID(),type:i.type,title,lines,strong:true,cardId,data:{request,quote,amount:quote.amount},expires:s.now+600000,createdAt:Date.now()};
}
export function flightConfirm(s,p){
 const v=virtualConfirm53(s,p);if(v)return v;
 if(!types.includes(p.type))return null;const fresh=flightDescription(s,{type:p.type,...p.data.request});if(JSON.stringify(fresh.data.quote)!==JSON.stringify(p.data.quote))fail('机票订单已变化，请重新核对');const q=p.data.quote,r=p.data.request;s.flightOrders||=[];
 let o=s.flightOrders.find(o=>o.id===r.order);
 if(p.type==='flightCreate'){o={id:p.id,...q,at:s.now,expires:s.now+15*60000,status:'pending',history:[]};s.flightOrders.unshift(o);}
 if(p.type==='flightPay'){financeCash(s,p.cardId,-q.amount,'机票付款',o.id);o.cardId=p.cardId;o.status='paid';}
 if(p.type==='flightIssue'){o.status='ticketed';o.ticket='TEST-'+o.id;}
 if(p.type==='flightCancel')o.status='cancelled';
 if(p.type==='flightRefund'){financeCash(s,p.cardId,q.amount,'机票退票',o.id);o.status='refunded';o.refund=q.amount;o.fee=q.fee;o.ticket=null;}
 o.history.push({at:s.now,text:p.title,receipt:p.id});const receipt={id:p.id,type:p.type,orderId:o.id,title:p.title,lines:p.lines,at:s.now,amount:q.amount,cardId:p.cardId,status:({pending:'待付款',paid:'出票中',ticketed:'测试已出票',cancelled:'已取消',refunded:'已退款'})[o.status]};s.receipts.unshift(receipt);s.audit.unshift({id:crypto.randomUUID(),at:s.now,type:'完成',text:p.title});s.pending=null;return {receipt};
}
