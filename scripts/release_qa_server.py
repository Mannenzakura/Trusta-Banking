"""Disposable browser acceptance server. Never reads production config or model keys."""
import os
import secrets
import tempfile
from pathlib import Path

def main():
    for name in list(os.environ):
        if name.startswith(('TRUSTA_', 'DEEPSEEK_')):
            os.environ.pop(name)
    os.environ['TRUSTA_ACCESS_MODE'] = 'local'
    os.environ['TRUSTA_DEMO_MODE'] = 'true'
    from backend.config import Config
    from backend.service import TrustaService
    from backend.server import create_server
    output = Path(__file__).resolve().parents[2] / 'private' / 'release-qa'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='trusta-release-', dir=output) as tmp:
        service = TrustaService(Config(db_path=str(Path(tmp)/'qa.sqlite3'), signing_key=secrets.token_bytes(32),
            banking_version=5, communication_version=3, safety_profile='competition'))
        token = secrets.token_urlsafe(32)
        token_file = output/'browser.token'
        from backend.security.local_files import write_secret_atomic
        write_secret_atomic(token_file, token.encode('utf-8'))
        server = create_server(service, token, port=8013)
        print('Isolated virtual QA ready on loopback:8013; no model configured.', flush=True)
        try:
            server.serve_forever()
        finally:
            server.server_close()
            token_file.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
