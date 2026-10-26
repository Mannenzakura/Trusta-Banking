from pathlib import Path
p=Path('worker/bank-api.mjs');s=p.read_text(encoding='utf-8');a=s.index('const encode=');b=s.index('export async function bankAPI',a)
module=s[a:b].replace('async function credential','export async function credential').replace('async function verify','export async function verify').replace('function validatePassword','export function validatePassword')
Path('worker/bank-auth.mjs').write_text("import {BankError} from './bank-engine.mjs';\n"+module,encoding='utf-8')
s=s[:a]+s[b:];s="import {credential,verify,validatePassword} from './bank-auth.mjs';\nimport {accountContext} from './bank-accounts.mjs';\n"+s
s=s.replace("  const token=request.headers", "  const account=await accountContext(request,env,body);if(account.response)return account.response;\n  const token=request.headers")
s=s.replace("let row=key?", "let row=account.row|| (key?").replace(".first():null;", ".first():null);")
s=s.replace("  const state=normalizeCards(JSON.parse(row.state));", "  const state=normalizeCards(JSON.parse(row.state));if(state.migratedTo)return json({locked:true,needsSetup:false,account:state.migratedTo,accountMode:true});")
s=s.replace("  const sec=state.security;", "  const sec=state.security;if(account.row)sec.until=account.session.unlock_until;")
s=s.replace("const locked=()=>({locked:true,needsSetup:!configured(),unlockUntil:0});", "const locked=()=>({locked:true,needsSetup:!configured(),unlockUntil:0,account:account.id||null,accountMode:!!account.row});")
a=s.index('  const save=async()=>');b=s.index('\n  const payload=',a)
s=s[:a]+'''  const save=async()=>{const r=await env.DB.prepare(account.row?'UPDATE bank_accounts SET state=?,revision=revision+1 WHERE id=? AND revision=?':'UPDATE bank_demo_sessions SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),account.id||key,row.revision).run();if(r.meta.changes!==1)throw new BankError('账户刚被另一窗口更新，请重新操作。',409);if(account.row)await env.DB.prepare('UPDATE bank_account_sessions SET unlock_until=?,credential_version=? WHERE id=?').bind(sec.until||0,state.credentialVersion||1,account.session.id).run();};''' +s[b:]
s=s.replace('delete safe.credentials;return {state:safe,','delete safe.credentials;delete safe.recoveryHash;return {account:account.id||null,accountMode:!!account.row,state:safe,')
s=s.replace("state.credentials[body.kind]=await credential(body.newPassword);", "state.credentials[body.kind]=await credential(body.newPassword);state.credentialVersion=(state.credentialVersion||1)+1;")
s=s.replace("const credentials=state.credentials,profile=state.profile;", "const credentials=state.credentials,profile=state.profile,recoveryHash=state.recoveryHash,credentialVersion=state.credentialVersion;")
s=s.replace('state.credentials=credentials;state.profile=profile;', 'state.credentials=credentials;state.profile=profile;state.recoveryHash=recoveryHash;state.credentialVersion=credentialVersion;')
p.write_text(s,encoding='utf-8')
p=Path('scripts/prepare-security.mjs');s=p.read_text(encoding='utf-8').replace("['bank-engine.mjs','bank-api.mjs']","['bank-engine.mjs','bank-api.mjs','bank-auth.mjs','bank-accounts.mjs']");p.write_text(s,encoding='utf-8')
