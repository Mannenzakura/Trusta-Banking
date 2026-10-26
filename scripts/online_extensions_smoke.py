"""Deployed paths and real tunnel API, without approving any debit or making model calls."""
import json,urllib.request,urllib.error,uuid
from datetime import datetime
from pathlib import Path
from backend.business import CHINA

def main():
 local='http://127.0.0.1:8000/bank';base='https://mannenzakura.cn/bank'
 master=Path('data/api.token').read_text(encoding='utf-8').strip()
 def call(root,path,body=None,token=None):
  h={'Content-Type':'application/json','User-Agent':'TRUSTA-Extension-QA/1.0'}
  if token:h['Authorization']='Bearer '+token
  req=urllib.request.Request(root+path,data=None if body is None else json.dumps(body).encode(),headers=h)
  with urllib.request.urlopen(req,timeout=45) as r:return json.load(r)
 for route in ('deposits','gold-savings','exchange','membership','support'):
  with urllib.request.urlopen(urllib.request.Request(base+'/'+route,headers={'User-Agent':'TRUSTA-Extension-QA/1.0'}),timeout=30) as r:
   assert r.status==200 and 'id="root"' in r.read().decode()
 assert call(base,'/health')['bank']=='virtual'
 try:call(base,'/api/chat/extensions')
 except urllib.error.HTTPError as e:assert e.code in (401,403)
 else:raise AssertionError('unauthenticated access')
 code=call(local,'/api/pairing/start',{'purpose':'device'},master)['code']
 device=call(base,'/api/pairing/claim',{'code':code,'name':'Bank extensions temporary QA'});token=device['device_token']
 try:
  def api(path,b=None):return call(base,'/api/chat/'+path,b,token)
  v=api('extensions');balances={c['id']:c['balance'] for c in v['cards']};card=next(c for c in v['cards'] if c['card_type']=='DEBIT' and c['status']=='ACTIVE' and not c['frozen'] and c['online_enabled'] and c['balance']>=10000)
  for page in ('gold-savings','membership','support'):assert isinstance(api(page),dict)
  for b in ({'type':'deposit_open','card_id':card['id'],'amount':10000,'term':90},{'type':'fx_buy','card_id':card['id'],'currency':'USD','units':100,'quote_mode':'practice'}):
   t=api('extensions/create',b)['contract'];p=api('finance/proposal',{'contract_id':t['id'],'operation':t['type'].upper()});assert p['status']=='WAITING_USER'
   c=next(c for c in p['cards'] if c['type']=='confirm')
   assert {c['id']:c['balance'] for c in api('extensions')['cards']}==balances
   api('finance/decide',{k:c[k] for k in ('task_id','action_id','action_hash')}|{'approve':False})
   api('finance/archive',{'contract_id':t['id']})
  p=api('gold-savings/create',{'name':'验收-'+uuid.uuid4().hex[:6],'card_id':card['id'],'amount':1000,'cycle':'monthly','start':datetime.now(CHINA).date().isoformat(),'count':1})['plan']
  api('gold-savings/update',{'plan_id':p['id'],'status':'PAUSED'});api('gold-savings/update',{'plan_id':p['id'],'status':'CANCELLED'})
  q=api('membership/prepare',{'reward':'birthday'});api('membership/confirm',{'quote_id':q['quote']['id'],'hash':q['hash'],'approve':False})
  item=next(i for i in api('support')['transactions'] if i['id']==c['action_id'])
  case=api('support/create',{'action_id':item['id'],'text':'上线验收：已拒绝的虚拟业务，无需处理。'})
  api('support/update',{'id':case['id'],'operation':'message','text':'验证关联记录及补充信息，本工单随后关闭。'})
  api('support/update',{'id':case['id'],'operation':'close'})
  assert next(x for x in api('support')['cases'] if x['id']==case['id'])['status']=='CANCELLED_BY_USER'
  assert {c['id']:c['balance'] for c in api('extensions')['cards']}==balances
  assert api('extensions')['deposits']==v['deposits'] and api('extensions')['wallets']==v['wallets']
  print('PASS: five public page routes, authenticated APIs, deposit/FX proposals and refusals, savings pause/cancel, points quote refusal, transaction-linked case create/message/close. Balances and holdings unchanged. No LLM calls.')
 finally:
  call(local,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)
  print('Temporary QA device revoked.')
if __name__=='__main__':main()
