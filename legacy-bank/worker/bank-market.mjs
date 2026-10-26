import {goldHistory} from './gold-history.mjs';
const memory=new Map();
async function source(url,ttl,fetcher){const now=Date.now(),old=memory.get(url);if(fetcher===fetch&&old&&old.until>now)return old.value;const key=new Request(url);if(fetcher===fetch&&globalThis.caches){const hit=await caches.default.match(key);if(hit)return hit.json();}const r=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('Unavailable');const value=await r.json();if(fetcher===fetch)memory.set(url,{until:now+ttl*1000,value});if(fetcher===fetch&&globalThis.caches)await caches.default.put(key,Response.json(value,{headers:{'Cache-Control':`public,max-age=${ttl}`}}));return value;}
export async function marketQuotes(fetcher=fetch){
 const [fx,gold,history]=await Promise.allSettled([source('https://open.er-api.com/v6/latest/CNY',3600,fetcher),source('https://api.gold-api.com/price/XAU',60,fetcher),source('https://xaus.com/api/v1/history',21600,fetcher)]);
 let rates=null,metal=null;const now=Date.now();
 if(fx.status==='fulfilled'){const x=fx.value;if(x.result==='success'&&x.base_code==='CNY'&&Number.isFinite(x.time_last_update_unix)&&['USD','EUR','JPY','GBP','HKD'].every(k=>Number.isFinite(x.rates?.[k])&&x.rates[k]>0)){rates={values:Object.fromEntries(['USD','EUR','JPY','GBP','HKD'].map(k=>[k,x.rates[k]])),updatedAt:x.time_last_update_unix*1000,stale:now-x.time_last_update_unix*1000>48*3600000};}}
 if(gold.status==='fulfilled'){const x=gold.value,t=Date.parse(x.updatedAt);if(x.symbol==='XAU'&&x.currency==='USD'&&Number.isFinite(x.price)&&x.price>0&&Number.isFinite(t)){metal={usdPerOunce:x.price,updatedAt:t,stale:now-t>15*60000,cnyPerGram:rates&&!rates.stale?x.price/rates.values.USD/31.1034768:null};}}
 return {rates,gold:metal,history:history.status==='fulfilled'?goldHistory(history.value,now):null,fetchedAt:now};
}
