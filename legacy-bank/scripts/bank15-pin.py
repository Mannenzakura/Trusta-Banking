from pathlib import Path
p=Path('worker/bank-auth.mjs');s=p.read_text(encoding='utf-8').replace('credential(password){','credential(password,format=\'password\'){').replace("return {salt,hash:await derive(password,salt),", "return {format,salt,hash:await derive(password,salt),")
s+="\nexport function validatePaymentPassword(value){if(typeof value!=='string'||!/^\\d{6}$/.test(value))throw new BankError('转账密码必须是 6 位数字。');}\n";p.write_text(s,encoding='utf-8')
for file in ['worker/bank-api.mjs','worker/bank-accounts.mjs']:
 p=Path(file);s=p.read_text(encoding='utf-8').replace('verify,validatePassword}', 'verify,validatePassword,validatePaymentPassword}')
 s=s.replace('validatePassword(body.paymentPassword);','validatePaymentPassword(body.paymentPassword);')
 s=s.replace('payment:await credential(body.paymentPassword)',"payment:await credential(body.paymentPassword,'pin6')")
 if file.endswith('bank-api.mjs'):
  s=s.replace('validatePassword(body.newPassword);',"if(body.kind==='payment')validatePaymentPassword(body.newPassword);else validatePassword(body.newPassword);")
  s=s.replace('await credential(body.newPassword);',"await credential(body.newPassword,body.kind==='payment'?'pin6':'password');")
  s=s.replace('accountMode:!!account.row,state:safe,',"accountMode:!!account.row,paymentPasswordLegacy:state.credentials.payment.format!=='pin6',state:safe,")
 else:
  s=s.replace('const passwords=body=>{','const passwords=(body,migrate=false)=>{').replace('validatePaymentPassword(body.paymentPassword);',"if(!migrate)validatePaymentPassword(body.paymentPassword);else if(typeof body.paymentPassword!=='string'||body.paymentPassword.length>128)throw new BankError('旧转账密码格式无效。');")
  s=s.replace('409);passwords(body);','409);passwords(body,body.migrate===true);')
  # During legacy migration preserve the existing verified payment credential and its format.
  s=s.replace("const recoveryKey=random();state.credentials={login:await credential(body.loginPassword),payment:await credential(body.paymentPassword,'pin6')};", "const recoveryKey=random();const payment=source?state.credentials.payment:await credential(body.paymentPassword,'pin6');state.credentials={login:await credential(body.loginPassword),payment};")
 p.write_text(s,encoding='utf-8')
p=Path('public/bank/app.js');s=p.read_text(encoding='utf-8')
pos=s.index('function authPasswords()')
s=s[:pos]+"function paymentField(label,name,legacy=false){return field(label,`<input name=\"${name}\" type=\"password\" ${legacy?'minlength=\"1\" maxlength=\"128\"':'inputmode=\"numeric\" pattern=\"[0-9]{6}\" minlength=\"6\" maxlength=\"6\"'} autocomplete=\"off\" required>`,legacy?'请输入当前旧转账密码，可在个人中心改为 6 位数字。':'请输入 6 位数字，开头的 0 会保留。');}\n"+s[pos:]
s=s.replace('function authPasswords(){','function authPasswords(legacy=false){').replace("passwordField('转账密码','paymentPassword')+passwordField('再次输入转账密码','paymentConfirm')", "paymentField('转账密码','paymentPassword',legacy)+paymentField('再次输入转账密码','paymentConfirm',legacy)",1)
s=s.replace('${accountNameField()}${authPasswords()}<button class="btn primary">迁移', '${accountNameField()}${authPasswords(true)}<button class="btn primary">迁移')
s=s.replace("passwordField('转账密码','paymentPassword')+passwordField('再次输入转账密码','paymentConfirm')", "paymentField('转账密码','paymentPassword')+paymentField('再次输入转账密码','paymentConfirm')")
s=s.replace('两套密码须不同，各为 12–128 位，包含字母和数字。','登录密码仍为 12–128 位，包含字母和数字；转账密码为 6 位数字。').replace('每套密码须为 12–128 位，包含字母和数字，且两套密码不能相同。','登录密码为 12–128 位字母数字组合，转账密码为 6 位数字。')
s=s.replace("${passwordField('当前'+label+'密码','currentPassword','current-password')}${passwordField('新'+label+'密码','newPassword')}${passwordField('再次输入新密码','confirmPassword')}", "${kind==='payment'?paymentField('当前转账密码','currentPassword',model.paymentPasswordLegacy):passwordField('当前登录密码','currentPassword','current-password')}${kind==='payment'?paymentField('新转账密码','newPassword'):passwordField('新登录密码','newPassword')}${kind==='payment'?paymentField('再次输入新密码','confirmPassword'):passwordField('再次输入新密码','confirmPassword')}")
s=s.replace('12–128 位，含字母和数字，与旧密码及另一套密码不同。</p>',"${kind==='payment'?'新转账密码为 6 位数字，须验证当前旧密码后修改。':'12–128 位，含字母和数字，与旧密码不同。'}</p>")
s=s.replace("passwordField('转账密码','pin','current-password')", "paymentField('转账密码','pin',model.paymentPasswordLegacy)")
s=s.replace('<h2>密码与安全</h2>',"<h2>密码与安全</h2>${model.paymentPasswordLegacy?'<p class=\"notice\">你仍在使用旧版转账密码。展开下方“修改转账密码”，验证旧密码后设置 6 位数字。</p>':''}")
p.write_text(s,encoding='utf-8')
p=Path('public/bank/index.html');s=p.read_text(encoding='utf-8').replace('20261011-account14','20261011-pin15');p.write_text(s,encoding='utf-8')
