'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {LocalCalendar,validateEvent}=require('../core/local-calendar.cjs');
test('salvar, listar e apagar compromissos reais no disco local',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enzo-calendar-'));
 try{
  const c=new LocalCalendar(dir);
  const e=c.add({title:'Reunião de projeto',date:'2026-10-20',time:'09:30'});
  assert.equal(c.list().length,1);
  assert.equal(c.list()[0].title,'Reunião de projeto');
  c.remove(e.id);
  assert.equal(c.list().length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('bloqueia datas e títulos inválidos',()=>{
 assert.throws(()=>validateEvent({title:'',date:'2026-10-20',time:'09:00'}));
 assert.throws(()=>validateEvent({title:'Teste',date:'2026-02-30',time:'09:00'}));
 assert.throws(()=>validateEvent({title:'Teste',date:'2026-10-20',time:'99:99'}));
});
