from pathlib import Path
p=Path('worker/bank-api.mjs');s=p.read_text(encoding='utf-8')
s=s.replace('return json({state,contacts,products,report:report(state)},200,','return json({locked:true,unlockUntil:0},200,')
a=s.index("  if(request.method==='GET'||body.action==='init')")
b=s.index('\n }catch',a)
s=s[:a]+'''  state.security||={until:0,attempts:0,blockedUntil:0};
  const sec=state.security;
  const save=async()=>{const r=await env.DB.prepare('UPDATE bank_demo_sessions SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),key,row.revision).run();if(r.meta.changes!==1)throw new BankError('账户刚被另一窗口更新，请重新操作。',409);};
  const payload=(extra={})=>{if(sec.until<=Date.now())return {locked:true,unlockUntil:0};const safe=structuredClone(state);delete safe.security;return {state:safe,contacts:safe.contacts,products,report:report(state),unlockUntil:sec.until,...extra};};
  if(body.action==='lock'){sec.until=0;state.pending=null;await save();return json({locked:true,unlockUntil:0});}
  if(body.action==='unlock'){
   if(sec.blockedUntil>Date.now())return json({error:'尝试次数过多，请 5 分钟后再试。'},429);
   if(body.pin!=='246810'){sec.attempts++;if(sec.attempts>=5){sec.blockedUntil=Date.now()+300000;sec.attempts=0;}await save();return json({error:'演示口令不正确，请使用页面提示的沙箱口令。'},403);}
   sec.until=Date.now()+10*60000;sec.attempts=0;await save();return json(payload());
  }
  if(sec.until<=Date.now())return json({locked:true,unlockUntil:0});
  if(request.method==='GET'||body.action==='init')return json(payload());
  if(body.action==='confirm'&&(state.pending?.strong||state.pending?.type==='transfer')){
   if(sec.blockedUntil>Date.now())return json({error:'尝试次数过多，请 5 分钟后再试。'},429);
   if(body.pin!=='246810'){sec.attempts++;if(sec.attempts>=5){sec.blockedUntil=Date.now()+300000;sec.attempts=0;sec.until=0;state.pending=null;}await save();return json({error:'交易演示口令错误；连续 5 次错误将锁定。'},403);}
   sec.attempts=0;
  }
  const result=operate(state,body);
  if(body.action==='reset')return (await save(),json({locked:true,unlockUntil:0}));
  await save();return json(payload(result));''' +s[b:]
p.write_text(s,encoding='utf-8')
