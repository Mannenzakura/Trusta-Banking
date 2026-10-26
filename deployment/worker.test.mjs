import assert from 'node:assert/strict';
import worker from './worker.mjs';
const original=globalThis.fetch;
try {
 globalThis.fetch=async()=>{throw new Error('offline')};
 const result=await worker.fetch(new Request('https://mannenzakura.cn/bank/health'),{TRUSTA_ORIGIN:'https://local-test.example'});
 assert.equal(result.status,503);assert.equal((await result.json()).error,'LOCAL_SERVER_OFFLINE');
 let requested;
 const staticResponse=await worker.fetch(new Request('https://mannenzakura.cn/bank/wealth'),{ASSETS:{fetch:async r=>{requested=new URL(r.url).pathname;return new Response('static')}}});
 assert.equal(requested,'/index.html');assert.equal(await staticResponse.text(),'static');
 assert.equal(staticResponse.headers.get('X-Frame-Options'),'DENY');
 assert.match(staticResponse.headers.get('Content-Security-Policy'),/object-src 'none'/);
 assert.equal(staticResponse.headers.get('Referrer-Policy'),'no-referrer');
 const unrelated=await worker.fetch(new Request('https://mannenzakura.cn/planning'),{});assert.equal(unrelated.status,404);
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}')};
 for(const origin of [undefined,'http://unsafe.example','https://user:password@unsafe.example']){
  assert.equal((await worker.fetch(new Request('https://public.example/bank/health'),{TRUSTA_ORIGIN:origin})).status,503);
 }
 assert.equal(calls,0,'missing or invalid origin must not send authentication upstream');
 let target,forwarded;
 globalThis.fetch=async request=>{target=request.url;forwarded=request.headers;return new Response('{}')};
 await worker.fetch(new Request('https://public.example/bank/api/chat/overview',{headers:{Cookie:'private-cookie'}}),{TRUSTA_ORIGIN:'https://recipient.example'});
 assert.equal(target,'https://recipient.example/bank/api/chat/overview');
 assert.equal(forwarded.has('Cookie'),false);
 console.log('PASS: offline API 503, static route isolation, unrelated paths rejected');
} finally {globalThis.fetch=original}
