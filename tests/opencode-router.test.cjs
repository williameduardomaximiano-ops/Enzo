'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const llm=require('../core/llm.cjs');
const local=require('../core/opencode.cjs');

test('OpenCode faz conversa, ferramentas e visão sem chamar APIs comerciais',async()=>{
 const original={chatAuto:local.chatAuto,chatTools:local.chatTools,vision:local.vision};
 const calls=[];
 try{
  local.chatAuto=async(messages,opts,signal,system)=>{
   calls.push(['chat',opts.provider,messages[0].content]);return {say:'Resposta local.'};
  };
  local.chatTools=async(transcript,tools,opts,signal,system)=>{
   calls.push(['tools',opts.provider,tools.length]);return {text:'Sem ação',calls:[]};
  };
  local.vision=async(prompt,image,opts,signal)=>{
   calls.push(['vision',opts.provider,prompt]);return 'Imagem analisada';
  };
  const opts={provider:'opencode'};
  // Mesmo sem chaves, o OpenCode pode ser o provedor principal.
  assert.equal((await llm.chatAuto([{role:'user',content:'Oi'}],opts,{})).say,'Resposta local.');
  assert.equal((await llm.chatTools([{role:'user',content:'Oi'}],[],opts,{},null,'sistema')).text,'Sem ação');
  assert.equal(await llm.vision('Olhe a tela',{mime:'image/jpeg',data:'AA=='},opts,{}),'Imagem analisada');
  assert.deepEqual(calls.map(x=>x[0]),['chat','tools','vision']);
 }finally{Object.assign(local,original);}
});
test('Falha OpenCode não pode reativar Groq, Gemini ou Claude silenciosamente',async()=>{
 const original=local.chatAuto;
 try{
  local.chatAuto=async()=>{throw Error('OpenCode indisponível');};
  await assert.rejects(llm.chatAuto([{role:'user',content:'Oi'}],{provider:'opencode'},{
   groq:'test-groq-key-12345678',gemini:'test-gemini-key-12345678',
   anthropic:'test-claude-key-12345678'
  }),/OpenCode indisponível/);
 }finally{local.chatAuto=original;}
});
