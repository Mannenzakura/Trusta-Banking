"""Local web runner: no paid integrations, no live banking, no secret logging."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
os.environ.setdefault('TRUSTA_ACCESS_MODE', 'tunnel')
os.environ.setdefault('TRUSTA_PUBLIC_HOST', 'mannenzakura.cn')
from backend.config import Config
from backend.service import TrustaService
from backend.server import create_server
import secrets

def main():
    config = Config.local()
    if config.bank_config_path:
        raise RuntimeError('This distribution only permits the virtual bank; remove TRUSTA_BANK_CONFIG.')
    service = TrustaService(config)
    p = Path(config.db_path).parent / 'api.token'
    from backend.security.local_files import write_secret_atomic, protect_secret
    if not p.exists():
        write_secret_atomic(p, secrets.token_urlsafe(32).encode(), create_only=True)
    protect_secret(p)
    token = p.read_text(encoding='utf-8').strip()
    port=int(os.environ.get("TRUSTA_PORT", "8000"))
    server = create_server(service, token, port=port)
    print(f'TRUSTA virtual bank ready on loopback:{port}; credentials remain in private data/', flush=True)
    if os.environ.get('TRUSTA_OPEN_BROWSER') == '1':
        import webbrowser
        webbrowser.open(f'http://127.0.0.1:{port}/bank/#token=' + token)
    try: server.serve_forever()
    finally: server.server_close()
if __name__ == '__main__': main()
