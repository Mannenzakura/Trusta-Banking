from pathlib import Path
p=Path('worker/bank-api.mjs');s=p.read_text(encoding='utf-8')
s=s.replace('delete safe.recoveryHash;','delete safe.recoveryHash;delete safe.demoBackup;')
pos=s.index("  if(body.action==='profile')")
s=s[:pos]+'''  if(body.action==='demoSeed'&&!state.demoMode){const backup=structuredClone(state);for(const field of ['credentials','security','recoveryHash','credentialVersion','demoBackup'])delete backup[field];const retained={credentials:state.credentials,security:sec,recoveryHash:state.recoveryHash,credentialVersion:state.credentialVersion,profile:state.profile};for(const field of Object.keys(state))delete state[field];Object.assign(state,initialState(),retained,{demoMode:true,demoBackup:backup});}
  if(body.action==='exitDemo'){if(!state.demoMode||!state.demoBackup)throw new BankError('当前不在演示账本');const restored=state.demoBackup,retained={credentials:state.credentials,security:sec,recoveryHash:state.recoveryHash,credentialVersion:state.credentialVersion,profile:state.profile};for(const field of Object.keys(state))delete state[field];Object.assign(state,restored,retained);state.pending=null;await save();return json(payload());}
''' +s[pos:]
s=s.replace("credentialVersion=state.credentialVersion;", "credentialVersion=state.credentialVersion,demoBackup=state.demoBackup,demoMode=state.demoMode;")
s=s.replace("state.credentialVersion=credentialVersion;state.security", "state.credentialVersion=credentialVersion;state.demoBackup=demoBackup;state.demoMode=demoMode;state.security")
p.write_text(s,encoding='utf-8')
p=Path('worker/bank-engine.mjs');s=p.read_text(encoding='utf-8').replace("['birthday','travel','bills','invest','cards','subscriptions'].includes(body.scenario)","['birthday','transfer','travel','bills','invest','cards','subscriptions'].includes(body.scenario)");p.write_text(s,encoding='utf-8')
p=Path('public/bank/app.js');s=p.read_text(encoding='utf-8').replace("['travel','智能转账'","['transfer','智能转账'")
s=s.replace("case'demoSeed':", "case'exitDemo':act({action:'exitDemo'},'已回到个人账本').then(()=>navigateBank('overview'));break;case'demoSeed':")
s=s.replace('演示指引已载入','已进入独立演示账本')
s=s.replace('“载入演示”不会清空现有账户或扣款；联动场景添加零预算示例。所有交易仍需本人确认。','首次载入会切换到独立演示账本，自动生成六场景基础测试数据，个人账本保留。结束演示即可恢复；所有交易仍需本人确认。')
s=s.replace('<main class="main" id="content" tabindex="-1">','<main class="main" id="content" tabindex="-1">${s.demoMode?`<div class="demo-session-banner"><strong>独立演示账本</strong><span>操作不会改变你的个人账本</span>${btn(\'结束演示，返回个人账本\',\'exitDemo\')}</div>`:\'\'}')
p.write_text(s,encoding='utf-8')
