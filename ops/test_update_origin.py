import hashlib,importlib.util,json,pathlib,tempfile,unittest
import sys
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).parent))

spec=importlib.util.spec_from_file_location('origin_update',pathlib.Path(__file__).with_name('update-origin.py'))
updater=importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)

class OriginReleaseBoundaryTests(unittest.TestCase):
    def test_successful_ci_for_another_sha_never_replaces_the_installed_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);state=root/'private';install=root/'installed';install.mkdir();bundle=install/'server.cjs';bundle.write_text('existing bundle')
            def gh(*args):
                if args[0]=='api':return 'a'*40+'\n'
                if args[0]=='run' and args[1]=='list':return json.dumps([{'databaseId':1,'headSha':'b'*40,'headBranch':'main','conclusion':'success','status':'completed'}])
                raise AssertionError('A mismatched-SHA artifact must not be downloaded')
            with patch.object(updater,'STATE',state),patch.object(updater,'INSTALL',install),patch.object(updater,'gh',gh),patch.object(updater.subprocess,'run') as restart:
                updater.main()
                restart.assert_not_called()
            self.assertEqual(bundle.read_text(),'existing bundle')

    def test_artifact_digest_mismatch_never_replaces_the_installed_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);state=root/'private';install=root/'installed';install.mkdir();bundle=install/'server.cjs';bundle.write_text('existing bundle')
            def gh(*args):
                if args[0]=='api':return 'a'*40+'\n'
                if args[0]=='run' and args[1]=='list':return json.dumps([{'databaseId':1,'headSha':'a'*40,'headBranch':'main','conclusion':'success','status':'completed'}])
                raise AssertionError('Unexpected GitHub operation')
            def download(root,*args):
                artifact=pathlib.Path(root);(artifact/'server.cjs').write_text('tampered bundle');(artifact/'release.json').write_text(json.dumps({'commit':'a'*40,'sha256':hashlib.sha256(b'expected bundle').hexdigest()}))
            with patch.object(updater,'STATE',state),patch.object(updater,'INSTALL',install),patch.object(updater,'gh',gh),patch.object(updater.artifact_store,'download',download),patch.object(updater.subprocess,'run') as restart:
                with self.assertRaisesRegex(AssertionError,'digest mismatch'):updater.main()
                restart.assert_not_called()
            self.assertEqual(bundle.read_text(),'existing bundle')

if __name__=='__main__':unittest.main()
