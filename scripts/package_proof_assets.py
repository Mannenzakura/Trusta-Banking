"""Package only hash-pinned public DEVELOPMENT proof artifacts, never setup secrets."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASES = ('data/zkp-dev-v1', 'data/anchor-integration/m1-artifacts')

def build(output):
    output = Path(output).resolve()
    payload = {}
    for base in BASES:
        folder = ROOT / base
        manifest = json.loads((folder / 'manifest.json').read_bytes())
        if manifest.get('production_ready') is not False:
            raise ValueError('Only development artifacts may be packaged here')
        payload[base + '/manifest.json'] = (folder / 'manifest.json').read_bytes()
        for name, digest in manifest['files'].items():
            path = folder / name
            if not path.resolve().is_relative_to(folder.resolve()) or path.is_symlink():
                raise ValueError('Unsafe artifact path')
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != digest:
                raise ValueError('Artifact hash mismatch: ' + name)
            payload[base + '/' + name] = raw
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, 6) as archive:
        for name, raw in payload.items():
            archive.writestr(name, raw)
        archive.writestr('PROOF-ASSETS-README.txt',
            'Development Groth16 artifacts only. NOT a production trusted setup.\n'
            'Extract into the repository root; install crypto_trust dependencies with npm ci.\n'
            'See docs/proof-assets.md. Public proving and verification keys are NOT API keys.\n')
    return {'path': str(output), 'files': len(payload), 'bytes': output.stat().st_size,
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output')
    print(json.dumps(build(parser.parse_args().output)))
