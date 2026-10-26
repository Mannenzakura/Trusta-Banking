"""Export reviewable source (no Git history), fail closed on detected credentials.

Run from the repository using Python. Output goes beside the repository, never
overwrites an earlier release. Known private key/token values are compared only
in memory. Findings contain file paths and rule names, never secret values.
"""
import datetime,hashlib,json,re,subprocess,zipfile,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BLOCKED_DIRS={'.git','.venv','node_modules','__pycache__','data','private','.wrangler',
              '.pytest_cache','site-dist','qa-cache','coverage','.mypy_cache'}
BLOCKED_SUFFIXES={'.sqlite','.sqlite3','.db','.log','.zip','.exe','.dll','.pfx','.p12','.token','.key','.pyc'}

def eligible(name):
    p=Path(name)
    return (not p.is_absolute() and '..' not in p.parts and not set(p.parts)&BLOCKED_DIRS
        and p.suffix.lower() not in BLOCKED_SUFFIXES
        and not p.name.endswith(('-wal','-shm','.map')) and '.local.' not in name
        and (not p.name.startswith('.env') or p.name.endswith('.example'))
        and p.name.lower() not in {'credentials.json','tunnel.yml','tunnel.yaml','deepseek-api-key.txt'}
        and not re.search(r'(?:^|/)(?:api[-_]?key|private[-_]?key|secret)[^/]*\.(?:txt|json|pem)$',name,re.I))

def known_secrets():
    values=set()
    for p in [ROOT.parent/'private/deepseek-api-key.txt', ROOT/'data/api.token',ROOT/'data/signing.key']:
        if p.is_file():
            raw=p.read_bytes().strip()
            if len(raw)>=16:values.add(raw)
    for p in [ROOT/'.env',ROOT.parent/'private/tunnel.yml']:
        if p.is_file():
            for line in p.read_text(encoding='utf-8-sig').splitlines():
                if re.search('key|secret|token|password',line.split('=',1)[0].split(':',1)[0],re.I):
                    value=re.split('[:=]',line,maxsplit=1)[-1].strip().strip('\"\'')
                    if len(value)>=16 and not any(x in value for x in ('/', '\\','${')):values.add(value.encode())
    return values

def secret_findings(name,raw,known):
    found=[]
    if any(value in raw for value in known):found.append('known-local-secret')
    if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n',raw):found.append('private-key-material')
    if re.search(rb'\b(?:sk-[a-zA-Z0-9_-]{24,}|gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,}|AKIA[A-Z0-9]{16})\b',raw):found.append('credential-pattern')
    return [{'file':name,'rule':rule} for rule in found]

def main():
    names=set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0'))
    known=known_secrets();payload={};findings=[];excluded=[]
    cloud_account=json.loads((ROOT/'deployment/wrangler.json').read_text()).get('account_id','')
    for name in sorted(names):
        if not name:continue
        p=ROOT/name
        if not p.is_file():continue
        if not eligible(name) or p.is_symlink():excluded.append(name);continue
        raw=p.read_bytes()
        if name=='deployment/wrangler.json':
            cfg=json.loads(raw);cfg.pop('account_id',None);cfg['name']='trusta-review';cfg['routes']=[];cfg['workers_dev']=True
            cfg.pop('vars',None)  # Recipient must explicitly configure their own HTTPS origin.
            raw=(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n').encode()
        if name.endswith(('.md','.txt','.ps1','.mjs','.json')):
            try:
                text=raw.decode('utf-8-sig')
                # Remove machine/account identifiers in handoff documents only.
                if name.endswith('.md'):
                    text=re.sub(r'[CD]:[\\/](?:Users[\\/][^\\/\s]+|Downloads[\\/]trusta-integration-\d+)', '<LOCAL_ROOT>',text)
                    if cloud_account:text=text.replace(cloud_account,'<CLOUDFLARE_ACCOUNT>')
                raw=(b'\xef\xbb\xbf' if name.endswith('.ps1') else b'')+text.encode('utf-8')
            except UnicodeDecodeError:pass
        findings.extend(secret_findings(name,raw,known));payload[name]=raw
    if findings:
        print(json.dumps({'status':'BLOCKED','findings':findings},ensure_ascii=False));return 1
    if '--check' in sys.argv:
        print(json.dumps({'status':'SCAN_PASSED','files':len(payload),'bytes':sum(map(len,payload.values())), 'excluded':len(excluded)}));return 0
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    out=ROOT.parent/('release-'+stamp);out.mkdir(exist_ok=False)
    tree=out/'Trusta';tree.mkdir()
    for name,raw in payload.items():
        p=tree/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    manifest={'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'working_tree_changes_included':True,'git_history_included':False,'files':len(payload),
        'bytes_uncompressed':sum(map(len,payload.values())),'secret_scan_findings':[],
        'excluded_count':len(excluded),'sha256_by_file':{n:hashlib.sha256(b).hexdigest() for n,b in payload.items()}}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    archive=out/'TRUSTA-review.zip'
    with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED,6) as z:
        for name in payload:z.write(tree/name,'Trusta/'+name)
        z.write(out/'manifest.json','manifest.json')
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for item in z.infolist():
            assert not secret_findings(item.filename,z.read(item),known)
    checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
    (out/'SHA256.txt').write_text(checksum+'  TRUSTA-review.zip\n',encoding='ascii')
    print(json.dumps({'status':'READY_FOR_REVIEW','path':str(archive),'files':len(payload),'bytes':archive.stat().st_size,'sha256':checksum},ensure_ascii=False))
    return 0

if __name__=='__main__':raise SystemExit(main())
