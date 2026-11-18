"""Private, bounded CI artifacts in Sean's Cloudflare KV namespace."""
import argparse,gzip,hashlib,io,json,os,pathlib,tarfile,time,urllib.error,urllib.parse,urllib.request
ACCOUNT='7a7a08127b6d6744c838413b4473ecf1'
NAMESPACE='eb542ad262a549d38269c0bb79bc844a'
MAX_BYTES=24*1024*1024

def token():
    value=os.environ.get('CLOUDFLARE_API_TOKEN')
    if value:return value
    private=pathlib.Path('/root/.local/state/vercel-to-cf/cloudflare-token.json')
    data=json.loads(private.read_text());return data.get('CLOUDFLARE_API_TOKEN') or data['token']

def request(key,method='GET',body=None,content_type=None):
    url=f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/storage/kv/namespaces/{NAMESPACE}/values/'+urllib.parse.quote(key,safe='')
    headers={'Authorization':'Bearer '+token()}
    if content_type:headers['Content-Type']=content_type
    for attempt in range(13):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers,method=method),timeout=90) as response:raw=response.read(MAX_BYTES+1)
            break
        except urllib.error.HTTPError as error:
            if error.code!=404 or method!='GET' or attempt==12:raise
            time.sleep(5)
    assert len(raw)<=MAX_BYTES,'Artifact value exceeds the approved KV size boundary'
    if method!='GET':assert json.loads(raw)['success'],'Artifact storage rejected upload'
    return raw

def prefix(repo,commit,run_id,group):
    assert repo in ['seankrux/domainpulse','seankrux/lawyersph']
    assert len(commit)==40 and all(c in '0123456789abcdef' for c in commit)
    assert str(run_id).isdigit() and group in ['tls-origin','public-web']
    return '/'.join([repo,group,commit,str(run_id)])

def sha(raw):return hashlib.sha256(raw).hexdigest()

def publish(root,repo,commit,run_id,group):
    root=pathlib.Path(root).resolve();files=[];buffer=io.BytesIO()
    with tarfile.open(fileobj=buffer,mode='w') as archive:
        for path in sorted(root.rglob('*')):
            assert not path.is_symlink(),'Artifact symlinks are not permitted'
            if not path.is_file():continue
            data=path.read_bytes();name=path.relative_to(root).as_posix();info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;archive.addfile(info,io.BytesIO(data));files.append({'path':name,'sha256':sha(data),'bytes':len(data)})
    raw=gzip.compress(buffer.getvalue(),mtime=0);assert files and len(raw)<=MAX_BYTES,'Artifact must fit one private KV value'
    manifest={'repo':repo,'commit':commit,'run_id':str(run_id),'group':group,'sha256':sha(raw),'bytes':len(raw),'files':files}
    key=prefix(repo,commit,run_id,group);request(key+'/artifact.tar.gz','PUT',raw,'application/gzip');request(key+'/manifest.json','PUT',json.dumps(manifest,separators=(',',':')).encode(),'application/json')
    print(json.dumps({k:v for k,v in manifest.items() if k!='files'}));return manifest

def download(root,repo,commit,run_id,group):
    key=prefix(repo,commit,run_id,group);manifest=json.loads(request(key+'/manifest.json'))
    assert (manifest.get('repo'),manifest.get('commit'),manifest.get('run_id'),manifest.get('group'))==(repo,commit,str(run_id),group),'Artifact source/run identity mismatch'
    raw=request(key+'/artifact.tar.gz');assert len(raw)==manifest['bytes'] and sha(raw)==manifest['sha256'],'Artifact archive digest mismatch'
    root=pathlib.Path(root).resolve();root.mkdir(parents=True,exist_ok=True);expected={f['path']:f for f in manifest['files']};seen=set()
    assert len(expected)==len(manifest['files']) and len(expected)<=10000,'Invalid artifact file inventory'
    assert all(0<=f['bytes']<=128*1024*1024 for f in expected.values()) and sum(f['bytes'] for f in expected.values())<=128*1024*1024,'Expanded artifact exceeds its size boundary'
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
        for member in archive.getmembers():
            name=member.name;relative=pathlib.PurePosixPath(name)
            assert member.isfile() and not relative.is_absolute() and '..' not in relative.parts and name not in seen and name in expected,'Unsafe artifact archive entry'
            record=expected[name];assert member.size==record['bytes'],'Artifact file size mismatch';data=archive.extractfile(member).read(record['bytes']+1);assert len(data)==record['bytes'] and sha(data)==record['sha256'],'Artifact file digest mismatch'
            path=root/relative;assert root in path.resolve().parents,'Artifact escaped its destination';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);seen.add(name)
    assert seen==set(expected),'Artifact file set mismatch'
    return manifest

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['publish','download']);parser.add_argument('--root',required=True);parser.add_argument('--repo',required=True);parser.add_argument('--commit',required=True);parser.add_argument('--run-id',required=True);parser.add_argument('--group',required=True);args=parser.parse_args()
    result=globals()[args.action](args.root,args.repo,args.commit,args.run_id,args.group)
    if args.action=='download':print(json.dumps({k:v for k,v in result.items() if k!='files'}))
if __name__=='__main__':main()
