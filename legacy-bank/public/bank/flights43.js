import {realView52,installReal52} from './real-flights52.js?v=60';
let sandbox52=false;
export function flights43(model,{esc,money,stamp,btn,field}){
 if(!sandbox52)return realView52(model,esc);
 return `<section class="panel"><button class="btn" data-returnreal52>返回真实航班查询</button><h2>历史沙箱订单</h2><p>仅用于已有测试订单的查询与退款，与真实航班数据隔离。</p>${(model.duffel?.orders||[]).map(o=>`<article><h3>${esc(o.id)}</h3><p>${esc(({booked:"测试已出票",quote:"测试报价",refunded:"测试已退款",refund_quote:"测试退款待确认",booking:"测试出票处理中",refunding:"测试退款处理中"})[o.status]||o.status)}</p>${o.data?.refund?`<p>退款金额 ${esc(o.data.refund.currency)} ${esc(o.data.refund.amount)} · 退至 ${esc(o.data.refund.to||"原测试账户")}</p>`:""}${['booked','refund_quote'].includes(o.status)?`<button class="btn" data-duffel45="${o.status==='booked'?'duffelRefundQuote':'duffelRefund'}" data-id="${esc(o.id)}">${o.status==='booked'?'查看测试退款报价':'确认测试退款'}</button>`:''}</article>`).join('')||'<p>暂无历史沙箱订单</p>'}</section>`;
}
export function installFlights43({getModel,render,act}){
 installReal52({getModel,render,act,onSandbox:()=>{sandbox52=true;render();}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-returnreal52]')){sandbox52=false;render();}const d=e.target.closest('[data-duffel45]')?.dataset;if(d)act({action:d.duffel45,id:d.id});});
}
