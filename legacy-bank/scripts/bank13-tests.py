from pathlib import Path
import re
p=Path('tests/bank.test.mjs');s=p.read_text(encoding='utf-8')
s=re.sub(r"confirm\(s,([^\n;]*?),'246810'\)",r"confirm(s,\1,true)",s)
s=s.replace("const original=await (await bankAPI(req({action:'unlock',pin:'246810'},cookie),env)).json();", "await bankAPI(req({action:'setupPasswords',loginPassword:'TestLogin2026!',loginConfirm:'TestLogin2026!',paymentPassword:'TestPayment2026!',paymentConfirm:'TestPayment2026!'},cookie),env);const original=await (await bankAPI(req({action:'unlock',password:'TestLogin2026!'},cookie),env)).json();")
s=s.replace("await bankAPI(req({action:'unlock',pin:'246810'},cookie2),env);", "await bankAPI(req({action:'setupPasswords',loginPassword:'TestLogin2026!',loginConfirm:'TestLogin2026!',paymentPassword:'TestPayment2026!',paymentConfirm:'TestPayment2026!'},cookie2),env);await bankAPI(req({action:'unlock',password:'TestLogin2026!'},cookie2),env);")
s=s.replace("pin:'246810'","pin:'TestPayment2026!'")
a=s.index("test('locked API never")
s=s[:a]+'''test('independent credentials, migration, password changes, reset preservation and lockout',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0005_bank_demo.sql',import.meta.url),'utf8'));
 const env={DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)},async run(){return {meta:db.prepare(sql).run(...args)}}}}}}}};
 let cookie;const call=async body=>bankAPI(new Request('https://example.test/api/bank',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)}),env);
 const init=await call({action:'init'});cookie=init.headers.get('set-cookie').split(';')[0];assert.equal((await init.json()).needsSetup,true);
 const setup={action:'setupPasswords',loginPassword:'TestLogin2026!',loginConfirm:'TestLogin2026!',paymentPassword:'TestPayment2026!',paymentConfirm:'TestPayment2026!'};
 assert.equal((await call({...setup,paymentPassword:setup.loginPassword,paymentConfirm:setup.loginPassword})).status,400);
 assert.equal((await call(setup)).status,200);assert.equal((await call(setup)).status,409);
 const stored=db.prepare('SELECT state FROM bank_demo_sessions').get().state;assert.ok(!stored.includes('TestLogin2026!'));assert.ok(!stored.includes('TestPayment2026!'));
 assert.equal((await call({action:'unlock',password:'246810'})).status,403);
 assert.equal((await call({action:'unlock',password:'TestPayment2026!'})).status,403);
 const unlocked=await (await call({action:'unlock',password:'TestLogin2026!'})).json();assert.equal(unlocked.state.credentials,undefined);assert.equal(unlocked.state.security,undefined);
 const proposal=await (await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}})).json();
 assert.equal((await call({action:'confirm',id:proposal.state.pending.id,pin:true})).status,403);
 assert.equal((await call({action:'confirm',id:proposal.state.pending.id,pin:'TestLogin2026!'})).status,403);
 assert.equal((await call({action:'confirm',id:proposal.state.pending.id,pin:'TestPayment2026!'})).status,200);
 assert.equal((await call({action:'changePassword',kind:'payment',currentPassword:'bad',newPassword:'NewPayment2026!',confirmPassword:'NewPayment2026!'})).status,403);
 const changed=await (await call({action:'changePassword',kind:'payment',currentPassword:'TestPayment2026!',newPassword:'NewPayment2026!',confirmPassword:'NewPayment2026!'})).json();assert.equal(changed.locked,true);
 await call({action:'unlock',password:'TestLogin2026!'});
 const p2=await (await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}})).json();assert.equal((await call({action:'confirm',id:p2.state.pending.id,pin:'TestPayment2026!'})).status,403);assert.equal((await call({action:'confirm',id:p2.state.pending.id,pin:'NewPayment2026!'})).status,200);
 const changedLogin=await (await call({action:'changePassword',kind:'login',currentPassword:'TestLogin2026!',newPassword:'NewLogin2026!',confirmPassword:'NewLogin2026!'})).json();assert.equal(changedLogin.locked,true);
 assert.equal((await call({action:'unlock',password:'TestLogin2026!'})).status,403);await call({action:'unlock',password:'NewLogin2026!'});
 await call({action:'reset',confirm:'重置模拟账户'});assert.equal((await (await call({action:'init'})).json()).needsSetup,false);await call({action:'unlock',password:'NewLogin2026!'});
 await call({action:'lock'});for(let i=0;i<5;i++)assert.equal((await call({action:'unlock',password:'bad'})).status,403);assert.equal((await call({action:'unlock',password:'NewLogin2026!'})).status,429);
 assert.equal((await (await call({action:'prepare',operation:{type:'transfer',contact:'lin',amount:1}})).json()).state,undefined);
 db.close();
});
'''
p.write_text(s,encoding='utf-8')
