'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Agenda,validDate}=require('../core/agenda.cjs');
const {createMonitor}=require('../core/system-monitor.cjs');
test('datas de agenda são verificadas',()=>{
  assert.equal(validDate('2026-10-15T15:30'),true);
  assert.equal(validDate('2026-02-31T15:30'),false);
  assert.equal(validDate('2026-10-15T25:30'),false);
  assert.equal(validDate('um texto'),false);
});
test('compromissos permanecem locais e podem ser removidos',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enzo-agenda-'));
  try{
    const a=new Agenda(dir);
    assert.deepEqual(a.list(),[]);
    const item=a.create({title:'Reunião',startsAt:'2026-10-15T15:30'});
    assert.equal(a.list().length,1);
    assert.equal(a.list()[0].title,'Reunião');
    assert.equal(a.remove(item.id),true);
    assert.deepEqual(a.list(),[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('agenda recusa dados grandes ou inválidos',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enzo-agenda-'));
  try{
    const a=new Agenda(dir);
    assert.throws(()=>a.create({title:'',startsAt:'2026-10-15T15:30'}));
    assert.throws(()=>a.create({title:'x'.repeat(101),startsAt:'2026-10-15T15:30'}));
    assert.throws(()=>a.remove('../index'));
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('monitor retorna valores válidos, sem inventar temperatura',()=>{
  const m=createMonitor().snapshot();
  assert.ok(m.ramUsedGB>=0 && m.ramTotalGB>0);
  assert.equal(m.temperatureC,null);
  assert.ok(m.logicalCores>=1);
});
