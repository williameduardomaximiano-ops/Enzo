// Provedor Claude (Anthropic) pelo SDK oficial: conversa, ferramentas (tool use) e visão.
const Anthropic=require('@anthropic-ai/sdk');const Client=Anthropic.default||Anthropic;

// Respostas do COSMO: Claude Haiku 5.5 (rápido e barato). Projetos: Claude Sonnet 5.5 no agente (ver agent.cjs).
const DEFAULT_MODEL='claude-haiku-5-5';
const MODEL_RE=/^[-\w.:]{1,100}$/;
// Recusa de segurança: nos modelos que suportam, o servidor reenvia ao modelo de reserva indicado pela Anthropic.
// O Haiku não tem essa reserva no servidor; a recusa vira erro e o COSMO tenta o próximo provedor.
const FALLBACK={betas:['server-side-fallback-2026-07-01'],fallbacks:'default'};
function fallbackFor(model){return /^claude-(opus|fable|sonnet)-/.test(model)?FALLBACK:{};}

function makeClient(apiKey){if(typeof apiKey!=='string'||apiKey.length<8)throw Error('Chave Claude inválida.');return new Client({apiKey,maxRetries:1,timeout:90000,...(process.env.ENZO_ANTHROPIC_BASE?{baseURL:process.env.ENZO_ANTHROPIC_BASE}:{})});}
function modelOf(m){const model=m||DEFAULT_MODEL;if(!MODEL_RE.test(model))throw Error('Modelo Claude inválido.');return model;}

// Transcrição neutra do COSMO -> mensagens da API. Respostas anteriores do Claude voltam sem alteração (inclui blocos de raciocínio).
function toAnthropic(transcript){const out=[];
 const push=(role,content)=>{const last=out[out.length-1];if(last&&last.role===role&&Array.isArray(last.content)&&Array.isArray(content)&&role==='user'&&last.content.every(b=>b.type==='tool_result')&&content.every(b=>b.type==='tool_result'))last.content.push(...content);else out.push({role,content});};
 for(const m of transcript){
  if(m.role==='tool')push('user',[{type:'tool_result',tool_use_id:m.id,content:String(m.content),...(String(m.content).startsWith('ERRO:')?{is_error:true}:{})}]);
  else if(m.role==='assistant'){if(m.raw?.anthropic)push('assistant',m.raw.anthropic);else if(m.calls?.length)push('assistant',[...(m.content?[{type:'text',text:m.content}]:[]),...m.calls.map(c=>({type:'tool_use',id:String(c.id).replace(/[^\w-]/g,'_'),name:c.name,input:c.args||{}}))]);else push('assistant',String(m.content||'…'));}
  else push('user',m.image?[{type:'image',source:{type:'base64',media_type:m.image.mime,data:m.image.data}},{type:'text',text:String(m.content||'')}]:String(m.content||''));}
 if(out[0]?.role!=='user')out.unshift({role:'user',content:'(início da conversa)'});
 return out;}
function errorOf(e){const status=e?.status;if(status===401||status===403)return Error('Chave Claude rejeitada (401/403). Verifique o cofre.');if(status===429)return Error('Claude: limite de uso atingido, tente em instantes.');if(status===404)return Object.assign(Error('Claude: modelo não encontrado.'),{modelMissing:true});if(status>=500)return Error('Claude indisponível no momento.');return Error('Claude: '+String(e?.message||'falha').slice(0,200));}
function textOf(content){return (content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();}

async function create(apiKey,params,signal){
 const client=makeClient(apiKey);let r;
 try{r=await client.beta.messages.create({...params,...fallbackFor(params.model)},{signal});}catch(e){if(signal?.aborted)throw e;throw errorOf(e);}
 if(r.stop_reason==='refusal')throw Error('O Claude recusou este pedido.');
 return r;}

// Uma rodada do cérebro com ferramentas.
async function claudeTools(transcript,tools,{model,apiKey,signal,system,effort='medium'}){
 const r=await create(apiKey,{model:modelOf(model),max_tokens:16000,system,messages:toAnthropic(transcript),...(tools.length?{tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}))}:{}),output_config:{effort}},signal);
 const calls=r.content.filter(b=>b.type==='tool_use').map(b=>({id:b.id,name:b.name,args:b.input||{}}));
 return {text:textOf(r.content),calls,raw:{anthropic:r.content}};}
// Conversa simples (sem ferramentas), respostas curtas para voz.
async function claudeChat(messages,{model,apiKey,signal,system}){
 const r=await create(apiKey,{model:modelOf(model),max_tokens:16000,system,messages:toAnthropic(messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content}))),output_config:{effort:'low'}},signal);
 return textOf(r.content);}
async function claudeVision(prompt,image,{model,apiKey,signal}){
 const r=await create(apiKey,{model:modelOf(model),max_tokens:16000,system:'Você analisa capturas de tela para o assistente COSMO. Seja preciso e objetivo.',messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:image.mime,data:image.data}},{type:'text',text:prompt}]}],output_config:{effort:'medium'}},signal);
 return textOf(r.content);}

module.exports={claudeTools,claudeChat,claudeVision,toAnthropic,DEFAULT_MODEL,FALLBACK};
