import {createPrivateKey, createPublicKey, sign, verify} from 'node:crypto';
import {BankError} from './bank-engine.mjs';
export const GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
export const APP_ID = '9021000169630091';
const fail=(message,status=400)=>{throw new BankError(message,status);};
function pem(value,type){const s=String(value||'').trim();return s.startsWith('-----BEGIN')?s:`-----BEGIN ${type}-----\n${s.replace(/\s/g,'')}\n-----END ${type}-----`;}
export function keys(env){
 if(env.ALIPAY_SANDBOX_ENABLED!=='true'||env.BANK_TEST_MODE!=='true')fail('支付宝沙箱尚未启用',503);
 try{let privateKey;for(const t of ['RSA PRIVATE KEY','PRIVATE KEY']){try{privateKey=createPrivateKey(pem(env.ALIPAY_SANDBOX_PRIVATE_KEY,t));break;}catch{}}
 const publicKey=createPublicKey(pem(env.ALIPAY_SANDBOX_PUBLIC_KEY,'PUBLIC KEY'));if(!privateKey||privateKey.asymmetricKeyType!=='rsa'||publicKey.asymmetricKeyType!=='rsa')throw Error();return {privateKey,publicKey};
 }catch{fail('支付宝沙箱密钥配置不可用',503);}
}
export function signedParams(env,method,biz,extra={}){
 const {privateKey}=keys(env);const p={app_id:APP_ID,method,format:'JSON',charset:'utf-8',sign_type:'RSA2',timestamp:new Date(Date.now()+28800000).toISOString().slice(0,19).replace('T',' '),version:'1.0',biz_content:JSON.stringify(biz),...extra};
 p.sign=sign('RSA-SHA256',Buffer.from(Object.keys(p).sort().map(k=>`${k}=${p[k]}`).join('&')),privateKey).toString('base64');return p;
}
// Extract the signed JSON object without reserializing it (whitespace and escaping are signed).
export function responseObject(raw,name){
 const start=raw.indexOf('"'+name+'"');if(start<0)fail('支付宝响应格式无效',502);let i=raw.indexOf(':',start)+1;while(/\s/.test(raw[i]||'')&&i<raw.length)i++;const begin=i;if(raw[i]!=='{')fail('支付宝响应格式无效',502);let depth=0,quoted=false,escape=false;
 for(;i<raw.length;i++){const c=raw[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return raw.slice(begin,i+1);}
 fail('支付宝响应不完整',502);
}
export async function rpc(env,method,biz,transport=fetch){
 if(!['alipay.trade.query','alipay.trade.refund'].includes(method))fail('不允许的沙箱接口');
 const p=signedParams(env,method,biz);let response;
 try{response=await transport(GATEWAY,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams(p),signal:AbortSignal.timeout(15000)});}catch{fail('沙箱网络暂不可用，请查单后重试；不会自动新建交易',502);}
 if(!response.ok)fail('沙箱服务暂不可用',502);const raw=await response.text();if(raw.length>100000)fail('沙箱响应过大',502);
 let data;try{data=JSON.parse(raw);}catch{fail('沙箱响应格式无效',502);}const name=method.replaceAll('.','_')+'_response';
 if(!data[name]||!data.sign)fail('沙箱返回未签名的错误，请检查应用配置',502);
 if(!verify('RSA-SHA256',Buffer.from(responseObject(raw,name)),keys(env).publicKey,Buffer.from(data.sign,'base64')))fail('支付宝响应验签失败，状态未采信',502);
 return data[name];
}
const amount=cents=>(cents/100).toFixed(2);
const cents=value=>{if(!/^\d+(\.\d{1,2})?$/.test(String(value)))return -1;return Math.round(Number(value)*100);};
const safe=o=>({id:o.id,amount:o.amount,status:o.status,created:o.created,updated:o.updated,refundId:o.refund_id||null});
export async function sandboxAction(env,owner,body,origin,call=rpc){
 keys(env);const db=env.DB;
 if(body.action==='alipayList'){const rows=await db.prepare('SELECT * FROM bank_alipay_sandbox WHERE owner=? ORDER BY created DESC LIMIT 50').bind(owner).all();return {orders:rows.results.map(safe),sandbox:true};}
 let order;
 if(body.action==='alipayCreate'){
  if(!/^[a-f0-9-]{36}$/.test(body.requestId||''))fail('请求编号无效');
  const id='SBX'+body.requestId.replaceAll('-','');
  const existing=await db.prepare('SELECT * FROM bank_alipay_sandbox WHERE id=?').bind(id).first();
  if(existing&&existing.owner!==owner)fail('订单不可用',404);
  if(!existing){const count=await db.prepare('SELECT COUNT(*) AS n FROM bank_alipay_sandbox WHERE created>?').bind(Date.now()-86400000).first();if(count.n>=100)fail('今日沙箱测试数量已达上限',429);
   await db.prepare('INSERT OR IGNORE INTO bank_alipay_sandbox(id,owner,amount,status,created,updated) VALUES(?,?,100,?,?,?)').bind(id,owner,'created',Date.now(),Date.now()).run();}
  order=await db.prepare('SELECT * FROM bank_alipay_sandbox WHERE id=? AND owner=?').bind(id,owner).first();
 }else{
  if(!/^SBX[a-f0-9]{32}$/.test(body.id||''))fail('订单编号无效');
  order=await db.prepare('SELECT * FROM bank_alipay_sandbox WHERE id=? AND owner=?').bind(body.id,owner).first();
 }
 if(!order)fail('订单不存在或不属于当前账户',404);
 const update=async(status)=>{await db.prepare('UPDATE bank_alipay_sandbox SET status=?,updated=? WHERE id=? AND owner=?').bind(status,Date.now(),order.id,owner).run();order.status=status;order.updated=Date.now();};
 const query=async()=>{
  const r=await call(env,'alipay.trade.query',{out_trade_no:order.id});
  if(r.sub_code==='ACQ.TRADE_NOT_EXIST')return;
  if(r.code!=='10000')fail('支付宝查单未成功，请稍后重试',502);
  if(r.out_trade_no!==order.id||cents(r.total_amount)!==order.amount)fail('订单或金额核对失败',502);
  if(order.status==='refunded'||order.status==='refunding')return;
  const status={WAIT_BUYER_PAY:'pending',TRADE_SUCCESS:'paid',TRADE_FINISHED:'paid',TRADE_CLOSED:'closed'}[r.trade_status];if(!status)fail('未知支付状态',502);
  await db.prepare("UPDATE bank_alipay_sandbox SET status=?,updated=? WHERE id=? AND owner=? AND status NOT IN ('refunding','refunded')").bind(status,Date.now(),order.id,owner).run();
  order=await db.prepare('SELECT * FROM bank_alipay_sandbox WHERE id=? AND owner=?').bind(order.id,owner).first();
 };
 if(['alipayCreate','alipayPay'].includes(body.action)){
  if(!['created','pending'].includes(order.status))fail('此订单不能再次付款');
  if(Date.now()-order.created>15*60000)fail('付款窗口已过期，请查询状态或新建测试订单');
  const p=signedParams(env,'alipay.trade.page.pay',{out_trade_no:order.id,total_amount:amount(order.amount),subject:'银行网站沙箱联调订单（无实物）',product_code:'FAST_INSTANT_TRADE_PAY',timeout_express:'15m'},{return_url:origin+'/bank/payments.html'});
  return {order:safe(order),paymentUrl:GATEWAY+'?'+new URLSearchParams(p),sandbox:true};
 }
 if(body.action==='alipayQuery'){await query();return {order:safe(order),sandbox:true};}
 if(body.action==='alipayRefund'){
  if(order.status==='refunded')return {order:safe(order),sandbox:true};
  await query();if(!['paid','refunding'].includes(order.status))fail('仅已付款订单可以退款');
  // The same identifier and full amount are reused after timeout or concurrent retries.
  const refundId='RF'+order.id;
  await db.prepare("UPDATE bank_alipay_sandbox SET refund_id=?,status='refunding',updated=? WHERE id=? AND owner=? AND status IN ('paid','refunding')").bind(refundId,Date.now(),order.id,owner).run();
  const r=await call(env,'alipay.trade.refund',{out_trade_no:order.id,out_request_no:refundId,refund_amount:amount(order.amount),refund_reason:'沙箱联调全额退款'});
  if(r.code!=='10000')fail('退款未确认，请稍后点击重试退款；将沿用原退款编号',502);
  if(r.out_trade_no!==order.id||cents(r.refund_fee)!==order.amount)fail('退款回执核对失败，请重试查证',502);
  order.refund_id=refundId;await update('refunded');return {order:safe(order),sandbox:true};
 }
 fail('沙箱操作无效');
}
