const securityHeaders = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'SAMEORIGIN',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
function reject(message,status,extra={}){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store',...extra}})}
export function secureResponse(response){
  const result=new Response(response.body,response);
  for(const [key,value] of Object.entries(securityHeaders))result.headers.set(key,value);
  // Preserve the stronger sandbox policy used by uploaded files.
  if(!result.headers.has('Content-Security-Policy'))result.headers.set('Content-Security-Policy',"base-uri 'self'; object-src 'none'; frame-ancestors 'self'");
  return result;
}
export async function protect(request,env,next){
  let path;try{path=decodeURIComponent(new URL(request.url).pathname).replace(/\/+$/,'')||'/';}catch{return secureResponse(reject('请求路径无效',400));}
  const respond=r=>{const out=secureResponse(r);if(path==='/bank'||path.startsWith('/bank/')||path==='/api/bank'){out.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");out.headers.set('X-Frame-Options','DENY');}return out;};
  if(path==='/api/lookup'||path==='/api/submit')return respond(reject('本轮回信查询和问卷提交已结束。',410));
  if(!path.startsWith('/api/'))return respond(await next(request));
  const mutating=!['GET','HEAD','OPTIONS'].includes(request.method);
  if(mutating){
    const origin=request.headers.get('origin');
    if(origin!==new URL(request.url).origin&&!(path==='/api/companion'&&origin==='null'))return respond(reject('请求来源无效',403));
  }
  // Edge burst limits run before database access and password hashing.
  const auth=path==='/api/auth'||path==='/api/members/auth';
  const limiter=auth?env.AUTH_BURST:env.API_BURST;
  if(!limiter)return respond(reject('防护服务暂不可用，请稍后重试',503));
  const key=request.headers.get('cf-connecting-ip')||'local';
  try{if(!(await limiter.limit({key})).success)return respond(reject('请求过于频繁，请稍后重试',429,{'Retry-After':'60'}));}
  catch{return respond(reject('防护服务暂不可用，请稍后重试',503,{'Retry-After':'60'}));}
  if(mutating&&request.body){
    const maximum=path==='/api/members/files'?512000:auth?8192:path==='/api/companion'?20000:path.startsWith('/api/admin')?2097152:65536;
    if(Number(request.headers.get('content-length'))>maximum)return respond(reject('请求内容过大',413));
    const reader=request.body.getReader(),parts=[];let size=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();return respond(reject('请求内容过大',413));}parts.push(value);}
    }catch{return respond(reject('请求内容不完整',400));}
    const body=new Uint8Array(size);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.byteLength;}
    request=new Request(request,{body});
  }
  return respond(await next(request));
}
