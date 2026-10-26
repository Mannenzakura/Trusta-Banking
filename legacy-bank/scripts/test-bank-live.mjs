import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5192';let cookie='';
async function call(body){const r=await fetch(base+'/api/bank',{method:body?'POST':'GET',headers:{origin:base,'content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
async function run(operation){const p=await call({action:'prepare',operation});return call({action:'confirm',id:p.state.pending.id,pin:'246810'});}
let result=await call({action:'init'}),initial=result.state.balance;
result=await call({action:'chat',text:'给林晓转 200 元'});assert.equal(result.state.balance,initial);assert.equal(result.state.pending.data.amount,20000);
result=await call({action:'confirm',id:result.state.pending.id});assert.equal(result.state.balance,initial-20000);
result=await run({type:'split',amount:100,people:['lin','chen']});assert.equal(result.state.splits[0].amount,10000);
assert.ok(result.report.transactions.some(t=>t.merchant==='林晓'));
await call({action:'risk',answers:[2,2,2]});result=await run({type:'buy',product:'cash',amount:100});const holding=result.state.holdings[0].id;result=await run({type:'redeem',holding});assert.equal(result.state.balance,initial-20000);
result=await run({type:'card',operation:'lock'});assert.equal(result.state.card.status,'locked');await run({type:'card',operation:'unlock'});
result=await run({type:'subscription',id:'music',operation:'cancel'});assert.equal(result.state.subscriptions.find(x=>x.id==='music').status,'cancelled');
result=await run({type:'birthday',contact:'mom',amount:300,at:new Date(result.state.now+86400000).toISOString()});assert.equal(result.state.reserved,30000);
result=await run({type:'clock',days:1});assert.equal(result.state.plans[0].status,'completed');assert.equal(result.state.plans[0].orders.length,2);assert.equal(result.state.reserved,0);
result=await run({type:'card',operation:'apply'});assert.equal(result.state.cards.length,2);const added=result.state.cards[1].id;
await call({action:'selectCard',id:added});await call({action:'customizeCard',id:added,nickname:'旅行卡',theme:'champagne',pattern:'brushed'});
result=await call();assert.equal(result.state.card.id,added);assert.equal(result.state.card.nickname,'旅行卡');assert.equal(result.state.card.theme,'champagne');assert.equal(result.state.cards[0].theme,'forest');
const isolation=await fetch(base+'/api/bank');assert.equal(isolation.status,401);
const csrf=await fetch(base+'/api/bank',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json',cookie},body:JSON.stringify({action:'reset'})});assert.equal(csrf.status,403);
console.log('PASS: isolated live sandbox; transfer, AA, bills, investment, card, subscription, birthday, multi-card persistence, customization, session and origin checks.');
