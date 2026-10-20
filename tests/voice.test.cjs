const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {spawnSync}=require('node:child_process');const {Voice}=require('../core/voice.cjs');
function findPython(){
 const cands=[process.env.ENZO_PYTHON,'python3','python'].filter(Boolean);
 for(const bin of cands){try{const r=spawnSync(bin,['--version'],{stdio:'ignore',windowsHide:true});if(!r.error&&r.status===0)return bin;}catch{}}
 throw Error('Nenhum interpretador Python encontrado (ENZO_PYTHON, python3 ou python).');
}
test('worker de voz responde saúde, rejeita operação e reinicia após cancelamento',async()=>{const root=path.join(__dirname,'..');const v=new Voice(findPython(),path.join(root,'voice/worker.py'),path.join(root,'resources/models'));try{const r=await v.call('health');assert.equal(typeof r.tts,'boolean');await assert.rejects(v.call('arbitrary_shell'));v.stop();await new Promise(r=>setTimeout(r,100));assert.equal(typeof(await v.call('health')).stt,'boolean');}finally{v.stop()}});
test('worker de voz que morre não derruba o app (write EOF) e o pedido é refeito num processo novo',async()=>{const fs=require('node:fs'),os=require('node:os');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-voz-'));const py=findPython();
 const dead=path.join(dir,'dead.py');fs.writeFileSync(dead,'import sys\nsys.stderr.write("modelo corrompido\\n")\nsys.exit(3)\n');
 const v=new Voice(py,dead,dir);await assert.rejects(v.call('speak',{text:'oi'}),/Serviço de voz parou/);await assert.rejects(v.call('health'),/Serviço de voz parou/);v.stop();
 const mark=path.join(dir,'mark');const flaky=path.join(dir,'flaky.py');fs.writeFileSync(flaky,`import json,os,sys\nm=${JSON.stringify(mark)}\nif not os.path.exists(m):\n    open(m,'w').close()\n    sys.exit(1)\nfor line in sys.stdin:\n    r=json.loads(line)\n    print(json.dumps({'id':r['id'],'result':{'ok':r['op']}}),flush=True)\n`);
 const w=new Voice(py,flaky,dir);try{assert.equal((await w.call('health')).ok,'health');}finally{w.stop();fs.rmSync(dir,{recursive:true,force:true});}});
