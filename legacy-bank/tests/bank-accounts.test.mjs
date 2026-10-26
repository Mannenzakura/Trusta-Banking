import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {totpCode} from '../worker/bank-auth.mjs';
import {runBankSchedule} from '../worker/bank-scheduler.mjs';
import {bankAPI} from '../worker/bank-api.mjs';
import {initialState,operate,prepare,confirm,notifications,tick} from '../worker/bank-engine.mjs';
const setup={action:'register',username:'qa_account',loginPassword:'ExampleLogin2026!',loginConfirm:'ExampleLogin2026!',paymentPassword:'038529',paymentConfirm:'038529'};
function harness(){const db=new DatabaseSync(':memory:');for(const f of ['0005_bank_demo.sql','0006_bank_accounts.sql','0007_bank_due.sql'])db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const env={DB:{prepare(sql){return {bind(...args){return {async all(){return {results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)},async run(){return {meta:db.prepare(sql).run(...args)}}}}}}}};const call=async(body,cookie='')=>{const res=await bankAPI(new Request('https://example.test/api/bank',{method:body?'POST':'GET',headers:{origin:'https://example.test',cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}};return {db,call,env};}
test('persistent accounts survive expired cookies, isolate users and support recovery with revocation',async()=>{
 const {db,call}=harness();const register=await call(setup);assert.equal(register.status,200);assert.equal(register.body.recoveryKey.length,48);assert.equal(register.body.locked,true);const key=register.body.recoveryKey;
 assert.equal((await call({...setup})).status,409);assert.equal((await call({action:'login',username:setup.username,password:'bad'})).status,403);
 const device1=await call({action:'login',username:setup.username,password:setup.loginPassword});const one=await call(null,device1.cookie);assert.equal(one.body.state.balance,2865240);assert.equal(one.body.state.credentials,undefined);assert.equal(one.body.state.recoveryHash,undefined);
 const device2=await call({action:'login',username:setup.username,password:setup.loginPassword});await call({action:'profile',name:'跨设备测试'},device1.cookie);assert.equal((await call(null,device2.cookie)).body.state.profile.name,'跨设备测试');
 await call({...setup,username:'other_account'});const other=await call({action:'login',username:'other_account',password:setup.loginPassword});assert.equal((await call(null,other.cookie)).body.state.profile,undefined);
 const recover=await call({...setup,action:'recover',recoveryKey:key,loginPassword:'ChangedLogin2026!',loginConfirm:'ChangedLogin2026!'});assert.equal(recover.status,200);assert.notEqual(recover.body.recoveryKey,key);assert.equal((await call(null,device1.cookie)).body.locked,true);assert.equal((await call(null,device2.cookie)).body.locked,true);
 assert.equal((await call({...setup,action:'recover',recoveryKey:key})).status,403);assert.equal((await call({action:'login',username:setup.username,password:setup.loginPassword})).status,403);
 const newDevice=await call({action:'login',username:setup.username,password:'ChangedLogin2026!'});assert.equal((await call(null,newDevice.cookie)).body.state.profile.name,'跨设备测试');await call({action:'logout'},newDevice.cookie);assert.equal((await call(null,newDevice.cookie)).body.locked,true);
 db.prepare('UPDATE bank_account_sessions SET expires=0').run();const fresh=await call({action:'login',username:setup.username,password:'ChangedLogin2026!'});assert.equal((await call(null,fresh.cookie)).body.state.profile.name,'跨设备测试');db.close();
});
test('legacy migration preserves data and forbids reuse of migrated browser session',async()=>{
 const {db,call}=harness();const init=await call({action:'init'});const cookie=init.cookie;await call({...setup,action:'setupPasswords'},cookie);await call({action:'unlock',password:setup.loginPassword},cookie);await call({action:'profile',name:'旧账户称呼'},cookie);
 const migrated=await call({...setup,migrate:true},cookie);assert.equal(migrated.status,200);const login=await call({action:'login',username:setup.username,password:setup.loginPassword});assert.equal((await call(null,login.cookie)).body.state.profile.name,'旧账户称呼');assert.equal((await call({action:'unlock',password:setup.loginPassword},cookie)).body.state,undefined);db.close();
});
test('plan tasks, budget payments and completion conserve balance and reservations',()=>{
 const s=initialState();s.subscriptions=[];const before=s.balance;let p=prepare(s,{type:'event',name:'旅行',category:'旅行',amount:500,at:new Date(s.now+86400000).toISOString(),tasks:['车票','住宿']});confirm(s,p.id,true);const plan=s.plans[0];
 assert.throws(()=>operate(s,{action:'completeEvent',id:plan.id}));p=prepare(s,{type:'planPayment',plan:plan.id,amount:120,merchant:'测试车票'});assert.throws(()=>confirm(s,p.id,false));confirm(s,p.id,true);assert.equal(s.balance,before-12000);assert.equal(s.reserved,38000);assert.equal(plan.amount,38000);assert.equal(s.receipts[0].amount,12000);
 for(const t of plan.tasks)operate(s,{action:'taskToggle',plan:plan.id,task:t.id});operate(s,{action:'completeEvent',id:plan.id});assert.equal(s.reserved,0);assert.equal(s.balance,before-12000);assert.throws(()=>operate(s,{action:'completeEvent',id:plan.id}));
});
test('notifications preserve unread state and scheduled receipts reflect execution status',()=>{
 const s=initialState();const p=prepare(s,{type:'transfer',contact:'lin',amount:100,at:new Date(s.now+86400000).toISOString()});confirm(s,p.id,true);const receipt=s.receipts[0];assert.equal(receipt.planId,s.plans[0].id);assert.equal(notifications(s).some(n=>n.kind==='交易结果'),true);
 const notice=notifications(s)[0];operate(s,{action:'readNotification',id:notice.id});assert.equal(notifications(s).find(n=>n.id===notice.id).read,true);s.card.status='locked';s.now+=86400000;tick(s);assert.equal(s.plans.find(x=>x.id===receipt.planId).status,'failed');assert.ok(notifications(s).some(n=>n.kind==='计划结果'));
});
test('demo scenarios are non-destructive and repeated current scenario is idempotent',()=>{
 const s=initialState();const before=s.balance;operate(s,{action:'demoSeed',scenario:'birthday'});operate(s,{action:'demoSeed',scenario:'birthday'});assert.equal(s.plans.length,1);assert.equal(s.plans[0].amount,0);assert.equal(s.balance,before);assert.equal(s.reserved,0);
});
test('isolated demo ledger restores personal data and never exposes its backup',async()=>{
 const {db,call}=harness();await call(setup);const login=await call({action:'login',username:setup.username,password:setup.loginPassword});const cookie=login.cookie;
 const before=(await call(null,cookie)).body.state;const demo=(await call({action:'demoSeed',scenario:'birthday'},cookie)).body;
 assert.equal(demo.state.demoMode,true);assert.equal(demo.state.demoBackup,undefined);assert.equal(demo.state.plans.length,1);
 const proposal=(await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:100}},cookie)).body;
 await call({action:'confirm',id:proposal.state.pending.id,pin:setup.paymentPassword},cookie);assert.equal((await call(null,cookie)).body.state.balance,before.balance-10000);
 const restored=(await call({action:'exitDemo'},cookie)).body;assert.equal(restored.state.balance,before.balance);assert.equal(restored.state.plans.length,before.plans.length);assert.equal(restored.state.receipts.length,before.receipts.length);assert.equal(restored.state.demoMode,undefined);db.close();
});
test('six-digit payment validation, leading zero and verified legacy password migration',async()=>{
 const {credential}=await import('../worker/bank-auth.mjs');const {db,call}=harness();
 for(const bad of ['12345','1234567','12a456','１２３４５６',' 12345',123456]){assert.equal((await call({...setup,paymentPassword:bad,paymentConfirm:bad})).status,400);}
 await call(setup);let login=await call({action:'login',username:setup.username,password:setup.loginPassword});let cookie=login.cookie;
 assert.equal((await call(null,cookie)).body.paymentPasswordLegacy,false);
 const row=db.prepare('SELECT state FROM bank_accounts WHERE id=?').get(setup.username);const state=JSON.parse(row.state);state.credentials.payment=await credential('LegacyPayment2026!');db.prepare('UPDATE bank_accounts SET state=?,revision=revision+1 WHERE id=?').run(JSON.stringify(state),setup.username);
 assert.equal((await call(null,cookie)).body.paymentPasswordLegacy,true);
 const change={action:'changePassword',kind:'payment',currentPassword:'wrong',newPassword:'001234',confirmPassword:'001234'};
 assert.equal((await call(change,cookie)).status,403);assert.equal((await call({...change,currentPassword:'LegacyPayment2026!',newPassword:'StillLong2026!',confirmPassword:'StillLong2026!'},cookie)).status,400);
 assert.equal((await call({...change,currentPassword:'LegacyPayment2026!'},cookie)).body.locked,true);
 login=await call({action:'login',username:setup.username,password:setup.loginPassword});cookie=login.cookie;assert.equal((await call(null,cookie)).body.paymentPasswordLegacy,false);
 let proposal=(await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}},cookie)).body;
 assert.equal((await call({action:'confirm',id:proposal.state.pending.id,pin:'LegacyPayment2026!'},cookie)).status,403);
 assert.equal((await call({action:'confirm',id:proposal.state.pending.id,pin:'001234'},cookie)).status,200);
 assert.equal((await call({action:'changePassword',kind:'login',currentPassword:setup.loginPassword,newPassword:'123456',confirmPassword:'123456'},cookie)).status,400);
 db.close();
});

test('password-free test switch isolates accounts and restores authentication',async()=>{
 const {db,call,env}=harness();
 assert.equal((await call({action:'enterTest'})).status,403);
 env.BANK_TEST_MODE='true';
 await call(setup);const user=await call({action:'login',username:setup.username,password:setup.loginPassword});
 const before=(await call(null,user.cookie)).body.state.balance;
 const enter=await call({action:'enterTest'},user.cookie);assert.equal(enter.status,200);
 const cookies=user.cookie+'; '+enter.cookie;
 const state=await call(null,cookies);assert.equal(state.body.testMode,true);assert.equal(state.body.unlockUntil,0);assert.equal(state.body.state.credentials,undefined);
 const prep=await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:100}},cookies);
 const done=await call({action:'confirm',id:prep.body.state.pending.id},cookies);assert.equal(done.status,200);assert.equal(done.body.state.balance,before-10000);
 assert.equal((await call(null,user.cookie)).body.state.balance,before);
 assert.equal((await call({action:'changePassword',kind:'payment'},cookies)).status,400);
 const exit=await call({action:'exitTest'},cookies);assert.equal(exit.body.locked,true);assert.equal(exit.cookie,'bank_test=');
 await call({action:'lock'},user.cookie);assert.equal((await call(null,user.cookie)).body.locked,true);
 assert.equal((await call({action:'unlock',password:setup.loginPassword},user.cookie)).body.state.balance,before);
 env.BANK_TEST_MODE='false';assert.notEqual((await call(null,enter.cookie)).body.testMode,true);
 db.close();
});

test('API MFA enrollment, secret redaction, forged verification and code replay defenses',async()=>{
 const {db,call,env}=harness();env.BANK_REQUIRE_MFA='true';await call(setup);const login=await call({action:'login',username:setup.username,password:setup.loginPassword}),cookie=login.cookie;
 let prep=await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}},cookie);
 assert.equal((await call({action:'confirm',id:prep.body.state.pending.id,pin:setup.paymentPassword},cookie)).status,403);
 const enroll=await call({action:'mfaBegin',password:setup.loginPassword},cookie);assert.equal(enroll.status,200);const secret=enroll.body.enrollmentSecret,step=Math.floor(Date.now()/30000);
 assert.equal((await call(null,cookie)).body.enrollmentSecret,undefined);assert.equal(enroll.body.state.security,undefined);
 assert.equal((await call({action:'mfaFinish',otp:await totpCode(secret,step)},cookie)).body.mfaEnabled,true);
 prep=await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}},cookie);const id=prep.body.state.pending.id;
 assert.equal((await call({action:'confirm',id,pin:true,otp:await totpCode(secret,step+1),testMode:true},cookie)).status,403);
 const good=await call({action:'confirm',id,pin:setup.paymentPassword,otp:await totpCode(secret,step+1)},cookie);assert.equal(good.status,403); // failed PIN consumed the one-time code in persisted security state
 db.close();
});
test('MFA successful transfer and replay rejection with stored enrolled factor',async()=>{
 const {db,call,env}=harness();env.BANK_REQUIRE_MFA='true';await call(setup);const login=await call({action:'login',username:setup.username,password:setup.loginPassword}),cookie=login.cookie;
 const row=db.prepare('SELECT state FROM bank_accounts WHERE id=?').get(setup.username),s=JSON.parse(row.state),secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';s.security.totp={secret,last:-1};db.prepare('UPDATE bank_accounts SET state=? WHERE id=?').run(JSON.stringify(s),setup.username);
 let prep=await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}},cookie);const code=await totpCode(secret,Math.floor(Date.now()/30000));
 assert.equal((await call({action:'confirm',id:prep.body.state.pending.id,pin:setup.paymentPassword,otp:code},cookie)).status,200);
 prep=await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}},cookie);assert.equal((await call({action:'confirm',id:prep.body.state.pending.id,pin:setup.paymentPassword,otp:code},cookie)).status,403);
 await call({action:'reset',confirm:'重置模拟账户'},cookie);const saved=JSON.parse(db.prepare('SELECT state FROM bank_accounts WHERE id=?').get(setup.username).state);assert.equal(saved.security.totp.secret,secret);db.close();
});
test('background scheduler processes due work once and ignores test accounts',async()=>{
 const {db,call,env}=harness();await call(setup);const login=await call({action:'login',username:setup.username,password:setup.loginPassword});const prep=await call({action:'prepare',operation:{type:'workflow',name:'后台测试',amount:10,at:new Date(Date.now()+3*86400000).toISOString()}},login.cookie);await call({action:'confirm',id:prep.body.state.pending.id,pin:setup.paymentPassword},login.cookie);
 const now=Date.now()+2*86400000;const first=await runBankSchedule(env,now);assert.equal(first.processed,1);const read=()=>JSON.parse(db.prepare('SELECT state FROM bank_accounts WHERE id=?').get(setup.username).state);assert.equal(read().workflows[0].status,'completed');const balance=read().balance;await runBankSchedule(env,now);assert.equal(read().balance,balance);
 env.BANK_TEST_MODE='true';const enter=await call({action:'enterTest'});const test=await call({action:'prepare',operation:{type:'workflow',name:'测试不后台执行',amount:10,at:new Date(Date.now()+3*86400000).toISOString()}},enter.cookie);await call({action:'confirm',id:test.body.state.pending.id},enter.cookie);await runBankSchedule(env,now);assert.equal((await call(null,enter.cookie)).body.state.workflows[0].status,'scheduled');db.close();
});
test('API rejects swapped test cookies, CSRF and forged flags on locked accounts',async()=>{const {db,call,env}=harness();env.BANK_TEST_MODE='true';const legacy=await call({action:'init'});assert.equal((await call(null,legacy.cookie.replace('bank_demo=','bank_test='))).status,403);await call(setup);const login=await call({action:'login',username:setup.username,password:setup.loginPassword});await call({action:'lock'},login.cookie);const attack=await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1},testMode:true,unlocked:true},login.cookie);assert.equal(attack.body.locked,true);const response=await bankAPI(new Request('https://example.test/api/bank',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({action:'enterTest'})}),env);assert.equal(response.status,403);db.close();});
test('card-to-card API persists both legs once and rejects unrelated targets',async()=>{const {db,call,env}=harness();env.BANK_TEST_MODE='true';const enter=await call({action:'enterTest'}),cookie=enter.cookie;let q=await call({action:'prepare',operation:{type:'card',operation:'apply',kind:'debit',accountClass:'II'}},cookie);let r=await call({action:'confirm',id:q.body.state.pending.id},cookie);const cards=r.body.state.cards,total=r.body.state.balance;q=await call({action:'prepare',operation:{type:'ownTransfer',cardId:cards[0].id,target:cards[1].id,amount:100}},cookie);const id=q.body.state.pending.id;r=await call({action:'confirm',id},cookie);assert.equal(r.status,200);await call({action:'confirm',id},cookie);r=await call(null,cookie);assert.equal(r.body.state.cards[0].balance,total-10000);assert.equal(r.body.state.cards[1].balance,10000);assert.equal(r.body.state.balance,total);assert.equal(r.body.state.transactions.filter(t=>t.transferId===id).length,2);assert.equal((await call({action:'prepare',operation:{type:'ownTransfer',target:'foreign',amount:1}},cookie)).status,400);db.close();});

test('session management is account scoped and revocation requires transaction password',async()=>{const {call}=harness();await call(setup);const a=await call({action:'login',username:setup.username,password:setup.loginPassword}),b=await call({action:'login',username:setup.username,password:setup.loginPassword});const list=await call({action:'sessions'},a.cookie);assert.equal(list.status,200);assert.equal(list.body.sessions.filter(x=>x.current).length,1);assert.ok(list.body.sessions.length>=2);assert.ok(list.body.sessions.every(x=>!('id' in x)));assert.equal((await call({action:'revokeOtherSessions',pin:'999999'},a.cookie)).status,403);assert.equal((await call({action:'sessions'},b.cookie)).status,200);assert.equal((await call({action:'revokeOtherSessions',pin:setup.paymentPassword},a.cookie)).status,200);assert.equal((await call({action:'init'},b.cookie)).body.locked,true);assert.equal((await call({action:'sessions'},a.cookie)).body.sessions.length,1);});
