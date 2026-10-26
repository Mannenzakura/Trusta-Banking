// Reference conversion only. Never used as a payment amount or currency.
let cached;
export async function flightFX(fetcher=fetch,now=Date.now()){
 if(fetcher===fetch&&cached&&now-cached.fetched<3600000)return cached.value;
 try{
  const url='https://open.er-api.com/v6/latest/CNY';
  const r=await fetcher(url,{signal:AbortSignal.timeout(8000),cf:{cacheTtl:3600,cacheEverything:true}});
  if(!r.ok)return null;const x=await r.json(),at=x.time_last_update_unix*1000;
  if(x.result!=='success'||x.base_code!=='CNY'||!Number.isFinite(at)||at>now+3600000||now-at>48*3600000)return null;
  const rates=Object.fromEntries(['CNY','EUR','USD','GBP','HKD','JPY'].filter(k=>Number.isFinite(x.rates?.[k])&&x.rates[k]>0).map(k=>[k,1/x.rates[k]]));
  const value={rates,at,source:'ExchangeRate-API'};if(fetcher===fetch)cached={value,fetched:now};return value;
 }catch{return null;}
}
