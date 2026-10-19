'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseWindows,observeWindows,SCRIPT}=require('../core/windows-observer.cjs');
test('interpreta dados de janelas sem capturar texto interno',()=>{
 const v=parseWindows(JSON.stringify([{title:'Brave - Ágape Studio',processId:1234},{title:'COSMO',processId:4321}]));
 assert.equal(v.length,2);assert.equal(v[0].title,'Brave - Ágape Studio');
 assert.ok(!SCRIPT.includes('Get-Content'));
});
test('rejeita resposta UIAutomation inválida',()=>assert.throws(()=>parseWindows('texto'),/inválidos/));
test('não tenta observar janelas fora do Windows',async()=>assert.rejects(observeWindows({platform:'linux'}),/Windows/));
test('observação usa script fixo sem shell arbitrário',async()=>{
 let opts,args;
 const windows=await observeWindows({platform:'win32',run:(exe,a,o,cb)=>{args=a;opts=o;cb(null,JSON.stringify([{title:'Editor',processId:42}]))}});
 assert.equal(opts.shell,false);assert.ok(args.includes('-EncodedCommand'));assert.equal(windows[0].title,'Editor');
});
