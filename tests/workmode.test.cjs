'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {intent} = require('../core/intent.cjs');
const {TABS, WorkMode, findBrave, findOpenCodeApp, hasOpenCodeCli, openBraveWorkspace, openOpenCode} = require('../core/workmode.cjs');

test('comandos naturais em português iniciam/encerram modo trabalho', () => {
  for (const text of ['Enzo, iniciar modo trabalho','Enzo, ative o modo de trabalho','vamos trabalhar','ENZO, hora de trabalhar','iniciar expediente','modo trabalho'])
    assert.equal(intent(text).type, 'work_mode_start',text);
  for (const text of ['Enzo, encerrar modo trabalho','desativar modo de trabalho'])
    assert.equal(intent(text).type, 'work_mode_end',text);
  assert.equal(intent('Enzo, pare').type, 'stop');
  assert.equal(intent('Enzo, abra o Brave').type, 'action');
});

test('URLs oficiais são fixas e somente HTTPS', () => {
  assert.deepEqual(TABS, ['https://chatgpt.com/', 'https://claude.ai/']);
  assert.ok(TABS.every(u=>new URL(u).protocol==='https:'));
});

test('Brave usa executável verificado e abre duas abas em uma janela', async () => {
  const calls = [];
  const env={ ProgramFiles:'C:\\Arquivos de Programas' };
  const expected=path.join(env.ProgramFiles,'BraveSoftware','Brave-Browser','Application','brave.exe');
  assert.equal(findBrave(env,p=>p===expected),expected);
  await openBraveWorkspace({platform:'win32',env,exists:p=>p===expected,launch:async(...args)=>calls.push(args)});
  assert.deepEqual(calls,[[expected,['--new-window',...TABS]]]);
});

test('sem Brave, não tenta lançar outro aplicativo', async () => {
  await assert.rejects(openBraveWorkspace({platform:'win32',env:{},exists:()=>false,launch:()=>{throw Error('não pode');}}),/Brave não encontrado/);
});

test('OpenCode procura aplicativo desktop e prioriza antes do terminal', async () => {
  const env={LOCALAPPDATA:'C:\\Users\\Teste\\AppData\\Local'};
  const expected=path.join(env.LOCALAPPDATA,'Programs','OpenCode','OpenCode.exe');
  assert.equal(findOpenCodeApp(env,p=>p===expected),expected);
  const calls=[];
  await openOpenCode({platform:'win32',env,exists:p=>p===expected,probe:()=>{throw Error('não deveria consultar');},launch:async(...args)=>calls.push(args)});
  assert.deepEqual(calls,[[expected,[]]]);
});

test('caminho alternativo do OpenCode só aceita executável aprovado', () => {
  const valid='D:\\Apps\\OpenCode\\OpenCode.exe';
  assert.equal(findOpenCodeApp({ENZO_OPENCODE_PATH:valid},p=>p===valid), valid);
  assert.equal(findOpenCodeApp({ENZO_OPENCODE_PATH:'C:\\Temp\\cmd.exe'},()=>true), null);
  assert.equal(findOpenCodeApp({ENZO_OPENCODE_PATH:'cmd.exe'},()=>true), null);
});

test('OpenCode CLI inicia somente se detectado no PATH', async () => {
  const calls=[];
  assert.equal(hasOpenCodeCli(()=>({status:0})),true);
  assert.equal(hasOpenCodeCli(()=>({status:1})),false);
  await openOpenCode({platform:'win32',env:{USERPROFILE:'C:\\Users\\Teste'},exists:()=>false,probe:()=>({status:0}),launch:async(...args)=>calls.push(args)});
  assert.equal(calls[0][0],'powershell.exe');
  assert.ok(calls[0][1].includes('opencode'));
  await assert.rejects(openOpenCode({platform:'win32',env:{},exists:()=>false,probe:()=>({status:1}),launch:async()=>{throw Error('não');}}),/não encontrado/);
});

test('modo trabalho é idempotente, sem duplicar abas por repetição', async () => {
  let brave=0,editor=0;
  const mode=new WorkMode({openBrowser:async()=>{brave++;return 'Brave OK'},openEditor:async()=>{editor++;return 'OpenCode OK'}});
  const a=await mode.start();const b=await mode.start();
  assert.equal(a.active,true); assert.equal(b.active,true); assert.equal(brave,1); assert.equal(editor,1);
  assert.match(mode.end(),/Mantive as janelas/);
  await mode.start();assert.equal(brave,2);
});

test('falha parcial permite tentar novamente apenas o item ausente', async () => {
  let brave=0,editor=0;
  const mode=new WorkMode({openBrowser:async()=>{brave++;return 'Brave OK';},openEditor:async()=>{editor++;if(editor===1)throw Error('não encontrado');return 'OpenCode OK';},openAssistant:async()=> 'Hermes OK'});
  const a=await mode.start();assert.equal(a.active,true);assert.match(a.say,/parcialmente/);
  const b=await mode.start();assert.equal(brave,1);assert.equal(editor,2);assert.equal(b.errors.length,0);
});

test('Parar Tudo impede iniciar OpenCode após abertura do Brave', async () => {
  let editor=0;
  const mode=new WorkMode({openBrowser:async()=>{mode.end();return 'Brave iniciado';},openEditor:async()=>{editor++;}});
  const r=await mode.start();assert.equal(r.cancelled,true);assert.equal(editor,0);assert.equal(mode.active,false);
});

test('modo trabalho não é aceito fora do Windows no lançador', async () => {
  await assert.rejects(openBraveWorkspace({platform:'linux'}),/Windows/);
  await assert.rejects(openOpenCode({platform:'linux'}),/Windows/);
});
