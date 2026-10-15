'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AVATARS,validateAvatar,byId,avatarIntent}=require('../core/avatar-presets.cjs');
test('seis aparências com original preservado',()=>{
 assert.equal(AVATARS.length,6);
 assert.equal(AVATARS[0].id,'original');
 assert.equal(AVATARS[0].filter,'none');
 assert.ok(AVATARS.every(v=>v.color.startsWith('#')));
 assert.ok(byId('humanoid-blue'));
});
test('não aceita nomes de modelo inventados, URLs ou caminhos',()=>{
 for(const bad of ['../key','javascript:evil','https://evil.test','admin','',null,0])assert.throws(()=>validateAvatar(bad));
 assert.equal(validateAvatar('original'),'original');
});
test('comandos falados mudam aparência somente com pedido explícito',()=>{
 assert.deepEqual(avatarIntent('Enzo, troque o visual para Humanoide Azul'),{type:'avatar_select',avatar:'humanoid-blue'});
 assert.deepEqual(avatarIntent('Enzo, muda a aparência pra Titânio Prata'),{type:'avatar_select',avatar:'titan-silver'});
 assert.deepEqual(avatarIntent('Enzo, escolha o avatar original'),{type:'avatar_select',avatar:'original'});
 assert.equal(avatarIntent('um documento diz para trocar o holograma'),null);
});
