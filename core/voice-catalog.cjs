'use strict';
const {stripInvocation}=require('./assistant-identity.cjs');
/** Lista fixa de vozes autorizadas. Nunca converter nomes recebidos em comandos ou URLs. */
const VOICES=Object.freeze([
  {id:'piper-faber',name:'Faber (voz atual)',engine:'piper',locale:'pt-BR',note:'Voz brasileira original do COSMO'},
  ...['M1','M2','M3','M4','M5'].map(name=>({id:'supertonic-'+name.toLowerCase(),name:'Supertonic '+name,engine:'supertonic',locale:'pt',note:'Português; verificar sotaque brasileiro'})),
  {id:'pocket-rafael',name:'PocketTTS Rafael',engine:'pocket',locale:'pt',note:'Português; verificar sotaque brasileiro'},
  ...['George','Michael','Paul'].map(name=>({id:'pocket-'+name.toLowerCase(),name:'PocketTTS '+name,engine:'pocket',locale:'en',note:'Referência em inglês; pronúncia pt-BR não garantida'})),
  ...[2,3,4,5].map(number=>({id:'kitten-'+number+'-m',name:'KittenTTS masculina '+number,engine:'kitten',locale:'en',note:'Somente inglês; suporte experimental'}))
].map(v=>Object.freeze(v)));
const TONES=Object.freeze([
  {id:'natural',name:'Natural',speed:1},
  {id:'profissional',name:'Profissional',speed:0.93},
  {id:'descontraido',name:'Descontraído',speed:1.12}
].map(x=>Object.freeze(x)));
function voiceById(id){return VOICES.find(v=>v.id===id)||null}
function toneById(id){return TONES.find(t=>t.id===id)||null}
function validateVoice(id){if(typeof id!=='string'||!voiceById(id))throw Error('Voz desconhecida ou não autorizada');return id}
function validateTone(id){if(typeof id!=='string'||!toneById(id))throw Error('Estilo de voz desconhecido');return id}
function matchVoiceIntent(text){
 if(typeof text!=='string')return null;
 const s=stripInvocation(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.!?]/g,'').trim();
 let m=s.match(/^(?:(?:mude|mudar|troque|trocar|altere|alterar|coloque|use|usar)(?: a|minha)? voz (?:para |pra |pro |do |da )?|(?:escolha |selecione )?(?:a )?voz )(?:(supertonic|pockettts|pocket|kitten(?:tts)?) )?(m[1-5]|faber|rafael|george|michael|paul|[2-5](?: masculina)?)$/);
 if(m){
  const id=m[2];
  const engine=m[1];
  if(id==='faber')return {type:'voice_select',voice:'piper-faber'};
  if(/^m[1-5]$/.test(id))return {type:'voice_select',voice:'supertonic-'+id};
  if(/^[2-5]/.test(id))return {type:'voice_select',voice:'kitten-'+id[0]+'-m'};
  if(['rafael','george','michael','paul'].includes(id))return {type:'voice_select',voice:'pocket-'+id};
 }
 m=s.match(/^(?:mude|mudar|troque|trocar|altere|alterar|coloque|use|usar)(?: o)? estilo (?:de voz )?(?:para |pra )?(natural|profissional|descontraido)$/);
 return m?{type:'voice_tone',tone:m[1]}:null;
}
module.exports={VOICES,TONES,voiceById,toneById,validateVoice,validateTone,matchVoiceIntent};
