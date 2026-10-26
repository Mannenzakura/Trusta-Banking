import { readFile } from 'node:fs/promises';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
const directory = '<LOCAL_USER>/.codex/secrets/alipay-sandbox/';
const gateway = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
function pem(text, type) {
  const clean = text.trim();
  return clean.startsWith('-----BEGIN') ? clean : `-----BEGIN ${type}-----\n${clean.replace(/\s/g, '').match(/.{1,64}/g).join('\n')}\n-----END ${type}-----`;
}
async function main() {
  const privateText = await readFile(directory + 'app-private-key.txt', 'utf8');
  const publicText = await readFile(directory + 'alipay-public-key.txt', 'utf8');
  let privateKey;
  for (const type of ['RSA PRIVATE KEY', 'PRIVATE KEY']) {
    try { privateKey = createPrivateKey(pem(privateText, type)); break; } catch {}
  }
  if (!privateKey) throw new Error('PRIVATE_KEY_FORMAT_INVALID');
  const publicKey = createPublicKey(pem(publicText, 'PUBLIC KEY'));
  if (privateKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa') throw new Error('RSA_KEYS_REQUIRED');
  console.log('Key files parsed successfully; key material is not logged.');
  const params = {
    app_id: '9021000169630091', method: 'alipay.trade.query', format: 'JSON',
    charset: 'utf-8', sign_type: 'RSA2',
    timestamp: new Date(Date.now() + 8 * 3600000).toISOString().slice(0,19).replace('T',' '),
    version: '1.0', biz_content: JSON.stringify({out_trade_no:'SBX_CONNECTION_CHECK_' + Date.now()})
  };
  const canonical = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  params.sign = sign('RSA-SHA256', Buffer.from(canonical), privateKey).toString('base64');
  const response = await fetch(gateway, {method:'POST', redirect:'error', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'}, body:new URLSearchParams(params), signal:AbortSignal.timeout(20000)});
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { throw new Error('NON_JSON_RESPONSE_HTTP_' + response.status); }
  const result = data.alipay_trade_query_response || data.error_response;
  const match = raw.match(/"alipay_trade_query_response"\s*:\s*(\{[\s\S]*\})\s*,\s*"sign"\s*:/);
  const signatureVerified = !!(match && data.sign && verify('RSA-SHA256', Buffer.from(match[1]), publicKey, Buffer.from(data.sign,'base64')));
  console.log(JSON.stringify({gateway, httpStatus:response.status, code:result?.code, subCode:result?.sub_code, signatureVerified, connected:signatureVerified && result?.sub_code === 'ACQ.TRADE_NOT_EXIST', operation:'Read-only query of a nonexistent sandbox order; no payment created.'}));
  if (!signatureVerified || result?.sub_code !== 'ACQ.TRADE_NOT_EXIST') process.exitCode = 1;
}
main().catch(error => { console.error('Sandbox check failed:', error.code || error.message); process.exitCode = 1; });
