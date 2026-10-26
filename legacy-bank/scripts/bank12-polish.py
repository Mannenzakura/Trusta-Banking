from pathlib import Path
p=Path('public/bank/app.js');s=p.read_text(encoding='utf-8').replace('${c.name}</label>','${esc(c.name)}</label>').replace('${c.name} · ${c.phone} · ${c.note}</option>','${esc(c.name)} · ${esc(c.phone)} · ${esc(c.note)}</option>').replace('个人银行<small>个人银行</small>','个人银行<small>生活与财富</small>').replace('输入演示校验码\',\'<input name="pin" inputmode','输入演示校验码\',\'<input name="pin" type="password" inputmode')
# Product eligibility matches server-side assessment validity, including migrated accounts.
s=s.replace("function invest(){const s=model.state;", "function invest(){const s=model.state,validRisk=!!s.riskAssessment&&s.now-s.riskAt<=365*86400000;")
a=s.index('function invest()');b=s.index('const cardThemes',a);part=s[a:b].replace('s.risk>=p.risk','validRisk&&s.risk>=p.risk').replace("${s.risk?'R'+s.risk:'待评估'}","${validRisk?'R'+s.risk:'需更新评估'}")
s=s[:a]+part+s[b:]
p.write_text(s,encoding='utf-8')
