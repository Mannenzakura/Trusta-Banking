import {BankError,financeCash} from './bank-engine.mjs';
const types=['virtualFlightCreate','virtualFlightPay','virtualFlightCancel','virtualFlightRefund','virtualFlightExchange'];
const fail=s=>{throw new BankError(s);};const yuan=n=>'¥'+(n/100).toFixed(2);
export function virtualDescription53(s,i){
 if(!types.includes(i.type))return null;if(s.testMode!==true)fail('虚拟购票请先开启测试模式');if(['virtualFlightRefund','virtualFlightExchange'].includes(i.type))fail('退改规则未匹配：当前报价缺少运价基础、产品适用条件及税费口径，无法准确计算手续费或退款。暂不执行资金变动；不接受自行填写费用。');let quote,request,title,lines,cardId;
 if(i.type==='virtualFlightCreate'){
 const offer=s.virtualFlightOffers?.find(x=>x.id===i.offer);if(!offer||offer.expires<Date.now())fail('报价已过期，请重新选择航班');
 const passengers=i.passengers;if(!Array.isArray(passengers)||passengers.length<1||passengers.length>6||!passengers.some(p=>p.type==='adult'))fail('请选择1至6位乘机人，至少一位成人');
 if(passengers.some(p=>!['adult','child','infant'].includes(p.type)||!/^TEST-[A-Z0-9]{3,16}$/.test(p.alias))||new Set(passengers.map(p=>p.alias)).size!==passengers.length)fail('每位乘机人填写不同的TEST-代号，请勿填写真实证件');
 if(passengers.filter(p=>p.type==='infant').length>passengers.filter(p=>p.type==='adult').length)fail('每位成人最多陪同一位婴儿');
 if((s.virtualFlightOrders||[]).some(o=>o.offer.id===offer.id&&!['cancelled','refunded'].includes(o.status)))fail('该报价已有订单，请到我的订单查看');
 const amount=offer.unit*passengers.length;if(!Number.isSafeInteger(amount)||amount<=0)fail('报价金额无效');
 quote={offer,passengers:passengers.map(p=>({alias:p.alias,type:p.type})),amount};request={offer:offer.id,passengers:quote.passengers};title='确认虚拟机票订单';lines=[offer.flight.number+' '+offer.flight.from+' → '+offer.flight.to,offer.cabin.name+' · '+offer.flight.departure,...quote.passengers.map(p=>`${p.alias} · ${{adult:'成人',child:'儿童',infant:'婴儿'}[p.type]} · ${offer.cabin.name} · 测试金额 ${yuan(offer.unit)}`),...(offer.cabin.baggage?[offer.cabin.baggage.basis,'托运参考：'+(offer.cabin.baggage.checked.join('；')||'无匹配规则'),'手提参考：'+(offer.cabin.baggage.carry.join('；')||'无匹配规则')]:['行李尚未查询']),`测试合计 ${yuan(amount)}：按所选报价×人数计算，不叠加税费；儿童和婴儿使用相同练习金额，不代表真实儿童/婴儿票价。`,'供应商税费、行李与退改信息不完整，不承诺实际含税总价。真实退改规则未匹配，暂不能计算或执行退改资金操作；不生成航空公司客票。'];
 }else{
 const o=s.virtualFlightOrders?.find(o=>o.id===i.order);if(!o)fail('订单不存在');request={order:o.id};
 if(i.type==='virtualFlightPay'){if(o.status!=='pending'||o.expires<Date.now())fail('订单不可付款或已过期');cardId=i.cardId;if(!s.cards.find(c=>c.id===cardId)?.online)fail('请开启付款卡线上支付');financeCash(s,cardId,-o.amount,'虚拟机票付款','',true);request.cardId=cardId;quote={amount:o.amount,status:o.status,paymentCard:{id:cardId,nickname:s.cards.find(c=>c.id===cardId).nickname,last4:s.cards.find(c=>c.id===cardId).last4}};title='虚拟机票付款';lines=[o.id,`付款银行卡：${quote.paymentCard.nickname} · 尾号 ${quote.paymentCard.last4}`,`测试银行卡扣款 ${yuan(o.amount)}`,'仅记入本站测试账本；不发起支付宝付款、不向航司下单、不实际出票。'];}
 else if(i.type==='virtualFlightCancel'){if(o.status!=='pending')fail('仅待付款订单可取消');quote={amount:0,status:o.status};title='取消虚拟机票订单';lines=[o.id,'订单未付款，无需退款。'];}

 }
 return {id:crypto.randomUUID(),type:i.type,title,lines,strong:true,cardId,data:{request,quote,amount:quote.amount},expires:s.now+600000,createdAt:Date.now()};
}
export function virtualConfirm53(s,p){if(!types.includes(p.type))return null;const fresh=virtualDescription53(s,{type:p.type,...p.data.request});if(JSON.stringify(fresh.data.quote)!==JSON.stringify(p.data.quote))fail('订单已变化，请重新核对');s.virtualFlightOrders||=[];const q=p.data.quote;let o=s.virtualFlightOrders.find(o=>o.id===p.data.request.order);
 if(p.type==='virtualFlightCreate'){o={id:p.id,...q,status:'pending',created:Date.now(),expires:Date.now()+15*60000,history:[]};s.virtualFlightOrders.unshift(o);}
 if(p.type==='virtualFlightPay'){financeCash(s,p.cardId,-o.amount,'虚拟机票付款',o.id);o.cardId=p.cardId;o.paymentCard=structuredClone(q.paymentCard);o.status='paid';o.reference='VIRTUAL-'+o.id;}
 if(p.type==='virtualFlightCancel')o.status='cancelled';

 o.history.push({at:Date.now(),text:p.title,receipt:p.id});const receipt={id:p.id,type:p.type,orderId:o.id,title:p.title,lines:p.lines,at:s.now,amount:p.type==='virtualFlightExchange'?Math.abs(q.delta):q.amount,cardId:p.cardId,status:({pending:'待付款',paid:'虚拟购票完成（未出票）',cancelled:'已取消',refunded:'已退款'})[o.status]};s.receipts.unshift(receipt);s.pending=null;return {receipt};
}
