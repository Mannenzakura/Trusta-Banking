"""Check an exported ZIP in fresh state; never uses a recipient's or host's keys.

Uses the current Python environment's installed dependencies. Does not install
packages, invoke models, use a tunnel, or touch the running demonstration.
"""
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
import zipfile


def verify(archive):
    archive=Path(archive).resolve()
    private=Path(__file__).resolve().parents[2]/'private'
    private.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='release-clean-room-',dir=private) as tmp:
        root=Path(tmp).resolve()
        assert root.parent==private.resolve()  # Cleanup is restricted to this new QA directory.
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            manifest=json.loads(z.read('manifest.json'))
            for name,expected in manifest['sha256_by_file'].items():
                dest=root/'Trusta'/name
                if not dest.resolve().is_relative_to(root/'Trusta'):
                    raise RuntimeError('Archive path outside clean room')
                raw=z.read('Trusta/'+name)
                assert hashlib.sha256(raw).hexdigest()==expected, 'Manifest mismatch'
                dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
        app=root/'Trusta'
        assert not (app/'data').exists() and not (app/'.env').exists()
        env={k:v for k,v in os.environ.items() if not k.startswith(('TRUSTA_','DEEPSEEK_'))}
        with socket.socket() as s:
            s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        env.update(TRUSTA_PORT=str(port),TRUSTA_ACCESS_MODE='local',TRUSTA_OPEN_BROWSER='0',
                   TRUSTA_CHAT_LLM_API_KEY='',TRUSTA_CHAT_LLM_KEY_FILE='',TRUSTA_LLM_CONFIG='',
                   TRUSTA_BANK_CONFIG='',PYTHONUTF8='1')
        log=open(root/'startup.log','wb')
        child=subprocess.Popen([sys.executable,'-u','-m','scripts.run_web_local'],cwd=app,env=env,
            stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        base=f'http://127.0.0.1:{port}/bank'
        def get(path,token=None):
            req=urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token} if token else {})
            with urllib.request.urlopen(req,timeout=3) as response:
                return response.status,response.read()
        try:
            health=None
            for _ in range(30):
                if child.poll() is not None:raise RuntimeError('Clean-room server stopped before readiness')
                try:
                    _,raw=get('/health');health=json.loads(raw);break
                except (OSError,ValueError):time.sleep(1)
            assert health and health.get('bank')=='virtual','Virtual backend did not become healthy'
            assert get('/')[0]==200
            try:get('/api/chat/finance')
            except urllib.error.HTTPError as error:assert error.code in (401,403)
            else:raise AssertionError('Unauthenticated finance read was accepted')
            token=(app/'data/api.token').read_text().strip()
            _,finance=get('/api/chat/finance',token)
            assert isinstance(json.loads(finance).get('cards'),list)
            _,capabilities=get('/api/chat/capabilities',token)
            nlu=next(f for f in json.loads(capabilities)['features'] if f['id']=='nlu')
            assert nlu['status']!='AVAILABLE','Model unexpectedly enabled in fresh package'
            return {'manifest_verified':True,'fresh_virtual_backend':True,'frontend_http':200,
                    'unauthenticated_finance_rejected':True,'authenticated_finance_read':True,
                    'model_unconfigured':True,'used_existing_python_dependencies':True}
        finally:
            # Stop only the exact process tree created above, not production.
            if child.poll() is None:
                if os.name=='nt':subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=15)
                else:child.terminate()
            child.wait(timeout=15);log.close()


if __name__=='__main__':
    print(json.dumps(verify(sys.argv[1]),ensure_ascii=False))
