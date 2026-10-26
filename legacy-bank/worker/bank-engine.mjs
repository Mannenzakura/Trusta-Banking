import {flightDescription,flightConfirm} from './bank-flight.mjs';
import {closureDescription,closureConfirm,tickFunds} from './bank-closure.mjs';
import {serviceDescription,serviceConfirm,tickRenewals} from './bank-service.mjs';
import {lifeDescription,lifeConfirm} from './bank-life.mjs';
import {financeDescription,financeConfirm} from './bank-finance.mjs';
// Competition sandbox: integer cents, deterministic tools, no real banking rails.
export const contacts=[{id:'lin',name:'林晓',phone:'138****6021',note:'室友'},{id:'chen',name:'陈宇',phone:'139****3186',note:'同学'},{id:'mom',name:'妈妈',phone:'136****8802',note:'家人'}];
export const products=[{id:'cash',name:'朝夕现金管理',risk:1,days:0,rate:'1.60%–2.10%',min:10000,description:'模拟现金管理产品，支持当日赎回。收益区间仅用于演示，不作收益承诺。'},{id:'steady',name:'稳盈 90 天',risk:2,days:90,rate:'2.40%–3.20%',min:100000,description:'模拟固定期限产品，持有期内不可赎回。本金和收益均不保证。'},{id:'growth',name:'远见多资产',risk:3,days:0,rate:'净值浮动',min:100000,description:'模拟高波动组合，可能发生本金亏损，适合较高风险承受能力。'}];
products.push(
 {id:'deposit',name:'定期存款体验',risk:1,days:30,rate:'不计演示利息',min:5000,description:'存款流程模拟，演示到期取回本金；不代表真实存款合同或利率。'},
 {id:'bond',name:'债券组合体验',risk:2,days:30,rate:'净值浮动',min:10000,description:'模拟债券组合，存在利率和信用风险，不承诺保本。'},
 {id:'index',name:'宽基指数体验',risk:4,days:0,rate:'净值浮动',min:10000,description:'模拟权益类配置，可能产生较大本金损失；演示赎回按本金，不展示虚构收益。'},
 {id:'gold',name:'黄金资产体验',priceCents:80000,risk:4,days:0,rate:'价格浮动',min:10000,description:'固定演示价 ¥800/克，按金额买入，显示模拟克数；赎回按本金，无真实黄金交割或收益。市场行情仅供参考。'},
 {id:'global',name:'全球资产体验',risk:5,days:0,rate:'净值浮动',min:100000,description:'模拟全球多资产配置，涉及市场与汇率风险，不连接真实交易。'}
);
for(const p of products)if(['bond','index','global'].includes(p.id))p.description='测试份额产品：固定净值、申购费用、1个测试日后确认份额；确认前可撤单，赎回按份额计算并扣费，不保本。不连接真实基金交易。';
export class BankError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const fail=m=>{throw new BankError(m);};
export const cents=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1000000||Math.abs(v*100-Math.round(v*100))>0.00001)fail('请输入有效金额，最多两位小数。');return Math.round(v*100);};
const id=()=>crypto.randomUUID();
const fmt=n=>(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2});
export function normalizeCards(s){
 if(!Array.isArray(s.cards)||!s.cards.length)s.cards=[{...s.card,id:'card-main',nickname:'日常生活卡',theme:'forest',pattern:'contour'}];
 for(const c of s.cards){c.kind||='debit';c.accountClass=c.kind==='credit'?null:(c.accountClass|| (s.cards.indexOf(c)===0?'I':'II'));c.nickname||='我的借记卡';c.theme||='forest';c.pattern||='contour';c.applications||=[];if(c.kind==='credit'){c.creditLimit??=1000000;c.outstanding??=0;c.creditEntries||=[];c.statements||=[];c.nextStatementAt||=nextCreditMonth(s.now);}c.classQuota=accountQuota(s,c);}
 s.activeCardId=s.cards.some(c=>c.id===s.activeCardId)?s.activeCardId:s.cards[0].id;s.card=s.cards.find(c=>c.id===s.activeCardId);
 for(const p of s.plans||[])p.cardId||=s.cards[0].id;
 for(const sub of s.subscriptions||[])sub.cardId||=s.cards[0].id;
 if(s.pending)s.pending.cardId||=s.cards[0].id;
 normalizeCashAccounts(s);for(const c of s.cards)c.classQuota=accountQuota(s,c);s.readNotifications||=[];s.contacts||=structuredClone(contacts);s.benefits||=[];s.version=3;return s;
}
function cardFor(s,cardId){const c=s.cards.find(c=>c.id===cardId);if(!c)fail('卡片不存在。');return c;}
function audit(s,type,text){s.audit.unshift({id:id(),at:s.now,type,text});}
function ledger(s,amount,category,merchant,note,cardId=s.card.id,context={}){checkAccountQuota(s,cardFor(s,cardId),amount,category);s.transactions.unshift({id:id(),at:s.now,amount,category,merchant,note,cardId,fee:0,currency:'CNY',channel:'模拟账本',recipient:context.recipient?structuredClone(context.recipient):null,status:'已入账',...context});cardFor(s,cardId).balance+=amount;s.balance=s.cards.filter(c=>c.kind==='debit').reduce((n,c)=>n+c.balance,0);}
export function initialState(now=Date.now()){
 const date=new Date(now);const tx=[[-38600,'购物','优选数码','耳机'],[-6800,'餐饮','街角餐厅','午餐'],[-2800,'交通','城市出行','通勤'],[-250000,'居住','房租','月租'],[1200000,'收入','实习工资','工资入账'],[-2500,'订阅','云音乐','月度会员'],[-1800,'订阅','云空间','自动续费'],[-9900,'订阅','学习平台','月度会员'],[-89900,'购物','海外商户','异地消费，待核实'],[-6800,'餐饮','街角餐厅','疑似重复扣费'],[-6800,'餐饮','街角餐厅','疑似重复扣费'],[-4200,'生活','便利店','日用品']];
 return normalizeCards({now,balance:2865240,reserved:0,risk:0,riskAt:null,card:{status:'active',limit:500000,online:true,last4:'0628',applications:[]},transactions:tx.map((t,i)=>({id:'seed-'+i,at:now-(i+1)*86400000,amount:t[0],category:t[1],merchant:t[2],note:t[3],status:'已入账'})),subscriptions:[{id:'music',name:'云音乐',amount:2500,next:now+2*86400000,status:'active',remind:true},{id:'cloud',name:'云空间',amount:1800,next:now+5*86400000,status:'active',remind:true},{id:'study',name:'学习平台',amount:9900,next:now+86400000,status:'active',remind:false}],holdings:[{id:'seed-holding',product:'cash',amount:1200000,bought:now-60*86400000,unlock:now-60*86400000}],plans:[],splits:[],audit:[{id:id(),at:now,type:'系统',text:'独立模拟账户已建立；所有资金、联系人和产品均为演示数据。'}],pending:null,receipts:[],messages:[],blocked:0,version:1});
}
function requireCash(s,n,c=s.card){if(c.kind!=='debit')fail('请选择借记卡');if(n>c.balance-cardReserved(s,c.id))fail('可用余额不足，请调整金额或取消已有资金预留。');}
function requireCard(s,n){if(s.card.kind==='credit')fail('信用卡不支持此借记账户资金操作，请切换借记卡。');if(s.card.status!=='active')fail('卡片已锁定或挂失，请先恢复卡片状态。');if(n>s.card.limit)fail('金额超过当前单笔交易限额。');}
function amountToday(s){const day=new Date(s.now).toISOString().slice(0,10);return s.transactions.filter(t=>t.category==='转账'&&new Date(t.at).toISOString().slice(0,10)===day).reduce((a,t)=>a-t.amount,0);}
function validateTasks(tasks){if(tasks===undefined)return [];if(!Array.isArray(tasks)||tasks.length>12)fail('最多设置 12 个步骤。');return tasks.map(t=>{const label=String(t||'').trim();if(!label||label.length>80)fail('步骤须为 1–80 字。');return {id:id(),label,done:false};});}
function validateRecipient(v){const name=String(v.name||'').trim(),bank=String(v.bank||'').trim(),account=String(v.account||'');if(!name||name.length>24||!bank||bank.length>40||!/^\d{12,19}$/.test(account))fail('请填写有效模拟收款信息。');return {name,bank,account,phone:bank+' · 尾号 '+account.slice(-4)};}
function contact(v,s){const c=(s?.contacts||contacts).find(c=>c.id===v);if(!c)fail('请选择已保存的收款人。');return c;}
function future(s,v){const n=Date.parse(v);if(!Number.isFinite(n)||n<s.now+60000||n>s.now+366*86400000)fail('执行时间需在模拟时钟一分钟之后、一年以内。');return n;}
export function describeAction(s,input){
 normalizeCards(s);
 if(!input||typeof input!=='object')fail('操作格式无效。');
 if(s.card.kind==='credit'&&['transfer','buy','birthday','event','planPayment','workflow'].includes(input.type))fail('请选择借记卡办理此资金业务，信用卡请在卡包办理消费与还款。');
 const extra=flightDescription(s,input)||closureDescription(s,input)||serviceDescription(s,input)||lifeDescription(s,input)||financeDescription(s,input)||depositDescription(s,input)||ownTransferDescription(s,input)||creditDescription(s,input)||advancedDescription(s,input);if(extra)return extra;
 const type=input.type;let data={},title='',lines=[],strong=false;
 if(type==='transfer') {const c=input.recipient?validateRecipient(input.recipient):contact(input.contact,s);const n=cents(input.amount);requireCash(s,n);requireCard(s,n);if(c.archived)fail('该收款人已停用，请恢复后再转账');data={contact:c.id||null,recipient:structuredClone(c),amount:n,at:input.at?future(s,input.at):null};strong=true;title=data.at?'预约模拟转账':'确认模拟转账';lines=[`收款人：${c.name} · ${c.phone}`,`金额：¥${fmt(n)}`,data.at?`执行时间：${new Date(data.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}，资金先预留`:'执行后写入模拟账本'];}
 else if(type==='split'){const n=cents(input.amount);if(!Array.isArray(input.people))fail('请选择 AA 参与人。');const people=[...new Set(input.people)];if(!people.length||people.length>3)fail('请选择 1–3 位 AA 参与人。');people.forEach(v=>contact(v,s));if(n<people.length+1)fail('总金额不足以让每人分摊至少一分。');data={amount:n,people};title='创建 AA 收款单';lines=[`账单总额：¥${fmt(n)}`,`你和 ${people.length} 位朋友共同分摊`,`创建收款请求，不自动扣除朋友账户资金`];}
 else if(type==='buy'){const p=products.find(p=>p.id===input.product);if(!p)fail('产品不存在。');const n=cents(input.amount);if(!s.risk||!s.riskAssessment||s.now-s.riskAt>365*86400000)fail('请先完成有效的 10 项风险评估。');if(s.risk<p.risk)fail('产品风险等级高于你的风险承受能力，暂不允许申购。');if(n<p.min)fail(`该产品最低申购 ¥${fmt(p.min)}。`);requireCash(s,n);requireCard(s,n);data={product:p.id,amount:n,...(p.id==='gold'?{priceCents:p.priceCents,goldUnits:Math.floor(n*1000000/p.priceCents)}:{})};strong=true;title='申购模拟理财';lines=[p.name,`金额：¥${fmt(n)} · 风险 R${p.risk}`,p.days?`持有期 ${p.days} 天，期间不可赎回`:'演示环境支持当日赎回','非真实产品，不构成投资建议；本金及收益不保证'];}
 else if(type==='redeem'){const h=s.holdings.find(h=>h.id===input.holding);if(!h)fail('持仓不存在或已赎回。');if(h.unlock>s.now)fail('尚未到期，暂不支持提前赎回。');const amount=input.amount===undefined?h.amount:cents(input.amount);if(amount>h.amount)fail('赎回金额超过持仓本金');const target=cardFor(s,h.cardId);if(target.status!=='active')fail('原扣款卡不可用，请先恢复卡片后赎回');data={holding:h.id,amount,quotedAmount:h.amount};strong=true;title='赎回模拟理财';lines=[products.find(p=>p.id===h.product).name,`赎回本金：¥${fmt(amount)}`,`到账账户：${target.nickname} · 尾号 ${target.last4}`,`剩余本金：¥${fmt(h.amount-amount)}`,'确认后即时返还原扣款卡；按本金赎回，不编造实际收益'];}
 else if(type==='card'){if(!['lock','unlock','lost','replace','limit','online','apply'].includes(input.operation))fail('卡片操作无效。');data={operation:input.operation};const labels={lock:'锁定卡片',unlock:'解锁卡片',lost:'挂失卡片',replace:'补办模拟卡',limit:'调整交易限额',online:'调整线上交易',apply:'申请模拟借记卡'};title=labels[input.operation];strong=['unlock','lost','replace','limit','apply'].includes(input.operation);if(input.operation==='limit')data.limit=cents(input.limit);if(input.operation==='online'){if(typeof input.enabled!=='boolean')fail('设置无效');data.enabled=input.enabled;}if(input.operation==='unlock'&&s.card.status==='lost')fail('挂失后请通过补办流程恢复，不能直接解锁。');if(input.operation==='replace'&&s.card.status!=='lost')fail('只有挂失卡片可以补办。');lines=[`卡尾号 ${s.card.last4}`,data.limit?`新单笔限额 ¥${fmt(data.limit)}`:'确认后更新模拟卡片状态'];}
 else if(type==='subscription'){const sub=s.subscriptions.find(x=>x.id===input.id);if(!sub)fail('订阅不存在');if(!['cancel','resume','remind'].includes(input.operation))fail('订阅操作无效');data={id:sub.id,operation:input.operation};title=input.operation==='cancel'?'取消模拟代扣':input.operation==='resume'?'恢复模拟代扣':'切换续费提醒';lines=[sub.name,`每期 ¥${fmt(sub.amount)}`,'仅修改模拟授权，不影响真实服务商'];}
 else if(type==='birthday'){const c=contact(input.contact,s);const n=cents(input.amount);if(n<10000)fail('生日计划预算至少 ¥100。');requireCash(s,n);const at=future(s,input.at);data={contact:c.id,amount:n,at};strong=true;title='确认生日联动计划';lines=[`对象：${c.name} · 预算 ¥${fmt(n)}`,'先锁定预算 → 到期检查 → 预订鲜花和蛋糕 → 记账','60% 预算用于鲜花、40% 用于蛋糕；均为模拟服务商','执行前可取消并释放全部预留资金'];}
 else if(type==='event') {const name=String(input.name||'').trim();if(!name||name.length>40)fail('活动名称须为 1–40 字。');if(!['生日','纪念日','节日','演唱会','旅行','自定义'].includes(input.category))fail('请选择活动类型。');const n=input.amount===0?0:cents(input.amount);requireCash(s,n);data={name,category:input.category,amount:n,at:future(s,input.at),note:String(input.note||'').slice(0,240),tasks:validateTasks(input.tasks)};strong=true;title='确认活动计划';lines=[name,`预算预留 ¥${fmt(n)}`,'到期仅提醒，不自动购票或付款；可暂停、编辑或取消'];}
 else if(type==='planPayment'){const plan=s.plans.find(x=>x.id===input.plan&&x.type==='event'&&['scheduled','ready','paused'].includes(x.status));if(!plan)fail('计划不可付款');const n=cents(input.amount);if(n>plan.amount)fail('金额超过计划剩余预算，请先编辑预算。');const merchant=String(input.merchant||'').trim();if(!merchant||merchant.length>60)fail('请填写模拟商户名称。');const card=cardFor(s,plan.cardId);if(card.status!=='active'||n>card.limit||n>card.balance)fail('卡片状态、限额或余额不允许付款。');data={plan:plan.id,amount:n,merchant};strong=true;title='确认计划模拟付款';lines=[plan.title,merchant,`金额 ¥${fmt(n)}，从预留预算结算`,'需要独立转账密码确认，不调用真实商户'];}
 else if(type==='cancelPlan'){const p=s.plans.find(p=>p.id===input.id&&['scheduled','ready','paused'].includes(p.status));if(!p)fail('计划已完成或不可取消');data={id:p.id};title='取消计划并释放资金';lines=[p.title,`释放预留 ¥${fmt(p.amount)}`];}
 else if(type==='clock'){const days=Number(input.days);if(!Number.isInteger(days)||days<1||days>120)fail('请选择 1–120 天。');data={days};title='推进演示时钟';lines=[`向前推进 ${days} 天`,'处理到期转账、生日服务与订阅扣费','用于比赛演示，不改变真实世界时间'];}
 else fail('不支持的操作类型。');
 if(type==='card'&&data.operation==='apply'){data.kind=input.kind||'debit';title=data.kind==='credit'?'申请模拟信用卡':'申请模拟借记卡';if(!['debit','credit'].includes(data.kind))fail('卡种无效');data.accountClass=data.kind==='credit'?null:(input.accountClass||'II');if(data.kind==='debit'&&!['I','II'].includes(data.accountClass))fail('账户类别无效');if(data.accountClass==='I'&&s.cards.some(c=>c.kind==='debit'&&c.accountClass==='I'))fail('模拟规则：已有Ⅰ类账户，请选择Ⅱ类借记卡。');if(s.cards.length>=8)fail('最多可创建 8 张模拟卡。');lines=data.kind==='credit'?['创建模拟信用卡，授信额度 ¥10,000','支持消费、按月出账和还款；授信不增加现金余额']:['创建模拟'+data.accountClass+'类借记卡','新卡余额为零，卡片独立记账；可从本人其他借记卡转入资金'];}
 if(type==='buy'&&data.product==='gold')lines.push(`固定演示价：¥${fmt(data.priceCents)}/克 · 模拟克数 ${(data.goldUnits/1000000).toFixed(6)}；截取至六位小数，按原本金赎回，不以市场报价结算。`);
 if(type==='transfer')lines.push('手续费：¥0.00',data.at?'按预约时间执行；执行前可取消并释放预留':'核对确认后立即记账；完成后可下载回执');
 if(['transfer','buy','birthday'].includes(type))lines.unshift(`使用卡片：${s.card.nickname} · 尾号 ${s.card.last4}`);
 return {id:id(),type,data,title,lines,strong,cardId:type==='planPayment'?s.plans.find(x=>x.id===data.plan).cardId:s.card.id,expires:s.now+10*60000,createdAt:Date.now()};
}
export function prepare(s,input){normalizeCards(s);const selected=s.activeCardId;try{if(input?.cardId){s.card=cardFor(s,input.cardId);s.activeCardId=s.card.id;}s.pending=null;s.pending=describeAction(s,input);s.pending.level=s.pending.strong?'red':'yellow';audit(s,'待确认',s.pending.id+' '+s.pending.title);return s.pending;}finally{s.activeCardId=selected;s.card=cardFor(s,selected);}}
export function tick(s){
 normalizeCards(s);
 for(const c of s.cards)if(c.kind==='credit')closeCredit(s,c);
 tickWorkflows(s);
 tickRenewals(s);
 tickFunds(s);
 for(const p of s.plans.filter(p=>p.status==='scheduled'&&p.at<=s.now)){
  if(p.type==='event'){p.status='ready';p.steps.push('已到提醒时间，请核对活动并手动办理；预算仍预留');continue;}
  s.reserved-=p.amount;const executionCard=cardFor(s,p.cardId);
  if(executionCard.kind==='credit'||executionCard.status!=='active'||p.amount>executionCard.limit||p.amount>executionCard.balance||!quotaAllowed(s,executionCard,-p.amount,'生活')){p.status='failed';p.steps.push('执行检查未通过，预留资金已释放');audit(s,'失败',p.title+'：卡状态、限额或余额不满足，未扣款');continue;}
  if(p.type==='transfer'){ledger(s,-p.amount,'转账',(p.recipient||contact(p.contact,s)).name,'预约转账',p.cardId,{planId:p.id,receiptId:p.confirmationId,recipient:p.recipient||contact(p.contact,s)});p.steps.push('模拟转账成功');}
  else {const flower=Math.floor(p.amount*0.6);ledger(s,-flower,'生活','花间模拟花店','生日计划鲜花',p.cardId,{planId:p.id,receiptId:p.confirmationId});ledger(s,-(p.amount-flower),'生活','甜日模拟烘焙','生日计划蛋糕',p.cardId,{planId:p.id,receiptId:p.confirmationId});p.orders=[{id:id(),service:'鲜花',amount:flower,status:'模拟预订成功'},{id:id(),service:'蛋糕',amount:p.amount-flower,status:'模拟预订成功'}];p.steps.push('鲜花预订完成','蛋糕预订完成','资金结算完成');}
  p.status='completed';audit(s,'完成',p.title+'执行完成');
 }
 for(const sub of s.subscriptions.filter(x=>x.status==='active'&&x.next<=s.now)){
  const debitCard=cardFor(s,sub.cardId),cycle={id:id(),at:s.now,dueAt:sub.next,title:sub.name+' · 周期代扣',type:'subscription',cardId:sub.cardId,amount:sub.amount,subscriptionId:sub.id,transactionIds:[]};s.serviceEvents||=[];
  if(debitCard.balance-cardReserved(s,debitCard.id)>=sub.amount&&debitCard.status==='active'&&debitCard.online&&sub.amount<=debitCard.limit&&debitCard.kind!=='credit'&&quotaAllowed(s,debitCard,-sub.amount,'订阅')){ledger(s,-sub.amount,'订阅',sub.name,'模拟周期代扣',sub.cardId,{serviceEventId:cycle.id,subscriptionId:sub.id});cycle.status='已完成';cycle.transactionIds=[s.transactions[0].id];cycle.lines=['本期扣款成功，下期重新校验授权与账户状态'];audit(s,'代扣',sub.name+'扣费成功');}else{cycle.status='失败';cycle.lines=['本期未扣款：请检查绑定卡状态、可用余额、线上支付开关和限额；本期不自动补扣'];audit(s,'失败',sub.name+'代扣失败；保留订阅，不补扣');}s.serviceEvents.unshift(cycle);
  // Skipped periods are not retroactively charged when advancing the demo clock.
  sub.next=s.now+(sub.periodDays||30)*86400000;
 }
}
function confirmInternal(s,pendingId,pin){
 if(s.receipts.some(r=>r.id===pendingId))return {duplicate:true,receipt:s.receipts.find(r=>r.id===pendingId)};
 const p=s.pending;if(!p||p.id!==pendingId)fail('确认单不存在，请重新发起操作。');if(p.expires<s.now||Date.now()-p.createdAt>600000)fail('确认单已过期，请重新发起。');if((p.strong||p.type==='transfer')&&pin!==true)fail('交易密码验证未通过。');
 const d=p.data;
 const extra=flightConfirm(s,p)||closureConfirm(s,p)||serviceConfirm(s,p)||lifeConfirm(s,p)||financeConfirm(s,p)||depositConfirm(s,p)||ownTransferConfirm(s,p)||creditConfirm(s,p)||advancedConfirm(s,p);if(extra)return extra;
 if(p.type==='transfer'){requireCash(s,d.amount);requireCard(s,d.amount);if(d.amount+amountToday(s)>100000&&pin!==true)fail('交易必须经过密码验证。');if(d.at){s.reserved+=d.amount;s.plans.unshift({id:id(),confirmationId:p.id,cardId:s.card.id,type:'transfer',contact:d.contact,recipient:d.recipient,amount:d.amount,at:d.at,status:'scheduled',title:'转账给'+(d.recipient||contact(d.contact,s)).name,steps:['收款人已确认','资金已预留']});}else ledger(s,-d.amount,'转账',(d.recipient||contact(d.contact,s)).name,'即时模拟转账',s.card.id,{recipient:d.recipient||contact(d.contact,s)});}
 if(p.type==='split'){const count=d.people.length+1,each=Math.floor(d.amount/count),rem=d.amount%count;s.splits.unshift({id:id(),amount:d.amount,at:s.now,self:each+rem,participants:d.people.map(c=>({contact:c,amount:each,status:'待支付'}))});}
 if(p.type==='buy'){const product=products.find(x=>x.id===d.product);if(!s.risk||!s.riskAssessment||s.now-s.riskAt>365*86400000||s.risk<product.risk)fail('当前风险评估不匹配');requireCash(s,d.amount);requireCard(s,d.amount);ledger(s,-d.amount,'理财',product.name,'模拟申购');const h={id:id(),product:d.product,cardId:s.card.id,amount:d.amount,bought:s.now,unlock:s.now+product.days*86400000,...(d.product==='gold'?{priceCents:d.priceCents||product.priceCents,goldUnits:d.goldUnits??Math.floor(d.amount*1000000/product.priceCents)}:{})};s.holdings.unshift(h);if(d.product==='gold'){s.goldTrades||=[];s.goldTrades.unshift({id:p.id,holding:h.id,side:'buy',amount:h.amount,goldUnits:h.goldUnits,priceCents:h.priceCents,cardId:h.cardId,at:s.now});}}
 if(p.type==='redeem'){const h=s.holdings.find(h=>h.id===d.holding);if(!h||h.unlock>s.now)fail('持仓不可赎回');const amount=d.amount??h.amount;if(amount>h.amount||(d.quotedAmount!==undefined&&d.quotedAmount!==h.amount))fail('持仓已变更，请重新核对赎回');if(cardFor(s,h.cardId).status!=='active')fail('原扣款卡不可用，请先恢复卡片后赎回');const units=h.goldUnits==null?null:amount===h.amount?h.goldUnits:Number(BigInt(h.goldUnits)*BigInt(amount)/BigInt(h.amount));ledger(s,amount,'理财',products.find(x=>x.id===h.product).name,'本金赎回',h.cardId);if(h.product==='gold'){s.goldTrades||=[];s.goldTrades.unshift({id:p.id,holding:h.id,side:'sell',amount,goldUnits:units,priceCents:h.priceCents??null,cardId:h.cardId,at:s.now});if(units!==null)h.goldUnits-=units;}h.amount-=amount;if(h.amount===0)s.holdings=s.holdings.filter(x=>x.id!==h.id);}

 if(p.type==='card'){const op=d.operation;if(op==='lock')s.card.status='locked';if(op==='unlock'){if(s.card.status==='lost')fail('挂失卡不能直接解锁');s.card.status='active';}if(op==='lost')s.card.status='lost';if(op==='replace'){if(s.card.status!=='lost')fail('仅挂失卡可补办');s.card.status='active';s.card.last4=String(1000+Math.floor(Math.random()*8999));}if(op==='limit')s.card.limit=d.limit;if(op==='online')s.card.online=d.enabled;if(op==='apply'){if(s.cards.length>=8)fail('最多可创建 8 张模拟卡。');let last4;do{last4=String(1000+Math.floor(Math.random()*9000));}while(s.cards.some(c=>c.last4===last4));const newCard={id:id(),kind:d.kind||'debit',accountClass:d.kind==='credit'?null:(d.accountClass||'II'),balance:0,creditLimit:d.kind==='credit'?1000000:0,outstanding:0,nickname:(d.kind==='credit'?'信用卡 ':'借记卡 ')+(s.cards.length+1),theme:['midnight','graphite','champagne'][s.cards.length%3],pattern:'contour',status:'active',limit:500000,online:true,last4,applications:[]};s.cards.push(newCard);s.card.applications.unshift({id:id(),at:s.now,status:'模拟开卡成功 · 尾号 '+last4});}}
 if(p.type==='subscription'){const sub=s.subscriptions.find(x=>x.id===d.id);if(d.operation==='cancel')sub.status='cancelled';if(d.operation==='resume'){sub.status='active';sub.next=Math.max(sub.next,s.now+86400000);}if(d.operation==='remind')sub.remind=!sub.remind;}
 if(p.type==='birthday'){requireCash(s,d.amount);s.reserved+=d.amount;s.plans.unshift({id:id(),confirmationId:p.id,cardId:s.card.id,type:'birthday',contact:d.contact,amount:d.amount,at:d.at,status:'scheduled',title:(d.recipient||contact(d.contact,s)).name+'的生日安排',steps:['生日需求已保存','预算已锁定','等待触发日期'],orders:[]});}
 if(p.type==='event'){requireCash(s,d.amount);s.reserved+=d.amount;s.plans.unshift({id:id(),confirmationId:p.id,cardId:s.card.id,type:'event',...d,title:d.name,status:'scheduled',steps:['活动已保存','预算已预留','等待提醒时间']});}
 if(p.type==='planPayment'){const plan=s.plans.find(x=>x.id===d.plan&&['scheduled','ready','paused'].includes(x.status));if(!plan||plan.amount<d.amount)fail('计划预算已变更，请重新确认。');requireCard(s,d.amount);if(s.card.balance<d.amount)fail('余额不足');checkAccountQuota(s,s.card,-d.amount,'生活');s.reserved-=d.amount;plan.amount-=d.amount;ledger(s,-d.amount,'生活',d.merchant,'联动计划模拟付款');plan.steps.push('已确认模拟付款 ¥'+fmt(d.amount)+'，剩余预算 ¥'+fmt(plan.amount));}
 if(p.type==='cancelPlan'){const plan=s.plans.find(x=>x.id===d.id&&['scheduled','ready','paused'].includes(x.status));if(!plan)fail('计划不可取消');s.reserved-=plan.amount;plan.status='cancelled';plan.steps.push('用户取消，资金已释放');}
 if(p.type==='clock'){s.now+=d.days*86400000;tick(s);}
 const receipt={id:p.id,title:p.title,at:s.now,lines:p.lines,cardId:p.cardId,amount:d.amount??null,fee:0,status:'已完成',planId:s.plans.find(x=>x.confirmationId===p.id)?.id||null};s.receipts.unshift(receipt);s.pending=null;audit(s,'完成',p.title);return {receipt};
}
export function confirm(s,pendingId,pin){normalizeCards(s);const selected=s.activeCardId,oldIds=new Set(s.transactions.map(t=>t.id)),oldHoldings=new Set(s.holdings.map(h=>h.id)),pending=s.pending?.id===pendingId?structuredClone(s.pending):null;try{if(pending)s.card=cardFor(s,pending.cardId);const result=confirmInternal(s,pendingId,pin);if(result.receipt&&!result.duplicate&&pending){const r=result.receipt;r.type=pending.type;r.transactionIds=s.transactions.filter(t=>!oldIds.has(t.id)).map(t=>{t.receiptId=r.id;return t.id;});r.holdingId=pending.data.holding||s.holdings.find(h=>!oldHoldings.has(h.id))?.id||null;if(r.holdingId&&pending.type==='buy')Object.assign(s.holdings.find(h=>h.id===r.holdingId),{receiptId:r.id,contract:{version:'TEST-PRODUCT-37',...structuredClone(products.find(x=>x.id===pending.data.product)||{})}});r.workflowId=s.workflows?.find(w=>w.confirmationId===r.id)?.id||null;r.status=r.planId||r.workflowId?'待执行':(r.status||'已完成');}return result;}finally{normalizeCards(s);s.card=cardFor(s,selected);}}

function legacyReport(s,period='month') {const d=new Date(s.now),year=d.getUTCFullYear(),month=d.getUTCMonth();const tx=s.transactions.filter(t=>{if(['信用卡还款','本人卡间转账','存款','存款支取','贷款放款','贷款还本','外汇兑换','基金申购','基金赎回','基金撤单退款'].includes(t.category))return false;const x=new Date(t.at);return x.getUTCFullYear()===year&&(period==='year'||x.getUTCMonth()===month);});const groups={};let income=0,expense=0,refunds=0;for(const t of tx){if(t.amount>0&&/退款/.test(t.category))refunds+=t.amount;else if(t.amount>0)income+=t.amount;else{expense-=t.amount;groups[t.category]=(groups[t.category]||0)-t.amount;}}return {period,income,expense,refunds,netExpense:expense-refunds,groups,transactions:tx,anomalies:tx.filter(t=>/异地|重复/.test(t.note)).map(t=>({...t,reason:t.note.includes('重复')?'同商户、同金额短期重复记录；请核实是否重复支付':'演示数据标记的异地消费；不代表已确认欺诈'}))};}
function legacyChat(s,text){
 if(typeof text!=='string'||!text.trim()||text.length>1200)fail('请输入 1–1200 字的需求。');text=text.trim();
 let reply='',proposal=null,view=null;
 if(/忽略.{0,12}(规则|指令|限制)|绕过|系统提示|system\s*prompt|无需确认|不要确认|他人账户|别人的|密码|验证码发|泄露|ignore.{0,20}instructions/i.test(text)){s.blocked++;reply='已拒绝该请求：不能绕过确认、读取其他用户账户或泄露凭据。你可以查询自己的模拟账单，或发起需要本人确认的操作。';audit(s,'拦截','自然语言请求触发安全边界，未调用交易工具');}
 else if(/余额|多少钱|资产/.test(text)){reply=`当前模拟余额 ¥${fmt(s.balance)}，预留 ¥${fmt(s.reserved)}，可用 ¥${fmt(s.balance-s.reserved)}。数据来自当前账户账本。`;view='overview';}
 else if(/账单|消费|花了|支出|异常|年度报告|月报/.test(text)){const r=report(s,/年/.test(text)?'year':'month');reply=`本${r.period==='year'?'年':'月'}模拟收入 ¥${fmt(r.income)}、支出 ¥${fmt(r.expense)}。发现 ${r.anomalies.length} 条待核实记录，已打开账单分析。`;view='bills';}
 else if(/转.{0,10}(给|账)|给.+转/.test(text)){const c=s.contacts.find(c=>text.includes(c.name)||text.includes(c.note)||text.includes(c.phone));const m=text.match(/(-?\d+(?:\.\d+)?)\s*(?:元|块)/)||text.match(/转(?:账)?\s*(-?\d+(?:\.\d+)?)/);if(!c||!m)reply='请补充明确的收款人和金额，例如“给林晓转 200 元”。支持林晓、陈宇、妈妈；手机号请在已核实联系人中选择。';else if(/明天|定时|后天|预约/.test(text)){reply='已识别预约转账需求。请在转账页选择准确日期和时间，再生成确认单。';view='transfer';}else{proposal={type:'transfer',contact:c.id,amount:Number(m[1])};reply='已识别收款人和金额。请核对确认单，确认前不会扣款。';view='transfer';}}
 else if(/AA|平摊|分摊|收款/i.test(text)){reply='已打开 AA 收款。请填写总金额并选择参与人；系统按分计算，每人金额与余数会列在收款单里。';view='transfer';}
 else if(/生日|鲜花|蛋糕/.test(text)){reply='生日计划分为确认对象和日期、预留预算、到期检查、模拟商户预订、结算五步。请在联动计划页补全信息，执行前可撤销。';view='plans';}
 else if(/挂失/.test(text)){proposal={type:'card',operation:'lost'};reply='挂失会停止该模拟卡后续交易。请完成加强确认。';view='cards';}
 else if(/解锁|锁卡|锁定卡/.test(text)){proposal={type:'card',operation:/解锁/.test(text)?'unlock':'lock'};reply='已生成卡片状态变更确认单。';view='cards';}
 else if(/订阅|代扣|续费/.test(text)){const sub=s.subscriptions.find(x=>text.includes(x.name));if(/取消/.test(text)&&sub){proposal={type:'subscription',id:sub.id,operation:'cancel'};reply='请确认取消这项模拟代扣授权。';}else reply='已打开订阅管理，可以查看识别来源、续费日期、提醒和取消代扣。';view='subscriptions';}
 else if(/理财|申购|赎回|风险|推荐/.test(text)){reply=s.risk?`当前演示风险等级 R${s.risk}。请比较期限、风险和起购金额，申购前还需确认。`:'请先完成风险问卷，再比较产品。系统不会推荐高于评估结果的产品。';view='invest';}
 else {reply='我可以帮你查余额、分析账单、准备转账、管理卡片与订阅、安排生日计划。请说明对象、金额和时间；目前使用可解释的规则解析器，不会假装已理解不支持的指令。';}
 if(proposal){try{prepare(s,proposal);}catch(e){reply=e.message;}}
 s.messages.push({role:'user',text,at:s.now},{role:'assistant',text:reply,at:s.now});s.messages=s.messages.slice(-40);return {reply,view};
}
export function operate(s,body){
 normalizeCards(s);
 const extended=advancedOperation(s,body);if(extended!==null)return extended;
 if(body.action==='taskToggle'){const p=s.plans.find(x=>x.id===body.plan&&x.type==='event'&&['scheduled','ready','paused'].includes(x.status));const t=p?.tasks?.find(x=>x.id===body.task);if(!t)fail('步骤不存在或计划已结束');t.done=!t.done;t.completedAt=t.done?s.now:null;audit(s,'步骤',p.title+'：'+t.label+(t.done?' 已完成':' 已重新打开'));return {};}
 if(body.action==='completeEvent'){const p=s.plans.find(x=>x.id===body.id&&x.type==='event'&&['scheduled','ready','paused'].includes(x.status));if(!p)fail('计划不可完成');if(p.tasks?.some(t=>!t.done))fail('请先完成全部步骤');s.reserved-=p.amount;p.status='completed';p.steps.push('用户确认活动完成，预留资金已释放；不产生自动付款');audit(s,'完成',p.title);return {};}
 if(body.action==='readNotification'){if(body.id==='all')s.readNotifications=notifications(s).map(n=>n.id);else if(notifications(s).some(n=>n.id===body.id))s.readNotifications=[...new Set([...s.readNotifications,body.id])].slice(-300);return {};}
 if(body.action==='demoSeed'&&body.scenario==='subscriptions'&&!s.transactions.some(t=>t.id==='recurring-demo-0')){for(let i=0;i<3;i++)s.transactions.push({id:'recurring-demo-'+i,at:s.now-i*30*86400000,amount:-3900,merchant:'演示设计工具订阅',category:'订阅',note:'历史周期扣费样本'});}
 if(body.action==='demoSeed'){if(!['birthday','transfer','travel','bills','invest','cards','subscriptions'].includes(body.scenario))fail('演示场景无效');if(s.demoScenario===body.scenario)return {};if(body.scenario==='birthday'||body.scenario==='travel'){const travel=body.scenario==='travel';s.plans.unshift({id:id(),cardId:s.card.id,type:'event',name:travel?'周末旅行演示':'纪念日演示',title:travel?'周末旅行演示':'纪念日演示',category:travel?'旅行':'纪念日',amount:0,at:s.now+86400000,status:'scheduled',steps:['演示活动已建立；预算为零，不改变资金'],tasks:validateTasks(travel?['核对出发日期','购票提醒','住宿确认','旅行费用分摊']:['确认日期与对象','准备礼物','核对预算','完成活动'])});}s.demoScenario=body.scenario;audit(s,'演示','已载入 '+body.scenario+' 场景指引；未改变资金');return {};}
 if(body.action==='contactArchive'){const c=contact(body.id,s);if(typeof body.archived!=='boolean')fail('收款人状态无效');c.archived=body.archived;audit(s,'收款人',c.name+(c.archived?'已停用；历史记录与已有预约保留':'已恢复'));return {};}
 if(body.action==='saveContact'){const name=String(body.name||'').trim(),bank=String(body.bank||'').trim(),account=String(body.account||'').replace(/\s/g,'');if(!name||name.length>24||!bank||bank.length>40||!/^\d{12,19}$/.test(account))fail('请填写姓名、银行和 12–19 位模拟卡号。');if(s.contacts.length>=30)fail('最多保存 30 位收款人。');if(s.contacts.some(c=>c.account===account))fail('该收款卡已保存。');s.contacts.push({id:id(),name,bank,account,phone:'尾号 '+account.slice(-4),note:'已保存 · 未实名核验'});audit(s,'收款人','已保存模拟收款人 '+name);return {};}
 if(body.action==='eventUpdate'){const p=s.plans.find(p=>p.id===body.id&&p.type==='event'&&['scheduled','paused','ready'].includes(p.status));if(!p)fail('活动不可修改。');if(body.operation==='pause'){p.status='paused';p.steps.push('已暂停提醒，预算保留');}else if(body.operation==='resume'){p.at=future(s,body.at);p.status='scheduled';p.steps.push('已恢复提醒');}else if(body.operation==='edit'){const name=String(body.name||'').trim();if(!name||name.length>40)fail('请填写活动名称');const n=body.amount===0?0:cents(body.amount);if(n>cardFor(s,p.cardId).balance-cardReserved(s,p.cardId)+p.amount)fail('可用余额不足');const at=future(s,body.at);s.reserved+=n-p.amount;Object.assign(p,{name,title:name,amount:n,at,note:String(body.note||'').slice(0,240),status:'scheduled'});p.steps.push('计划已更新');}else fail('操作无效');audit(s,'计划','已更新活动 '+p.title);return {};}
 if(body.action==='benefit'){const catalog=['coffee','travel','reading'];if(!catalog.includes(body.id))fail('权益不存在');let b=s.benefits.find(b=>b.id===body.id);if(body.operation==='claim'){if(b)fail('已领取过此权益');s.benefits.push({id:body.id,claimed:s.now,expires:s.now+30*86400000,status:'available'});}else if(body.operation==='use'){if(!b||b.status!=='available'||b.expires<=s.now)fail('权益不可使用');b.status='used';b.used=s.now;}else fail('操作无效');s.serviceEvents||=[];s.serviceEvents.unshift({id:id(),at:s.now,type:'benefit',title:({coffee:'咖啡时光',travel:'轻松出行',reading:'阅读时刻'})[body.id]+(body.operation==='claim'?' · 领取':' · 使用'),status:'已完成',benefitId:body.id,lines:['有效期至 '+new Date(b?.expires||s.now+30*86400000).toISOString(),'该操作不扣款'],transactionIds:[]});audit(s,'权益','模拟权益'+(body.operation==='claim'?'已领取':'已使用'));return {};}
 if(body.action==='selectCard'){s.card=cardFor(s,body.id);s.activeCardId=s.card.id;return {};}
 if(body.action==='customizeCard'){const c=cardFor(s,body.id);if(typeof body.nickname!=='string'||!body.nickname.trim()||body.nickname.trim().length>16)fail('卡片昵称须为 1–16 字。');if(!['forest','midnight','graphite','champagne','pearl'].includes(body.theme)||!['contour','brushed','minimal'].includes(body.pattern))fail('卡面样式无效。');if(body.artwork!==undefined){const a=body.artwork;if(a!==null&&(typeof a!=='object'||typeof a.src!=='string'||a.src.length>60000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(a.src)||!Number.isFinite(a.x)||a.x<0||a.x>100||!Number.isFinite(a.y)||a.y<0||a.y>100||!Number.isFinite(a.zoom)||a.zoom<1||a.zoom>3))fail('卡面图片或裁剪参数无效。');c.artwork=a?{src:a.src,x:a.x,y:a.y,zoom:a.zoom}:null;}if(body.textMode!==undefined&&!['auto','manual'].includes(body.textMode))fail('文字模式无效。');if(body.textColor!==undefined&&(typeof body.textColor!=='string'||!/^#[0-9a-fA-F]{6}$/.test(body.textColor)))fail('文字颜色无效。');c.textMode=body.textMode??c.textMode??'auto';c.textColor=body.textColor??c.textColor??'#ffffff';c.nickname=body.nickname.trim();c.theme=body.theme;c.pattern=body.pattern;audit(s,'卡面',`已保存卡尾号 ${c.last4} 的卡面设置`);return {};}

 if(body.action==='prepare')return {pending:prepare(s,body.operation)};
 if(body.action==='confirm')return confirm(s,body.id,body.pin);
 if(body.action==='cancel'){s.pending=null;audit(s,'撤销','用户撤销尚未执行的确认单');return {};}
 if(body.action==='risk'){const x=body.answers;if(!Array.isArray(x)||x.length!==10||x.some(v=>!Number.isInteger(v)||v<1||v>5))fail('请完成全部 10 项风险问卷。');const score=x.reduce((a,b)=>a+b,0);s.risk=Math.min(Math.max(1,Math.ceil((score-10)/8)),x[4],x[5],x[6]);s.riskAt=s.now;s.riskAssessment={answers:x,score,explanation:'综合 10 项回答评分，并以投资期限、资金流动性和最大可承受损失设定上限。仅为比赛模拟规则。'};audit(s,'评估',`完成 10 项模拟风险评估 R${s.risk}`);return {};}

 if(body.action==='chat')return chat(s,body.text);
 if(body.action==='reset'){if(body.confirm!=='重置模拟账户')fail('请输入重置确认文字');const fresh=initialState();for(const k of Object.keys(s))delete s[k];Object.assign(s,fresh);return {};}
 fail('未知操作。');
}

export function notifications(s){
 const items=[];
 for(const [kind,plans] of [['loans',s.loans||[]],['installments',s.installments||[]]])for(const p of plans){if(p.status==='approved')items.push({id:'approval-'+p.id,title:'贷款审批结果',text:p.expires<=s.now?'审批已过期，可取消并重新申请':'审批通过，请核对合同后签约',at:p.appliedAt,view:kind,kind:'待办'});if(p.status==='active'){const r=p.schedule.find(x=>x.status==='unpaid');if(r&&r.dueAt<=s.now+7*86400000)items.push({id:'finance-'+p.id+'-'+r.number,title:r.dueAt<=s.now?'还款已到期':'近期还款提醒',text:'第'+r.number+'期应还 ¥'+fmt(r.principal+r.fee)+'，请手动核对还款',at:r.dueAt,view:kind,kind:'待办'});}}

 for(const p of s.plans){const active=['scheduled','ready','paused'].includes(p.status);if(active&&p.status!=='paused'&&p.at<=s.now+3*86400000)items.push({id:'plan-'+p.id+'-'+p.status,title:p.title,text:p.at<=s.now?'已到办理时间，请打开计划处理。':'未来三天内的安排，请提前准备。',at:p.at,view:'plans',kind:'待办'});if(['completed','failed','cancelled'].includes(p.status))items.push({id:'result-'+p.id+'-'+p.status,title:p.title,text:p.steps.at(-1)||p.status,at:p.at,view:'plans',kind:'计划结果'});}
 for(const w of s.workflows||[])items.push({id:'workflow-'+w.id+'-'+w.status,title:w.name,text:w.history.at(-1)||'任务等待执行',at:w.at,view:'tasks',kind:'自动任务'});
 for(const sub of s.subscriptions)if(['active','observed'].includes(sub.status)&&sub.remind&&sub.next<=s.now+3*86400000)items.push({id:'sub-'+sub.id+'-'+sub.next,title:sub.name+'即将续费',text:'预计扣款 ¥'+fmt(sub.amount)+'，可前往订阅页取消授权。',at:sub.next,view:'subscriptions',kind:'续费提醒'});
 for(const b of s.benefits)if(b.status==='available'&&b.expires<=s.now+7*86400000)items.push({id:'benefit-'+b.id+'-'+b.expires,title:'权益即将或已经到期',text:'请到权益中心查看使用条件和有效期。',at:b.expires,view:'benefits',kind:'权益提醒'});
 for(const event of (s.serviceEvents||[]).slice(0,30))items.push({id:'service-'+event.id,title:event.title,text:event.status+' · '+(event.lines?.[0]||'可查看办理记录'),at:event.at,view:'receipts',kind:event.status==='失败'?'办理失败':'服务结果'});
 for(const r of s.receipts.slice(0,30))items.push({id:'receipt-'+r.id,title:r.title,text:'操作回执已生成，可查看结果与明细。',at:r.at,view:'receipts',kind:'交易结果'});
 return items.sort((a,b)=>b.at-a.at).map(n=>({...n,read:(s.readNotifications||[]).includes(n.id)}));
}

// Deterministic assistant: account-scoped slots and allowlisted operations only.
export function report(s,period='month'){
 const r=legacyReport(s,period), seen=new Map();r.anomalies=[];
 for(const t of [...r.transactions].sort((a,b)=>a.at-b.at)){
  if(t.amount>=0)continue;
  const key=t.merchant+'|'+t.amount,prev=seen.get(key);let reason='';
  if(prev&&t.at-prev.at<=10*60000)reason='同商户、同金额在 10 分钟内重复，请核实';
  else if(/异地/.test(t.note||''))reason='账单标记异地交易，请核实';
  const history=s.transactions.filter(x=>x.id!==t.id&&x.category===t.category&&x.amount<0&&x.at<t.at);
  if(!reason&&history.length>=3){const a=history.map(x=>-x.amount).sort((a,b)=>a-b),median=a[Math.floor(a.length/2)];if(-t.amount>median*3&&-t.amount>=50000)reason='超过该分类历史中位数 3 倍，建议核实';}
  if(reason)r.anomalies.push({...t,reason});seen.set(key,t);
 }
 const d=new Date(s.now);d.setUTCMonth(d.getUTCMonth()-1);const prev=s.transactions.filter(t=>new Date(t.at).getUTCFullYear()===d.getUTCFullYear()&&new Date(t.at).getUTCMonth()===d.getUTCMonth()&&t.amount<0).reduce((n,t)=>n-t.amount,0);
 r.previousMonthExpense=prev;r.change=prev?(r.expense-prev)/prev:null;return r;
}
export function detectSubscriptions(s){
 const groups=new Map();for(const t of s.transactions.filter(t=>t.amount<0)){const k=t.merchant;groups.set(k,[...(groups.get(k)||[]),t]);}
 return [...groups].flatMap(([name,rows])=>{if(s.subscriptions.some(x=>x.name===name))return [];rows.sort((a,b)=>a.at-b.at);if(rows.length<3)return [];const tail=rows.slice(-3),gaps=[tail[1].at-tail[0].at,tail[2].at-tail[1].at].map(n=>n/86400000);if(!gaps.every(n=>n>=25&&n<=35)||!tail.every(t=>Math.abs(t.amount-tail[0].amount)<=Math.abs(tail[0].amount)*0.1))return [];return [{id:tail.at(-1).id,name,amount:-tail.at(-1).amount,next:tail.at(-1).at+30*86400000,evidence:tail.map(x=>x.id)}];});
}
export function recommendations(s,amount=0,days=366){return products.filter(p=>s.riskAssessment&&s.now-s.riskAt<=365*86400000&&p.risk<=s.risk&&p.days<=days&&(!amount||p.min<=amount)).map(p=>({...p,reason:`风险 R${p.risk} 不超过你的 R${s.risk}；持有期 ${p.days} 天；起购 ¥${fmt(p.min)}。不预测收益。`}));}
function advancedDescription(s,input){
 let data,title,lines,strong=false;
 if(input.type==='subscriptionCard'){const sub=s.subscriptions.find(x=>x.id===input.id),card=cardFor(s,input.target);if(!sub)fail('订阅不存在');if(card.kind!=='debit'||card.status!=='active'||!card.online)fail('请选择正常且开启线上交易的借记卡');data={id:sub.id,target:card.id};strong=true;title='更换代扣账户';lines=[sub.name,`新扣款卡：${card.nickname} · 尾号 ${card.last4}`,`每期 ¥${fmt(sub.amount)}；下次扣款前再次核验余额与限额`,'更换卡片不恢复已取消的授权，也不会立即扣款'];}
 else if(input.type==='splitCollect'){const group=s.splits.find(x=>x.id===input.split),person=group?.participants.find(x=>x.contact===input.contact);if(!person||person.status!=='待支付')fail('该 AA 款项不存在或已收款');data={split:group.id,contact:person.contact};title='模拟朋友支付 AA 款';lines=[contact(person.contact,s).name,`到账 ¥${fmt(person.amount)}`,'仅模拟对方支付，不扣任何真实账户'];}
 else if(input.type==='subscriptionDetect'){const found=detectSubscriptions(s).find(x=>x.id===input.id);if(!found)fail('订阅候选已变更');data=found;title='确认周期扣费记录';lines=[found.name,`近三期周期约 30 天，每期 ¥${fmt(found.amount)}`,'只记录订阅并开启提醒，不自动授予新的扣款权限'];}
 else if(input.type==='workflow'){
  const name=String(input.name||'').trim();if(!name||name.length>40)fail('请输入 1–40 字的活动名称');const amount=cents(input.amount);requireCash(s,amount);requireCard(s,amount);
  const eventAt=future(s,input.at),at=Math.max(s.now+60000,eventAt-2*86400000);data={name,amount,eventAt,at};strong=true;title='确认跨场景自动计划';lines=[name,`活动日期 ${new Date(eventAt).toISOString()}`,`立即预留 ¥${fmt(amount)}；提前两天开始模拟预订`,'鲜花占 60%，蛋糕占 40%；失败重试三次后转人工，不重复扣款','授权仅覆盖此计划、金额和两家模拟商户；可暂停或取消'];
 }else return null;
 return {id:id(),type:input.type,data,title,lines,strong,cardId:s.card.id,expires:s.now+600000,createdAt:Date.now()};
}
function advancedConfirm(s,p){
 const d=p.data;
 if(p.type==='subscriptionCard'){const sub=s.subscriptions.find(x=>x.id===d.id),card=cardFor(s,d.target);if(!sub||card.kind!=='debit'||card.status!=='active'||!card.online)fail('代扣账户状态已变更');sub.cardId=card.id;}
 else if(p.type==='splitCollect'){const group=s.splits.find(x=>x.id===d.split),person=group?.participants.find(x=>x.contact===d.contact);if(!person||person.status!=='待支付')fail('该款项已处理');ledger(s,person.amount,'收款',contact(person.contact,s).name,'模拟 AA 到账');person.status='已支付';}
 else if(p.type==='subscriptionDetect'){if(s.subscriptions.some(x=>x.name===d.name))fail('订阅已存在');s.subscriptions.push({...d,id:id(),cardId:p.cardId,status:'observed',remind:true});}
 else if(p.type==='workflow'){
  requireCash(s,d.amount);requireCard(s,d.amount);s.reserved+=d.amount;s.workflows||=[];const flower=Math.floor(d.amount*0.6);
  s.workflows.unshift({...d,id:id(),confirmationId:p.id,cardId:p.cardId,status:'scheduled',remaining:d.amount,created:s.now,steps:[{id:'flowers',merchant:'花间模拟花店',amount:flower,depends:[],status:'waiting',attempts:0},{id:'cake',merchant:'甜日模拟烘焙',amount:d.amount-flower,depends:['flowers'],status:'waiting',attempts:0}],history:['用户确认计划及最高预算，已预留资金']});
 }else return null;
 const receipt={id:p.id,title:p.title,at:s.now,lines:p.lines,cardId:p.cardId,status:'已完成',amount:d.amount||null};s.receipts.unshift(receipt);s.pending=null;audit(s,'完成',p.title);return {receipt};
}
export function tickWorkflows(s){
 for(const w of s.workflows||[]){if(w.status!=='scheduled'||w.at>s.now)continue;
  const card=cardFor(s,w.cardId);if(card.kind==='credit'||card.status!=='active'||!card.online){w.status='attention';w.history.push('卡片不可用，已停止，等待人工处理');continue;}
  for(const step of w.steps){if(step.status==='completed'||step.depends.some(id=>w.steps.find(x=>x.id===id)?.status!=='completed')||(step.retryAt||0)>s.now)continue;
   if(step.amount>card.limit||step.amount>w.remaining||step.amount>card.balance||!quotaAllowed(s,card,-step.amount,'生活')){w.status='attention';w.history.push('额度或资金检查失败，停止执行');break;}
   step.attempts++;
   if(w.simulateFailure===step.id){step.status='failed';step.retryAt=s.now+60000;w.history.push(step.merchant+'模拟服务不可用，第 '+step.attempts+' 次');if(step.attempts>=3){w.status='attention';w.history.push('已熔断，等待人工处理');}break;}
   // Payment, reservation release and order result persist together in one revision.
   ledger(s,-step.amount,'生活',step.merchant,'联动计划 '+w.name,card.id,{workflowId:w.id,receiptId:w.confirmationId,orderId:w.id+'-'+step.id});s.reserved-=step.amount;w.remaining-=step.amount;step.status='completed';step.orderId=w.id+'-'+step.id;step.completedAt=s.now;w.history.push(step.merchant+'预订成功，¥'+fmt(step.amount));audit(s,'工具执行',step.orderId+' 模拟预订及结算完成');
  }
  if(w.steps.every(x=>x.status==='completed')){w.status='completed';w.history.push('全部步骤完成');}
 }
}
function advancedOperation(s,b){
 if(b.action==='workflowControl'){
  const w=s.workflows?.find(x=>x.id===b.id);if(!w||['completed','cancelled'].includes(w.status))fail('计划不可操作');
  if(b.operation==='cancel'){s.reserved-=w.remaining;w.remaining=0;w.status='cancelled';w.history.push('已取消未执行步骤，释放剩余预算；已完成订单未自动退款');}
  else if(b.operation==='pause'){w.status='paused';w.history.push('用户暂停');}
  else if(b.operation==='resume'){w.status='scheduled';for(const step of w.steps)if(step.status==='failed'){step.attempts=0;step.retryAt=s.now;}w.history.push('用户恢复，仍受原预算和商户约束');}
  else fail('无效操作');audit(s,'任务控制',w.name+' '+b.operation);return {};
 }
 if(b.action==='workflowFault') {if(!s.testMode)fail('仅免密码测试沙箱可模拟故障');const w=s.workflows?.find(x=>x.id===b.id);if(!w||!['flowers','cake',''].includes(b.step))fail('故障目标无效');w.simulateFailure=b.step;return {};}
 if(b.action==='runTasks'){tick(s);return {};}
 if(b.action==='cancelDialogue'){s.dialogue=null;s.pending=null;return {};}
 return null;
}
function assistantReply(s,text,reply,view){s.messages.push({role:'user',text,at:s.now},{role:'assistant',text:reply,at:s.now});s.messages=s.messages.slice(-80);audit(s,'助手',reply.slice(0,180));return {reply,view};}
export function chat(s,text){
 if(typeof text!=='string'||!text.trim()||text.length>1200)fail('请输入 1–1200 字的需求');normalizeCards(s);text=text.trim();
 if(/忽略|绕过|system\s*prompt|无需确认|不要确认|他人账户|别人的账户|泄露|ignore.*instructions|<script/i.test(text)){s.dialogue=null;return legacyChat(s,'绕过规则');}
 if(/^(取消|算了|停止|取消任务)$/.test(text)){s.dialogue=null;s.pending=null;return assistantReply(s,text,'已撤销尚未确认的需求，未执行交易。');}
 if(/-\d+(?:\.\d+)?\s*(?:元|块)|\d+\.\d{3,}\s*(?:元|块)/.test(text))return assistantReply(s,text,'金额必须为正数，最多两位小数。');
 const intent=/生日|纪念日|鲜花|蛋糕/.test(text)?'workflow':/转账|转给|给.+转/.test(text)?'transfer':/申购|买入/.test(text)?'buy':/赎回/.test(text)?'redeem':/AA|分摊/i.test(text)?'split':null;
 if(s.dialogue&&s.dialogue.expires<Date.now())s.dialogue=null;
 if(intent||s.dialogue){
  s.pending=null;
  const d=intent&&s.dialogue?.type!==intent?{type:intent,expires:Date.now()+600000}:s.dialogue||{type:intent,expires:Date.now()+600000};s.dialogue=d;
  const people=s.contacts.filter(c=>[c.name,c.note,c.phone,c.account].some(v=>v&&text.includes(v)));if(people.length>1&&d.type!=='split')return assistantReply(s,text,'发现多个收款人，请明确选择一个姓名。','contacts');if(people.length===1)d.contact=people[0].id;
  const amount=text.match(/(?<![\d.\-A-Za-z])(\d+(?:\.\d{1,2})?)\s*(?:元|块)/)||text.match(/^\s*(\d+(?:\.\d{1,2})?)\s*$/);if(amount)d.amount=Number(amount[1]);
  const date=text.match(/(20\d{2}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/);if(date){const parsed=Date.parse(date[1]+'T'+(date[2]||'09:00')+':00+08:00');if(Number.isFinite(parsed))d.at=new Date(parsed).toISOString();}
  if(/明天|后天/.test(text)){const dt=new Date(s.now+(/后天/.test(text)?2:1)*86400000);const hm=text.match(/(\d{1,2})[:点](\d{2})?/);if(hm){dt.setUTCHours(Number(hm[1])-8,Number(hm[2]||0),0,0);d.at=dt.toISOString();}else d.needsTime=true;}
  if(/预约|定时/.test(text))d.needsTime=true;
  if(d.type==='workflow'){d.name||=text.slice(0,40);if(!d.amount)return assistantReply(s,text,'这个活动预留多少元预算？','plans');if(!d.at)return assistantReply(s,text,'请提供活动日期，例如 2026-11-20。将提前两天执行模拟预订。','plans');}
  if(d.type==='transfer'){if(!d.contact)return assistantReply(s,text,'请提供已保存的收款人姓名、备注或完整号码。','contacts');if(!d.amount)return assistantReply(s,text,'转账多少元？','transfer');if(d.needsTime&&!d.at)return assistantReply(s,text,'请提供准确日期和时间，例如 2026-11-20 09:00。','transfer');}
  if(d.type==='buy'||d.type==='redeem'){const p=products.filter(p=>text.includes(p.name));if(p.length===1)d.product=p[0].id;if(!d.product)return assistantReply(s,text,'请提供产品全名；可先说“比较理财产品”。','invest');if(d.type==='buy'&&!d.amount)return assistantReply(s,text,'申购多少元？','invest');if(d.type==='redeem'){const h=s.holdings.filter(h=>h.product===d.product);if(h.length!==1){s.dialogue=null;return assistantReply(s,text,'该产品存在多笔持仓或暂无持仓，请在持仓列表选择准确的一笔赎回。','invest');}d.holding=h[0].id;}}
  if(d.type==='split'){d.people=[...new Set([...(d.people||[]),...people.map(x=>x.id)])];if(!d.amount||!d.people.length)return assistantReply(s,text,'请提供总金额与参与人，例如“和林晓、陈宇 AA 300 元”。','transfer');}
  try{prepare(s,d);s.dialogue=null;return assistantReply(s,text,'已生成确认单，请核对对象、金额与时间。只有点击确认才执行。',d.type==='workflow'?'tasks':d.type==='buy'||d.type==='redeem'?'invest':'transfer');}catch(e){return assistantReply(s,text,e.message);}
 }
 if(/推荐|比较|对比/.test(text)&&/理财|产品|基金/.test(text)){const picks=recommendations(s);return assistantReply(s,text,picks.length?picks.map(p=>p.name+'：'+p.reason).join('\n'):'请先完成风险评估；当前没有符合条件的产品。','invest');}
 if(/卡/.test(text)&&/申请|挂失|解锁|锁定|限额|补办|关闭线上|开启线上/.test(text)){const matches=s.cards.filter(c=>text.includes(c.nickname)||text.includes(c.last4));if(matches.length>1)return assistantReply(s,text,'有多张匹配卡，请提供准确尾号。','cards');const card=matches[0]||s.card;const operation=/申请/.test(text)?'apply':/补办/.test(text)?'replace':/挂失/.test(text)?'lost':/解锁/.test(text)?'unlock':/限额/.test(text)?'limit':/线上/.test(text)?'online':'lock';const amount=text.match(/(\d+(?:\.\d{1,2})?)\s*元/);if(operation==='limit'&&!amount)return assistantReply(s,text,'请同时提供卡片尾号和新限额，例如“0628 卡限额 2000 元”。','cards');try{prepare(s,{type:'card',operation,cardId:card.id,limit:amount?Number(amount[1]):undefined,enabled:/开启/.test(text)});return assistantReply(s,text,'已生成卡片操作确认单，请核对尾号及设置。','cards');}catch(e){return assistantReply(s,text,e.message,'cards');}}
 if(/订阅|代扣/.test(text)&&/识别|发现|扫描/.test(text)){const candidates=detectSubscriptions(s);return assistantReply(s,text,`从交易记录识别到 ${candidates.length} 项候选周期扣费，请核对证据后保存。不会自动新增扣款授权。`,'subscriptions');}
 return legacyChat(s,text);
}
export function nextWake(s){if(s.testMode||s.demoMode)return null;const times=[...(s.fundOrders||[]).filter(o=>o.status==='pending').map(o=>o.dueAt),...(s.deposits||[]).filter(d=>d.status==='active'&&d.renewOnce).map(d=>d.maturesAt),...(s.cards||[]).filter(c=>c.kind==='credit'&&c.nextStatementAt).map(c=>c.nextStatementAt),...(s.plans||[]).filter(p=>p.status==='scheduled').map(p=>p.at),...(s.subscriptions||[]).filter(p=>p.status==='active').map(p=>p.next),...(s.workflows||[]).filter(w=>w.status==='scheduled').map(w=>Math.max(w.at,...w.steps.filter(x=>x.status!=='completed').map(x=>x.retryAt||0)))];return times.length?Math.min(...times):null;}

// Account quotas use Beijing calendar days/years. Investment purchase/redemption is exempt.
function beijingDay(at){return new Date(at+8*3600000).toISOString().slice(0,10);}
export function accountQuota(s,c){
 const day=beijingDay(s.now),year=day.slice(0,4),q={dailyOut:0,yearlyOut:0,dailyIn:0,yearlyIn:0};
 for(const t of s.transactions||[]){if(t.cardId!==c.id||t.category==='理财'||t.channel==='信用卡授信')continue;const d=beijingDay(t.at);if(d.slice(0,4)!==year)continue;const dir=t.amount<0?'Out':'In';q['yearly'+dir]+=Math.abs(t.amount);if(d===day)q['daily'+dir]+=Math.abs(t.amount);}
 return q;
}
function checkAccountQuota(s,c,amount,category){if(c.kind==='credit')fail('信用卡不能使用现金账本');if(c.accountClass!=='II'||category==='理财')return;const q=accountQuota(s,c),dir=amount<0?'Out':'In';if(q['daily'+dir]+Math.abs(amount)>1000000)fail('Ⅱ类账户日累计限额 ¥10,000 已不足');if(q['yearly'+dir]+Math.abs(amount)>20000000)fail('Ⅱ类账户年累计限额 ¥200,000 已不足');}
function quotaAllowed(s,c,n,category){try{checkAccountQuota(s,c,n,category);return true;}catch{return false;}}
function nextCreditMonth(at){const d=new Date(at+8*3600000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)-8*3600000;}
function closeCredit(s,c){
 while(c.nextStatementAt<=s.now){const end=c.nextStatementAt,entries=c.creditEntries.filter(e=>!e.statementId&&!e.installmentId&&e.at<end);if(entries.length){const bill={id:id(),at:end,dueAt:end+20*86400000,amount:entries.reduce((n,e)=>n+e.amount,0),remaining:entries.reduce((n,e)=>n+e.remaining,0)};entries.forEach(e=>e.statementId=bill.id);c.statements.unshift(bill);}c.nextStatementAt=nextCreditMonth(end);}
}
function creditDescription(s,input){
 if(!['creditSpend','creditRepay'].includes(input.type))return null;
 const c=s.card;if(c.kind!=='credit')fail('请先选择信用卡');closeCredit(s,c);const amount=cents(input.amount);let data={amount},title,lines;
 if(input.type==='creditSpend'){const merchant=String(input.merchant||'').trim();if(!merchant||merchant.length>60)fail('请输入 1–60 字模拟商户');if(c.status!=='active'||!c.online)fail('信用卡已停用或线上交易关闭');if(amount>c.limit||amount>c.creditLimit-c.outstanding)fail('单笔限额或可用授信不足');if(c.statements.some(b=>b.remaining>0&&b.dueAt<=s.now)||(s.installments||[]).some(p=>p.cardId===c.id&&p.status==='active'&&p.schedule.some(r=>r.status==='unpaid'&&r.dueAt<=s.now)))fail('存在逾期账单，请先还清');data.merchant=merchant;title='确认信用卡模拟消费';lines=[merchant,`金额 ¥${fmt(amount)}`,'消费占用授信，不扣借记现金；每月 1 日出账，出账后 20 天到期'];}
 else {if(c.creditEntries.reduce((n,e)=>n+e.remaining,0)!==c.outstanding)fail('信用卡账本不一致，请联系维护');const source=cardFor(s,input.source);if(source.kind!=='debit'||source.status!=='active')fail('请选择正常状态的借记卡还款');if(amount>c.creditEntries.filter(e=>!e.installmentId).reduce((n,e)=>n+e.remaining,0))fail('金额超过非分期待还本金；分期请在分期计划单独还款');if(amount>source.limit)fail('超过还款卡单笔限额');requireCash(s,amount,source);checkAccountQuota(s,source,-amount,'信用卡还款');data.source=source.id;title='确认信用卡模拟还款';lines=[`从 ${source.nickname} 尾号 ${source.last4} 扣款 ¥${fmt(amount)}`,'优先偿还最早消费，包括已出账欠款；按还款金额恢复额度','本模拟不计算利息、费用或最低还款，不代表真实信用卡合同'];}
 return {id:id(),type:input.type,data,title,lines,strong:true,cardId:c.id,expires:s.now+600000,createdAt:Date.now()};
}
function creditConfirm(s,p){
 if(!['creditSpend','creditRepay'].includes(p.type))return null;
 creditDescription(s,{type:p.type,...p.data,amount:p.data.amount/100});const c=s.card,d=p.data;
 if(p.type==='creditSpend'){c.outstanding+=d.amount;c.creditEntries.push({id:p.id,at:s.now,merchant:d.merchant,amount:d.amount,remaining:d.amount,statementId:null});s.transactions.unshift({id:p.id,at:s.now,amount:-d.amount,category:'信用卡消费',merchant:d.merchant,note:'占用授信，未扣现金',cardId:c.id,channel:'信用卡授信',currency:'CNY',fee:0,status:'已入账'});}
 else {ledger(s,-d.amount,'信用卡还款',c.nickname,'还款至尾号 '+c.last4,d.source);let left=d.amount;for(const e of [...c.creditEntries].filter(e=>!e.installmentId).sort((a,b)=>a.at-b.at)){const n=Math.min(left,e.remaining);e.remaining-=n;left-=n;if(e.statementId){const b=c.statements.find(b=>b.id===e.statementId);b.remaining-=n;}if(!left)break;}if(left)fail('信用卡账本不一致，请联系维护');c.outstanding-=d.amount;}
 const receipt={id:p.id,title:p.title,at:s.now,lines:p.lines,cardId:c.id,amount:d.amount,status:'已完成',fee:0};s.receipts.unshift(receipt);s.pending=null;audit(s,'完成',p.title);return {receipt};
}

export function cardReserved(s,cardId){return (s.plans||[]).filter(p=>p.cardId===cardId&&['scheduled','paused','ready'].includes(p.status)).reduce((n,p)=>n+p.amount,0)+(s.workflows||[]).filter(w=>w.cardId===cardId&&!['completed','cancelled'].includes(w.status)).reduce((n,w)=>n+w.remaining,0);}
function normalizeCashAccounts(s){
 const debit=s.cards.filter(c=>c.kind==='debit'),main=debit[0];
 if(!s.cashAccountsVersion){
  // Preserve total money and existing card-bound reservations during one-time migration.
  for(const c of debit)c.balance=cardReserved(s,c.id);
  if(main)main.balance+=s.balance-debit.reduce((n,c)=>n+c.balance,0);
  for(const t of s.transactions||[])t.cardId||=main?.id;
  s.cashAccountsVersion=1;
 }
 for(const c of debit){c.balance??=0;c.reserved=cardReserved(s,c.id);c.available=c.balance-c.reserved;}
 for(const h of s.holdings||[])h.cardId||=main?.id;
 s.balance=debit.reduce((n,c)=>n+c.balance,0);s.reserved=debit.reduce((n,c)=>n+c.reserved,0);
}
function ownTransferDescription(s,input){
 if(input.type!=='ownTransfer')return null;
 const source=s.card,target=cardFor(s,input.target),amount=cents(input.amount);
 if(source.id===target.id||source.kind!=='debit'||target.kind!=='debit')fail('请选择两张不同的本人借记卡');
 requireCard(s,amount);if(target.status!=='active')fail('收款卡已锁定或挂失');requireCash(s,amount);
 checkAccountQuota(s,source,-amount,'本人卡间转账');checkAccountQuota(s,target,amount,'本人卡间转账');
 return {id:id(),type:input.type,data:{amount,target:target.id},title:'确认本人卡间转账',lines:[`从 ${source.nickname} 尾号 ${source.last4}`,`转入 ${target.nickname} 尾号 ${target.last4}`,`金额 ¥${fmt(amount)}，不改变全部借记卡余额合计`,'本模拟尚无绑定账户协议，Ⅱ类卡转入及转出均占用各自累计限额'],strong:true,cardId:source.id,expires:s.now+600000,createdAt:Date.now()};
}
function ownTransferConfirm(s,p){
 if(p.type!=='ownTransfer')return null;
 ownTransferDescription(s,{type:p.type,...p.data,amount:p.data.amount/100});
 const source=s.card,target=cardFor(s,p.data.target),amount=p.data.amount;
 ledger(s,-amount,'本人卡间转账',target.nickname,'转入尾号 '+target.last4,source.id);
 ledger(s,amount,'本人卡间转账',source.nickname,'来自尾号 '+source.last4,target.id);
 s.transactions[0].transferId=p.id;s.transactions[1].transferId=p.id;
 const receipt={id:p.id,title:p.title,at:s.now,lines:p.lines,cardId:source.id,amount,fee:0,status:'已完成'};s.receipts.unshift(receipt);s.pending=null;audit(s,'完成',p.title);return {receipt};
}

// Fixed, disclosed sandbox rates; no external price or banking service is called.
export const depositTerms=[{days:30,bps:100},{days:90,bps:120},{days:180,bps:150}];
function depositDescription(s,input){
 if(!['depositOpen','depositClose'].includes(input.type))return null;
 let data,title,lines,cardId=s.card.id;
 if(input.type==='depositOpen'){const term=depositTerms.find(t=>t.days===input.term);if(!term)fail('请选择支持的存期');const amount=cents(input.amount);if(amount<5000)fail('存款最低 50 元');requireCard(s,amount);requireCash(s,amount);data={amount,term:term.days,bps:term.bps};title='开立定期存款';lines=[`扣款卡：${s.card.nickname} · ${s.card.last4}`,`本金 ¥${fmt(amount)} · 存期 ${term.days} 天`,`测试年利率 ${(term.bps/100).toFixed(2)}%，按实际天数 / 365，利息向下取整至分`,'到期后手动支取；提前支取按测试年利率 0.10% 计息；不自动续存'];}
 else {const d=s.deposits?.find(x=>x.id===input.deposit&&x.status==='active');if(!d)fail('存单不存在或已支取');const c=cardFor(s,d.cardId);if(c.status!=='active')fail('原扣款卡不可用，请先恢复');const days=Math.max(0,Math.min(d.term,Math.floor((s.now-d.openedAt)/86400000))),bps=days>=d.term?d.bps:10,interest=Number(BigInt(d.amount)*BigInt(bps)*BigInt(days)/3650000n);data={deposit:d.id,amount:d.amount,interest,days,bps};cardId=d.cardId;title=days>=d.term?'到期支取':'提前支取';lines=[`本金 ¥${fmt(d.amount)} · 利息 ¥${fmt(interest)}`,`计息 ${days} 天 · 年利率 ${(bps/100).toFixed(2)}%`,`本息返还 ${c.nickname} · ${c.last4}`,'全额支取，提交前再次校验；不产生实际银行存款'];}
 return {id:id(),type:input.type,data,title,lines,strong:true,cardId,expires:s.now+600000,createdAt:Date.now()};
}
function depositConfirm(s,p){if(!['depositOpen','depositClose'].includes(p.type))return null;const d=p.data;
 if(p.type==='depositOpen'){requireCard(s,d.amount);requireCash(s,d.amount);ledger(s,-d.amount,'存款','定期存款','开立存单',p.cardId);s.deposits||=[];s.deposits.unshift({id:p.id,cardId:p.cardId,amount:d.amount,term:d.term,bps:d.bps,openedAt:s.now,maturesAt:s.now+d.term*86400000,status:'active'});}
 else{const h=s.deposits?.find(x=>x.id===d.deposit&&x.status==='active');if(!h)fail('存单已支取');const c=cardFor(s,h.cardId);if(c.status!=='active')fail('原扣款卡不可用');const latest=depositDescription(s,{type:'depositClose',deposit:h.id});if(latest.data.interest!==d.interest)fail('计息日期已改变，请重新确认');checkAccountQuota(s,c,h.amount+d.interest,'存款支取');ledger(s,h.amount,'存款支取','定期存款','本金返还',h.cardId);if(d.interest)ledger(s,d.interest,'利息','定期存款','存款利息',h.cardId);h.status='closed';h.closedAt=s.now;h.interest=d.interest;h.receiptId=p.id;}
 const receipt={id:p.id,title:p.title,at:s.now,lines:p.lines,cardId:p.cardId,amount:d.amount,fee:0,status:'已完成'};s.receipts.unshift(receipt);s.pending=null;audit(s,'完成',p.title);return {receipt};
}

export function financeCash(s,cardId,amount,category,note,checkOnly=false){const c=cardFor(s,cardId);if(c.kind!=='debit'||c.status!=='active'||!Number.isSafeInteger(amount)||amount===0)fail('资金账户或金额无效');if(amount<0){if(-amount>c.limit)fail('超过扣款卡单笔限额');requireCash(s,-amount,c);}checkAccountQuota(s,c,amount,category);if(!checkOnly)ledger(s,amount,category,category,note,cardId);}
