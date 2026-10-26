"""Verify the Windows archive using ONLY its bundled Python, on an isolated port."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile


def verify(archive):
    if os.name != 'nt':
        raise RuntimeError('Windows verification requires Windows')
    archive = Path(archive).resolve()
    private = Path(__file__).resolve().parents[2] / 'private'
    private.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='portable-qa-', dir=private) as tmp:
        root = Path(tmp).resolve()
        assert root.parent == private.resolve()
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            for item in z.infolist():
                dest = root / item.filename
                if not dest.resolve().is_relative_to(root):
                    raise ValueError('Unsafe archive path')
            z.extractall(root)
        app = root / 'TRUSTA'
        assert not (app / 'data').exists() and not (app / '.env').exists()
        py = app / 'runtime/python/python.exe'
        version = subprocess.check_output([str(py), '--version'], text=True).strip()
        env = {k: v for k, v in os.environ.items() if not k.startswith(('TRUSTA_', 'DEEPSEEK_', 'PYTHON'))}
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        env.update(TRUSTA_PORT=str(port), TRUSTA_BANK_CONFIG='', TRUSTA_DEMO_MODE='false', PYTHONUTF8='1')
        log = open(root / 'startup.log', 'wb')
        child = subprocess.Popen(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', str(app / 'start-web.ps1')], cwd=app, env=env, stdout=log,
            stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
        base = f'http://127.0.0.1:{port}/bank'
        def get(path, token=None):
            req = urllib.request.Request(base + path, headers={'Authorization': 'Bearer ' + token} if token else {})
            with urllib.request.urlopen(req, timeout=4) as response:
                return response.status, response.read()
        try:
            for _ in range(45):
                if child.poll() is not None:
                    raise RuntimeError('Portable launcher stopped before readiness')
                try:
                    status, raw = get('/health')
                    if json.loads(raw).get('bank') == 'virtual':
                        break
                except (OSError, ValueError):
                    pass
                time.sleep(1)
            else:
                raise RuntimeError('Portable virtual backend not ready')
            assert get('/')[0] == 200
            try:
                get('/api/chat/finance')
            except urllib.error.HTTPError as exc:
                assert exc.code in (401, 403)
            else:
                raise AssertionError('Unauthenticated financial access')
            token = (app / 'data/api.token').read_text().strip()
            assert isinstance(json.loads(get('/api/chat/finance', token)[1])['cards'], list)
            assert isinstance(json.loads(get('/api/chat/extensions', token)[1])['deposits'], list)
            features = json.loads(get('/api/chat/capabilities', token)[1])['features']
            assert next(f for f in features if f['id'] == 'nlu')['status'] != 'AVAILABLE'
            return {'bundled_python': version, 'supervised_launcher': True, 'frontend_http': 200,
                    'unauthenticated_finance_rejected': True, 'finance_and_extensions_read': True,
                    'fresh_virtual_database': True, 'model_unconfigured': True,
                    'used_existing_python_dependencies': False}
        finally:
            (app / 'data/supervisor.stop').touch()
            try:
                child.wait(timeout=25)
            except subprocess.TimeoutExpired:
                subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'], capture_output=True, timeout=15)
                child.wait(timeout=15)
            log.close()


if __name__ == '__main__':
    print(json.dumps(verify(sys.argv[1]), ensure_ascii=False))
