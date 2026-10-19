'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MemoryStore}=require('../core/local-memory.cjs');
const {intent}=require('../core/intent.cjs');
const key=0x5a;
const encrypt=s=>Buffer.from(s,'utf8').map(v=>v^key);
const decrypt=b=>Buffer.from(b).map(v=>v^key).toString('utf8');
function temp(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-memory-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('memória permanece cifrada, pesquisável, removível e entre reinícios',()=>temp(dir=>{
 const mem=new MemoryStore(dir,{encrypt,decrypt});const note='Prefiro sites responsivos com SEO local';
 const entry=mem.add(note);
 assert.ok(!fs.readFileSync(path.join(dir,'memory-v1.enc'),'utf8').includes(note));
 assert.equal(mem.search('sites SEO')[0].id,entry.id);
 const reloaded=new MemoryStore(dir,{encrypt,decrypt});
 assert.equal(reloaded.list()[0].text,note);
 assert.equal(reloaded.remove(entry.id),true);
 assert.equal(reloaded.search('SEO').length,0);
}));
test('recusa segredos e arquivo corrompido sem sobrescrever',()=>temp(dir=>{
 let mem=new MemoryStore(dir,{encrypt,decrypt});
 assert.throws(()=>mem.add('Minha chave é gsk_12345678901234567890'),/segredos/);
 fs.writeFileSync(path.join(dir,'memory-v1.enc'),'invalid');
 mem=new MemoryStore(dir,{encrypt,decrypt});
 assert.match(mem.readError,/preservado/);
 assert.throws(()=>mem.add('Uma preferência importante sobre projetos'),/preservado/);
 assert.equal(fs.readFileSync(path.join(dir,'memory-v1.enc'),'utf8'),'invalid');
}));
test('comando vocal apenas salva explicitamente e pesquisa localmente',()=>{
 assert.equal(intent('Ei, Cosmo, memorize que prefiro sites com SEO local').type,'memory_add');
 assert.equal(intent('Cosmo, o que você lembra sobre sites?').type,'memory_search');
});
