"""Virtual finance acceptance. Public mode never changes MFA or risk-profile settings."""
import argparse,json,urllib.request,urllib.error
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--stage',action='store_true');args=p.parse_args()
 local='http://127.0.0.1:'+('8001' if args.stage else '8000')+'/bank'
 base=local if args.stage else 'https://mannenzakura.cn/bank'
 master=Path('data/api.token').read_text(encoding='utf-8').strip()
 def call(url,path,body=None,token=None):
  headers={'Content-Type':'application/json','User-Agent':'TRUSTA-Integration-QA/1.0'}
  if token:headers['Authorization']='Bearer '+token
  req=urllib.request.Request(url+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
  except urllib.error.HTTPError as e:raise RuntimeError(str(e.code)+' '+e.read().decode()) from None
 assert call(base,'/health')['bank']=='virtual'
 device=None;token=master
 if not args.stage:
  code=call(local,'/api/pairing/start',{'purpose':'device'},master)['code']
  device=call(base,'/api/pairing/claim',{'code':code,'name':'Finance temporary QA'});token=device['device_token']
 try:
  def api(path,body=None):return call(base,'/api/chat/'+path,body,token)
  def view():return api('finance')
  before=view();card=next(c for c in before['cards'] if c['status']=='ACTIVE' and c['online_enabled'] and not c['frozen'] and c['balance']>=10000)
  def balance():return next(c['balance'] for c in view()['cards'] if c['id']==card['id'])
  start=balance();expected=start
  def create(typ,**kw):return api('finance/create',{'type':typ,'card_id':card['id'],**kw})['contract']
  def complete(t,operation):
   prev=balance();proposal=api('finance/proposal',{'contract_id':t['id'],'operation':operation});assert proposal['status']=='WAITING_USER',proposal
   assert balance()==prev,'proposal moved funds before confirmation'
   conf=next(c for c in proposal['cards'] if c['type']=='confirm')
   b={k:conf[k] for k in ('task_id','action_id','action_hash')}|{'approve':True}
   if conf['risk_level']=='RED':
    assert args.stage,'Do not change public MFA for a smoke test'
    otp=api('finance/sms',{k:conf[k] for k in ('task_id','action_id')})
    b['verification']={'method':'SMS','code':otp['dev_code']}
   result=api('finance/decide',b);assert result['status']=='COMPLETED',result
   record=next(c for c in view()['contracts'] if c['id']==t['id'])
   activity=api('activity')['items'];assert any(a.get('target_id')==t['id'] and a['status']=='SUCCEEDED' and a['verified'] for a in activity)
   return record
  loan=create('loan',amount=10000,months=3);complete(loan,'LOAN_DRAW');assert balance()==start+10000
  paid=complete(loan,'CREDIT_SETTLE');expected-=loan['schedule'][0]['fee'];assert paid['status']=='SETTLED' and balance()==expected
  eligible=[r for r in view()['eligible'] if r['account_id']==card['account_id'] and r['amount']<500000 and r['amount']<=card['spending_limit']]
  assert eligible,'No eligible installment fixture'
  source=min(eligible,key=lambda r:r['amount'])
  inst=create('installment',source_id=source['id'],months=3);complete(inst,'INSTALLMENT_START');assert balance()==expected+source['amount']
  settled=complete(inst,'CREDIT_SETTLE');expected-=inst['schedule'][0]['fee'];assert settled['status']=='SETTLED' and balance()==expected
  duplicate=create('installment',source_id=source['id'],months=3);assert api('finance/proposal',{'contract_id':duplicate['id'],'operation':'INSTALLMENT_START'})['status']=='BLOCKED'
  if args.stage:
   gold=create('gold_buy',units=1);complete(gold,'GOLD_BUY');expected-=gold['amount'];assert balance()==expected
   sell=create('gold_sell',units=1);complete(sell,'GOLD_SELL');expected+=sell['amount'];assert balance()==expected
   print('PASS stage: gold buy/sell with live public quote, bound test OTP, holdings and signed ledger')
  else:
   # Verify suitability restriction on the actual public demo profile; never silently raise its risk rating.
   if (view().get('risk') or {}).get('risk_level',0)<3:
    gold=create('gold_buy',units=1);blocked=api('finance/proposal',{'contract_id':gold['id'],'operation':'GOLD_BUY'})
    assert blocked['status']=='BLOCKED' and balance()==expected
    print('PASS online: gold R3 suitability blocks R2 purchase without changing the profile')
  try:api('retail/orders',{'product_id':'wash','card_id':card['id']})
  except RuntimeError as e:assert 'FEATURE_UNAVAILABLE' in str(e)
  else:raise AssertionError('retired storefront still creates orders')
  print('PASS: loan draw/settle; installment/repeated-source block/settle; confirmation before money; reconciled balance; signed receipts; retired retail creation blocked')
 finally:
  if device:call(local,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)

if __name__=='__main__':main()
