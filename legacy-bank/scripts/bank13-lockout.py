from pathlib import Path
p=Path('worker/bank-api.mjs');s=p.read_text(encoding='utf-8');s=s.replace("await save();throw new BankError((kind==='login'?'登录':'转账')+'密码不正确，连续 5 次错误将暂时锁定。',403);", "await save();const error=new BankError((kind==='login'?'登录':'转账')+'密码不正确，连续 5 次错误将暂时锁定。',403);error.locked=sec.until<=Date.now();throw error;")
s=s.replace("{error:e instanceof BankError?e.message:'模拟服务暂不可用，请稍后重试。'}", "{error:e instanceof BankError?e.message:'模拟服务暂不可用，请稍后重试。',...(e.locked?{locked:true,needsSetup:false,unlockUntil:0}:{})}")
p.write_text(s,encoding='utf-8')
p=Path('public/bank/app.js');s=p.read_text(encoding='utf-8').replace("if(!r.ok)throw Error(data.error||'服务暂不可用');", "if(!r.ok){if(data.locked){model=data;render();}throw Error(data.error||'服务暂不可用');}")
p.write_text(s,encoding='utf-8')
