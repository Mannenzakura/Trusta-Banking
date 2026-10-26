import {BankError} from './bank-engine.mjs';
export function saveLifestyle64(s,input){
 if(!input||typeof input!=='object')throw new BankError('设置无效');
 const text=(k,n)=>{const v=input[k]??'';if(typeof v!=='string'||v.length>n)throw new BankError('个人信息过长或格式无效');return v.trim();};
 const birthday=text('birthday',5);if(birthday&&!validDate(birthday))throw new BankError('生日请输入有效的月-日，如10-13');
 const budget=Number(input.budget);if(!Number.isFinite(budget)||budget<0||budget>100000)throw new BankError('预算须为0至100000元');
 const dates=text('dates',1000).split('\n').filter(Boolean).map(line=>{const [name,date,...rest]=line.split('|').map(x=>x.trim());if(!name||name.length>30||!validDate(date)||rest.length)throw new BankError('纪念日格式：称呼|月-日，每行一项');return {name,date};});if(dates.length>20)throw new BankError('最多20个重要日期');
 s.lifestyle={city:text('city',30),artists:text('artists',160),interests:text('interests',160),birthday,budget,dates,enabled:input.enabled===true,birthdays:input.birthdays===true,bills:input.bills===true,updatedAt:Date.now()};s.discoveryDismissed=[];return {};
}
function validDate(x){if(!/^\d{2}-\d{2}$/.test(x||''))return false;const d=new Date('2000-'+x+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(5,10)===x;}
export function discoveries64(s,now=Date.now()){
 const p=s.lifestyle;if(!p?.enabled)return [];const day=new Date(now+8*3600000).toISOString().slice(0,10),today=Date.parse(day+'T00:00:00Z'),year=Number(day.slice(0,4)),out=[];
 if(p.birthdays)for(const [index,d] of [...(p.birthday?[{name:'你的生日',date:p.birthday}]:[]),...(p.dates||[])].entries()){
 let y=year,at;do{at=Date.parse(y+'-'+d.date+'T00:00:00Z');y++;}while((at<today||new Date(at).toISOString().slice(5,10)!==d.date)&&y<=year+8);const days=Math.round((at-today)/86400000);if(days<=30)out.push({date:new Date(at).toISOString().slice(0,10),id:'birthday-'+index+'-'+at,title:d.name+' · '+(days===0?'今天':days+'天后'),basis:'依据你授权的重要日期 '+d.date,detail:'可先挑选礼物、安排聚餐，再逐项确认付款。'+'请在本次计划中单独设置预算',page:'stores',kind:'birthday'});
 }
 if(p.bills)for(const a of s.subscriptions||[])if(a.status==='active'&&a.next>=now&&a.next-now<=7*86400000)out.push({id:'bill-'+a.id+'-'+a.next,title:a.name+' 即将到期',basis:'依据本站代扣授权及下一期日期',detail:'预计金额 ¥'+(a.amount/100).toFixed(2)+'；请核对授权与扣款账户。',page:'subscriptions',kind:'bill'});
 return out.filter(x=>!(s.discoveryDismissed||[]).includes(x.id));
}
