"""One local supervisor, bounded crash backoff, no replay of business requests.
Only manages processes it spawned. Run via start-web.ps1; stop via stop-web.ps1.
"""
import argparse,json,os,signal,socket,subprocess,sys,time
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]

def backoff(failures):return min(60,2**min(failures,6))

def stop_child(child):
    """Windows venv launchers own a real Python child; stop the owned tree."""
    if child.poll() is not None:return
    if os.name=='nt':
        subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15)
    else:child.terminate()

def main():
    p=argparse.ArgumentParser();p.add_argument('--tunnel');p.add_argument('--cloudflared',default='cloudflared');p.add_argument('--state-dir',default='data');a=p.parse_args()
    os.chdir(ROOT);data=ROOT/a.state_dir;data.mkdir(parents=True,exist_ok=True)
    lock=(data/'supervisor.lock').open('a+b');lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
    if os.name=='nt':
        import msvcrt
        try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
        except OSError:print('TRUSTA supervisor already running.');return
    port=int(os.getenv('TRUSTA_PORT','8000'))
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1',port))==0:raise SystemExit('Port already occupied; existing service left untouched.')
    stop=data/'supervisor.stop';stop.unlink(missing_ok=True)
    env=os.environ.copy();env['TRUSTA_ACCESS_MODE']='tunnel' if a.tunnel else 'local';env['TRUSTA_PUBLIC_HOST']='mannenzakura.cn';env['PYTHONIOENCODING']='utf-8'
    commands={name:[sys.executable,'-u','-m','scripts.'+module]+args for name,module,args in [('web','run_web_local',[]),('audit','audit_worker',['--watch']),('scheduled','scheduled_worker',['--watch'])]}
    if a.tunnel:commands['tunnel']=[a.cloudflared,'tunnel','--config',a.tunnel,'run']
    children={};logs={};state={name:{'failures':0,'next':0,'since':0} for name in commands};running=True;bad=0;last_health=0
    def halt(*_):
        nonlocal running
        running=False
    signal.signal(signal.SIGINT,halt);signal.signal(signal.SIGTERM,halt)
    try:
        while running and not stop.exists():
            now=time.time()
            for name,cmd in commands.items():
                child=children.get(name);info=state[name]
                if child and child.poll() is not None:
                    logs[name].close();children.pop(name);info['failures']+=1;info['next']=now+backoff(info['failures'])
                if name not in children and now>=info['next']:
                    logs[name]=(data/(name+'-managed.log')).open('ab')
                    children[name]=subprocess.Popen(cmd,env=env,cwd=ROOT,stdout=logs[name],stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                    info['since']=now
                if name in children and now-info['since']>300:info['failures']=0
            if now-last_health>=15:
                last_health=now
                try:
                    with urlopen(f'http://127.0.0.1:{port}/bank/health',timeout=3) as r:healthy=r.status==200
                except Exception:healthy=False
                bad=0 if healthy else bad+1
                child=children.get('web')
                # A hung server is stopped only if this supervisor owns it; no money request is retried.
                if bad>=4 and child and now-state['web']['since']>60:
                    stop_child(child);bad=0
                report={'pid':os.getpid(),'checked_at':now,'backend':healthy,'components':{n:{'pid':c.pid,'running':c.poll() is None,'restarts':state[n]['failures']} for n,c in children.items()}}
                tmp=data/'supervisor-status.tmp';tmp.write_text(json.dumps(report),encoding='utf-8');tmp.replace(data/'supervisor-status.json')
            time.sleep(2)
    finally:
        for c in children.values():
            stop_child(c)
        for c in children.values():
            try:c.wait(timeout=8)
            except subprocess.TimeoutExpired:c.kill()
        for f in logs.values():f.close()
        report={'pid':os.getpid(),'checked_at':time.time(),'backend':False,'stopped':True,'components':{}}
        (data/'supervisor-status.json').write_text(json.dumps(report),encoding='utf-8')
        lock.close()

if __name__=='__main__':main()
