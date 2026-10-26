from pathlib import Path
p=Path('public/bank/app.js');s=p.read_text(encoding='utf-8')
s=s.replace('澄明金融','个人银行').replace('澄明助手','银行助手').replace('澄明','银行助手').replace('林澄','先生').replace('你好，先生。','先生，欢迎回来。').replace('>澄<','>银<')
s=s.replace("['plans','联动计划']]","['plans','联动计划'],['benefits','权益中心'],['contacts','收款人管理'],['fx','外币与兑换']]")
s=s.replace("if(model.state.pending)showConfirm()", "if(model.state?.pending)showConfirm()")
s=s.replace("model?.state.pending", "model?.state?.pending")
s=s.replace("function render(){const s=model.state;", "function render(){if(model.locked){assistantOpen=false;$('#confirm').close();$('#app').innerHTML=lockScreen();return;}const s=model.state;")
s=s.replace('plans,security}[view]', 'plans,security,benefits,contacts:contactPage,fx}[view]')
s=s.replace('<div class="top-actions">','<div class="top-actions"><button class="text-btn" data-action="search">搜索功能</button><button class="text-btn" data-action="lock">锁定</button>')
s=s.replace("case'selectCard':", "case'lock':act({action:'lock'});break;case'search':openSearch();break;case'benefit':act({action:'benefit',id:d.id,operation:d.op},'模拟权益已更新');break;case'pauseEvent':act({action:'eventUpdate',id:d.id,operation:'pause'},'提醒已暂停，预算保留');break;case'selectCard':")
s=s.replace("case'privacy':hideBalance=!hideBalance;render();document.querySelector('[data-action=privacy]').focus();break;", "case'privacy':act({action:'lock'});break;")
s=s.replace("if(kind==='risk')act({action:'risk',answers:[Number(d.loss),Number(d.experience),Number(d.term)]}", "if(kind==='risk')act({action:'risk',answers:Array.from({length:10},(_,i)=>Number(d['q'+i]))}")
s=s.replace("const ops={transfer:", "if(kind==='unlock')act({action:'unlock',pin:d.pin});if(kind==='contact')act({action:'saveContact',name:d.name,bank:d.bank,account:d.account},'模拟收款人已保存');if(kind==='eventEdit')act({action:'eventUpdate',operation:'edit',id:f.dataset.id,name:d.name,amount:Number(d.amount),at:new Date(d.at).toISOString(),note:d.note},'计划已更新');if(kind==='fx'){const quotes={USD:7.20,EUR:7.85,JPY:0.048};$('#fx-result').textContent='按固定演示汇率折合 '+(Number(d.amount)/quotes[d.currency]).toFixed(2)+' '+d.currency+'，无手续费演示。此结果不是成交报价，不执行兑换。';}const ops={event:()=>({type:'event',name:d.name,category:d.category,amount:Number(d.amount),at:new Date(d.at).toISOString(),note:d.note}),bankTransfer:()=>({type:'transfer',contact:d.contact,amount:Number(d.amount)}),transfer:")
s=s.replace("try{model=await api();render();}","try{model=await api({action:'lock'});render();}")
s=s.replace("累计当日转账超过 ¥1,000 或预约转账需加强确认。", "每笔转账均须输入演示口令确认。")
s=s.replace("<legend>转给谁</legend>","<legend>转给谁</legend><p>选择已保存收款人，或先添加银行卡。${btn('添加银行卡收款人','nav','','data-view=contacts')}</p>")
s=s.replace("${icon(t.amount>0?'transfer':'cards')}","${categoryIcon(t.category,t.amount)}")
a=s.index('<form data-form="risk">');b=s.index('</form>',a)+len('</form>')
s=s[:a]+'''<form data-form="risk" class="risk-questionnaire"><p>共 10 项。请按实际情况选择；此为演示规则，不替代银行正式适当性评估。</p>${riskQuestions.map((q,i)=>field((i+1)+'. '+q[0],`<select name="q${i}" required><option value="">请选择</option>${q[1].map((v,j)=>`<option value="${j+1}">${v}</option>`).join('')}</select>`)).join('')}<button class="btn primary">提交模拟评估</button>${s.riskAssessment?`<p>上次得分 ${s.riskAssessment.score}/50 · ${esc(s.riskAssessment.explanation)} 有效期一年。</p>`:''}</form>'''+s[b:]
# Upgrade the old birthday composer while preserving the timeline and clock.
a=s.index('<form data-form="birthday">');b=s.index('</form>',a)+len('</form>')
s=s[:a]+'''<form data-form="event" class="event-form">${eventFields()}<p class="small muted">预算只预留，不自动购买门票或商品。到期后展示提醒，需你自行核实并付款。请勿输入真实身份或支付信息。</p><button class="btn primary">核对活动计划 ${icon('arrow')}</button></form>'''+s[b:]
s=s.replace('创建生日联动计划','创建活动计划').replace('选择对象、预算与时间','选择场景、预算与时间').replace('包括生日联动与预约转账','活动安排与预约转账').replace('创建生日计划后','创建活动计划后')
s=s.replace("p.status==='scheduled'", "['scheduled','ready','paused'].includes(p.status)")
s=s.replace("scheduled:'待执行'", "ready:'待你办理',paused:'已暂停',scheduled:'待执行'")
# Add editable event settings after the timeline steps.
s=s.replace("${p.orders?", "${eventEditor(p)}${p.orders?") if '${p.orders?' in s else s
# Exact timeline insertion before cancellation action
s=s.replace("${['scheduled','ready','paused'].includes(p.status)?btn", "${eventEditor(p)}${['scheduled','ready','paused'].includes(p.status)?btn")
p.write_text(s,encoding='utf-8')
