import {planAction66,planView66,guardPlan66} from './bank-journeys66.mjs';
import {saveLifestyle64,discoveries64} from './bank-lifestyle64.mjs';
import {quoteFlight63} from './bank-flight-quote63.mjs';
import {cloudEnabled62,cloudChat62} from './bank-cloud-ai62.mjs';
import {baggage54,cachedBaggage54,matchBaggage54} from './baggage54.mjs';
import {realFlights52} from './variflight52.mjs';
import {DuffelTestError} from './duffel-test-client.mjs';
import {duffelView,duffelAction} from './bank-duffel.mjs';
import {commerceAction,commerceView,commerceReceipts} from './bank-commerce.mjs';
import {sandboxAction} from './bank-alipay.mjs';
import {ensureBook,verifyBook,postBook} from './bank-book.mjs';
import {queueAI,acceptAI,nextAI} from './bank-ai.mjs';
import {pairBridge,bridgeAPI} from './bank-bridge.mjs';
import {marketQuotes} from './bank-market.mjs';
import {credential,verify,validatePassword,validatePaymentPassword,newTotpSecret,verifyTotp} from './bank-auth.mjs';
import {accountContext} from './bank-accounts.mjs';
import {normalizeCards,initialState,operate,report,notifications,contacts,products,BankError,detectSubscriptions,recommendations,tick,nextWake} from './bank-engine.mjs';
const json=(v,status=200,extra={})=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',...extra}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function bankAPI(request,env){
 try{
  const url=new URL(request.url);if(url.pathname!=='/api/bank')return json({error:'接口不存在'},404);
  if(!['GET','POST'].includes(request.method))return json({error:'方法不支持'},405,{'Allow':'GET, POST'});
  let body={};if(request.method==='POST'){if(request.headers.get('origin')!==url.origin)return json({error:'请求来源无效'},403);try{body=await request.json();}catch{return json({error:'请求格式无效'},400);}}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'请求格式无效'},400);
  const testEnabled=env.BANK_TEST_MODE==='true';
  if(['bridgePoll','bridgeResult'].includes(body.action))return json(await bridgeAPI(env,body));
  const testToken=request.headers.get('cookie')?.match(/(?:^|;\s*)bank_test=([a-f0-9]{64})(?:;|$)/)?.[1];
  const testCookie=v=>`bank_test=${v}; HttpOnly; SameSite=Strict; Path=/api/bank; Max-Age=${v?604800:0}${url.protocol==='https:'?'; Secure':''}`;
  const revokeBridge=async()=>{if(!testToken)return;const k=await hash(testToken),r=await env.DB.prepare('SELECT state,revision FROM bank_demo_sessions WHERE id=? AND expires>?').bind(k,Date.now()).first();if(!r)return;const v=JSON.parse(r.state);if(!v.ai)return;delete v.ai;const out=await env.DB.prepare('UPDATE bank_demo_sessions SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(v),k,r.revision).run();if(out.meta.changes!==1)throw new BankError('状态更新中，请重试退出',409);};
  if(body.action==='exitTest'){await revokeBridge();return json({locked:true,needsSetup:false},200,{'Set-Cookie':testCookie('')});}
  if(body.action==='enterTest'){
   if(!testEnabled)throw new BankError('测试模式已关闭。',403);
   const raw=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const fresh=initialState();fresh.testMode=true;
   await env.DB.prepare('INSERT INTO bank_demo_sessions(id,state,revision,expires) VALUES(?,?,0,?)').bind(await hash(raw),JSON.stringify(fresh),Date.now()+7*86400000).run();
   return json({loginComplete:true},200,{'Set-Cookie':testCookie(raw)});
  }
  const testing=testEnabled&&!!testToken;
  const account=testing?{}:await accountContext(request,env,body);if(account.response)return account.response;
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)bank_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
  const key=testing?await hash(testToken):token?await hash(token):null;
  let row=account.row|| (key?await env.DB.prepare('SELECT state,revision FROM bank_demo_sessions WHERE id=? AND expires>?').bind(key,Date.now()).first():null);
  if(!row&&testing)return json({locked:true,needsSetup:false},200,{'Set-Cookie':testCookie('')});
  if(!row){if(body.action!=='init')return json({needsSession:true},401);const raw=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');const state=initialState();await env.DB.prepare('INSERT INTO bank_demo_sessions(id,state,revision,expires) VALUES(?,?,0,?)').bind(await hash(raw),JSON.stringify(state),Date.now()+7*86400000).run();await env.DB.prepare('DELETE FROM bank_demo_sessions WHERE id IN (SELECT id FROM bank_demo_sessions WHERE expires<? LIMIT 20)').bind(Date.now()).run();return json({locked:true,needsSetup:true,unlockUntil:0},200,{'Set-Cookie':`bank_demo=${raw}; HttpOnly; SameSite=Strict; Path=/api/bank; Max-Age=604800${url.protocol==='https:'?'; Secure':''}`});}
  const state=normalizeCards(JSON.parse(row.state));if(testing&&!state.testMode)throw new BankError('测试会话无效',403);if(!testing&&state.testMode)throw new BankError('测试模式已关闭',403);if(state.migratedTo)return json({locked:true,needsSetup:false,account:state.migratedTo,accountMode:true});
  ensureBook(state);verifyBook(state);
  state.security||={until:0};
  const sec=state.security;if(account.row)sec.until=account.session.unlock_until;
  sec.login||={attempts:0,blockedUntil:0};sec.payment||={attempts:0,blockedUntil:0};
  const configured=()=>testing||!!(state.credentials?.login&&state.credentials?.payment);
  const locked=()=>({locked:true,needsSetup:!configured(),unlockUntil:0,account:account.id||null,accountMode:!!account.row});
  const save=async()=>{postBook(state,body.action||'scheduled',body.id||null);state.nextWake=nextWake(state);const r=await env.DB.prepare(account.row?'UPDATE bank_accounts SET state=?,revision=revision+1 WHERE id=? AND revision=?':'UPDATE bank_demo_sessions SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),account.id||key,row.revision).run();if(r.meta.changes!==1)throw new BankError('账户刚被另一窗口更新，请重新操作。',409);if(account.row)await env.DB.prepare('UPDATE bank_account_sessions SET unlock_until=?,credential_version=? WHERE id=?').bind(sec.until||0,state.credentialVersion||1,account.session.id).run();};
  const verifySecondFactor=async(code)=>{if(testing||env.BANK_REQUIRE_MFA!=='true')return;if(!sec.totp)throw new BankError('请先在个人中心绑定身份验证器。',403);const gate=sec.payment;if(gate.blockedUntil>Date.now())throw new BankError('验证暂时锁定，请稍后重试。',429);const step=await verifyTotp(sec.totp.secret,code,sec.totp.last);if(step===null){gate.attempts++;if(gate.attempts>=5){gate.blockedUntil=Date.now()+300000;gate.attempts=0;}await save();throw new BankError('身份验证器代码无效、已使用或已过期。',403);}sec.totp.last=step;gate.attempts=0;};
  let duffel=testing?await duffelView(env,key):{ready:false};
  let commerce=testing?await commerceView(env,key):null;
  const payload=(extra={})=>{if(!configured()||(!testing&&sec.until<=Date.now()))return locked();normalizeCards(state);const safe=structuredClone(state);delete safe.security;delete safe.credentials;delete safe.recoveryHash;delete safe.demoBackup;delete safe.book;safe.receipts=[...commerceReceipts(commerce),...safe.receipts].sort((a,b)=>b.at-a.at);if(safe.ai){delete safe.ai.bridgeHash;if(safe.ai.job){delete safe.ai.job.lease;delete safe.ai.job.text;}}return {journeys66:(state.journeys66||[]).map(p=>planView66(state,p)),discoveries:discoveries64(state),cloudAI:testing&&cloudEnabled62(env),cloudProvider:env.BANK_GLM_FREE==='enabled'?'glm-free':'cloudflare',duffel,commerce,account:account.id||null,accountMode:!!account.row,testMode:testing,mfaEnabled:!!sec.totp,mfaRequired:!testing&&env.BANK_REQUIRE_MFA==='true',subscriptionCandidates:detectSubscriptions(state),recommendations:recommendations(state),paymentPasswordLegacy:!testing&&state.credentials.payment.format!=='pin6',bookStatus:verifyBook(state),state:safe,contacts:safe.contacts,products,report:report(state),yearReport:report(state,'year'),notifications:notifications(state),unlockUntil:testing?0:sec.until,...extra};};
  const authenticate=async(kind,password)=>{const gate=sec[kind];if(gate.blockedUntil>Date.now())throw new BankError('尝试次数过多，请 5 分钟后再试。',429);if(!await verify(password,state.credentials?.[kind])){gate.attempts++;if(gate.attempts>=5){gate.blockedUntil=Date.now()+300000;gate.attempts=0;sec.until=0;state.pending=null;}await save();const error=new BankError((kind==='login'?'登录':'转账')+'密码不正确，连续 5 次错误将暂时锁定。',403);error.locked=sec.until<=Date.now();throw error;}gate.attempts=0;};
  if(testing&&['setupPasswords','changePassword','register','recover','login'].includes(body.action))throw new BankError('请先关闭测试模式，再管理个人账户。',400);
  if(testing&&['lock','logout'].includes(body.action)){await revokeBridge();return json({locked:true,needsSetup:false},200,{'Set-Cookie':testCookie('')});}
  if(body.action==='lock'){sec.until=0;state.pending=null;await save();return json(locked());}
  if(body.action==='setupPasswords'){
   if(configured())throw new BankError('密码已设置，请在个人中心修改。',409);
   validatePassword(body.loginPassword);validatePaymentPassword(body.paymentPassword);
   if(body.loginPassword!==body.loginConfirm||body.paymentPassword!==body.paymentConfirm)throw new BankError('两次输入的密码不一致。');
   if(body.loginPassword===body.paymentPassword)throw new BankError('登录密码和转账密码必须不同。');
   state.credentials={login:await credential(body.loginPassword),payment:await credential(body.paymentPassword,'pin6')};
   sec.until=0;state.pending=null;sec.login={attempts:0,blockedUntil:0};sec.payment={attempts:0,blockedUntil:0};
   state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'安全',text:'已设置独立登录密码和转账密码'});await save();return json(locked());
  }
  if(!configured())return json(locked());
  if(body.action==='unlock'){await authenticate('login',body.password);sec.until=Date.now()+10*60000;await save();return json(payload());}
  if(!testing&&sec.until<=Date.now())return json(locked());
  if(['journeyCreate66','journeyBudget66','journeyFlight66','journeyPrepare66'].includes(body.action)){const result=planAction66(state,body);await save();return json(payload(result));}
  if(body.action==='saveLifestyle64'){saveLifestyle64(state,body.settings);await save();return json(payload());}
  if(body.action==='deleteLifestyle64'){delete state.lifestyle;delete state.discoveryDismissed;await save();return json(payload());}
  if(body.action==='dismiss64'){if(!discoveries64(state).some(x=>x.id===body.id))throw new BankError('提醒已失效');state.discoveryDismissed=[...(state.discoveryDismissed||[]),body.id].slice(-100);await save();return json(payload());}
  if(body.action==='flightBaggage')return json(payload(await baggage54(env,key,body)));
  if(body.action==='virtualFlightQuote'){
   if(!testing)throw new BankError('请开启测试模式后虚拟购票',403);
   const offer=await quoteFlight63(state,env,key,body);await save();return json(payload({virtualFlightOffer:offer}));
  }
  if(body.action==='realFlightSearch')return json(payload(await realFlights52(env,key,body)));
  if(String(body.action||'').startsWith('duffel')){if(!testing)throw new BankError('Duffel 仅支持测试会话',403);const result=await duffelAction(env,key,body);duffel=await duffelView(env,key);return json(payload(result));}
  if(String(body.action||'').startsWith('commerce')){if(!testing)throw new BankError('支付宝沙箱订单仅在测试模式可用',403);const result=await commerceAction(env,key,body,url.origin);commerce=await commerceView(env,key);return json(payload(result));}
  if(String(body.action||'').startsWith('alipay')){if(!testing)throw new BankError('支付宝沙箱仅在测试模式可用',403);return json(await sandboxAction(env,key,body,url.origin));}
  if(body.action==='sessions'||body.action==='revokeOtherSessions'){
   if(!account.row||testing)throw new BankError('会话管理仅适用于已登录的个人账号');
   if(body.action==='revokeOtherSessions'){await verifySecondFactor(body.otp);await authenticate('payment',body.pin);await env.DB.prepare('DELETE FROM bank_account_sessions WHERE account_id=? AND id<>?').bind(account.id,account.session.id).run();state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'安全',text:'已退出其他登录会话'});await save();}
   const rows=await env.DB.prepare('SELECT id,expires,unlock_until FROM bank_account_sessions WHERE account_id=? AND expires>?').bind(account.id,Date.now()).all();return json(payload({sessions:rows.results.map(r=>({current:r.id===account.session.id,expires:r.expires,unlocked:r.unlock_until>Date.now()}))}));
  }
  if(body.action==='aiPair'){const result=await pairBridge(env,state,key);await save();return json(payload(result));}
  if(body.action==='aiDisconnect'){delete state.ai;await save();return json(payload());}
  if(body.action==='aiCancel'){if(state.ai){state.ai.job=null;state.ai.draft=null;delete state.ai.sequence;}await save();return json(payload());}
  if(body.action==='marketQuotes')return json(await marketQuotes());
  if(!testing&&!state.demoMode){state.now=Math.max(state.now,Date.now());tick(state);}
  if(request.method==='GET'||body.action==='init'){await save();return json(payload());}
  if(body.action==='mfaBegin'){if(testing)throw new BankError('测试模式无需绑定');await authenticate('login',body.password);if(sec.totp)throw new BankError('身份验证器已绑定');sec.totpPending={secret:newTotpSecret(),expires:Date.now()+600000};await save();return json(payload({enrollmentSecret:sec.totpPending.secret}));}
  if(body.action==='mfaFinish'){if(!sec.totpPending||sec.totpPending.expires<Date.now())throw new BankError('绑定已过期，请重新开始');if(sec.payment.blockedUntil>Date.now())throw new BankError('验证暂时锁定',429);const step=await verifyTotp(sec.totpPending.secret,body.otp);if(step===null){sec.payment.attempts++;if(sec.payment.attempts>=5){sec.payment.blockedUntil=Date.now()+300000;sec.payment.attempts=0;}await save();throw new BankError('验证码不正确',403);}sec.totp={secret:sec.totpPending.secret,last:step};delete sec.totpPending;await save();return json(payload());}
  if(body.action==='changePassword'){
   if(!['login','payment'].includes(body.kind))throw new BankError('密码类型无效。');
   if(body.kind==='payment')validatePaymentPassword(body.newPassword);else validatePassword(body.newPassword);if(body.newPassword!==body.confirmPassword)throw new BankError('两次输入的新密码不一致。');
   await verifySecondFactor(body.otp);await authenticate(body.kind,body.currentPassword);
   if(await verify(body.newPassword,state.credentials[body.kind]))throw new BankError('新密码不能与旧密码相同。');
   if(await verify(body.newPassword,state.credentials[body.kind==='login'?'payment':'login']))throw new BankError('登录密码和转账密码必须不同。');
   state.credentials[body.kind]=await credential(body.newPassword,body.kind==='payment'?'pin6':'password');state.credentialVersion=(state.credentialVersion||1)+1;state.pending=null;sec.until=0;
   state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'安全',text:(body.kind==='login'?'登录':'转账')+'密码已修改，已锁定会话'});await save();return json(locked());
  }
  if(body.action==='demoSeed'&&!state.demoMode){const backup=structuredClone(state);for(const field of ['credentials','security','recoveryHash','credentialVersion','demoBackup'])delete backup[field];const retained={credentials:state.credentials,security:sec,recoveryHash:state.recoveryHash,credentialVersion:state.credentialVersion,profile:state.profile};for(const field of Object.keys(state))delete state[field];Object.assign(state,initialState(),retained,{demoMode:true,demoBackup:backup});}
  if(body.action==='exitDemo'){if(!state.demoMode||!state.demoBackup)throw new BankError('当前不在演示账本');const restored=state.demoBackup,retained={credentials:state.credentials,security:sec,recoveryHash:state.recoveryHash,credentialVersion:state.credentialVersion,profile:state.profile};for(const field of Object.keys(state))delete state[field];Object.assign(state,restored,retained);state.pending=null;await save();return json(payload());}
  if(body.action==='profile'){const name=String(body.name||'').trim();if(!name||name.length>20)throw new BankError('称呼须为 1–20 字。');state.profile={name};await save();return json(payload());}
  let transactionVerified=false;
  if(body.action==='confirm'&&(state.pending?.strong||state.pending?.type==='transfer')){if(!testing){await verifySecondFactor(body.otp);await authenticate('payment',body.pin);}transactionVerified=true;}
  const credentials=state.credentials,profile=state.profile,recoveryHash=state.recoveryHash,credentialVersion=state.credentialVersion,demoBackup=state.demoBackup,demoMode=state.demoMode;
  if(sec.toolBlockedUntil>Date.now())throw new BankError('操作连续失败，已暂停执行 5 分钟。',429);
  const snapshot=structuredClone(state);let result;
  try{if(body.action==='confirm')guardPlan66(state);result=body.action==='chat'&&testing&&cloudEnabled62(env)?await cloudChat62(state,env,key,body.text):body.action==='chat'&&state.ai?.bridgeHash?queueAI(state,body.text):body.action==='aiAccept'?acceptAI(state,body.id):body.action==='aiNext'?nextAI(state):operate(state,{...body,pin:transactionVerified});sec.toolFailures=0;state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'接口审计',text:body.action+' 成功',action:body.action,confirmationId:body.action==='confirm'?body.id:state.pending?.id||null,level:state.pending?.level||'account'});}
  catch(error){for(const k of Object.keys(state))delete state[k];Object.assign(state,snapshot,{security:sec});if(body.action==='prepare'||body.action==='confirm'){state.serviceEvents||=[];state.serviceEvents.unshift({id:crypto.randomUUID(),at:state.now,type:'failure',title:'业务办理未完成',status:'失败',lines:[error instanceof BankError?error.message:'服务暂不可用，请稍后重试','本次操作未提交，未产生新的资金变动'],transactionIds:[]});state.pending=null;}sec.toolFailures=(sec.toolFailures||0)+1;if(sec.toolFailures>=5){sec.toolBlockedUntil=Date.now()+300000;sec.toolFailures=0;}state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'失败',text:'操作未提交：'+String(body.action).slice(0,40)});await save();throw error;}
  if(body.action==='reset'){state.credentials=credentials;state.profile=profile;state.recoveryHash=recoveryHash;state.credentialVersion=credentialVersion;state.demoBackup=demoBackup;state.demoMode=demoMode;state.security={...sec,until:0};state.testMode=testing;sec.until=0;await save();return json(testing?payload():locked());}
  if(testing)state.testMode=true;
  await save();return json(payload(result));
 }catch(e){return json({error:e instanceof BankError||e instanceof DuffelTestError?e.message:'模拟服务暂不可用，请稍后重试。',...(e.locked?{locked:true,needsSetup:false,unlockUntil:0}:{})},e instanceof BankError?e.status:503);}
}
