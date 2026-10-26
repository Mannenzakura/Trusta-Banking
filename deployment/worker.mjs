const offline = () => new Response(JSON.stringify({error:'LOCAL_SERVER_OFFLINE',message:'本地服务暂未连接，请确认电脑及 TRUSTA 服务正在运行。'}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Retry-After':'30'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/bank') return Response.redirect(url.origin+'/bank/'+url.search,308);
  if(!url.pathname.startsWith('/bank/')) return new Response('Not found',{status:404});
  const path=url.pathname.slice(5);
  if(path.startsWith('/api/') || path==='/health' || path.startsWith('/legacy')) {
   let origin;
   try {
    origin=new URL(env.TRUSTA_ORIGIN);
    if(origin.protocol!=='https:' || origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash) return offline();
   } catch {return offline();}
   const upstream=new URL(url.pathname+url.search,origin);
   const headers=new Headers(request.headers);
   headers.delete('host'); headers.delete('cookie');
   try {
    const response=await fetch(new Request(upstream, {method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(60000)}));
    if([502,503,504,530].includes(response.status)) return offline();
    const out=new Headers(response.headers);out.set('Cache-Control','no-store');out.delete('set-cookie');
    return new Response(response.body,{status:response.status,headers:out});
   } catch {return offline();}
  }
  const staticURL=new URL(request.url);
  const routes=new Set(['/funds','/credit-account','/todos','/gold','/','/overview','/bills','/wealth','/credit','/plans','/life','/features','/settings','/deposits','/gold-savings','/exchange','/membership','/support']);
  staticURL.pathname=routes.has(path.replace(/\/$/,'')||'/')?'/index.html':path==='/about/'||path==='/about'?'/intro.html':path;
  const asset = await env.ASSETS.fetch(new Request(staticURL,request));
  const safeHeaders = new Headers(asset.headers);
  safeHeaders.set('X-Content-Type-Options','nosniff');
  safeHeaders.set('X-Frame-Options','DENY');
  safeHeaders.set('Referrer-Policy','no-referrer');
  safeHeaders.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  safeHeaders.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
  if ((safeHeaders.get('Content-Type') || '').includes('text/html')) safeHeaders.set('Cache-Control','no-store');
  return new Response(asset.body,{status:asset.status,headers:safeHeaders});
 }
};
