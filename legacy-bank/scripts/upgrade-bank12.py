from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'worker/bank-engine.mjs'
s=p.read_text(encoding='utf-8')
s=s.replace("s.version=2;return s;", "s.contacts||=structuredClone(contacts);s.benefits||=[];s.version=3;return s;")
s=s.replace("function contact(v){const c=contacts.find", "function contact(v,s){const c=(s?.contacts||contacts).find")
s=s.replace("contact(input.contact)","contact(input.contact,s)").replace("contact(d.contact)","contact(d.contact,s)").replace("contact(p.contact)","contact(p.contact,s)").replace("people.forEach(contact)","people.forEach(v=>contact(v,s))")
s=s.replace("请选择已核实的收款人。","请选择已保存的收款人。")
s=s.replace("strong=n+amountToday(s)>100000||!!data.at", "strong=true")
s=s.replace("if(p.strong&&pin", "if((p.strong||p.type==='transfer')&&pin")
s=s.replace("else if(type==='cancelPlan')", """else if(type==='event') {const name=String(input.name||'').trim();if(!name||name.length>40)fail('活动名称须为 1–40 字。');if(!['生日','纪念日','节日','演唱会','旅行','自定义'].includes(input.category))fail('请选择活动类型。');const n=input.amount===0?0:cents(input.amount);requireCash(s,n);data={name,category:input.category,amount:n,at:future(s,input.at),note:String(input.note||'').slice(0,240)};strong=true;title='确认活动计划';lines=[name,`预算预留 ¥${fmt(n)}`,'到期仅提醒，不自动购票或付款；可暂停、编辑或取消'];}
 else if(type==='cancelPlan')""")
s=s.replace("  s.reserved-=p.amount;const executionCard", "  if(p.type==='event'){p.status='ready';p.steps.push('已到提醒时间，请核对活动并手动办理；预算仍预留');continue;}\n  s.reserved-=p.amount;const executionCard")
s=s.replace("if(p.type==='cancelPlan'){", "if(p.type==='event'){requireCash(s,d.amount);s.reserved+=d.amount;s.plans.unshift({id:id(),cardId:s.card.id,type:'event',...d,title:d.name,status:'scheduled',steps:['活动已保存','预算已预留','等待提醒时间']});}\n if(p.type==='cancelPlan'){")
s=s.replace("x.status==='scheduled'", "['scheduled','ready','paused'].includes(x.status)")
s=s.replace("p.status==='scheduled');if(!p)","['scheduled','ready','paused'].includes(p.status));if(!p)")
s=s.replace("if(body.action==='selectCard')", """if(body.action==='saveContact'){const name=String(body.name||'').trim(),bank=String(body.bank||'').trim(),account=String(body.account||'').replace(/\\s/g,'');if(!name||name.length>24||!bank||bank.length>40||!/^\\d{12,19}$/.test(account))fail('请填写姓名、银行和 12–19 位模拟卡号。');if(s.contacts.length>=30)fail('最多保存 30 位收款人。');if(s.contacts.some(c=>c.account===account))fail('该收款卡已保存。');s.contacts.push({id:id(),name,bank,account,phone:'尾号 '+account.slice(-4),note:'已保存 · 未实名核验'});audit(s,'收款人','已保存模拟收款人 '+name);return {};}
 if(body.action==='eventUpdate'){const p=s.plans.find(p=>p.id===body.id&&p.type==='event'&&['scheduled','paused','ready'].includes(p.status));if(!p)fail('活动不可修改。');if(body.operation==='pause'){p.status='paused';p.steps.push('已暂停提醒，预算保留');}else if(body.operation==='resume'){p.at=future(s,body.at);p.status='scheduled';p.steps.push('已恢复提醒');}else if(body.operation==='edit'){const name=String(body.name||'').trim();if(!name||name.length>40)fail('请填写活动名称');const n=body.amount===0?0:cents(body.amount);if(n>s.balance-s.reserved+p.amount)fail('可用余额不足');const at=future(s,body.at);s.reserved+=n-p.amount;Object.assign(p,{name,title:name,amount:n,at,note:String(body.note||'').slice(0,240),status:'scheduled'});p.steps.push('计划已更新');}else fail('操作无效');audit(s,'计划','已更新活动 '+p.title);return {};}
 if(body.action==='benefit'){const catalog=['coffee','travel','reading'];if(!catalog.includes(body.id))fail('权益不存在');let b=s.benefits.find(b=>b.id===body.id);if(body.operation==='claim'){if(b)fail('已领取过此权益');s.benefits.push({id:body.id,claimed:s.now,expires:s.now+30*86400000,status:'available'});}else if(body.operation==='use'){if(!b||b.status!=='available'||b.expires<=s.now)fail('权益不可使用');b.status='used';b.used=s.now;}else fail('操作无效');audit(s,'权益','模拟权益'+(body.operation==='claim'?'已领取':'已使用'));return {};}
 if(body.action==='selectCard')""")
start=s.index(" if(body.action==='risk')")
end=s.index("\n if(body.action==='chat')",start)
s=s[:start]+""" if(body.action==='risk'){const x=body.answers;if(!Array.isArray(x)||x.length!==10||x.some(v=>!Number.isInteger(v)||v<1||v>5))fail('请完成全部 10 项风险问卷。');const score=x.reduce((a,b)=>a+b,0);s.risk=Math.min(Math.max(1,Math.ceil((score-10)/8)),x[4],x[5],x[6]);s.riskAt=s.now;s.riskAssessment={answers:x,score,explanation:'综合 10 项回答评分，并以投资期限、资金流动性和最大可承受损失设定上限。仅为比赛模拟规则。'};audit(s,'评估',`完成 10 项模拟风险评估 R${s.risk}`);return {};}
"""+s[end:]
s=s.replace("if(!s.risk)fail('请先完成风险评估。');", "if(!s.risk||!s.riskAssessment||s.now-s.riskAt>365*86400000)fail('请先完成有效的 10 项风险评估。');")
s=s.replace("if(!s.risk||s.risk<product.risk)","if(!s.risk||!s.riskAssessment||s.now-s.riskAt>365*86400000||s.risk<product.risk)")
s=s.replace("export class BankError", """products.push(
 {id:'deposit',name:'定期存款体验',risk:1,days:30,rate:'不计演示利息',min:5000,description:'存款流程模拟，演示到期取回本金；不代表真实存款合同或利率。'},
 {id:'bond',name:'债券组合体验',risk:2,days:30,rate:'净值浮动',min:10000,description:'模拟债券组合，存在利率和信用风险，不承诺保本。'},
 {id:'index',name:'宽基指数体验',risk:4,days:0,rate:'净值浮动',min:10000,description:'模拟权益类配置，可能产生较大本金损失；演示赎回按本金，不展示虚构收益。'},
 {id:'gold',name:'黄金资产体验',risk:4,days:0,rate:'价格浮动',min:10000,description:'黄金配置流程模拟，不提供实时金价或实际黄金份额；存在价格波动风险。'},
 {id:'global',name:'全球资产体验',risk:5,days:0,rate:'净值浮动',min:100000,description:'模拟全球多资产配置，涉及市场与汇率风险，不连接真实交易。'}
);
export class BankError""")
p.write_text(s,encoding='utf-8')
