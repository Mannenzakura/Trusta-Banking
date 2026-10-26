"""Public release checks. Refuse every financial proposal; never call a model."""
import hashlib,json,re,sqlite3,urllib.request,urllib.error,uuid
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
 expected=re.findall(rb'(?:src|href)="(/bank/assets/[^\"]+)"',Path('frontend/dist/index.html').read_bytes())
 for route in ['wealth','funds','credit-account','todos']:
  html=read(public,'/'+route)
  assert b'id="root"' in html and re.findall(rb'(?:src|href)="(/bank/assets/[^\"]+)"',html)==expected,route
 for pattern in ['main-*.js','main-*.css','AdvancedBanking-*.js','Todos-*.js','BankExtensions-*.css']:
  for file in Path('frontend/dist/assets').glob(pattern):
   assert hashlib.sha256(read(public,'/assets/'+file.name)).digest()==hashlib.sha256(file.read_bytes()).digest(),file.name
 for path in ['advanced','todos']:
  try:call(public,'/api/chat/'+path)
  except urllib.error.HTTPError as e:assert e.code in {401,403},e.code
  else:raise AssertionError('Unauthenticated access accepted')
 print('PASS: public pages/assets match build; unauthenticated business reads denied.')
 code=call(local,'/api/pairing/start',{'purpose':'device'},master)['code']
 device=call(public,'/api/pairing/claim',{'code':code,'name':'Temporary advanced banking verification'})
 try:
  def api(path,body=None):return call(public,'/api/chat/'+path,body,device['device_token'])
  before=api('advanced');balances={c['id']:c['balance'] for c in before['cards']};todos=api('todos');assert isinstance(todos['items'],list)
  card=next(c for c in before['cards'] if c['card_type']=='DEBIT' and c['status']=='ACTIVE' and not c['frozen'] and c['online_enabled'] and c['balance']>=10000)
  drafts=[{'type':'card_charge','amount':100,'merchant':'发布验收（拒绝）'}, {'type':'fund_subscribe','amount':10000,'product_id':'practice-bond'}]
  for body in drafts:
   draft=api('finance/create',body|{'card_id':card['id']})['contract']
   try:
    p=api('finance/proposal',{'contract_id':draft['id'],'operation':body['type'].upper()})
    assert p['status']=='WAITING_USER',(body['type'],p['status'])
    confirm=next(c for c in p['cards'] if c['type']=='confirm')
    if body['type']=='fund_subscribe':assert confirm['risk_level']=='RED'
    result=api('finance/decide',{k:confirm[k] for k in ('task_id','action_id','action_hash')}|{'approve':False})
    assert result['status']=='CANCELLED'
   finally:api('finance/archive',{'contract_id':draft['id']})
  after=api('advanced')
  assert balances=={c['id']:c['balance'] for c in after['cards']}
  assert before['states']==after['states']
  assert todos['items']==api('todos')['items']
  print('PASS: credit and fund proposals require confirmation; refusal leaves balances, debt, holdings and to-dos unchanged. No model calls.')
  session=api('sessions',{'channel':'app'});sid=session['session_id'];revision=session['revision']
  assert session['llm_mode']=='rules','A real model is configured; do not issue model requests in this test.'
  agent_contract=None
  try:
   message=api('sessions/'+sid+'/messages',{'message_id':uuid.uuid4().hex,'revision':revision,'text':'申购100元稳健债券练习基金，使用'+card['id']})
   confirm=next(c for c in message['reply']['cards'] if c['type']=='confirm')
   assert confirm['action_type']=='FUND_SUBSCRIBE' and confirm['risk_level']=='RED'
   # Identify only this action's draft, never cancel a concurrent user-created draft.
   with sqlite3.connect((Path('data/trusta.sqlite3').resolve().as_uri()+'?mode=ro'),uri=True) as db:
    action=json.loads(db.execute('SELECT body FROM actions WHERE id=?',(confirm['action_id'],)).fetchone()[0])
    assert action['action_type']=='FUND_SUBSCRIBE'
    agent_contract=action['target']['id']
   api('sessions/'+sid+'/actions/'+confirm['action_id']+'/decision',{'action_hash':confirm['action_hash'],'approve':False})
   current=api('advanced')
   assert balances=={c['id']:c['balance'] for c in current['cards']} and before['states']==current['states']
   print('PASS: public rule assistant prepares an actual fund confirmation; refusal leaves all balances/holdings unchanged.')
  finally:
   if agent_contract:api('finance/archive',{'contract_id':agent_contract})
 finally:
  call(local,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)
  print('Temporary verification device revoked.')

if __name__=='__main__':main()
