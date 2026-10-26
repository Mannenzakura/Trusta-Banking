"""Online virtual-only smoke. No model/provider calls. Revokes its own test device."""
import json,urllib.request,urllib.error
from pathlib import Path
LOCAL='http://127.0.0.1:8000/bank';PUBLIC='https://mannenzakura.cn/bank'
master=Path('data/api.token').read_text(encoding='utf-8').strip()
def call(base,path,body=None,token=None):
 headers={'Content-Type':'application/json','User-Agent':'TRUSTA-Integration-QA/1.0'}
 if token:headers['Authorization']='Bearer '+token
 data=json.dumps(body).encode() if body is not None else None
 with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers),timeout=50) as r:return json.load(r)
assert call(PUBLIC,'/health')['bank']=='virtual'
code=call(LOCAL,'/api/pairing/start',{'purpose':'device'},master)['code']
device=call(PUBLIC,'/api/pairing/claim',{'code':code,'name':'Integration temporary QA'})
token=device['device_token']
try:
 def read():return call(PUBLIC,'/api/chat/retail',token=token)
 before=read();card=next(c for c in before['cards'] if c['status']=='ACTIVE' and c['balance']>=3500 and c['online_enabled'])
 old_design=card['design'];start=card['balance']
 call(PUBLIC,'/api/chat/retail/design',{'card_id':card['id'],'theme':'ocean','nickname':'QA temporary'},token)
 assert next(c for c in read()['cards'] if c['id']==card['id'])['design']['theme']=='ocean'
 call(PUBLIC,'/api/chat/retail/design',{'card_id':card['id'],**old_design},token)
 from datetime import date
 today=date.today().isoformat()
 pid=call(PUBLIC,'/api/chat/plans',{'name':'Online virtual QA','kind':'wash','place':'test','start':today,'end':today,'budget':5000},token)['plan_id']
 oid=call(PUBLIC,'/api/chat/retail/orders',{'product_id':'wash','card_id':card['id'],'plan_id':pid},token)['order_id']
 for refund in (False,True):
  p=call(PUBLIC,'/api/chat/retail/proposal',{'order_id':oid,'refund':refund},token)
  assert p['status']=='WAITING_USER',p['status']
  assert next(c for c in read()['cards'] if c['id']==card['id'])['balance']==(start-3500 if refund else start)
  conf=next(c for c in p['cards'] if c['type']=='confirm')
  result=call(PUBLIC,'/api/chat/retail/decide',{k:conf[k] for k in ('task_id','action_id','action_hash')}|{'approve':True},token)
  assert result['status']=='COMPLETED',result['status']
  plan=next(p for p in call(PUBLIC,'/api/chat/plans',token=token)['plans'] if p['id']==pid)
  assert plan['spent']==(0 if refund else 3500)
 final=read();assert next(c for c in final['cards'] if c['id']==card['id'])['balance']==start
 assert next(o for o in final['orders'] if o['id']==oid)['status']=='REFUNDED'
 records=call(PUBLIC,'/api/chat/activity?kind=retail',token=token)['items']
 assert len([r for r in records if r.get('target_id')==oid and r['status']=='SUCCEEDED'])==2
 call(PUBLIC,'/api/chat/plans/update',{'plan_id':pid,'budget':5000,'status':'ARCHIVED'},token)
 assert isinstance(call(PUBLIC,'/api/chat/profile',token=token),dict)
 print('PASS online: plan budget reconciled and archived; card design saved/restored; confirmed virtual pay/refund; balance restored; order and activity linked')
finally:call(LOCAL,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)
