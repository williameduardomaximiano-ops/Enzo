'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Recovery}=require('../core/recovery.cjs');
function temp(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-recovery-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('backup preserva chaves e dados, com restauração protegida',()=>temp(dir=>{
 fs.writeFileSync(path.join(dir,'settings.json'),'{"voice":"Faber"}');
 fs.writeFileSync(path.join(dir,'vault.enc'),'segredo-cifrado');
 const rec=new Recovery(dir);
 const old=rec.backup('manual');
 assert.equal(rec.list()[0].id,old.id);
 fs.writeFileSync(path.join(dir,'settings.json'),'{"voice":"M2"}');
 const result=rec.restore(old.id);
 assert.equal(fs.readFileSync(path.join(dir,'settings.json'),'utf8'),'{"voice":"Faber"}');
 assert.ok(result.safetyBackup);
 assert.equal(rec.list().length,2);
}));
test('não restaura se hash diverge e mantém arquivo existente',()=>temp(dir=>{
 fs.writeFileSync(path.join(dir,'settings.json'),'original');
 const rec=new Recovery(dir),a=rec.backup('manual');
 fs.writeFileSync(path.join(dir,'settings.json'),'atual');
 fs.writeFileSync(path.join(dir,'cosmo-backups',a.id,'settings.json'),'adulterado');
 assert.throws(()=>rec.restore(a.id),/Integridade/);
 assert.equal(fs.readFileSync(path.join(dir,'settings.json'),'utf8'),'atual');
 assert.throws(()=>rec.restore('../../etc/passwd'),/Identificador/);
}));
test('arquivos fora da lista de dados do usuário nunca entram no backup',()=>temp(dir=>{
 fs.writeFileSync(path.join(dir,'arbitrary.exe'),'virus');
 const rec=new Recovery(dir);const a=rec.backup('manual');
 assert.deepEqual(a.files,[]);
}));
