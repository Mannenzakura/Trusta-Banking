export function cny49(o,amount=o.amount,currency=o.currency){
 const rate=currency==='CNY'?1:o.fx?.rates?.[currency];
 if(amount==null||!Number.isFinite(Number(amount))||!Number.isFinite(rate)||rate<=0)return '人民币参考价暂不可用';
 return `${currency==='CNY'?'':'约 '}¥${(Number(amount)*rate).toFixed(2)}`;
}
export function fxNote49(o){return o.currency==='CNY'?'人民币报价':o.fx?`人民币为参考换算，汇率时间 ${new Date(o.fx.at).toISOString().slice(0,16).replace('T',' ')} UTC；来源 ${o.fx.source}。下单与退款使用供应商原币沙箱余额。`:'汇率暂不可用，原币报价见费用明细。';}
