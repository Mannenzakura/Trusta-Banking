from pathlib import Path
p=Path('worker/bank-engine.mjs');s=p.read_text(encoding='utf-8')
pos=s.index(" else if(type==='cancelPlan')")
s=s[:pos]+''' else if(type==='planPayment'){const plan=s.plans.find(x=>x.id===input.plan&&x.type==='event'&&['scheduled','ready','paused'].includes(x.status));if(!plan)fail('计划不可付款');const n=cents(input.amount);if(n>plan.amount)fail('金额超过计划剩余预算，请先编辑预算。');const merchant=String(input.merchant||'').trim();if(!merchant||merchant.length>60)fail('请填写模拟商户名称。');const card=cardFor(s,plan.cardId);if(card.status!=='active'||n>card.limit||n>s.balance)fail('卡片状态、限额或余额不允许付款。');data={plan:plan.id,amount:n,merchant};strong=true;title='确认计划模拟付款';lines=[plan.title,merchant,`金额 ¥${fmt(n)}，从预留预算结算`,'需要独立转账密码确认，不调用真实商户'];}
''' +s[pos:]
s=s.replace("cardId:s.card.id,expires:s.now", "cardId:type==='planPayment'?s.plans.find(x=>x.id===data.plan).cardId:s.card.id,expires:s.now")
pos=s.index(" if(p.type==='cancelPlan')")
s=s[:pos]+''' if(p.type==='planPayment'){const plan=s.plans.find(x=>x.id===d.plan&&['scheduled','ready','paused'].includes(x.status));if(!plan||plan.amount<d.amount)fail('计划预算已变更，请重新确认。');requireCard(s,d.amount);if(s.balance<d.amount)fail('余额不足');s.reserved-=d.amount;plan.amount-=d.amount;ledger(s,-d.amount,'生活',d.merchant,'联动计划模拟付款');plan.steps.push('已确认模拟付款 ¥'+fmt(d.amount)+'，剩余预算 ¥'+fmt(plan.amount));}
''' +s[pos:]
p.write_text(s,encoding='utf-8')
