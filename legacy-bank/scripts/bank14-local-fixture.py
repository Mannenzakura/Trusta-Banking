import urllib.request,json
body=dict(action='register',username='ui_test_20261011',loginPassword='LocalUITest2026!',loginConfirm='LocalUITest2026!',paymentPassword='LocalPayTest2026!',paymentConfirm='LocalPayTest2026!')
r=urllib.request.Request('http://127.0.0.1:5192/api/bank',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':'http://127.0.0.1:5192'})
try:
 with urllib.request.urlopen(r) as res: print('Local fixture created:',res.status)
except urllib.error.HTTPError as e: print('Local fixture status:',e.code)
