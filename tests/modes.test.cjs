'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {ModeStore,VoiceModes,parseTargets,normalizeName,BUILTIN_WORK}=require('../core/modes.cjs');
const {intent}=require('../core/intent.cjs');
const {findHermesApp,hasHermesCli,openHermes,WorkMode,TABS}=require('../core/workmode.cjs');

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'enzo-modes-'));}

test('Hermes integra padrão do Modo Trabalho',async()=>{
 assert.deepEqual(TABS,['https://chatgpt.com/','https://claude.ai/']);
 let calls=[];const m=new WorkMode({openBrowser:async()=>{calls.push('brave');return 'Brave'},openEditor:async()=>{calls.push('opencode');return 'OpenCode'},openAssistant:async()=>{calls.push('hermes');return 'Hermes'}});
 await m.start();await m.start();assert.deepEqual(calls,['brave','opencode','hermes']);
 assert.match(m.end(),/Mantive/);
 await m.start();assert.equal(calls.length,6);
});
test('Hermes executável e CLI aceitam somente caminhos e comandos previamente permitidos',async()=>{
 const custom='C:\\Apps\\Hermes\\Hermes.exe';assert.equal(findHermesApp({ENZO_HERMES_PATH:custom},p=>p===custom),custom);
 assert.equal(findHermesApp({ENZO_HERMES_PATH:'C:\\Apps\\cmd.exe'},()=>true),null);
 assert.equal(hasHermesCli(()=>({status:0})),true);
 assert.equal(hasHermesCli(()=>({status:1})),false);
 const calls=[];
 await openHermes({platform:'win32',env:{ENZO_HERMES_PATH:custom},exists:p=>p===custom,launch:async(...args)=>calls.push(args)});
 assert.deepEqual(calls,[[custom,[]]]);
 const cli=[];
 await openHermes({platform:'win32',env:{USERPROFILE:'C:\\Users\\Teste'},exists:()=>false,probe:()=>({status:0}),launch:async(...args)=>cli.push(args)});
 assert.equal(cli[0][0],'powershell.exe');assert.ok(cli[0][1].includes('hermes'));
 await assert.rejects(openHermes({platform:'win32',env:{},exists:()=>false,probe:()=>({status:1})}),/não encontrado/);
});
test('Intenções de voz para salvar, iniciar, editar, listar e excluir modos',()=>{
 const samples={
 'Enzo, salve o modo pesquisa com Brave, ChatGPT e Hermes':'mode_save',
 'Enzo, crie o modo estudo com YouTube e Claude':'mode_save',
 'Enzo, salve o modo trabalho':'mode_save_existing',
 'Enzo, adicione o YouTube ao modo pesquisa':'mode_add',
 'Enzo, remova Hermes do modo pesquisa':'mode_remove',
 'Enzo, inicie o modo pesquisa':'mode_start',
 'Enzo, encerre o modo pesquisa':'mode_end',
 'Enzo, liste meus modos':'mode_list',
 'Enzo, apague o modo pesquisa':'mode_delete',
 'Enzo, iniciar modo trabalho':'work_mode_start',
 'Enzo, vamos trabalhar':'work_mode_start'
 };
 for(const [s,expected]of Object.entries(samples))assert.equal(intent(s).type,expected,s);
});
test('Lista explícita bloqueia shell, URLs arbitrárias e comandos estranhos',()=>{
 assert.deepEqual(parseTargets('Brave, ChatGPT e Hermes'),['brave','chatgpt','hermes']);
 for(const input of ['powershell','cmd.exe','https://exemplo.com','Brave e apagar arquivos','OpenCode && whoami','YouTube; rm -rf /'])assert.throws(()=>parseTargets(input),/Não reconheci/);
 assert.throws(()=>normalizeName('../pasta'),/Nome inválido/);
});
test('Modo é salvo no userData e retorna após reiniciar sem afetar credenciais',()=>{
 const dir=temp();try{
  const store=new ModeStore(dir);assert.deepEqual(store.get('trabalho'),BUILTIN_WORK);
  store.save('pesquisa',parseTargets('Brave, ChatGPT e Hermes'));
  const disk=fs.readFileSync(path.join(dir,'modes.json'),'utf8');assert.match(disk,/pesquisa/);
  const restored=new ModeStore(dir);assert.deepEqual(restored.get('pesquisa'),['brave','chatgpt','hermes']);
  restored.add('pesquisa',parseTargets('YouTube'));assert.deepEqual(restored.get('pesquisa'),['brave','chatgpt','hermes','youtube']);
  restored.remove('pesquisa',parseTargets('Hermes'));assert.equal(restored.get('pesquisa').includes('hermes'),false);
  restored.delete('pesquisa');assert.equal(new ModeStore(dir).get('pesquisa'),null);
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('Modo salvo nunca abre URL fora da lista e não duplica durante sessão',async()=>{
 const dir=temp();try{
  const store=new ModeStore(dir);store.save('escritorio',['brave','chatgpt','claude','hermes']);
  let browsers=[],hermes=0;
  const modes=new VoiceModes(store,{openBrowser:async x=>{browsers.push(x.urls);return 'Brave'},launchTarget:async key=>{assert.equal(key,'hermes');hermes++;return 'Hermes'}});
  await modes.start('escritorio');await modes.start('escritorio');
  assert.deepEqual(browsers,[['https://chatgpt.com/','https://claude.ai/']]);assert.equal(hermes,1);
  modes.end('escritorio');await modes.start('escritorio');assert.equal(hermes,2);
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('Parar Tudo impede abrir o próximo programa do modo salvo',async()=>{
 const dir=temp();try{
  const store=new ModeStore(dir);store.save('estudo',['chatgpt','hermes']);let started=0;
  const modes=new VoiceModes(store,{openBrowser:async()=>{modes.stop();return 'Brave'},launchTarget:async()=>{started++;}});
  const result=await modes.start('estudo');assert.equal(result.cancelled,true);assert.equal(started,0);
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('Não sobrescreve arquivo corrompido silenciosamente',()=>{
 const dir=temp();try{fs.writeFileSync(path.join(dir,'modes.json'),'{ruim');const broken=new ModeStore(dir);assert.match(broken.loadError,/Não foi possível ler/);assert.throws(()=>broken.save('teste',['brave']),/Não foi possível ler/);assert.equal(fs.readFileSync(path.join(dir,'modes.json'),'utf8'),'{ruim');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
