// Run only against scripts.release_qa_server (disposable virtual funds, no LLM).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../qa-tools/node_modules/playwright'));
const output=path.resolve(__dirname,'../../private/release-qa');
const base='http://127.0.0.1:8013/bank';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.QA_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const report={pages:[],flows:[],errors:[]};
 if(process.argv.includes('--flows-only'))report.pages=JSON.parse(fs.readFileSync(path.join(output,'browser-report.json'),'utf8')).pages;
 try {
 const page=await browser.newPage();
 await page.addInitScript(t=>sessionStorage.setItem('trusta-token',t),fs.readFileSync(path.join(output,'browser.token'),'utf8'));
 page.on('pageerror',e=>report.errors.push(e.message));
 const routes=['overview','bills','wealth','funds','deposits','gold','gold-savings','exchange','credit','credit-account','membership','support','plans','life','features','settings','todos'];
 for(const width of process.argv.includes('--flows-only')?[]:[390,360,1440]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const route of routes){
   await page.goto(base+'/'+route,{waitUntil:'networkidle'});
   await page.locator('main').waitFor({timeout:12000});
   const view=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector('main h1,main h2')?.textContent}));
   assert.ok(view.heading,route+' missing heading');
   assert.ok(view.scroll<=view.width+1,route+' horizontal overflow at '+width);
   report.pages.push({route,...view});
   if(width===390&&['deposits','credit-account','plans','wealth','exchange'].includes(route))await page.screenshot({path:path.join(output,route+'-390.png'),fullPage:true});
  }
 }
 await page.setViewportSize({width:390,height:844});
 const read=async endpoint=>page.evaluate(async endpoint=>{const r=await fetch('/bank/api/chat/'+endpoint,{headers:{Authorization:'Bearer '+sessionStorage.getItem('trusta-token')}});if(!r.ok)throw Error('read failed');return r.json()},endpoint);
 await page.goto(base+'/deposits',{waitUntil:'networkidle'});
 const before=await read('extensions');const card=before.cards[0];
 await page.locator('.bank-extensions select').first().selectOption(card.id);
 await page.getByLabel('存入金额（元）').fill('100');
 await page.getByRole('button',{name:'核对存款',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 assert.equal((await read('extensions')).cards.find(c=>c.id===card.id).balance,card.balance);
 await page.screenshot({path:path.join(output,'deposit-confirm-390.png'),fullPage:true});
 await page.getByRole('button',{name:'拒绝办理',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal((await read('extensions')).cards.find(c=>c.id===card.id).balance,card.balance);
 report.flows.push('deposit proposal/refusal leaves balance unchanged');
 await page.getByRole('button',{name:'核对存款',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 let decisions=0;page.on('request',r=>{if(r.url().endsWith('/finance/decide'))decisions++});
 await page.getByRole('button',{name:'确认办理',exact:true}).evaluate(button=>{button.click();button.click()});
 await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(decisions,1,'double click made duplicate approval requests');
 assert.equal((await read('extensions')).cards.find(c=>c.id===card.id).balance,card.balance-10000);
 report.flows.push('deposit explicit confirmation debits exactly once on double click');
 await page.reload({waitUntil:'networkidle'});
 assert.ok((await read('extensions')).deposits.some(d=>d.principal===10000));
 report.flows.push('deposit survives page reload');
 await page.route('**/bank/api/chat/extensions',r=>r.abort());
 await page.getByRole('button',{name:'刷新',exact:true}).click();
 await page.getByRole('alert').first().waitFor();
 report.flows.push('failed read displays recoverable error');
 assert.deepEqual(report.errors,[]);
 }finally{
  fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
  await browser.close();
 }
 console.log(JSON.stringify({pages:report.pages.length,flows:report.flows,errors:report.errors}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
