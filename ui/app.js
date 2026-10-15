import {createHologram} from './hologram.js';
import {IMAGE_URI} from './hologram-image.js';
const $=s=>document.querySelector(s);let holo;try{holo=createHologram($('#hologram'))}catch{$('#holo-text').textContent='WebGL indisponível. Atualize o driver gráfico.'}
const api=window.enzo;let settings={},active=false,busy=false,audioCtx,stream,processor,source,frames=[],samples=0,heard=false,silent=0,generation=0,playing,playCtx,uiState='idle';const SENS={alta:.008,normal:.013,baixa:.022};let micPeak=0,testing=false;let voiceInfo=null;
const names={idle:'DISPONÍVEL',listening:'OUVINDO',thinking:'PENSANDO',speaking:'FALANDO',permission:'AGUARDANDO AUTORIZAÇÃO',executing:'EXECUTANDO',paused:'PAUSADO',updating:'ATUALIZANDO'};
function notice(t){$('#notice').textContent=t||''}
function state(s){uiState=s;$('#state-label').textContent=names[s]||s;holo?.setState(s);$('#holo-text').textContent=({listening:'Pode falar. Estou ouvindo.',thinking:'Um instante, estou pensando.',speaking:'Vamos conversar.',paused:'Seu espaço está em modo privacidade.',permission:'A decisão é sua.',executing:'Executando sua solicitação.'})[s]||'Pronto quando você precisar.';}function setMeter(v){const m=$('#mic-level');if(m)m.style.width=Math.round(Math.min(1,Math.max(0,v))*100)+'%';}
async function invoke(name,...args){const r=await api[name](...args);if(!r.ok)throw Error(r.error);return r.data}
function message(text,who='assistant'){const node=document.createElement('article');node.className=who;const label=document.createElement('label');label.textContent=who==='user'?'VOCÊ':'ENZO';const p=document.createElement('p');p.textContent=text;node.append(label,p);$('#messages').append(node);$('#messages').scrollTop=$('#messages').scrollHeight;}
function stopAudio(){if(playing){playing.onended=null;try{playing.stop()}catch{}playing=null;}if(playCtx){playCtx.close();playCtx=null;}holo?.setLevel(0)}
function closeMic(){active=false;setMeter(0);stream?.getTracks().forEach(t=>t.stop());processor?.disconnect();source?.disconnect();audioCtx?.close();stream=null;processor=null;source=null;audioCtx=null;frames=[];samples=0;heard=false;silent=0;$('#mic').textContent='Ativar microfone';$('#micro-status').textContent='MICROFONE DESLIGADO';}
async function emergency(){generation++;closeMic();stopAudio();busy=false;$('#send').disabled=false;await invoke('stop');state('paused');$('#resume').hidden=false;notice('Pausado. Use Retomar para permitir novos pedidos.');}
async function speak(text,token=generation){const start=performance.now();try{const data=await invoke('speak',text);if(token!==generation)return;if(data.fallback)notice(data.fallback);$('#voice-metric').textContent=`Síntese: ${data.ms} ms · Espera total: ${Math.round(performance.now()-start)} ms`;const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));playCtx=new AudioContext();const buffer=await playCtx.decodeAudioData(bytes.buffer);if(token!==generation){stopAudio();return;}const player=playCtx.createBufferSource();playing=player;const analyser=playCtx.createAnalyser();analyser.fftSize=256;player.buffer=buffer;player.connect(analyser);analyser.connect(playCtx.destination);state('speaking');const arr=new Uint8Array(analyser.fftSize);let done=false;function animate(){if(done)return;analyser.getByteTimeDomainData(arr);holo?.setLevel(Math.sqrt(arr.reduce((s,v)=>s+((v-128)/128)**2,0)/arr.length));requestAnimationFrame(animate)}animate();await new Promise(resolve=>{player.onended=()=>{done=true;resolve()};player.start();const check=setInterval(()=>{if(token!==generation){done=true;clearInterval(check);resolve()}if(done)clearInterval(check)},100)});stopAudio();}catch(e){if(token===generation)notice('Voz neural indisponível: '+e.message+' A resposta permanece em texto.');}finally{if(token===generation)state(active?'listening':'idle')}}
async function send(text){if(busy){notice('Aguarde a resposta ou use Parar tudo.');return;}busy=true;const token=generation;$('#send').disabled=true;message(text,'user');notice('');state('thinking');try{const r=await invoke('chat',text);if(token!==generation)return;message(r.say);await speak(r.say,token);}catch(e){if(token===generation){message(e.message);notice(e.message)}}finally{if(token===generation){busy=false;$('#send').disabled=false;frames=[];samples=0;silent=0;heard=false;state(active?'listening':'idle')}}}
function wavBase64(chunks){const total=chunks.reduce((n,x)=>n+x.length,0);const b=new ArrayBuffer(44+total*2),v=new DataView(b);const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};str(0,'RIFF');v.setUint32(4,36+total*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,total*2,true);let at=44;for(const chunk of chunks)for(const x of chunk){v.setInt16(at,Math.max(-1,Math.min(1,x))*32767,true);at+=2;}const bytes=new Uint8Array(b);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
async function transcribe(chunks){const token=generation;busy=true;state('thinking');try{const data=await invoke('transcribe',wavBase64(chunks));if(token!==generation)return;busy=false;if(data.text)await send(data.text);else notice('Não identifiquei fala. Tente novamente.');}catch(e){if(token===generation)notice('Falha no reconhecimento: '+e.message);}finally{if(token===generation){busy=false;frames=[];samples=0;heard=false;silent=0;if(!settings.continuous)closeMic();state(active?'listening':'idle')}}}
async function toggleMic(){if(active){generation++;closeMic();stopAudio();await invoke('stop');$('#resume').hidden=false;state('paused');return;}if(busy)return;await invoke('resume');$('#resume').hidden=true;const token=++generation;notice('');try{stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:(settings.micDevice||$('#device').value)?{exact:(settings.micDevice||$('#device').value)}:undefined,channelCount:1,echoCancellation:settings.micEcho!==false,noiseSuppression:settings.micNoise!==false,autoGainControl:settings.micGain!==false},video:false});if(token!==generation){closeMic();return;}audioCtx=new AudioContext({sampleRate:16000});if(audioCtx.sampleRate!==16000)throw Error('O dispositivo não aceitou 16 kHz. Selecione outro microfone.');source=audioCtx.createMediaStreamSource(stream);processor=audioCtx.createScriptProcessor(2048,1,1);source.connect(processor);processor.connect(audioCtx.destination);active=true;state('listening');$('#mic').textContent='Desligar microfone';$('#micro-status').textContent='MICROFONE ATIVO';await refreshMics();
processor.onaudioprocess=e=>{if(!active||busy)return;const input=new Float32Array(e.inputBuffer.getChannelData(0));const rms=Math.sqrt(input.reduce((s,x)=>s+x*x,0)/input.length);setMeter(Math.min(1,rms/.1));const thr=SENS[settings.micSensitivity]||.013;if(rms>thr){heard=true;silent=0;}else silent+=input.length;frames.push(input);samples+=input.length;if(!heard&&samples>16000){frames=frames.slice(-3);samples=frames.reduce((n,x)=>n+x.length,0);}if(heard&&(silent>16000*.85||samples>=16000*28)){const chunks=frames;frames=[];samples=0;heard=false;silent=0;transcribe(chunks);}};
}catch(e){closeMic();notice('Microfone: '+e.message);state('idle')}}
$('#chat-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#input').value.trim();if(text){$('#input').value='';send(text)}});$('#input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chat-form').requestSubmit()}});document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>send(b.dataset.command));$('#mic').onclick=()=>toggleMic().catch(e=>notice(e.message));$('#stop').onclick=emergency;$('#resume').onclick=async()=>{await invoke('resume');$('#resume').hidden=true;notice('');state('idle')};$('#compact').onclick=()=>invoke('window','compact');
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('selected',x===b));$('#heading').textContent=({home:'Inteligência com presença.',settings:'Você no controle.',appearance:'Escolha a aparência.',android:'Uma presença, dois dispositivos.',updates:'Sempre evoluindo.'})[b.dataset.tab]});

function applyAvatar(id){
 holo?.setPreset(id);
 document.querySelectorAll('.avatar-card').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.avatar===id)));
}
async function loadAvatarGallery(){
 const avatars=await invoke('avatarCatalog');
 const gallery=$('#avatar-gallery');
 if(!gallery)return;
 gallery.replaceChildren();
 for(const avatar of avatars){
   const button=document.createElement('button');button.type='button';button.className='avatar-card';
   button.dataset.avatar=avatar.id;button.setAttribute('aria-label','Usar modelo visual '+avatar.name);
   const art=document.createElement('span');art.className='avatar-art';
   const img=document.createElement('img');img.src=IMAGE_URI;img.alt='Prévia '+avatar.name;
   img.loading='lazy';img.style.filter=avatar.filter;art.appendChild(img);
   const name=document.createElement('span');name.className='avatar-name';name.textContent=avatar.name;
   const desc=document.createElement('span');desc.className='avatar-desc';desc.textContent=avatar.description;
   button.append(art,name,desc);
   button.onclick=async()=>{try{
      const saved=await invoke('configure',{avatarPreset:avatar.id});settings=saved;
      applyAvatar(avatar.id);notice('Modelo visual '+avatar.name+' aplicado e salvo.');
   }catch(e){notice('Aparência: '+e.message);}};
   gallery.appendChild(button);
 }
 applyAvatar(settings.avatarPreset||'original');
}
async function loadVoices(){
 const catalog=await invoke('voiceCatalog');voiceInfo=catalog;
 const select=$('#voice-profile');const selected=settings.voiceProfile||'piper-faber';
 select.replaceChildren();
 const groups={piper:'Piper · instalado com ENZO',supertonic:'Supertonic 3 · português',pocket:'PocketTTS · português e inglês',kitten:'KittenTTS · somente inglês'};
 for(const [engine,title] of Object.entries(groups)){
  const group=document.createElement('optgroup');group.label=title;
  for(const v of catalog.voices.filter(x=>x.engine===engine)){
   const ready=v.engine==='piper'?true:Boolean(catalog.engines?.[v.engine]);
   const option=new Option(v.name+(ready?'':' · requer motor'),v.id);
   group.appendChild(option);
  }
  select.appendChild(group);
 }
 select.value=catalog.voices.some(v=>v.id===selected)?selected:'piper-faber';
 const tone=$('#voice-tone');tone.replaceChildren();
 for(const t of catalog.tones)tone.add(new Option(t.name,t.id));
 tone.value=catalog.tones.some(t=>t.id===settings.voiceTone)?settings.voiceTone:'natural';
 updateVoiceAvailability();
}
function updateVoiceAvailability(){
 const voice=voiceInfo?.voices?.find(v=>v.id===$('#voice-profile').value);
 if(!voice)return;
 const installed=voice.engine==='piper'||voiceInfo.engines?.[voice.engine];
 $('#voice-availability').textContent=voice.name+' — '+(installed?'Motor detectado; faça o teste de áudio.':'Motor opcional ainda não instalado; precisa do OpenCode para habilitar.')+' '+voice.note;
}

async function save(){settings=await invoke('configure',{provider:$('#provider').value,groqModel:$('#groq-model').value.trim(),geminiModel:$('#gemini-model').value.trim(),autoUpdate:$('#auto-update').checked,micDevice:$('#device').value,micSensitivity:$('#mic-sensitivity').value,micNoise:$('#mic-noise').checked,micEcho:$('#mic-echo').checked,micGain:$('#mic-gain').checked,continuous:$('#continuous').checked,remember:$('#remember').checked,voiceProfile:$('#voice-profile').value,voiceTone:$('#voice-tone').value});notice('Configuração salva.');}$('#save-settings').onclick=()=>save().catch(e=>notice(e.message));$('#continuous').onchange=save;$('#remember').onchange=save;
$('#test-voice').onclick=()=>speak('Olá, eu sou o Enzo. Esta é uma demonstração da voz que você escolheu. Como ficou?');$('#clear').onclick=async()=>{await invoke('clearHistory');$('#messages').replaceChildren();notice('Conversa apagada.');};$('#pair').onclick=async()=>{try{const r=await invoke('android',true);$('#pair-info').textContent=r?`Abra no Android:\n${r.urls.join('\n')}\n\nCódigo: ${r.code}\nVálido até ${new Date(r.expires).toLocaleTimeString()}`:'Conexão desativada.';}catch(e){notice(e.message)}};$('#unpair').onclick=async()=>{await invoke('android',false);$('#pair-info').textContent='Conexão desativada.';};$('#check-update').onclick=async()=>{try{$('#update-info').textContent=await invoke('checkUpdate')}catch(e){$('#update-info').textContent=e.message}};$('#install-update').onclick=async()=>{try{$('#update-info').textContent=await invoke('installUpdate')}catch(e){$('#update-info').textContent=e.message}};
api.onEvent(e=>{if(e.type==='state'&&e.state!=='idle')state(e.state);if(e.type==='notice')notice(e.text);if(e.type==='stop'){generation++;closeMic();stopAudio();busy=false;$('#send').disabled=false;$('#resume').hidden=false;state('paused')}if(e.type==='toggle-mic')toggleMic();if(e.type==='compact')document.body.classList.toggle('compact',e.enabled);if(e.type==='avatar'&&e.avatar){settings.avatarPreset=e.avatar;applyAvatar(e.avatar)}if(e.type==='remote'){message('[Android] '+e.text,'user');message(e.reply);}if(e.type==='update'&&e.update){$('#update-info').textContent=`Versão ${e.update.version}\n${e.update.notes}`;notice('Há uma atualização verificada disponível.');}});
invoke('status').then(s=>{settings=s.settings;loadAvatarGallery().catch(e=>notice('Aparências: '+e.message));$('#provider').value=settings.provider||'auto';$('#voice-profile').value=settings.voiceProfile||'piper-faber';$('#voice-tone').value=settings.voiceTone||'natural';loadVoices().catch(e=>notice('Catálogo de vozes: '+e.message));$('#groq-model').value=settings.groqModel||'openai/gpt-oss-120b';$('#gemini-model').value=settings.geminiModel||'gemini-3.5-flash';$('#continuous').checked=settings.continuous;$('#remember').checked=settings.remember;$('#auto-update').checked=settings.autoUpdate!==false;$('#device').value=settings.micDevice||'';$('#mic-sensitivity').value=settings.micSensitivity||'normal';$('#mic-noise').checked=settings.micNoise!==false;$('#mic-echo').checked=settings.micEcho!==false;$('#mic-gain').checked=settings.micGain!==false;refreshMics().catch(()=>{});$('#version').textContent=s.version;$('#hardware').textContent=`Detectado: ${s.ramGB} GB de RAM · ${s.cpus} processadores lógicos`;const p=s.providers||{};$('#vault-status').textContent=`Cofre: Groq ${p.groq?'✓':'—'} · Gemini ${p.gemini?'✓':'—'} · GitHub ${p.github?'✓':'—'}${s.encryption?'':' · criptografia indisponível'}`;}).catch(e=>notice(e.message));

$('#get-vc').onclick=()=>invoke('dependency','vc').catch(e=>notice(e.message));$('#diagnostics').onclick=async()=>{try{const d=await invoke('diagnostics');const p=d.providers||{};notice(`Voz: ${d.voice.tts?'modelo presente':'modelo ausente'} · Reconhecimento: ${d.voice.stt?'modelo presente':'modelo ausente'} · Nuvem: Groq ${p.groq?'✓':'—'} Gemini ${p.gemini?'✓':'—'} GitHub ${p.github?'✓':'—'}. A presença dos modelos não substitui o teste de áudio.`)}catch(e){notice(e.message)}};
function vaultText(st){return `Cofre: Groq ${st.groq?'✓':'—'} · Gemini ${st.gemini?'✓':'—'} · GitHub ${st.github?'✓':'—'}`}
$('#save-vault').onclick=async()=>{try{const ids={groq:'#groq-key',gemini:'#gemini-key',github:'#github-key'};let st=null;for(const k of Object.keys(ids)){const v=$(ids[k]).value.trim();if(!v)continue;st=await invoke('vaultSet',{provider:k,key:v});$(ids[k]).value='';}if(!st)st=await invoke('vaultStatus').then(r=>r.configured);$('#vault-status').textContent=vaultText(st)+' · salvo criptografado.';notice('Chaves salvas no cofre criptografado.');}catch(e){notice('Cofre: '+e.message)}};
$('#vault-state').onclick=async()=>{try{const r=await invoke('vaultStatus');$('#vault-status').textContent=vaultText(r.configured)+(r.encryption?'':' · criptografia indisponível');}catch(e){notice(e.message)}};
$('#clear-vault').onclick=async()=>{try{for(const k of ['groq','gemini','github'])await invoke('vaultClear',k);$('#vault-status').textContent='Cofre vazio.';notice('Chaves apagadas.');}catch(e){notice(e.message)}};
$('#provider').onchange=save;$('#groq-model').onchange=save;$('#gemini-model').onchange=save;$('#auto-update').onchange=save;$('#voice-profile').onchange=()=>{updateVoiceAvailability();save().catch(e=>notice(e.message))};$('#voice-tone').onchange=()=>save().catch(e=>notice(e.message));
async function refreshMics(){const devices=await navigator.mediaDevices.enumerateDevices();const selected=settings.micDevice||$('#device').value;$('#device').replaceChildren(new Option('Padrão do sistema',''));let n=0;devices.filter(d=>d.kind==='audioinput').forEach(d=>{n++;$('#device').add(new Option(d.label||('Microfone '+n),d.deviceId))});$('#device').value=selected||'';return n;}
$('#refresh-mics').onclick=async()=>{try{let t;try{t=await navigator.mediaDevices.getUserMedia({audio:true,video:false})}catch(e){notice('Microfone: permita o acesso no navegador do ENZO para listar os dispositivos.');return;}t.getTracks().forEach(x=>x.stop());const n=await refreshMics();notice(n?'Microfones atualizados. Escolha o seu, salve e faça o teste.':'Nenhum microfone encontrado.');}catch(e){notice(e.message)}};
$('#test-mic').onclick=async()=>{if(testing||busy){notice('Aguarde o teste terminar.');return;}testing=true;micPeak=0;const token=++generation;notice('Teste: fale normalmente por 3 segundos…');try{const dev=settings.micDevice||$('#device').value;const s=await navigator.mediaDevices.getUserMedia({audio:{deviceId:dev?{exact:dev}:undefined,echoCancellation:settings.micEcho!==false,noiseSuppression:settings.micNoise!==false,autoGainControl:settings.micGain!==false},video:false});if(token!==generation){s.getTracks().forEach(t=>t.stop());testing=false;return;}const ctx=new AudioContext({sampleRate:16000});const src=ctx.createMediaStreamSource(s);const proc=ctx.createScriptProcessor(2048,1,1);src.connect(proc);proc.connect(ctx.destination);const stop=()=>{try{proc.disconnect();src.disconnect();ctx.close()}catch{}s.getTracks().forEach(t=>t.stop())};proc.onaudioprocess=e=>{const ch=new Float32Array(e.inputBuffer.getChannelData(0));const r=Math.sqrt(ch.reduce((a,x)=>a+x*x,0)/ch.length);if(r>micPeak)micPeak=r;setMeter(Math.min(1,r/.1))};await new Promise(r=>setTimeout(r,3000));if(token!==generation){stop();testing=false;return;}stop();testing=false;setMeter(0);const pct=Math.round(Math.min(1,micPeak/.1)*100);$('#mic-test').textContent='Nível máximo captado: '+pct+'%.';notice(pct<1?'Quase nenhum sinal. Verifique o dispositivo escolhido e o volume no Windows.':pct<8?'Sinal fraco. Fale mais perto/alto ou use sensibilidade Alta.':'Sinal bom. Pode ativar o microfone e falar.');}catch(e){testing=false;setMeter(0);notice('Microfone: '+e.message)}};
$('#device').onchange=save;$('#mic-sensitivity').onchange=save;$('#mic-noise').onchange=save;$('#mic-echo').onchange=save;$('#mic-gain').onchange=save;


// Sistema e calendário: sem valores fictícios, somente IPC validado do processo principal.
let agendaMonth=new Date();
agendaMonth=new Date(agendaMonth.getFullYear(),agendaMonth.getMonth(),1);
let agendaEvents=[];
function isoDay(d){
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function renderAgenda(){
  const now=new Date(),today=isoDay(now);
  $('#agenda-day').textContent='Hoje, '+new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long'}).format(now);
  const todayList=agendaEvents.filter(e=>e.date===today);
  const summary=$('#agenda-today');summary.replaceChildren();
  if(!todayList.length)summary.textContent='Nenhum compromisso registrado para hoje.';
  for(const e of todayList.slice(0,5)){
    const d=document.createElement('div');d.textContent=e.time+' • '+e.title;summary.appendChild(d);
  }
  const future=agendaEvents.filter(e=>e.date>=today).slice(0,40);
  const list=$('#all-events');list.replaceChildren();
  const content=document.createElement('div');content.className='calendar-events';
  for(const e of future){
    const row=document.createElement('div');row.className='calendar-event';
    const label=document.createElement('span');label.textContent=e.date.split('-').reverse().join('/')+' às '+e.time+' — '+e.title;
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+e.title);
    remove.onclick=async()=>{try{await invoke('calendarRemove',e.id);notice('Compromisso removido.');await refreshDashboard();}catch(err){notice('Agenda: '+err.message);}};
    row.append(label,remove);content.appendChild(row);
  }
  list.appendChild(content);
  if(!future.length)list.textContent='Nenhum compromisso futuro registrado.';
  drawMonth();
}
function drawMonth(){
  const y=agendaMonth.getFullYear(),m=agendaMonth.getMonth();
  $('#month-title').textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(agendaMonth);
  const grid=$('#calendar-month');grid.replaceChildren();
  for(const day of ['D','S','T','Q','Q','S','S']){const head=document.createElement('span');head.className='calendar-weekday';head.textContent=day;grid.appendChild(head);}
  const start=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  for(let i=0;i<start;i++){const el=document.createElement('span');el.className='calendar-empty';grid.appendChild(el);}
  const eventDates=new Set(agendaEvents.map(e=>e.date));
  const selected=$('#event-date').value;
  for(let d=1;d<=days;d++){
    const day=new Date(y,m,d),id=isoDay(day);
    const btn=document.createElement('button');btn.type='button';btn.className='calendar-day';
    if(eventDates.has(id))btn.classList.add('has-event');
    if(id===selected)btn.classList.add('active');
    btn.textContent=String(d);btn.setAttribute('aria-label',day.toLocaleDateString('pt-BR'));
    btn.onclick=()=>{$('#event-date').value=id;drawMonth();};
    grid.appendChild(btn);
  }
}
async function refreshDashboard(){
  const response=await invoke('dashboard'),sys=response.system||{};
  $('#cpu-usage').textContent=sys.cpuPercent===null||sys.cpuPercent===undefined?'N/D':sys.cpuPercent+'%';
  $('#ram-usage').textContent=sys.ram?.usedPercent==null?'N/D':sys.ram.usedPercent+'%';
  $('#gpu-usage').textContent=sys.gpu?.usagePercent==null?'N/D':sys.gpu.usagePercent+'%';
  $('#gpu-temp').textContent=sys.gpu?.temperatureC==null?'N/D':sys.gpu.temperatureC+' °C';
  $('#cpu-temp-note').textContent='Temperatura da CPU: '+(sys.cpuTemperatureC==null?'N/D — sensor não disponível.':sys.cpuTemperatureC+' °C');
  $('#gpu-model').textContent=sys.gpu?.name||'GPU: monitoramento não disponível nesta configuração.';
  agendaEvents=Array.isArray(response.events)?response.events:[];
  renderAgenda();
}
$('#event-date').value=isoDay(new Date());
$('#event-time').value='09:00';
$('#event-date').onchange=drawMonth;
$('#month-prev').onclick=()=>{agendaMonth=new Date(agendaMonth.getFullYear(),agendaMonth.getMonth()-1,1);drawMonth();};
$('#month-next').onclick=()=>{agendaMonth=new Date(agendaMonth.getFullYear(),agendaMonth.getMonth()+1,1);drawMonth();};
$('#event-form').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const title=$('#event-title').value.trim(),date=$('#event-date').value,time=$('#event-time').value;
    await invoke('calendarAdd',{title,date,time});
    $('#event-title').value='';notice('Compromisso adicionado ao calendário local.');
    await refreshDashboard();
  }catch(err){notice('Agenda: '+err.message);}
});
refreshDashboard().catch(e=>notice('Widgets: '+e.message));
setInterval(()=>{if(!document.hidden)refreshDashboard().catch(()=>{});},12000);
