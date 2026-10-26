import {readFileSync} from 'node:fs';
import {signedParams,GATEWAY} from '../worker/bank-alipay.mjs';
const env={BANK_TEST_MODE:'true',ALIPAY_SANDBOX_ENABLED:'true',ALIPAY_SANDBOX_PRIVATE_KEY:readFileSync('<LOCAL_USER>/.codex/secrets/alipay-sandbox/app-private-key.txt','utf8'),ALIPAY_SANDBOX_PUBLIC_KEY:readFileSync('<LOCAL_USER>/.codex/secrets/alipay-sandbox/alipay-public-key.txt','utf8')};
const params=signedParams(env,'alipay.trade.query',{out_trade_no:'SBXa45f7a62ab294d9d8806e14784069325'});
const r=await fetch(GATEWAY,{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams(params),signal:AbortSignal.timeout(15000)});
console.log(JSON.stringify({status:r.status,type:r.headers.get('content-type'),retry:r.headers.get('retry-after')}));
