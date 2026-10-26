import {BankError} from './bank-engine.mjs';
import {stores} from './bank-life-catalog.mjs';
import {rpc,signedParams,GATEWAY,keys} from './bank-alipay.mjs';
export const commerceCatalog=[...stores.map(s=>({sku:'voucher-'+s.id,name:s.name+' · '+s.product,kind:'voucher',amount:s.price,description:'30天有效；未核销可原路全额退款。沙箱购买不叠加站内会员优惠或核销积分。'})),
 {sku:'mall-cup',name:'商城 · 轻行保温杯',kind:'goods',amount:8900,description:'350ml · 米白色。测试发货，不寄送真实商品；发货前可退款。'},
 {sku:'mall-bag',name:'商城 · 城市随行包',kind:'goods',amount:12900,description:'浅沙色 · 单件。测试发货，不寄送真实商品；发货前可退款。'},
 {sku:'mall-notebook',name:'商城 · 日常手账本',kind:'goods',amount:2900,description:'A5 · 单本。测试发货，不寄送真实商品；发货前可退款。'}];
export const commerceLabels={pending:'待付款',paid:'已付款',refunding:'退款处理中',refunded:'已退款',used:'已核销',shipped:'已发货',received:'已收货',closed:'已关闭',review:'状态待核查'};
const fail=(m,status=400)=>{throw new BankError(m,status);};
const money=c=>(c/100).toFixed(2);
const price=s=>/^\d+(\.\d{1,2})?$/.test(String(s))?Math.round(Number(s)*100):-1;
const safe=o=>({...o,owner:undefined,voucherCode:o.kind==='voucher'&&['paid','used'].includes(o.status)?'TEST-'+o.id.slice(3).toUpperCase():null});
export async function commerceView(env,owner){
 if(env.ALIPAY_SANDBOX_ENABLED!=='true'||env.BANK_COMMERCE_SANDBOX_ENABLED!=='true')return null;
 const rows=await env.DB.prepare('SELECT * FROM bank_commerce_sandbox WHERE owner=? ORDER BY created DESC LIMIT 100').bind(owner).all();
 return {catalog:commerceCatalog,orders:rows.results.map(safe),sandbox:true};
}
export function commerceReceipts(view){return (view?.orders||[]).flatMap(o=>[
 ...(o.paid_at?[{id:'PAY-'+o.id,title:'支付宝沙箱付款 · '+o.name,at:o.paid_at,amount:o.amount,status:'付款已确认',orderId:o.id,lines:['支付渠道：支付宝沙箱',o.name,'订单号：'+o.id,'实付：¥'+money(o.amount),'不扣减站内银行卡余额；订单现状以生活订单为准。']}]:[]),
 ...(o.refunded_at?[{id:'REFUND-'+o.id,title:'支付宝沙箱退款 · '+o.name,at:o.refunded_at,amount:o.amount,status:'原路退款已确认',orderId:o.id,lines:['支付渠道：支付宝沙箱','原订单：'+o.id,'退款号：'+o.refund_id,'退回：¥'+money(o.amount),'退回原沙箱买家，不增加银行卡余额。']}]:[])
 ]);}
export async function commerceAction(env,owner,body,origin,call=rpc){
 if(env.BANK_COMMERCE_SANDBOX_ENABLED!=='true')fail('商品沙箱支付尚在验收，暂未开放',503);
 keys(env);const db=env.DB,now=Date.now();let order;
 const get=async id=>db.prepare('SELECT * FROM bank_commerce_sandbox WHERE id=? AND owner=?').bind(id,owner).first();
 if(body.action==='commerceCreate'){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId||''))fail('请求编号无效');
  const p=commerceCatalog.find(p=>p.sku===body.sku);if(!p)fail('商品不存在');
  const destination=p.kind==='goods'?String(body.destination||'').trim().toUpperCase():'';
  if(p.kind==='goods'&&!/^TEST-[A-Z0-9-]{3,32}$/.test(destination))fail('请填写TEST-开头的虚构收件点，勿填真实地址');
  const id='CSB'+body.requestId.replaceAll('-','');
  const old=await db.prepare('SELECT * FROM bank_commerce_sandbox WHERE id=?').bind(id).first();
  if(old&&(old.owner!==owner||old.sku!==p.sku||old.destination!==destination))fail('请求编号已被其他订单使用',409);
  if(!old){
   const count=await db.prepare('SELECT COUNT(*) AS n FROM bank_commerce_sandbox WHERE created>?').bind(now-86400000).first();if(count.n>=100)fail('今日沙箱订单测试数量已达上限',429);
   await db.prepare("INSERT OR IGNORE INTO bank_commerce_sandbox(id,owner,sku,name,kind,amount,destination,status,created,updated) SELECT ?,?,?,?,?,?,?,'pending',?,? WHERE (SELECT COUNT(*) FROM bank_commerce_sandbox WHERE created>?)<100").bind(id,owner,p.sku,p.name,p.kind,p.amount,destination,now,now,now-86400000).run();
  }
  order=await get(id);
  if(order&&(order.sku!==p.sku||order.destination!==destination))fail('请求编号已被其他订单使用',409);
 }else{
  if(!/^CSB[a-f0-9]{32}$/.test(body.id||''))fail('订单编号无效');order=await get(body.id);
 }
 if(!order)fail('订单不存在或不属于当前测试会话',404);
 const query=async()=>{
  const r=await call(env,'alipay.trade.query',{out_trade_no:order.id});
  if(r.sub_code==='ACQ.TRADE_NOT_EXIST')return;
  if(r.code!=='10000')fail('支付宝暂未返回有效订单，请稍后查单',502);
  if(r.out_trade_no!==order.id||price(r.total_amount)!==order.amount)fail('付款订单或金额核对失败',502);
  if(['TRADE_SUCCESS','TRADE_FINISHED'].includes(r.trade_status)){
   await db.prepare("UPDATE bank_commerce_sandbox SET status='paid',paid_at=COALESCE(paid_at,?),trade_no=?,updated=? WHERE id=? AND owner=? AND status='pending'").bind(Date.now(),r.trade_no||'',Date.now(),order.id,owner).run();
  }else if(r.trade_status==='TRADE_CLOSED'){
   await db.prepare("UPDATE bank_commerce_sandbox SET status=CASE WHEN status='pending' THEN 'closed' ELSE 'review' END,updated=? WHERE id=? AND owner=? AND status IN ('pending','paid','used','shipped','received')").bind(Date.now(),order.id,owner).run();
  }else if(r.trade_status!=='WAIT_BUYER_PAY')fail('未知的支付宝状态，请稍后核查',502);
  order=await get(order.id);
 };
 if(['commerceCreate','commercePay'].includes(body.action)){
  if(order.status!=='pending')fail('订单当前不可付款');
  if(now-order.created>15*60000)fail('付款窗口已过期，请先查单；未付款可重新购买');
  const params=signedParams(env,'alipay.trade.page.pay',{out_trade_no:order.id,total_amount:money(order.amount),subject:'沙箱 · '+order.name,product_code:'FAST_INSTANT_TRADE_PAY',timeout_express:'15m'},{return_url:origin+'/bank/?commerce=return'});
  return {commerceOrder:safe(order),commercePaymentUrl:GATEWAY+'?'+new URLSearchParams(params)};
 }
 if(body.action==='commerceQuery'){await query();return {commerceOrder:safe(order)};}
 if(body.action==='commerceRefund'){
  if(order.status==='refunded')return {commerceOrder:safe(order)};
  if(order.status==='pending')await query();
  if(!['paid','refunding'].includes(order.status))fail('仅未核销、未发货的已付款订单可退款');
  const reserved=await db.prepare("UPDATE bank_commerce_sandbox SET status='refunding',refund_id=?,updated=? WHERE id=? AND owner=? AND status IN ('paid','refunding')").bind('RF'+order.id,Date.now(),order.id,owner).run();
  if(reserved.meta.changes!==1)fail('订单已被核销、发货或正在更新，请刷新',409);
  const r=await call(env,'alipay.trade.refund',{out_trade_no:order.id,out_request_no:'RF'+order.id,refund_amount:money(order.amount),refund_reason:'沙箱商品订单全额退款'});
  if(r.code!=='10000')fail('退款结果暂未确认，重试将沿用原退款编号',502);
  if(r.out_trade_no!==order.id||price(r.refund_fee)!==order.amount)fail('退款回执核对失败，请重试核查',502);
  await db.prepare("UPDATE bank_commerce_sandbox SET status='refunded',refunded_at=COALESCE(refunded_at,?),updated=? WHERE id=? AND owner=? AND status='refunding'").bind(Date.now(),Date.now(),order.id,owner).run();
 }else if(['commerceUse','commerceShip','commerceReceive'].includes(body.action)){
  const op={commerceUse:['voucher','paid','used'],commerceShip:['goods','paid','shipped'],commerceReceive:['goods','shipped','received']}[body.action];
  if(order.kind!==op[0])fail('商品类型不支持此操作');
  if(order.status===op[2])return {commerceOrder:safe(order)};
  if(body.action==='commerceUse'&&order.paid_at+30*86400000<=now)fail('权益已过期，可以申请退款');
  const r=await db.prepare('UPDATE bank_commerce_sandbox SET status=?,updated=? WHERE id=? AND owner=? AND kind=? AND status=?').bind(op[2],now,order.id,owner,op[0],op[1]).run();
  if(r.meta.changes!==1)fail('订单状态已变化；未付款或退款中的商品不可使用',409);
 }else fail('不支持的订单操作');
 return {commerceOrder:safe(await get(order.id))};
}
