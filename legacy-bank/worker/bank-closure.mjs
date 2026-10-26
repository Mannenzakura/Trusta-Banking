import {BankError,cents,financeCash,products} from './bank-engine.mjs';

// Versioned fixtures, not market quotes, merchant stock or external approvals.
export const FX39={USD:720,EUR:790,HKD:92,JPY:5}; // CNY cents per foreign major unit
export const FUNDS39={bond:{nav:10250,feeBps:20},index:{nav:12500,feeBps:50},global:{nav:11000,feeBps:50}};
export const SERVICES39=[
 {id:'movie',name:'星幕影城 · 星际旅程',detail:'2号厅 · 普通场 · 单人座',price:3900,slots:['A1','A2','B1','B2'],kind:'ticket'},
 {id:'hotel',name:'海岸旅居 · 标准大床房',detail:'一晚住宿 · 单间 · 次日退房',price:29900,slots:['标准房'],kind:'hotel'},
 {id:'car',name:'悦行汽车 · 基础养护',detail:'机油检查与洗车 · 上午10点到店',price:9900,slots:['10:00','14:00'],kind:'car'},
 {id:'flight',name:'云途航空 · 深圳至上海',detail:'单程 · 经济舱 · 10:00出发',price:68000,slots:['12A','12B','12C'],kind:'flight'},
 {id:'social',name:'便民服务 · 社保咨询预约',detail:'本地预约样例 · 不查询或办理真实社保',price:0,slots:['09:00','15:00'],kind:'public'},
 {id:'medical',name:'便民服务 · 医保咨询预约',detail:'本地预约样例 · 不查询真实医保',price:0,slots:['09:00','15:00'],kind:'public'},
 {id:'housing',name:'便民服务 · 公积金咨询预约',detail:'本地预约样例 · 不查询真实公积金',price:0,slots:['09:00','15:00'],kind:'public'}
];
const fail=m=>{throw new BankError(m)},money=n=>'¥'+(n/100).toFixed(2),uid=()=>crypto.randomUUID();
const types=['fxTrade','fundBuy','fundCancel','fundRedeem','bookingCreate','bookingCancel','bookingUse','parcelClaim','parcelCancel','parcelAdvance','caseReview'];
export function extraAssets(s){return (s.fxWallets||[]).reduce((n,w)=>n+w.cost,0)+(s.fundOrders||[]).filter(o=>o.status==='pending').reduce((n,o)=>n+o.amount,0);}
export function closureDescription(s,i){
 if(i.type==='buy'&&Object.hasOwn(FUNDS39,i.product))i={...i,type:'fundBuy'};
 if(i.type==='redeem'&&s.holdings.find(h=>h.id===i.holding)?.fundUnits)i={...i,type:'fundRedeem',amount:i.amount??s.holdings.find(h=>h.id===i.holding).amount/100};
 if(!types.includes(i.type))return null;
 let request={},quote={},title='',lines=[],cardId=i.cardId||(s.card?.kind==='debit'?s.card.id:null)||s.cards.find(c=>c.kind==='debit')?.id;
 if(i.type==='fxTrade'){
  if(!Object.hasOwn(FX39,i.currency)||!['buy','sell'].includes(i.side))fail('币种或方向无效');
  const units=cents(i.amount),rate=FX39[i.currency],wallet=(s.fxWallets||[]).find(w=>w.currency===i.currency);
  const amount=i.side==='buy'?Math.ceil(units*rate/100):Math.floor(units*rate/100);
  if(amount<1)fail('兑换金额不足一分');
  if(i.side==='sell'&&(!wallet||wallet.units<units))fail('外币余额不足');
  financeCash(s,cardId,i.side==='buy'?-amount:amount,'外汇兑换','',true);
  const cost=i.side==='sell'?(wallet.units===units?wallet.cost:Math.floor(wallet.cost*units/wallet.units)):amount;
  request={currency:i.currency,side:i.side,amount:i.amount,cardId};quote={units,rate,amount,cost};title=i.side==='buy'?'购入外币':'结汇至人民币';
  lines=[`${i.currency} ${(units/100).toFixed(2)}`,`测试固定汇率：1 ${i.currency} = ${money(rate)}`,`${i.side==='buy'?'扣款':'到账'} ${money(amount)}`,'使用独立外币账本，非市场成交价；不跨境汇款、不连接真实外汇账户。'];
 } else if(i.type==='fundBuy'){
  const p=products.find(p=>p.id===i.product),cfg=FUNDS39[i.product];if(!cfg||!p)fail('基金产品不存在');
  if(!s.riskAssessment||!s.riskAt||s.now-s.riskAt>365*86400000||s.risk<p.risk)fail('请完成有效且匹配的风险评估');
  const amount=cents(i.amount);if(amount<p.min)fail('低于产品起购金额');
  const fee=Math.ceil(amount*cfg.feeBps/10000),units=Math.floor((amount-fee)*1000000/cfg.nav);
  financeCash(s,cardId,-amount,'基金申购','',true);request={product:p.id,amount:i.amount,cardId};quote={amount,fee,units,nav:cfg.nav,days:p.days};
  title='基金申购订单';lines=[p.name,`扣款 ${money(amount)} · 申购费 ${money(fee)}`,`测试净值 ${(cfg.nav/10000).toFixed(4)} · 份额 ${(units/10000).toFixed(4)}`,'1个测试日后确认份额，确认前可撤单全额返还；费用与净值为固定测试配置。'];
 } else if(i.type==='fundCancel'){
  const o=(s.fundOrders||[]).find(o=>o.id===i.order&&o.status==='pending');if(!o||o.dueAt<=s.now)fail('订单已到确认时间或不可撤销');
  cardId=o.cardId;financeCash(s,cardId,o.amount,'基金撤单退款','',true);request={order:o.id};quote={amount:o.amount};title='撤销基金申购';lines=[o.id,money(o.amount),'全额退回原付款卡，包括尚未收取的费用。'];
 } else if(i.type==='fundRedeem'){
  const h=s.holdings.find(h=>h.id===i.holding&&h.fundUnits);if(!h||h.unlock>s.now)fail('基金持仓不可赎回');
  const amount=cents(i.amount);if(amount>h.amount)fail('超过持仓成本');
  const units=amount===h.amount?h.fundUnits:Math.floor(h.fundUnits*amount/h.amount);if(units<1)fail('份额不足');
  const nav=FUNDS39[h.product].nav,gross=Math.floor(units*nav/1000000),fee=Math.ceil(gross/1000),net=gross-fee;if(net<1)fail('赎回金额不足支付费用');
  cardId=h.cardId;financeCash(s,cardId,net,'基金赎回','',true);request={holding:h.id,amount:i.amount};quote={amount,units,nav,gross,fee,net,before:h.amount};title='基金赎回';
  lines=[`赎回成本 ${money(amount)} · 份额 ${(units/10000).toFixed(4)}`,`测试净值 ${(nav/10000).toFixed(4)} · 赎回费 ${money(fee)} · 到账 ${money(net)}`,'测试即时结算，原卡到账；按份额计算净额，不按本金保本退回。'];
 } else if(i.type==='bookingCreate'){
  const p=SERVICES39.find(p=>p.id===i.product);if(!p||!p.slots.includes(i.slot))fail('服务或场次无效');
  const date=String(i.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('请选择日期');const time=/^\d{2}:\d{2}$/.test(i.slot)?i.slot:'10:00';const at=Date.parse(date+'T'+time+':00+08:00');
  if(!Number.isFinite(at)||at<=s.now||at>s.now+180*86400000||new Date(at+8*3600000).toISOString().slice(0,10)!==date)fail('请选择未来180天内有效日期');
  if((s.bookings||[]).some(o=>o.product===p.id&&o.date===date&&o.slot===i.slot&&o.status!=='cancelled'))fail('本账户已预订此位置/时段');
  if(p.price&&!s.cards.find(c=>c.id===cardId)?.online)fail('请先开启付款卡线上支付');
  if(p.price)financeCash(s,cardId,-p.price,'生活预订','',true);
  request={product:p.id,date,slot:i.slot,cardId};quote={amount:p.price,at};title='确认服务预订';lines=[p.name,p.detail,date+' · '+i.slot,`实付 ${money(p.price)}`,'开始前可全额取消；开始后凭订单核销。测试库存按账户隔离，不向真实商户出票。'];
 } else if(i.type==='bookingCancel'||i.type==='bookingUse'){
  const o=(s.bookings||[]).find(o=>o.id===i.order&&o.status==='booked');if(!o)fail('预订不存在或已结束');
  if(i.type==='bookingCancel'&&s.now>=o.at)fail('已开始的服务不可直接取消，请提交业务问题');
  if(i.type==='bookingUse'&&(s.now<o.at||s.now>o.at+7*86400000))fail('请在服务开始后7个测试日内核销');
  cardId=o.cardId;if(i.type==='bookingCancel'&&o.amount)financeCash(s,cardId,o.amount,'生活退款','',true);
  request={order:o.id};quote={amount:i.type==='bookingCancel'?o.amount:0,status:o.status};title=i.type==='bookingCancel'?'取消预订并退款':'完成服务核销';lines=[o.name,o.date+' · '+o.slot,i.type==='bookingCancel'?'原路退款 '+money(o.amount):'核销不再次扣款','仅改变本站测试订单。'];
 } else if(i.type==='parcelClaim'){
  const points=(s.life?.points||[]).reduce((n,p)=>n+p.amount,0);if(points<50)fail('需要50积分');
  const destination=String(i.destination||'').trim();if(!/^TEST-[A-Za-z0-9-]{3,40}$/.test(destination))fail('收件点使用TEST-开头的虚构代号，请勿填写真实地址');
  request={destination};quote={points:50};title='积分兑换随行杯';lines=['50积分 · 每次兑换1件',destination,'发货前可取消并退回积分。物流为本地测试状态，不实际寄送。'];
 } else if(i.type==='parcelCancel'||i.type==='parcelAdvance'){
  const o=(s.parcels||[]).find(o=>o.id===i.order);if(!o)fail('订单不存在');
  if(i.type==='parcelCancel'&&o.status!=='created')fail('只有待发货订单可以取消');
  if(i.type==='parcelAdvance'&&!['created','shipped'].includes(o.status))fail('物流状态不可变更');
  request={order:o.id};quote={status:o.status};title=i.type==='parcelCancel'?'取消积分订单':o.status==='created'?'测试发货':'确认收货';lines=['随行杯',o.destination,'仅推进本站测试物流，不调用快递服务。'];
 } else if(i.type==='caseReview'){
  const c=s.cases?.find(c=>c.id===i.caseId&&c.status==='open');if(!c)fail('事项不存在或已结束');request={caseId:c.id};quote={receipt:c.receipt};title='核查并结案';
  const r=c.receipt?s.receipts.find(r=>r.id===c.receipt):null;lines=[c.topic,r?`关联回执：${r.title} · ${r.status}`:'没有关联回执，仅记录说明','本地核查结果不等于人工客服答复，不自动执行退款；确认后标记已核查。'];
 }
 return {id:uid(),type:i.type,title,lines,strong:true,cardId,data:{request,quote,amount:i.type==='fundRedeem'?quote.net:(quote.amount||0)},expires:s.now+600000,createdAt:Date.now()};
}
export function closureConfirm(s,p){
 if(!types.includes(p.type))return null;
 const fresh=closureDescription(s,{type:p.type,...p.data.request});if(JSON.stringify(fresh.data.quote)!==JSON.stringify(p.data.quote))fail('业务状态已变化，请重新核对');
 const r=p.data.request,q=p.data.quote;let status='已完成';
 if(p.type==='fxTrade'){
  s.fxWallets||=[];let w=s.fxWallets.find(w=>w.currency===r.currency);if(!w){w={currency:r.currency,units:0,cost:0};s.fxWallets.push(w);}
  financeCash(s,p.cardId,r.side==='buy'?-q.amount:q.amount,'外汇兑换',r.currency+' '+r.side);
  const sign=r.side==='buy'?1:-1;w.units+=sign*q.units;w.cost+=sign*q.cost;s.fxTrades||=[];s.fxTrades.unshift({id:p.id,at:s.now,...r,...q});
 }
 if(p.type==='fundBuy'){financeCash(s,p.cardId,-q.amount,'基金申购',r.product);s.fundOrders||=[];s.fundOrders.unshift({id:p.id,cardId:p.cardId,product:r.product,...q,at:s.now,dueAt:s.now+86400000,status:'pending'});status='待确认份额';}
 if(p.type==='fundCancel'){const o=s.fundOrders.find(o=>o.id===r.order);financeCash(s,o.cardId,o.amount,'基金撤单退款',o.product);o.status='cancelled';o.closedAt=s.now;status='已取消';}
 if(p.type==='fundRedeem'){const h=s.holdings.find(h=>h.id===r.holding);financeCash(s,h.cardId,q.net,'基金赎回',h.product);h.amount-=q.amount;h.fundUnits-=q.units;if(!h.amount)s.holdings=s.holdings.filter(x=>x.id!==h.id);s.fundSales||=[];s.fundSales.unshift({id:p.id,at:s.now,holding:r.holding,...q});}
 if(p.type==='bookingCreate'){if(q.amount)financeCash(s,p.cardId,-q.amount,'生活预订',r.product);s.bookings||=[];s.bookings.unshift({id:p.id,...r,...q,name:SERVICES39.find(x=>x.id===r.product).name,status:'booked',code:'TEST-'+p.id.slice(0,8),history:[{at:s.now,text:'预订成功'}]});status='已预订';}
 if(p.type==='bookingCancel'||p.type==='bookingUse'){const o=s.bookings.find(o=>o.id===r.order);if(q.amount)financeCash(s,o.cardId,q.amount,'生活退款',o.name);o.status=p.type==='bookingCancel'?'cancelled':'used';o.history.push({at:s.now,text:p.title});status=o.status==='cancelled'?'已取消':'已核销';}
 if(p.type==='parcelClaim'){s.life||={orders:[],points:[],observations:[]};s.life.points.unshift({id:p.id,amount:-50,at:s.now,note:'兑换随行杯'});s.parcels||=[];s.parcels.unshift({id:p.id,...r,status:'created',history:[{at:s.now,text:'待发货'}]});status='待发货';}
 if(p.type==='parcelCancel'||p.type==='parcelAdvance'){const o=s.parcels.find(o=>o.id===r.order);if(p.type==='parcelCancel'){o.status='cancelled';s.life.points.unshift({id:p.id,amount:50,at:s.now,note:'取消随行杯兑换'});}else o.status=o.status==='created'?'shipped':'received';o.history.push({at:s.now,text:p.title});status=({cancelled:'已取消',shipped:'已发货',received:'已收货'})[o.status];}
 if(p.type==='caseReview'){const c=s.cases.find(c=>c.id===r.caseId);c.status='reviewed';c.history.push({at:s.now,message:p.lines.join('；')});status='已核查';}
 const receipt={id:p.id,type:p.type,at:s.now,title:p.title,lines:p.lines,amount:p.data.amount,fee:q.fee||0,cardId:p.cardId,status};s.receipts.unshift(receipt);s.pending=null;s.audit.unshift({id:uid(),at:s.now,type:'完成',text:p.title});return {receipt};
}
export function tickFunds(s){
 for(const o of s.fundOrders||[]){if(o.status!=='pending'||o.dueAt>s.now)continue;
  const h={id:uid(),product:o.product,cardId:o.cardId,amount:o.amount-o.fee,fundUnits:o.units,nav:o.nav,bought:s.now,unlock:s.now+o.days*86400000,receiptId:o.id,contract:{version:'TEST-FUND-39',description:'固定测试净值与申购费用已在确认单披露；按份额结算赎回，存在费用损失，不承诺本金。',nav:o.nav,fee:o.fee,days:o.days}};
  s.holdings.unshift(h);o.status='settled';o.holding=h.id;o.settledAt=s.now;s.serviceEvents||=[];s.serviceEvents.unshift({id:uid(),at:s.now,type:'fundSettlement',title:'基金份额已确认',status:'已完成',lines:[o.id,`份额 ${(o.units/10000).toFixed(4)} · 已收费用 ${money(o.fee)}`],transactionIds:[]});
 }
}
