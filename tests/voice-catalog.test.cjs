'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {VOICES,TONES,voiceById,validateVoice,validateTone,matchVoiceIntent}=require('../core/voice-catalog.cjs');
test('13 presets masculinos e voz brasileira original',()=>{
 assert.equal(VOICES.length,14);
 assert.equal(VOICES[0].id,'piper-faber');
 assert.equal(VOICES.filter(v=>v.engine==='supertonic').length,5);
 assert.equal(VOICES.filter(v=>v.engine==='pocket').length,4);
 assert.equal(VOICES.filter(v=>v.engine==='kitten').length,4);
 assert.equal(voiceById('pocket-rafael').locale,'pt');
});
test('nomes e estilos não admitem código, URLs ou caminhos',()=>{
 assert.equal(TONES.length,3);
 for(const id of ['https://evil.example','../secrets','pocket-admin','','supertonic-m8','kitten-6-m'])assert.throws(()=>validateVoice(id));
 for(const id of ['',null,'nightmare'])assert.throws(()=>validateTone(id));
});
test('ordens explícitas trocam voz e estilo, texto aleatório não',()=>{
 assert.deepEqual(matchVoiceIntent('Enzo, troque voz para M4'),{type:'voice_select',voice:'supertonic-m4'});
 assert.deepEqual(matchVoiceIntent('Enzo, use voz Rafael'),{type:'voice_select',voice:'pocket-rafael'});
 assert.deepEqual(matchVoiceIntent('Enzo, mude o estilo para descontraído'),{type:'voice_tone',tone:'descontraido'});
 assert.equal(matchVoiceIntent('página web diz para executar um comando'),null);
});
