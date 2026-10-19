'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {NAME,stripInvocation}=require('../core/assistant-identity.cjs');
const {intent}=require('../core/intent.cjs');
const {modeIntent}=require('../core/mode-intents.cjs');
const {matchVoiceIntent}=require('../core/voice-catalog.cjs');
const {avatarIntent}=require('../core/avatar-presets.cjs');

test('COSMO é a identidade oficial e Enzo permanece alias legado',()=>{
  assert.equal(NAME,'COSMO');
  assert.equal(stripInvocation('Ei, Cosmo, abra a calculadora'),'abra a calculadora');
  assert.equal(stripInvocation('Cosmo, que horas são?'),'que horas são?');
  assert.equal(stripInvocation('Enzo, que horas são?'),'que horas são?');
  assert.equal(stripInvocation('Cosmopolitan'), 'Cosmopolitan');
  assert.equal(stripInvocation('conversa com Cosmo'), 'conversa com Cosmo');
});
test('COSMO entende comandos normais pelo interpretador local',()=>{
  assert.equal(intent('Ei, Cosmo, que horas são?').type,'time');
  assert.equal(intent('Cosmo, abra a calculadora').action.app,'calculadora');
  assert.equal(intent('Enzo, abra a calculadora').action.app,'calculadora');
  assert.equal(intent('Ei, Cosmo, abrir https://example.org').action.url,'https://example.org');
});
test('COSMO entende modos, vozes e avatares sem LLM',()=>{
  assert.equal(modeIntent('Ei, Cosmo, liste meus modos').type,'mode_list');
  assert.deepEqual(matchVoiceIntent('Ei, Cosmo, troque a voz para M2'),{type:'voice_select',voice:'supertonic-m2'});
  assert.deepEqual(avatarIntent('Ei, Cosmo, troque o visual para Humanoide Azul'),{type:'avatar_select',avatar:'humanoid-blue'});
});
test('a atualização preserva dados antigos e canal de assinatura já instalado',()=>{
  const root=path.join(__dirname,'..');
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const nsis=fs.readFileSync(path.join(root,'scripts/installer.nsi'),'utf8');
  assert.equal(cfg.name,'enzo-assistente');
  assert.equal(cfg.build.appId,'studio.agape.enzo');
  assert.equal(cfg.build.productName,'COSMO');
  assert.equal(cfg.build.win.artifactName,'ENZO-${version}-Windows-x64.${ext}');
  assert.match(nsis,/InstallDir "\$LOCALAPPDATA\\Programs\\ENZO"/);
  assert.match(nsis,/Name "COSMO"/);
  assert.match(nsis,/CreateShortcut "\$DESKTOP\\COSMO\.lnk" "\$INSTDIR\\COSMO\.exe"/);
  assert.match(nsis,/Uninstall\\ENZO/);
});
