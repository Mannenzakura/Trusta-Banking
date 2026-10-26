from pathlib import Path
p=Path('worker/bank-api.mjs');s=p.read_text(encoding='utf-8')
pos=s.index('export async function bankAPI')
s=s[:pos]+'''const encode=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
async function derive(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return encode(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g),h=>parseInt(h,16)),iterations:100000,hash:'SHA-256'},material,256));}
async function credential(password){const salt=encode(crypto.getRandomValues(new Uint8Array(16)));return {salt,hash:await derive(password,salt),algorithm:'PBKDF2-SHA256',iterations:100000};}
async function verify(password,record){if(typeof password!=='string'||password.length>128||!record)return false;const actual=await derive(password,record.salt);let difference=actual.length^record.hash.length;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^record.hash.charCodeAt(i);return difference===0;}
function validatePassword(value){if(typeof value!=='string'||value.length<12||value.length>128||!/[a-zA-Z]/.test(value)||!/[0-9]/.test(value))throw new BankError('密码须为 12–128 位，并包含字母和数字。');}
''' +s[pos:]
s=s.replace('{locked:true,unlockUntil:0},200,','{locked:true,needsSetup:true,unlockUntil:0},200,')
a=s.index('  state.security||=');b=s.index('\n }catch',a)
s=s[:a]+'''  state.security||={until:0};
  const sec=state.security;
  sec.login||={attempts:0,blockedUntil:0};sec.payment||={attempts:0,blockedUntil:0};
  const configured=()=>!!(state.credentials?.login&&state.credentials?.payment);
  const locked=()=>({locked:true,needsSetup:!configured(),unlockUntil:0});
  const save=async()=>{const r=await env.DB.prepare('UPDATE bank_demo_sessions SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),key,row.revision).run();if(r.meta.changes!==1)throw new BankError('账户刚被另一窗口更新，请重新操作。',409);};
  const payload=(extra={})=>{if(!configured()||sec.until<=Date.now())return locked();const safe=structuredClone(state);delete safe.security;delete safe.credentials;return {state:safe,contacts:safe.contacts,products,report:report(state),unlockUntil:sec.until,...extra};};
  const authenticate=async(kind,password)=>{const gate=sec[kind];if(gate.blockedUntil>Date.now())throw new BankError('尝试次数过多，请 5 分钟后再试。',429);if(!await verify(password,state.credentials?.[kind])){gate.attempts++;if(gate.attempts>=5){gate.blockedUntil=Date.now()+300000;gate.attempts=0;sec.until=0;state.pending=null;}await save();throw new BankError((kind==='login'?'登录':'转账')+'密码不正确，连续 5 次错误将暂时锁定。',403);}gate.attempts=0;};
  if(body.action==='lock'){sec.until=0;state.pending=null;await save();return json(locked());}
  if(body.action==='setupPasswords'){
   if(configured())throw new BankError('密码已设置，请在个人中心修改。',409);
   validatePassword(body.loginPassword);validatePassword(body.paymentPassword);
   if(body.loginPassword!==body.loginConfirm||body.paymentPassword!==body.paymentConfirm)throw new BankError('两次输入的密码不一致。');
   if(body.loginPassword===body.paymentPassword)throw new BankError('登录密码和转账密码必须不同。');
   state.credentials={login:await credential(body.loginPassword),payment:await credential(body.paymentPassword)};
   sec.until=0;state.pending=null;sec.login={attempts:0,blockedUntil:0};sec.payment={attempts:0,blockedUntil:0};
   state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'安全',text:'已设置独立登录密码和转账密码'});await save();return json(locked());
  }
  if(!configured())return json(locked());
  if(body.action==='unlock'){await authenticate('login',body.password);sec.until=Date.now()+10*60000;await save();return json(payload());}
  if(sec.until<=Date.now())return json(locked());
  if(request.method==='GET'||body.action==='init')return json(payload());
  if(body.action==='changePassword'){
   if(!['login','payment'].includes(body.kind))throw new BankError('密码类型无效。');
   validatePassword(body.newPassword);if(body.newPassword!==body.confirmPassword)throw new BankError('两次输入的新密码不一致。');
   await authenticate(body.kind,body.currentPassword);
   if(await verify(body.newPassword,state.credentials[body.kind]))throw new BankError('新密码不能与旧密码相同。');
   if(await verify(body.newPassword,state.credentials[body.kind==='login'?'payment':'login']))throw new BankError('登录密码和转账密码必须不同。');
   state.credentials[body.kind]=await credential(body.newPassword);state.pending=null;sec.until=0;
   state.audit.unshift({id:crypto.randomUUID(),at:state.now,type:'安全',text:(body.kind==='login'?'登录':'转账')+'密码已修改，已锁定会话'});await save();return json(locked());
  }
  if(body.action==='profile'){const name=String(body.name||'').trim();if(!name||name.length>20)throw new BankError('称呼须为 1–20 字。');state.profile={name};await save();return json(payload());}
  let transactionVerified=false;
  if(body.action==='confirm'&&(state.pending?.strong||state.pending?.type==='transfer')){await authenticate('payment',body.pin);transactionVerified=true;}
  const credentials=state.credentials,profile=state.profile;
  const result=operate(state,{...body,pin:transactionVerified});
  if(body.action==='reset'){state.credentials=credentials;state.profile=profile;state.security={until:0};await save();return json(locked());}
  await save();return json(payload(result));''' +s[b:]
p.write_text(s,encoding='utf-8')
p=Path('worker/bank-engine.mjs');s=p.read_text(encoding='utf-8').replace("pin!=='246810'","pin!==true").replace('演示校验码不正确。比赛沙箱校验码为 246810，不代表生产级身份验证。','交易密码验证未通过。').replace('累计金额达到加强确认条件，请输入演示校验码。','交易必须经过密码验证。');p.write_text(s,encoding='utf-8')
