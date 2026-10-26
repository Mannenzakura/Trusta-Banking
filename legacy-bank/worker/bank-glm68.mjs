import {BankError} from './bank-engine.mjs';
import {AI_TOOLS} from './bank-ai.mjs';
export const glmEnabled68=env=>env.BANK_GLM_FREE==='enabled'&&!!env.GLM_API_KEY;
export async function glmRequest68(env,messages,{fetcher=(...args)=>fetch(...args),sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now}={}){
 if(!glmEnabled68(env))throw new BankError('免费模型未配置。');
 const model=env.BANK_GLM_MODEL||'glm-4.7-flash';
 const trial=model==='glm-5.3-flash'&&env.BANK_GLM_TRIAL==='verified-5m';
 if(!trial&&!['glm-4.7-flash','glm-4-flash-250414'].includes(model))throw new BankError('当前只允许免费模型，已停止请求。');
 const schema={...AI_TOOLS,navigate:['page'],flightSearch:['from','to','date'],flightQuote:['from','to','date','flight','cabin']};
 const toolSpecs=Object.entries(schema).map(([name,args])=>({type:'function',function:{name,description:'银行助手工具 '+name+'，仅生成待验证计划，不能直接执行交易。',parameters:{type:'object',properties:Object.fromEntries(args.map(k=>[k,{type:['amount','income','months','days','cabin'].includes(k)?'number':'string'}])),additionalProperties:false}}}));
 const db=env.DB,id=crypto.randomUUID(),start=now();let acquired=false,cooldown=60000;
 await db.prepare('DELETE FROM bank_glm_queue WHERE expires < ?').bind(start).run();
 const added=await db.prepare('INSERT INTO bank_glm_queue(id,expires) SELECT ?,? WHERE (SELECT COUNT(*) FROM bank_glm_queue)<8 RETURNING id').bind(id,start+240000).first();
 if(!added)throw new BankError('AI 等待队列已满，请至少 5 分钟后再试；没有执行业务。',429);
 try{
  while(now()-start<30000){
   const gate=await db.prepare('UPDATE bank_glm_gate SET owner=?,until_ms=? WHERE id=1 AND until_ms<=? AND ?=(SELECT id FROM bank_glm_queue ORDER BY seq LIMIT 1) RETURNING owner').bind(id,now()+180000,now(),id).first();
   if(gate){acquired=true;break;}await sleep(1000);
  }
  if(!acquired)throw new BankError('AI 正在排队，请至少 5 分钟后再试；没有执行业务。',429);
  for(let attempt=0;attempt<1;attempt++){
   if(trial){
    if(new TextEncoder().encode(JSON.stringify(messages)).length>40000)throw new BankError('上下文超过预算保护限制。');
    const reserve=new TextEncoder().encode(JSON.stringify(messages)).length+8192;
    const reserved=await db.prepare('UPDATE bank_glm_token_budget SET reserved=reserved+? WHERE id=1 AND reserved+?<=4000000 RETURNING reserved').bind(reserve,reserve).first();
    if(!reserved)throw new BankError('本站体验 Token 保护额度已到上限，已停止调用。');
   }
   let response,data;
   try{
    response=await fetcher('https://open.bigmodel.cn/api/paas/v4/chat/completions',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${env.GLM_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[...messages,{role:'system',content:'本接口使用原生函数调用。必须选择对应的原生业务函数，将args作为函数参数，不要在正文输出JSON。只能使用函数定义中的字段。'}],...((model==='glm-4.7-flash'||trial)?{thinking:{type:'disabled'}}:{}),max_tokens:1024,temperature:0,tools:toolSpecs,tool_choice:'auto'})});
    if(response.status>=300&&response.status<400)throw new BankError('模型网关返回重定向，已拒绝跟随，密钥未转发。',503);
    const raw=await response.text();
    try{data=JSON.parse(raw);}catch{throw new BankError('模型网关返回非 JSON 响应（HTTP '+response.status+'，类型 '+(response.headers.get('content-type')||'未知').slice(0,60)+'）。',503);}
   }catch(error){cooldown=300000;if(error instanceof BankError)throw error;throw new BankError(error?.name==='TimeoutError'?'智谱模型连接超过60秒，本次没有执行业务。':'Cloudflare 到智谱连接失败（'+String(error?.message||error?.name||'NetworkError').replaceAll(env.GLM_API_KEY,'[redacted]').replace(/https?:\/\/[^\s]+/g,'[upstream]').slice(0,180)+'），本次没有执行业务。',503);}
   if(response.ok){
    if(data?.choices?.[0]?.finish_reason==='length')throw new BankError('模型输出达到长度上限，业务计划未完成；没有执行交易。');
    const calls=data?.choices?.[0]?.message?.tool_calls;
    // Some free GLM versions return the plan as text; the same strict parser and business validator still apply.
    if(!calls && typeof data?.choices?.[0]?.message?.content==='string')return data;
    if(!Array.isArray(calls)||calls.length!==1||!Object.hasOwn(schema,calls[0]?.function?.name)||typeof calls[0].function.arguments!=='string')throw new BankError('模型未返回有效的业务计划，本次没有执行业务。');
    let args;try{args=JSON.parse(calls[0].function.arguments);}catch{throw new BankError('模型工具参数格式错误，未执行业务。');}
    return {choices:[{message:{content:JSON.stringify({tool:calls[0].function.name,args})}}]};
   }
   const code=String(data?.error?.code||'');
   if(response.status===429&&['1302','1305'].includes(code)){
    cooldown=300000;

    throw new BankError(code==='1305'?'智谱免费模型当前过载，请至少 5 分钟后再试；没有执行业务。':'智谱账户请求限流，请至少 5 分钟后再试；没有执行业务。',429);
   }
   throw new BankError('模型请求被拒绝（HTTP '+response.status+'，错误码 '+(/^[0-9]{3,6}$/.test(code)?code:'未知')+'），请检查账户余额、模型权限及请求参数。',503);
  }
 }finally{
  // Shared D1 lease serializes requests across Worker instances; crashed leases expire.
  if(acquired)await db.prepare('UPDATE bank_glm_gate SET owner=NULL,until_ms=? WHERE id=1 AND owner=?').bind(now()+cooldown,id).run();
  await db.prepare('DELETE FROM bank_glm_queue WHERE id=?').bind(id).run();
 }
}
