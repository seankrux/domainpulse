#!/usr/bin/env python3
"""Install only the origin artifact built by successful CI for the exact main SHA."""
import fcntl,hashlib,json,os,pathlib,shutil,subprocess,tempfile,urllib.request,urllib.error
import artifact_store

REPO='seankrux/domainpulse'
STATE=pathlib.Path('/root/.local/state/vercel-to-cf/domainpulse')
INSTALL=pathlib.Path('/opt/domainpulse-origin')

def gh(*args):
    return subprocess.run(['gh',*args],check=True,capture_output=True,text=True).stdout

def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def probe():
    config=dict(line.split('=',1) for line in (STATE/'origin.env').read_text().splitlines() if '=' in line)
    request=urllib.request.Request('http://127.0.0.1:4059/ssl?domain=cloudflare.com',headers={'Authorization':'Bearer '+config['SSL_ORIGIN_TOKEN']})
    with urllib.request.urlopen(request,timeout=30) as response:
        result=json.load(response)
        assert response.status==200 and result.get('validTo') and result.get('fingerprint256'),'Certificate origin did not return real metrics'
    return True

def main():
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    with open(STATE/'update.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        update_locked()

def update_locked():
    main_sha=gh('api',f'repos/{REPO}/commits/main','--jq','.sha').strip()
    installed=INSTALL/'server.cjs';receipt=INSTALL/'release.json'
    if receipt.exists():
        current=json.loads(receipt.read_text())
        if current.get('commit')==main_sha and installed.exists() and hash_file(installed)==current.get('sha256'):
            print(json.dumps({'status':'up_to_date','commit':main_sha}));return
    runs=json.loads(gh('run','list','--repo',REPO,'--workflow','cloudflare.yml','--branch','main','--status','success','--limit','10','--json','databaseId,headSha,headBranch,conclusion,status'))
    run=next((r for r in runs if r['headSha']==main_sha and r['headBranch']=='main' and r['conclusion']=='success' and r['status']=='completed'),None)
    if run is None:
        print(json.dumps({'status':'awaiting_successful_main_ci','commit':main_sha}));return
    with tempfile.TemporaryDirectory(prefix='origin-artifact-',dir=STATE) as temp:
        artifact_store.download(temp,REPO,main_sha,run['databaseId'],'tls-origin')
        artifact=pathlib.Path(temp);bundle=artifact/'server.cjs';manifest=json.loads((artifact/'release.json').read_text())
        assert manifest.get('commit')==main_sha,'Artifact SHA differs from current main'
        assert manifest.get('sha256')==hash_file(bundle),'Origin artifact digest mismatch'
        INSTALL.mkdir(mode=0o755,exist_ok=True)
        for path in [installed,receipt]:
            if path.exists():shutil.copy2(path,path.with_name(path.name+'.previous'))
        staged=INSTALL/'server.cjs.new';shutil.copy2(bundle,staged);staged.chmod(0o644);os.replace(staged,installed)
        manifest.update({'run_id':run['databaseId'],'run_url':f'https://github.com/{REPO}/actions/runs/{run["databaseId"]}'})
        receipt.write_text(json.dumps(manifest,indent=2)+'\n');receipt.chmod(0o644)
        try:
            subprocess.run(['systemctl','restart','domainpulse-origin.service'],check=True,capture_output=True)
            # Wait for the newly started process to bind loopback, without exposing its secret.
            import time
            for attempt in range(10):
                try:probe();break
                except (OSError,urllib.error.URLError):
                    if attempt==9:raise
                    time.sleep(1)
        except Exception:
            for path in [installed,receipt]:
                previous=path.with_name(path.name+'.previous')
                if previous.exists():shutil.copy2(previous,path)
            subprocess.run(['systemctl','restart','domainpulse-origin.service'],check=True,capture_output=True)
            raise
        result={'status':'installed','source_main_sha':main_sha,'verified_successful_main_ci':True,'verified_artifact_digest':True,'certificate_probe_after_restart':True,**manifest}
        (STATE/'origin-release.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result))

if __name__=='__main__':main()
