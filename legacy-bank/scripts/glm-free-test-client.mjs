// Single-process queue for isolated integration tests, not a distributed Worker queue.
export function createFreeTestClient({key,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),interval=3000,retryDelay=15000,maxPending=8}={}){
 let tail=Promise.resolve(),pending=0;
 return async function request(messages){
  if(pending>=maxPending)throw Error('测试队列已满，请稍后重试');
  pending++;
  const task=tail.then(async()=>{
   for(let attempt=0;attempt<3;attempt++){
    const response=await fetcher('https://open.bigmodel.cn/api/paas/v4/chat/completions',{
     method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
     body:JSON.stringify({model:'glm-4.7-flash',messages,thinking:{type:'disabled'},max_tokens:1024,response_format:{type:'json_object'}}),
    });
    const data=await response.json();
    if(response.ok)return data;
    const code=String(data?.error?.code||'unknown');
    if(response.status===429&&['1302','1305'].includes(code)&&attempt<2){
     const after=Number(response.headers.get('retry-after'));
     await sleep(Math.min(30000,Math.max(retryDelay*(attempt+1),Number.isFinite(after)?after*1000:0)));continue;
    }
    throw Error(`GLM HTTP ${response.status}, code ${code}: ${code==='1305'?'供应商模型过载':code==='1302'?'账户请求限流':'接口拒绝请求'}；未切换模型`);
   }
  });
  tail=task.catch(()=>{}).then(()=>sleep(interval));
  try{return await task;}finally{pending--;}
 };
}
