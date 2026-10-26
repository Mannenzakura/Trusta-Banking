from pathlib import Path
for f in ['tests/bank.test.mjs','tests/bank-accounts.test.mjs']:
 p=Path(f);s=p.read_text(encoding='utf-8').replace('TestPayment2026!','038529').replace('NewPayment2026!','907142').replace('ExamplePayment2026!','038529');p.write_text(s,encoding='utf-8')
