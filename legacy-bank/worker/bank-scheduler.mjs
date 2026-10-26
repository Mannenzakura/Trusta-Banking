import {ensureBook,verifyBook,postBook} from './bank-book.mjs';
import {normalizeCards,tick,nextWake} from './bank-engine.mjs';
export async function runBankSchedule(env,now=Date.now()){
 const result={processed:0,conflicts:0,failed:0};
 for(const table of ['bank_accounts','bank_demo_sessions']){
  const rows=await env.DB.prepare(`SELECT id,state,revision FROM ${table} WHERE json_extract(state,'$.nextWake')<=? ${table==='bank_demo_sessions'?'AND expires>?':''} ORDER BY json_extract(state,'$.nextWake') LIMIT 50`).bind(...(table==='bank_demo_sessions'?[now,now]:[now])).all();
  for(const row of rows.results||[]){try{const s=normalizeCards(JSON.parse(row.state));if(s.testMode||s.demoMode||s.migratedTo)continue;ensureBook(s);verifyBook(s);s.now=Math.max(s.now,now);tick(s);postBook(s,'scheduler');s.nextWake=nextWake(s);const out=await env.DB.prepare(`UPDATE ${table} SET state=?,revision=revision+1 WHERE id=? AND revision=?`).bind(JSON.stringify(s),row.id,row.revision).run();if(out.meta.changes===1)result.processed++;else result.conflicts++;}catch{result.failed++;}}
 }
 return result;
}
