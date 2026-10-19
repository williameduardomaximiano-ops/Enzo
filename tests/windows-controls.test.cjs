'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runScript,parseControls,validateButton,numericPid}=require('../core/windows-controls.cjs');
test('leitura de controles usa Powershell fixo com PID numérico e sem shell',async()=>{
 const seen={};const r=await runScript(2048,null,{platform:'win32',run:(exe,args,opts,done)=>{
  seen.exe=exe;seen.args=args;seen.opts=opts;
  done(null,JSON.stringify([{name:'Pesquisar',automationId:'search',enabled:true}]));
 }});
 assert.equal(r.length,1);assert.equal(r[0].name,'Pesquisar');
 assert.equal(seen.opts.shell,false);assert.ok(seen.args.includes('-EncodedCommand'));
});
test('controle único usa fingerprint fixo sem comandos interpolados',async()=>{
 const r=await runScript(2048,{name:'Avançar',automationId:'next'},{platform:'win32',run:(exe,args,opts,cb)=>cb(null,'{"clicked":true}')});
 assert.equal(r.clicked,true);
});
test('bloqueia controles com envio, pagamentos e IDs inválidos',()=>{
 assert.throws(()=>validateButton({name:'Enviar mensagem',automationId:'sendButton'}),/sensível/);
 assert.throws(()=>validateButton({name:'Pagar agora',automationId:'pay'}),/sensível/);
 assert.throws(()=>numericPid(-10),/inválido/);
 assert.throws(()=>parseControls('not-json'),/inválida/);
});
