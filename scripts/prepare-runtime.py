"""Prepare Windows runtime on Linux or Windows, validating every downloaded asset."""
import pathlib,sys,json,urllib.request,hashlib,zipfile,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
runtime=root/'resources';runtime.mkdir(exist_ok=True)
for asset in json.loads((root/'resources-lock.json').read_text()):
    p=runtime/asset['path'];p.parent.mkdir(parents=True,exist_ok=True)
    if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=asset['sha256']:
        tmp=p.with_suffix(p.suffix+'.part');print('Baixando',p.name,flush=True)
        urllib.request.urlretrieve(asset['url'],tmp)
        if tmp.stat().st_size!=asset['size'] or hashlib.sha256(tmp.read_bytes()).hexdigest()!=asset['sha256']:
            tmp.unlink();raise RuntimeError('Hash inválido: '+p.name)
        tmp.replace(p)
py=runtime/'python';py.mkdir(exist_ok=True)
with zipfile.ZipFile(runtime/'python-embed.zip') as z:z.extractall(py)
(py/'python311._pth').write_text('python311.zip\n.\nLib/site-packages\nimport site\n')
wheels=root/'.build-wheels';wheels.mkdir(exist_ok=True)
subprocess.run([sys.executable,'-m','pip','download','--require-hashes','--only-binary=:all:','--platform','win_amd64','--python-version','311','--implementation','cp','--abi','cp311','--dest',str(wheels),'-r',str(root/'voice/requirements-windows.txt')],check=True)
site=py/'Lib/site-packages';site.mkdir(parents=True,exist_ok=True)
for w in wheels.glob('*.whl'):
    with zipfile.ZipFile(w) as z:z.extractall(site)
(runtime/'python-embed.zip').unlink()
print('Runtime preparado; ainda exige teste no Windows.')
