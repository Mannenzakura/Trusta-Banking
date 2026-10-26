import {readFileSync,writeFileSync} from 'node:fs';import {duffelTestClient} from '../worker/duffel-test-client.mjs';
const client=duffelTestClient({DUFFEL_TEST_ENABLED:'true',DUFFEL_TEST_TOKEN:readFileSync('<LOCAL_USER>/.codex/secrets/duffel-test-token.txt','utf8').trim()});
const date=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
const r=await client.search({from:'LHR',to:'JFK',date});writeFileSync('output/duffel-search-private.json',JSON.stringify(r));console.log(JSON.stringify({test:r.live_mode===false,offers:r.offers?.length,keys:Object.keys(r)}));
