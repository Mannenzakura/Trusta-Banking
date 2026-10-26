import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const verified=JSON.parse(readFileSync('output/alipay40-live-result.json','utf8'));
if(verified.refund!=='refunded'||!verified.signatureVerified)throw Error('Live sandbox verification required');
const data={ALIPAY_SANDBOX_ENABLED:'true',ALIPAY_SANDBOX_PRIVATE_KEY:readFileSync('<LOCAL_USER>/.codex/secrets/alipay-sandbox/app-private-key.txt','utf8').trim(),ALIPAY_SANDBOX_PUBLIC_KEY:readFileSync('<LOCAL_USER>/.codex/secrets/alipay-sandbox/alipay-public-key.txt','utf8').trim()};
const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','wrangler.cloudflare.json'],{input:JSON.stringify(data),encoding:'utf8',windowsHide:true});
// Never echo CLI output that might contain a secret; report only outcome.
console.log('Sandbox secret upload exit:',r.status);process.exitCode=r.status??1;
