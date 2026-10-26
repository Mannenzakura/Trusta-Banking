"""Public-site integration smoke: proposal + refusal only; never approves money."""
import json,uuid,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timedelta
from backend.business import CHINA

def main():
 local='http://127.0.0.1:8000/bank';base='https://mannenzakura.cn/bank'
 master=Path('data/api.token').read_text(encoding='utf-8').strip()
 def call(root,path,body=None,token=None):
  headers={'Content-Type':'application/json','User-Agent':'TRUSTA-Integration-QA/1.0'}
  if token:headers['Authorization']='Bearer '+token
  request=urllib.request.Request(root+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
  with urllib.request.urlopen(request,timeout=45) as response:return json.load(response)
 code=call(local,'/api/pairing/start',{'purpose':'device'},master)['code']
 device=call(base,'/api/pairing/claim',{'code':code,'name':'Plan integration temporary QA'});token=device['device_token']
 try:
  def api(path,body=None):return call(base,'/api/chat/'+path,body,token)
  before=api('plan-center');balances={a['id']:a['balance'] for a in before['accounts']};profile=api('profile')
  account=next(a for a in before['accounts'] if a['balance']>=10000 and not a['frozen'])
  day=(datetime.now(CHINA).date()+timedelta(days=5)).isoformat()
  pid=api('plans',dict(name='联动验收-'+uuid.uuid4().hex[:6],kind='birthday',place='',start=day,end=day,budget=10000))['plan_id']
  payload=dict(plan_id=pid,account_id=account['id'],items=[])
  prepared=api('plans/prepare',payload);assert prepared['prepared']
  duplicate=api('plans/prepare',payload);assert duplicate['reused'] and duplicate['session_id']==prepared['session_id']
  assert api('plans/open',{'plan_id':pid})['session_id']==prepared['session_id']
  view=api('sessions/'+prepared['session_id']);card=next(c for c in view['pending'] if c['action_type']=='FUND_LOCK')
  assert {a['id']:a['balance'] for a in api('plan-center')['accounts']}==balances
  try:api('plans/prepare',payload|{'approve':True})
  except urllib.error.HTTPError as e:assert e.code==400
  else:raise AssertionError('Unexpected authorization parameter accepted')
  api('sessions/'+prepared['session_id']+'/actions/'+card['action_id']+'/decision',dict(action_hash=card['action_hash'],approve=False))
  api('plans/update',dict(plan_id=pid,budget=10000,status='ARCHIVED'))
  result=api('plan-center');plan=next(p for p in result['plans'] if p['id']==pid)
  assert plan['status']=='ARCHIVED' and plan['reserved']==0 and plan['spent']==0
  assert {a['id']:a['balance'] for a in result['accounts']}==balances
  assert api('profile')==profile
  assert view['llm_mode']=='rules'
  print('PASS public API: plan create, prepare, idempotent retry, conversation open, confirmation required, injected approval rejected, decline, archive, balances and profile unchanged. No LLM requests.')
 finally:
  call(local,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)
  print('Temporary QA device revoked.')

if __name__=='__main__':main()
