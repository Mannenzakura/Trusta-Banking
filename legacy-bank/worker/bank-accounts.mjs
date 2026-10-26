import {initialState,BankError} from './bank-engine.mjs';
import {credential,verify,validatePassword,validatePaymentPassword} from './bank-auth.mjs';
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(24))).map(v=>v.toString(16).padStart(2,'0')).join('');
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',...headers}});
const nameOf=value=>{const name=String(value||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_]{5,31}$/.test(name))throw new BankError('账号须为 6–32 位小写字母、数字或下划线，以字母开头。');return name;};
const passwords=(body,migrate=false)=>{validatePassword(body.loginPassword);if(!migrate)validatePaymentPassword(body.paymentPassword);else if(typeof body.paymentPassword!=='string'||body.paymentPassword.length>128)throw new BankError('旧转账密码格式无效。');if(body.loginPassword!==body.loginConfirm||body.paymentPassword!==body.paymentConfirm)throw new BankError('两次密码输入不一致。');if(body.loginPassword===body.paymentPassword)throw new BankError('两套密码必须不同。');};
export async function accountContext(request,env,body){
 const url=new URL(request.url),now=Date.now(),cookies=request.headers.get('cookie')||'';
 const cookie=value=>`bank_account=${value}; HttpOnly; SameSite=Strict; Path=/api/bank; Max-Age=${value?'604800':'0'}${url.protocol==='https:'?'; Secure':''}`;
 const createSession=async(id,state,unlock=false)=>{const raw=random();await env.DB.prepare('INSERT INTO bank_account_sessions(id,account_id,expires,unlock_until,credential_version) VALUES(?,?,?,?,?)').bind(await digest(raw),id,now+7*86400000,unlock?now+600000:0,state.credentialVersion||1).run();return raw;};
 if(['register','login','recover'].includes(body.action)){
  if(env.AUTH_BURST){const limit=await env.AUTH_BURST.limit({key:'bank-account:'+ (request.headers.get('cf-connecting-ip')||'local')});if(!limit.success)throw new BankError('请求过于频繁，请稍后再试。',429);}
  const id=nameOf(body.username);
  let row=await env.DB.prepare('SELECT state,revision FROM bank_accounts WHERE id=?').bind(id).first();
  if(body.action==='register'){
   if(row)throw new BankError('该账号不可用，请换一个。',409);passwords(body,body.migrate===true);
   let state=initialState(),source=null;
   if(body.migrate===true){const oldToken=cookies.match(/(?:^|;\s*)bank_demo=([a-f0-9]{64})(?:;|$)/)?.[1];if(!oldToken)throw new BankError('未找到旧浏览器账户，请在原浏览器登录后迁移。');source=await digest(oldToken);const old=await env.DB.prepare('SELECT state FROM bank_demo_sessions WHERE id=? AND expires>?').bind(source,now).first();if(!old)throw new BankError('旧账户会话已过期。');state=JSON.parse(old.state);if(state.migratedTo)throw new BankError('旧账户已经迁移。');if(state.security?.until<=now||!state.credentials)throw new BankError('请先解锁旧浏览器账户。');if(!await verify(body.loginPassword,state.credentials.login)||!await verify(body.paymentPassword,state.credentials.payment))throw new BankError('请填写旧账户当前的两套密码以完成迁移。',403);}
   const recoveryKey=random();const payment=source?state.credentials.payment:await credential(body.paymentPassword,'pin6');state.credentials={login:await credential(body.loginPassword),payment};state.recoveryHash=await digest(recoveryKey);state.credentialVersion=1;state.security={until:0};state.pending=null;
   try{await env.DB.prepare('INSERT INTO bank_accounts(id,state,revision,migration_source,created_at) VALUES(?,?,0,?,?)').bind(id,JSON.stringify(state),source,now).run();}catch{throw new BankError('账号或旧账户已被绑定，请重新登录确认。',409);}
   if(source){const legacy=JSON.stringify({migratedTo:id});await env.DB.prepare('UPDATE bank_demo_sessions SET state=?,revision=revision+1 WHERE id=?').bind(legacy,source).run();}
   return {response:json({locked:true,needsSetup:false,accountMode:true,account:id,recoveryKey,unlockUntil:0},200,{'Set-Cookie':cookie(await createSession(id,state))})};
  }
  if(!row)throw new BankError('账号或验证信息不正确。',403);
  const state=JSON.parse(row.state);state.security||={until:0};const kind=body.action==='login'?'login':'recovery';const gate=state.security[kind]||={attempts:0,blockedUntil:0};
  if(gate.blockedUntil>now)throw new BankError('尝试次数过多，请 5 分钟后重试。',429);
  const valid=body.action==='login'?await verify(body.password,state.credentials.login):typeof body.recoveryKey==='string'&&/^[0-9a-f]{48}$/.test(body.recoveryKey)&&await digest(body.recoveryKey)===state.recoveryHash;
  if(!valid){gate.attempts++;if(gate.attempts>=5){gate.attempts=0;gate.blockedUntil=now+300000;}await env.DB.prepare('UPDATE bank_accounts SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),id,row.revision).run();throw new BankError('账号或验证信息不正确。',403);}
  gate.attempts=0;let recoveryKey;
  if(body.action==='recover'){passwords(body);recoveryKey=random();state.credentials={login:await credential(body.loginPassword),payment:await credential(body.paymentPassword,'pin6')};state.recoveryHash=await digest(recoveryKey);state.credentialVersion=(state.credentialVersion||1)+1;state.security={until:0};state.pending=null;}
  const result=await env.DB.prepare('UPDATE bank_accounts SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),id,row.revision).run();if(result.meta.changes!==1)throw new BankError('账户刚被更新，请重试。',409);
  return {response:json({locked:true,needsSetup:false,accountMode:true,account:id,...(recoveryKey?{recoveryKey}:{}),loginComplete:body.action==='login',unlockUntil:0},200,{'Set-Cookie':cookie(await createSession(id,state,body.action==='login'))})};
 }
 const raw=cookies.match(/(?:^|;\s*)bank_account=([a-f0-9]{48})(?:;|$)/)?.[1];
 if(!raw)return {};
 const key=await digest(raw);
 if(body.action==='logout'){await env.DB.prepare('DELETE FROM bank_account_sessions WHERE id=?').bind(key).run();return {response:json({locked:true,accountMode:true,needsSetup:false},200,{'Set-Cookie':cookie('')})};}
 const session=await env.DB.prepare('SELECT id,account_id,expires,unlock_until,credential_version FROM bank_account_sessions WHERE id=? AND expires>?').bind(key,now).first();
 if(!session)return {response:json({locked:true,needsSetup:false,accountMode:true},200,{'Set-Cookie':cookie('')})};
 const row=await env.DB.prepare('SELECT state,revision FROM bank_accounts WHERE id=?').bind(session.account_id).first();if(!row)return {response:json({locked:true,accountMode:true},200,{'Set-Cookie':cookie('')})};
 const state=JSON.parse(row.state);if(session.credential_version!==(state.credentialVersion||1))session.unlock_until=0;
 return {id:session.account_id,row,session};
}
