// Reconhecimento de fala: vocabulário de contexto, Whisper large-v3 no Groq (nuvem) e o Whisper local como reserva.
const GROQ_MODELS=['whisper-large-v3-turbo','whisper-large-v3'];
const BASE_TERMS=['Cosmo','William','YouTube','ChatGPT','Claude','Claude Code','Gemini','Groq','WhatsApp','Google','GitHub','OpenCode','Spotify','Downloads','Área de Trabalho','DeepSeek','Big Pickle','Beam Free','Nemotron','MiniMax','GLM','MiMo','Google Maps','Maps','Brave','OpenCode Zen','LongCat'];
const BASE_PHRASES='Cosmo, abra o YouTube. Pesquise no Google. Mande pro ChatGPT. Crie um site. Me lembre de beber água em 10 minutos. Que horas são? Como está o tempo? Aumente o volume. Toque uma música. Como está meu dia? Organize minha pasta Downloads. Que erro é esse na tela?';

// Dica de vocabulário para o Whisper: nomes e comandos que ele deve preferir ao ouvir.
function buildPrompt({contacts=[],projects=[],city='',memory=[]}={}){
 const names=[...new Set([...BASE_TERMS,...contacts.map(c=>c?.name).filter(Boolean),...projects,...(city?[city]:[])])].map(s=>String(s).slice(0,40));
 let p=`Conversa em português do Brasil com o assistente Cosmo. Use os nomes próprios na grafia correta. ${BASE_PHRASES} Nomes: ${names.join(', ')}.`;
 const extra=memory.filter(f=>f.length<80).slice(-5).join('. ');if(extra)p+=` ${extra}.`;
 return p.slice(0,900);}
// Corrige o nome do assistente quando o reconhecimento troca por palavras parecidas no começo ou no fim.
function fixName(text){return String(text||'').replace(/^(\s*(?:ei|ok|oi|olá|bom dia|boa tarde|boa noite)?[\s,]*)(cosme|cosmos|kosmo|kozmo|cozmo|cosmu)\b/i,(m,pre)=>pre+'Cosmo').replace(/([\s,]+)(cosme|cosmos|kosmo|kozmo|cozmo|cosmu)([.!?\s]*)$/i,(m,pre,_,end)=>pre+'Cosmo'+end).trim();}

async function groqTranscribe(wav,{apiKey,prompt='',signal,fetchImpl=fetch,base=process.env.ENZO_GROQ_BASE||'https://api.groq.com/openai/v1'}={}){
 if(!apiKey)throw Error('Sem chave Groq.');let last;
 for(const model of GROQ_MODELS){
  const form=new FormData();form.append('file',new Blob([wav],{type:'audio/wav'}),'fala.wav');form.append('model',model);form.append('language','pt');form.append('temperature','0');form.append('response_format','json');if(prompt)form.append('prompt',prompt.slice(0,800));
  const r=await fetchImpl(base.replace(/\/+$/,'')+'/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+apiKey},body:form,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(r.ok){const d=await r.json();return String(d?.text||'').trim();}
  last=r.status;if(r.status===401||r.status===403)throw Error('Chave Groq rejeitada.');if(r.status!==404&&r.status!==400)break;}
 throw Error('Groq não transcreveu o áudio ('+last+').');}

// Escolhe o motor: "local" (só no PC), "groq" (nuvem) ou "auto" (nuvem se houver chave Groq, senão local). Falha na nuvem cai no local.
async function transcribe({audio,engine='auto',groqKey,prompt,local,signal,fetchImpl}){
 const wantCloud=engine==='groq'||(engine==='auto'&&!!groqKey);
 if(wantCloud&&groqKey){try{const text=await groqTranscribe(Buffer.from(audio,'base64'),{apiKey:groqKey,prompt,signal,fetchImpl});return {text:fixName(text),engine:'groq'};}catch(e){if(signal?.aborted)throw e;const r=await local(prompt);return {text:fixName(r.text),engine:'local',fallback:e.message,...(r.uncertain?{uncertain:true}:{})};}}
 const r=await local(prompt);return {text:fixName(r.text),engine:'local',...(r.uncertain?{uncertain:true}:{})};}
module.exports={buildPrompt,fixName,groqTranscribe,transcribe,GROQ_MODELS};
