from pathlib import Path
p=Path('worker/bank-engine.mjs');s=p.read_text(encoding='utf-8')
s=s.replace('s.contacts||=structuredClone(contacts);','s.readNotifications||=[];s.contacts||=structuredClone(contacts);')
s=s.replace("cardId,status:'已入账'", "cardId,fee:0,currency:'CNY',channel:'模拟账本',recipient:s.pending?.type==='transfer'?structuredClone(s.pending.data.recipient||contact(s.pending.data.contact,s)):null,status:'已入账'")
s=s.replace("const receipt={id:p.id,title:p.title,at:s.now};", "const receipt={id:p.id,title:p.title,at:s.now,lines:p.lines,cardId:p.cardId,amount:d.amount??null,fee:0,status:'已完成',planId:s.plans.find(x=>x.confirmationId===p.id)?.id||null};")
s=s.replace("s.plans.unshift({id:id(),cardId:s.card.id", "s.plans.unshift({id:id(),confirmationId:p.id,cardId:s.card.id")
s=s.replace("name,category:input.category,amount:n,at:future(s,input.at),note:String(input.note||'').slice(0,240)", "name,category:input.category,amount:n,at:future(s,input.at),note:String(input.note||'').slice(0,240),tasks:validateTasks(input.tasks)")
pos=s.index('function validateRecipient')
s=s[:pos]+"function validateTasks(tasks){if(tasks===undefined)return [];if(!Array.isArray(tasks)||tasks.length>12)fail('最多设置 12 个步骤。');return tasks.map(t=>{const label=String(t||'').trim();if(!label||label.length>80)fail('步骤须为 1–80 字。');return {id:id(),label,done:false};});}\n"+s[pos:]
pos=s.index(" if(body.action==='saveContact')")
s=s[:pos]+''' if(body.action==='taskToggle'){const p=s.plans.find(x=>x.id===body.plan&&x.type==='event'&&['scheduled','ready','paused'].includes(x.status));const t=p?.tasks?.find(x=>x.id===body.task);if(!t)fail('步骤不存在或计划已结束');t.done=!t.done;t.completedAt=t.done?s.now:null;audit(s,'步骤',p.title+'：'+t.label+(t.done?' 已完成':' 已重新打开'));return {};}
 if(body.action==='completeEvent'){const p=s.plans.find(x=>x.id===body.id&&x.type==='event'&&['scheduled','ready','paused'].includes(x.status));if(!p)fail('计划不可完成');if(p.tasks?.some(t=>!t.done))fail('请先完成全部步骤');s.reserved-=p.amount;p.status='completed';p.steps.push('用户确认活动完成，预留资金已释放；不产生自动付款');audit(s,'完成',p.title);return {};}
 if(body.action==='readNotification'){if(body.id==='all')s.readNotifications=notifications(s).map(n=>n.id);else if(notifications(s).some(n=>n.id===body.id))s.readNotifications=[...new Set([...s.readNotifications,body.id])].slice(-300);return {};}
 if(body.action==='demoSeed'){if(!['birthday','travel','bills','invest','cards','subscriptions'].includes(body.scenario))fail('演示场景无效');if(s.demoScenario===body.scenario)return {};if(body.scenario==='birthday'||body.scenario==='travel'){const travel=body.scenario==='travel';s.plans.unshift({id:id(),cardId:s.card.id,type:'event',name:travel?'周末旅行演示':'纪念日演示',title:travel?'周末旅行演示':'纪念日演示',category:travel?'旅行':'纪念日',amount:0,at:s.now+86400000,status:'scheduled',steps:['演示活动已建立；预算为零，不改变资金'],tasks:validateTasks(travel?['核对出发日期','购票提醒','住宿确认','旅行费用分摊']:['确认日期与对象','准备礼物','核对预算','完成活动'])});}s.demoScenario=body.scenario;audit(s,'演示','已载入 '+body.scenario+' 场景指引；未改变资金');return {};}
''' +s[pos:]
s += '''
export function notifications(s){
 const items=[];
 for(const p of s.plans){const active=['scheduled','ready','paused'].includes(p.status);if(active&&p.status!=='paused'&&p.at<=s.now+3*86400000)items.push({id:'plan-'+p.id+'-'+p.status,title:p.title,text:p.at<=s.now?'已到办理时间，请打开计划处理。':'未来三天内的安排，请提前准备。',at:p.at,view:'plans',kind:'待办'});if(['completed','failed','cancelled'].includes(p.status))items.push({id:'result-'+p.id+'-'+p.status,title:p.title,text:p.steps.at(-1)||p.status,at:p.at,view:'plans',kind:'计划结果'});}
 for(const sub of s.subscriptions)if(sub.status==='active'&&sub.remind&&sub.next<=s.now+3*86400000)items.push({id:'sub-'+sub.id+'-'+sub.next,title:sub.name+'即将续费',text:'预计扣款 ¥'+fmt(sub.amount)+'，可前往订阅页取消授权。',at:sub.next,view:'subscriptions',kind:'续费提醒'});
 for(const b of s.benefits)if(b.status==='available'&&b.expires<=s.now+7*86400000)items.push({id:'benefit-'+b.id+'-'+b.expires,title:'权益即将或已经到期',text:'请到权益中心查看使用条件和有效期。',at:b.expires,view:'benefits',kind:'权益提醒'});
 for(const r of s.receipts.slice(0,30))items.push({id:'receipt-'+r.id,title:r.title,text:'操作回执已生成，可查看结果与明细。',at:r.at,view:'receipts',kind:'交易结果'});
 return items.sort((a,b)=>b.at-a.at).map(n=>({...n,read:(s.readNotifications||[]).includes(n.id)}));
}
'''
p.write_text(s,encoding='utf-8')
p=Path('worker/bank-api.mjs');s=p.read_text(encoding='utf-8').replace('operate,report,contacts','operate,report,notifications,contacts').replace('report:report(state),unlockUntil','report:report(state),notifications:notifications(state),unlockUntil').replace("state.security={until:0};await save();return json(locked());", "state.security={until:0};sec.until=0;await save();return json(locked());")
p.write_text(s,encoding='utf-8')
