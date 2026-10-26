import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const base='https://mannenzakura.cn';let cookie='';
async function call(body,origin=base){const r=await fetch(base+'/api/bank',{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
const foreignOrigin=await call({action:'alipayList'},'https://example.invalid');assert.equal(foreignOrigin.status,403);
await call({action:'enterTest'});const list=await call({action:'alipayList'});assert.equal(list.status,200);
const foreign=await call({action:'alipayQuery',id:'SBXa45f7a62ab294d9d8806e14784069325'});assert.equal(foreign.status,404);
const assetResults=[];
for(const file of ['payments.html','payments.js','payments.css','closure39.js']){const r=await fetch(base+'/bank/'+file+'?verify=alipay40');assert.equal(r.status,200);const body=await r.text();assert.equal(body,readFileSync('public/bank/'+file,'utf8'));assert.ok(!body.includes('BEGIN RSA PRIVATE KEY'));assetResults.push(file);}
await call({action:'exitTest'});
writeFileSync('output/alipay40-online-result.json',JSON.stringify({at:new Date().toISOString(),originProtection:true,orderIsolation:true,assetResults,version:'4493b69e-14db-455d-979b-83725cc83473'},null,2));
console.log('PASS: online origin protection, order isolation, secret-free assets and exact asset versions.');
