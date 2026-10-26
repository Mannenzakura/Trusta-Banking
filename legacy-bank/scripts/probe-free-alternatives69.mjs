import {readFileSync} from 'node:fs';
import {initialState} from '../worker/bank-engine.mjs';
import {messages62,parse62} from '../worker/bank-cloud-ai62.mjs';
import {applyAIPlan} from '../worker/bank-ai.mjs';
const key=readFileSync('<LOCAL_USER>/.bank-local-secrets/glm-general-api-key.txt','utf8').trim();
// These two exact IDs have free input/output pricing verified before this probe.
for(const model of ['glm-4-flash-250414','glm-4.6v-flash']){
 for(const kind of ['native-tool','platform-payment']){
  const s=initialState();s.testMode=true;const before=s.balance,start=Date.now();
  const body=kind==='native-tool'?{messages:[{role:'user',content:'请调用accounts工具查询余额'}],tools:[{type:'function',function:{name:'accounts',description:'查询当前虚拟账户余额',parameters:{type:'object',properties:{},additionalProperties:false}}}],tool_choice:'auto'}:{messages:messages62(s,'用日常生活卡交水费，使用默认户号，先给我确认，不要扣款'),response_format:{type:'json_object'}};
  try{
   const r=await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:1024,...(model==='glm-4.6v-flash'?{thinking:{type:'disabled'}}:{}),...body})});
   const j=await r.json();if(!r.ok){console.log(JSON.stringify({model,kind,status:r.status,code:j.error?.code,ms:Date.now()-start}));break;}
   let ok;
   if(kind==='native-tool')ok=j.choices?.[0]?.message?.tool_calls?.[0]?.function?.name==='accounts';
   else{const p=parse62(j);applyAIPlan(s,p);ok=p.tool==='lifeBill'&&s.ai.draft?.operation.type==='lifeBill'&&s.balance===before&&s.pending===null;}
   console.log(JSON.stringify({model,kind,ok,ms:Date.now()-start}));
  }catch(e){console.log(JSON.stringify({model,kind,ok:false,error:e.name==='TimeoutError'?'timeout':'response failed validation',ms:Date.now()-start}));break;}
  await new Promise(r=>setTimeout(r,3000));
 }
}
