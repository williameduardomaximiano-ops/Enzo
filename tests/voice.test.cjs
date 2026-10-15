const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {spawnSync}=require('node:child_process');const {Voice}=require('../core/voice.cjs');
function findPython(){
 const cands=[process.env.ENZO_PYTHON,'python3','python'].filter(Boolean);
 for(const bin of cands){try{const r=spawnSync(bin,['--version'],{stdio:'ignore',windowsHide:true});if(!r.error&&r.status===0)return bin;}catch{}}
 throw Error('Nenhum interpretador Python encontrado (ENZO_PYTHON, python3 ou python).');
}
test('worker de voz responde saúde, rejeita operação e reinicia após cancelamento',async()=>{const root=path.join(__dirname,'..');const v=new Voice(findPython(),path.join(root,'voice/worker.py'),path.join(root,'resources/models'));try{const r=await v.call('health');assert.equal(typeof r.tts,'boolean');await assert.rejects(v.call('arbitrary_shell'));v.stop();await new Promise(r=>setTimeout(r,100));assert.equal(typeof(await v.call('health')).stt,'boolean');}finally{v.stop()}});
