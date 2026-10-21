// Ponte isolada do COSMO com o servidor local do OpenCode.
// Nunca usa chave de outras APIs, nem expõe ferramentas do PC ao agente OpenCode.
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {findBin}=require('./agent.cjs');
let proc=null, address='', password='';
const timeout=(signal,ms)=>signal?AbortSignal.any([signal,AbortSignal.timeout(ms)]):AbortSignal.timeout(ms);
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function request(method,route,body,signal,ms=20000){
 const auth='Basic '+Buffer.from('cosmo:'+password).toString('base64');
 const r=await fetch(address+route,{method,headers:{'Content-Type':'application/json',Authorization:auth},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:timeout(signal,ms)});
 if(!r.ok){let message='';try{const d=await r.json();message=String(d?.data?.message||d?.error?.message||d?.message||'').slice(0,150);}catch{}
  const e=Error('OpenCode HTTP '+r.status+(message?': '+message:''));e.status=r.status;throw e;}
 return r.status===204?null:r.json();
}
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
async function ensure(){
 if(proc&&proc.exitCode===null&&address)return;
 const bin=findBin('opencode');if(!bin)throw Error('OpenCode CLI não encontrado neste computador. Confira a instalação e o PATH.');
 const port=await freePort(),cwd=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-opencode-'));
 password=crypto.randomBytes(32).toString('hex');address='http://127.0.0.1:'+port;
 const env={...process.env,OPENCODE_SERVER_USERNAME:'cosmo',OPENCODE_SERVER_PASSWORD:password,
  OPENCODE_CONFIG_CONTENT:JSON.stringify({permission:{'*':'deny'}})};
 proc=spawn(bin,['serve','--hostname','127.0.0.1','--port',String(port)],{cwd,env,stdio:'ignore',windowsHide:true,shell:process.platform==='win32'&&/\.cmd$/i.test(bin)});
 const p=proc;p.on('error',()=>{});p.on('close',()=>{if(proc===p){proc=null;address='';password='';}try{fs.rmSync(cwd,{recursive:true,force:true});}catch{}});
 for(let i=0;i<40;i++){await sleep(250);if(p.exitCode!==null)break;try{if((await request('GET','/global/health',undefined,null,800))?.healthy)return;}catch{}}
 try{p.kill();}catch{}
 throw Error('Não foi possível iniciar o servidor seguro do OpenCode. Teste opencode serve no Windows.');
}
function isFree(id,m){
 const title=(String(id)+' '+String(m?.name||'')).toLowerCase();
 const costs=Object.values(m?.cost||{}).flatMap(x=>typeof x==='object'&&x?Object.values(x):[x]).filter(x=>typeof x==='number');
 if(costs.some(n=>n>0))return false;
 return /(^|[\/_\s-])free($|[_\s-])/.test(title)||id==='big-pickle'||(costs.length>=2&&costs.every(v=>v===0));
}
async function models(signal){
 await ensure();const data=await request('GET','/provider',undefined,signal),found=[];
 for(const provider of data?.all||[]){
  if(provider?.id!=='opencode')continue;
  if(Array.isArray(data.connected)&&data.connected.length&&!data.connected.includes('opencode'))continue;
  for(const [id,m] of Object.entries(provider.models||{})){
   const modelID=String(m?.id||id);
   if(!/^[\w./:-]{2,150}$/.test(modelID)||!isFree(modelID,m))continue;
   const inputs=Array.isArray(m?.modalities?.input)?m.modalities.input:[];
   const outputs=Array.isArray(m?.modalities?.output)?m.modalities.output:[];
   found.push({providerID:'opencode',modelID,name:String(m?.name||modelID),vision:inputs.includes('image'),inputs,outputs});
   // inputs de imagem/vídeo/áudio significam que o modelo entende arquivos,
   // NÃO que ele gera esses arquivos. Criação de mídia requer outro conector.
  }
 }
 if(!found.length)throw Error('Nenhum modelo grátis conectado no OpenCode. Confira o catálogo e o login.');
 return found;
}
// Ordem local pré-definida, sem pedir a outra IA que decida o roteamento.
// A disponibilidade e a gratuidade ainda são verificadas no OpenCode em cada consulta.
const CHAT_FAVORITES=['deepseek-v4.1-flash-free','big-pickle','beam-free',
 'nemotron-3.5-lightning-free','glm-5.3-flash-free','mimo-v2.6-flash-free',
 'longcat-2.5-preview-free','minimax-m3.1-flash-free','nemotron-3.5-super-vl-free'];
const VISION_FAVORITES=['nemotron-3.5-super-vl-free','glm-5.3-flash-free',
 'minimax-m3.1-flash-free','longcat-2.5-preview-free','mimo-v2.6-flash-free',
 'deepseek-v4.1-flash-free'];
function ordered(list,selected,vision=false){
 const eligible=list.filter(m=>!vision||m.vision);
 if(!eligible.length)throw Error(vision?'Nenhum modelo gratuito com entrada de imagem disponível.':'Nenhum modelo gratuito disponível.');
 if(selected){const exact=eligible.find(m=>m.modelID===selected);
  if(!exact)throw Error('O modelo escolhido não aparece entre os modelos grátis com a capacidade necessária.');
  return [exact,...eligible.filter(m=>m!==exact)];}
 const favorites=vision?VISION_FAVORITES:CHAT_FAVORITES;
 return [...eligible].sort((a,b)=>{
  const score=m=>{const i=favorites.indexOf(m.modelID.toLowerCase());return i<0?100:i;};
  return score(a)-score(b);
 });
}
// Identificação simples e rápida de pedidos de CRIAÇÃO, não de análise de mídia.
// Sem serviço de geração integrado, nunca trate uma entrada multimodal como gerador.
function mediaIntent(input){
 const s=String(input||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(!/\b(cria|crie|criar|gere|gerar|gera|faca|fazer|faz|produza|produzir|monte|montar|transforme)\b/.test(s))return null;
 if(/\b(video|videos|clipe|clipes|animacao|filmagem)\b/.test(s))return 'video';
 if(/\b(imagem|imagens|foto|fotos|ilustracao|arte|desenho)\b/.test(s))return 'image';
 if(/\b(audio|audios|musica|cancao|locucao|narracao)\b/.test(s))return 'audio';
 return null;
}
function mediaNotice(kind){
 const what=kind==='video'?'vídeos':kind==='audio'?'áudios':'imagens';
 return 'Ainda não há um gerador de '+what+' gratuito e testado conectado ao COSMO. Os modelos multimodais do OpenCode podem analisar arquivos, mas isso não garante geração. Posso ajudar com um roteiro ou prompt.';
}

const toolDeny=Object.fromEntries(['bash','read','write','edit','apply_patch','glob','grep','webfetch','websearch','task','skill','question','lsp','todowrite','list','batch'].map(k=>[k,false]));
async function one(model,prompt,system,image,signal){
 let session='';
 try{
  const s=await request('POST','/session',{title:'COSMO - conversa segura'},signal,15000);session=String(s?.id||'');
  if(!/^[\w-]{3,100}$/.test(session))throw Error('OpenCode não criou uma sessão válida.');
  const parts=[{type:'text',text:prompt}];
  if(image)parts.push({type:'file',mime:image.mime,filename:'tela-cosmo.jpg',url:'data:'+image.mime+';base64,'+image.data});
  const r=await request('POST','/session/'+encodeURIComponent(session)+'/message',
   {model:{providerID:model.providerID,modelID:model.modelID},agent:'plan',system,tools:toolDeny,parts},signal,90000);
  if(r?.info?.error)throw Error('OpenCode: '+String(r.info.error?.data?.message||r.info.error?.name||'erro no modelo').slice(0,150));
  if((r?.parts||[]).some(p=>p.type==='tool'))throw Error('OpenCode tentou usar uma ferramenta bloqueada.');
  const text=(r?.parts||[]).filter(p=>p.type==='text'&&!p.synthetic).map(p=>p.text||'').join('').trim();
  if(!text)throw Error('Modelo gratuito devolveu resposta vazia.');
  return text;
 }finally{if(session)request('DELETE','/session/'+encodeURIComponent(session),undefined,null,5000).catch(()=>{});}
}
async function ask(prompt,system,opts={},signal,image){
 const errors=[];
 for(const model of ordered(await models(signal),opts.opencodeModel,!!image).slice(0,5)){
  try{return await one(model,prompt,system,image,signal);}
  catch(e){if(signal?.aborted)throw e;errors.push(model.name+': '+String(e.message).slice(0,100));}
 }
 throw Error('Modelos grátis do OpenCode falharam. '+errors.join(' | ').slice(0,450));
}
function transcript(messages){return (messages||[]).slice(-12).map(m=>(m.role==='assistant'?'COSMO':m.role==='tool'?'Resultado':'Usuário')+': '+String(m.content||'').slice(0,3500)).join('\n\n');}
async function chatAuto(messages,opts={},signal,system='Você é COSMO. Responda em português brasileiro em 1 a 3 frases curtas.'){
 return {say:await ask(transcript(messages),system,opts,signal)};
}
async function chatTools(messages,tools,opts={},signal,system=''){
 const names=new Set(tools.map(t=>t.name));
 // Esquema compacto: reduz bastante os tokens sem esconder os campos das ações.
 const specs=tools.map(t=>({name:t.name,description:t.description.slice(0,125),
  required:t.parameters?.required||[],
  fields:Object.entries(t.parameters?.properties||{}).map(([name,p])=>({name,type:p.type||'string',description:String(p.description||'').slice(0,55),...(p.enum?{values:p.enum}:{})}))}));
 const guidance='\nNão execute ferramentas internas do OpenCode. Responda SEMPRE em JSON válido: {"text":"resposta","calls":[{"name":"nome","args":{}}]}. Sem ações, use calls vazio. As ferramentas externas disponíveis são: '+JSON.stringify(specs).slice(0,12000);
 const raw=await ask(transcript(messages),system+guidance,opts,signal);
 let d;try{d=JSON.parse(raw);}catch{return {text:raw,calls:[]};}
 const calls=Array.isArray(d?.calls)?d.calls.filter(c=>names.has(c?.name)&&c.args&&typeof c.args==='object'&&!Array.isArray(c.args)).slice(0,4).map((c,i)=>({id:'oc-'+i,name:c.name,args:c.args})):[];
 return {text:String(d?.text||'').slice(0,6000),calls};
}
async function vision(prompt,image,opts={},signal){return ask(prompt,'Descreva esta imagem com precisão, sem executar ferramentas ou comandos.',opts,signal,image);}
module.exports={models,isFree,ordered,mediaIntent,mediaNotice,chatAuto,chatTools,vision};