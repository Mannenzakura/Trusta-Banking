// Presentation only: never use this function to transform API request fields or stored data.
export function businessCopy(value){return String(value??'')
 .replaceAll('固定演示价','测试成交价').replaceAll('演示买入价','测试成交价')
 .replaceAll('模拟时钟','测试时钟').replaceAll('演示时钟','测试时钟').replaceAll('模拟时间','测试时间')
 .replaceAll('模拟规则','测试规则').replaceAll('演示规则','测试规则').replaceAll('演示数据','测试数据')
 .replaceAll('模拟环境','测试环境').replaceAll('演示环境','测试环境')
 .replaceAll('模拟克数','持有克数').replaceAll('模拟卡','银行卡')
 .replaceAll('流程模拟','流程体验').replaceAll('用于演示','用于测试').replaceAll('比赛演示','场景体验')
 .replaceAll('均为模拟','均为测试').replaceAll('仅模拟','仅测试')
 .replaceAll('模拟','').replaceAll('演示','测试');}

// Includes asynchronous market data, assistant replies, old ledger details and dialogs.
// Only text nodes are changed: form values, IDs, dataset attributes and event handlers stay intact.
export function installBusinessCopy(root){
 const clean=node=>{
  if(node.nodeType===3){if(!node.parentElement?.closest('script,style,textarea,input,code,[contenteditable]')){const next=businessCopy(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}return;}
  if(node.nodeType!==1)return;
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);const list=[];while(walker.nextNode())list.push(walker.currentNode);list.forEach(clean);
 };
 clean(root);
 const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')clean(record.target);else record.addedNodes.forEach(clean);}});
 observer.observe(root,{subtree:true,childList:true,characterData:true});return observer;
}
