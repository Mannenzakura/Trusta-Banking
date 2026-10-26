"""Authenticated deployed API checks. No LLM calls and no money confirmations.
The temporary paired device is always revoked; only virtual drafts are created.
"""
import json,urllib.request,urllib.error,uuid
from pathlib import Path

def main():
    local='http://127.0.0.1:8000/bank';base='https://mannenzakura.cn/bank'
    master=Path('data/api.token').read_text(encoding='utf-8').strip()
    def call(url,path,body=None,token=None):
        headers={'Content-Type':'application/json','User-Agent':'TRUSTA-QA/1.0'}
        if token:headers['Authorization']='Bearer '+token
        req=urllib.request.Request(url+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        with urllib.request.urlopen(req,timeout=45) as response:return json.load(response)
    assert call(base,'/health')['bank']=='virtual'
    try:call(base,'/api/chat/finance')
    except urllib.error.HTTPError as error:assert error.code in (401,403)
    else:raise AssertionError('Unauthenticated finance allowed')
    code=call(local,'/api/pairing/start',{'purpose':'device'},master)['code']
    device=call(base,'/api/pairing/claim',{'code':code,'name':'Agent upgrade temporary QA'})
    token=device['device_token']
    try:
        def api(path,body=None):return call(base,'/api/chat/'+path,body,token)
        nlu=next(f for f in api('capabilities')['features'] if f['id']=='nlu')
        assert nlu['status']!='AVAILABLE','This script must not invoke a configured model'
        before=api('finance');balances={c['id']:c['balance'] for c in before['cards']}
        overview=api('overview')['finance']
        assert overview['debt_minor']==before['outstanding']
        assert overview['assets_at_cost_minor']-overview['net_at_cost_minor']==overview['debt_minor']
        session=api('sessions',{'channel':'app'});sid=session['session_id'];revision=session['revision']
        def say(text):
            nonlocal revision
            result=api('sessions/'+sid+'/messages',{'message_id':uuid.uuid4().hex,'revision':revision,'text':text})
            revision=result['revision'];return result
        refusal=say('帮我写一首诗');assert '只处理 TRUSTA' in refusal['reply']['text']
        finance=say('看看我的黄金和贷款');assert '待还本金' in finance['reply']['text']
        transfer=say('给张三转1元')
        confirm=next(c for c in transfer['reply']['cards'] if c['type']=='confirm')
        assert {c['id']:c['balance'] for c in api('finance')['cards']}==balances
        api('sessions/'+sid+'/actions/'+confirm['action_id']+'/decision',{'action_hash':confirm['action_hash'],'approve':False})
        card=next(c for c in before['cards'] if c['status']=='ACTIVE' and not c['frozen'] and c['online_enabled'])
        draft=api('finance/create',{'type':'loan','card_id':card['id'],'amount':10000,'months':3})['contract']
        assert draft['card_label'] and draft['status']=='DRAFT'
        api('finance/archive',{'contract_id':draft['id']})
        assert api('finance/proposal',{'contract_id':draft['id'],'operation':'LOAN_DRAW'})['status']=='BLOCKED'
        assert {c['id']:c['balance'] for c in api('finance')['cards']}==balances
        print('PASS online: authenticated overview/finance reconcile; domain refusal; finance read; transfer requires confirmation and can be declined; archived draft blocked; balances unchanged; no model requests')
    finally:
        call(local,'/api/pairing/devices/'+device['device_id']+'/revoke',{},master)
        print('Temporary QA device revoked')

if __name__=='__main__':main()
