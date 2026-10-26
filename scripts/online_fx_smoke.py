"""Verify deployed reference FX quotes and confirmation gating; never approve funds."""
import hashlib,json,re,urllib.request
from pathlib import Path

def main():
 local='http://127.0.0.1:8000/bank';public='https://mannenzakura.cn/bank'
 master=Path('data/api.token').read_text(encoding='utf-8').strip()
 def read(root,path,body=None,token=None):
  headers={'User-Agent':'TRUSTA-Extension-QA/1.0','Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  req=urllib.request.Request(root+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
  with urllib.request.urlopen(req,timeout=45) as r:return r.read()
 def call(root,path,body=None,token=None):return json.loads(read(root,path,body,token))
 for route in ['wealth','deposits','gold','gold-savings','exchange']:
  html=read(public,'/'+route)
  # Cloudflare injects its analytics beacon into HTML; compare our entry assets instead.
  assert b'id="root"' in html,route
  assert re.findall(rb'(?:src|href)="(/bank/assets/[^\"]+)"',html)==re.findall(rb'(?:src|href)="(/bank/assets/[^\"]+)"',Path('frontend/dist/index.html').read_bytes()),route
 for pattern in ['main-*.js','main-*.css','BankExtensions-*.js','BankExtensions-*.css','Wealth-*.js']:
  for file in Path('frontend/dist/assets').glob(pattern):
   assert hashlib.sha256(read(public,'/assets/'+file.name)).digest()==hashlib.sha256(file.read_bytes()).digest(),file.name
 print('PASS: five public wealth pages and deployed asset hashes match local build.')
 code=call(local,'/api/pairing/start',{'purpose':'device'},master)['code']
 device=call(public,'/api/pairing/claim',{'code':code,'name':'Temporary FX verification'})
 token=device['device_token']
 try:
  def api(path,body=None):return call(public,'/api/chat/'+path,body,token)
  before=api('extensions');balances={c['id']:c['balance'] for c in before['cards']}
  quotes=api('market?refresh=1')['quotes'];symbols=['USDCNY','EURCNY','JPYCNY','HKDCNY']
  for symbol in symbols:
   q=next(q for q in quotes if q['symbol']==symbol)
   assert not q['snapshot'] and not q['stale'] and q['price']>0,(symbol,'quote unavailable')
   print(symbol,q['price'],q['unit'],q['source'],q['as_of'])
  card=next(c for c in before['cards'] if c['card_type']=='DEBIT' and c['status']=='ACTIVE' and not c['frozen'] and c['online_enabled'] and c['balance']>=10000)
  draft=api('extensions/create',{'type':'fx_buy','card_id':card['id'],'currency':'USD','units':100,'quote_mode':'reference'})['contract']
  assert draft['quote']['symbol']=='USDCNY' and draft['quote']['mode']=='reference'
  try:
   proposal=api('finance/proposal',{'contract_id':draft['id'],'operation':'FX_BUY'})
   assert proposal['status']=='WAITING_USER'
   confirm=next(c for c in proposal['cards'] if c['type']=='confirm')
   assert confirm['risk_level']=='RED'
   result=api('finance/decide',{k:confirm[k] for k in ('task_id','action_id','action_hash')}|{'approve':False})
   assert result['status']=='CANCELLED',result['status']
  finally:api('finance/archive',{'contract_id':draft['id']})
  after=api('extensions')
  assert {c['id']:c['balance'] for c in after['cards']}==balances
  assert before['wallets']==after['wallets']
  print('PASS: public reference-rate proposal requires strong confirmation; refusal moves no funds. No model calls.')
 finally:
  call(local,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)
  print('Temporary test device revoked.')
if __name__=='__main__':main()
