import gzip,hashlib,importlib.util,io,json,pathlib,tarfile,tempfile,unittest
from unittest.mock import patch
SPEC=importlib.util.spec_from_file_location('artifact_store',pathlib.Path(__file__).with_name('artifact_store.py'))
store=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(store)
REPO='seankrux/domainpulse';COMMIT='a'*40;RUN=123;GROUP='tls-origin'
class ArtifactStoreTests(unittest.TestCase):
    def fixture(self,root,mutate=None):
        source=root/'source';source.mkdir();(source/'bundle').write_bytes(b'original binary\x00');(source/'.well-known').mkdir();(source/'.well-known'/'deployment.json').write_text('{"revision":"'+COMMIT+'"}')
        objects={}
        def request(key,method='GET',body=None,content_type=None):
            if method=='PUT':objects[key]=body;return b'{"success":true}'
            return objects[key]
        with patch.object(store,'request',request):manifest=store.publish(source,REPO,COMMIT,RUN,GROUP)
        if mutate:mutate(objects)
        return objects,request,manifest
    def test_private_round_trip_includes_hidden_marker_and_binary_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);objects,request,expected=self.fixture(root)
            with patch.object(store,'request',request):actual=store.download(root/'target',REPO,COMMIT,RUN,GROUP)
            self.assertEqual(actual,expected);self.assertEqual((root/'target/bundle').read_bytes(),b'original binary\x00');self.assertTrue((root/'target/.well-known/deployment.json').exists())
    def test_wrong_run_or_sha_never_extracts(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);objects,request,_=self.fixture(root);key=store.prefix(REPO,COMMIT,RUN,GROUP)+'/manifest.json';manifest=json.loads(objects[key]);manifest['run_id']='456';objects[key]=json.dumps(manifest).encode()
            with patch.object(store,'request',request),self.assertRaisesRegex(AssertionError,'identity mismatch'):store.download(root/'target',REPO,COMMIT,RUN,GROUP)
            self.assertFalse((root/'target').exists())
    def test_tampered_archive_never_replaces_existing_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);objects,request,_=self.fixture(root);objects[store.prefix(REPO,COMMIT,RUN,GROUP)+'/artifact.tar.gz']=b'tampered';target=root/'target';target.mkdir();(target/'bundle').write_text('keep')
            with patch.object(store,'request',request),self.assertRaisesRegex(AssertionError,'digest mismatch'):store.download(target,REPO,COMMIT,RUN,GROUP)
            self.assertEqual((target/'bundle').read_text(),'keep')
    def test_unsafe_archive_paths_are_rejected_even_when_digests_match(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);objects,request,manifest=self.fixture(root);data=b'unsafe';buffer=io.BytesIO()
            with tarfile.open(fileobj=buffer,mode='w') as archive:
                info=tarfile.TarInfo('../escaped');info.size=len(data);archive.addfile(info,io.BytesIO(data))
            raw=gzip.compress(buffer.getvalue());manifest.update({'sha256':store.sha(raw),'bytes':len(raw),'files':[{'path':'../escaped','sha256':store.sha(data),'bytes':len(data)}]});key=store.prefix(REPO,COMMIT,RUN,GROUP);objects[key+'/artifact.tar.gz']=raw;objects[key+'/manifest.json']=json.dumps(manifest).encode()
            with patch.object(store,'request',request),self.assertRaisesRegex(AssertionError,'Unsafe artifact'):store.download(root/'target',REPO,COMMIT,RUN,GROUP)
            self.assertFalse((root/'escaped').exists())
if __name__=='__main__':unittest.main()
