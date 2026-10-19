const {app,BrowserWindow,ipcMain,dialog,shell,globalShortcut,session,Tray,Menu,nativeImage,safeStorage,Notification,clipboard,desktopCapturer,screen:displays}=require('electron');const screenLib=require('../core/screen.cjs');const integ=require('../core/integrations.cjs');const {reactorBitmap}=require('../core/icon.cjs');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');const {spawn}=require('node:child_process');
const {Gate,APPS,cleanText}=require('../core/policy.cjs');const {intent}=require('../core/intent.cjs');const {WorkMode}=require('../core/workmode.cjs');const {ModeStore,VoiceModes,parseTargets,normalizeName,LABELS}=require('../core/modes.cjs');const llm=require('../core/llm.cjs');const {Voice}=require('../core/voice.cjs');const {GitHubPrivateUpdater}=require('../updater/github-private.cjs');const {OWNER,REPO,PUBLIC_KEY_PEM}=require('../core/update-channel.cjs');const {Companion}=require('../core/android.cjs');const vaultLib=require('../core/vault.cjs');const {SecureStore,Memory,Reminders,jarvisIntent,sysinfo,statusReport,greeting,weather,describeDelay,formatAt,MEDIA}=require('../core/jarvis.cjs');const {skillIntent}=require('../core/skills.cjs');const {stripName}=require('../core/wake.cjs');const web=require('../core/web.cjs');const optimize=require('../core/optimize.cjs');const {AgentRunner,AGENTS,AGENT_MODEL,slug,sitePrompt,spoken}=require('../core/agent.cjs');const {runBrain,BRAIN_SYSTEM}=require('../core/brain.cjs');const {makeTools}=require('../core/tools.cjs');const {Files,summarizePlan,human}=require('../core/files.cjs');const {safeUrl}=require('../core/policy.cjs');
let agentRunner=new AgentRunner(),memory,reminders,secretStore,secrets={imap:'',ics:''},win,tray,voice,updater,companion,workMode,modeStore,voiceModes,root,python,dataDir,settings,controller,busy=false,epoch=0,updateTimer,controlProcess;const gate=new Gate();const history=[];let state='idle';
const defaults={remember:false,continuous:false,keepMicOn:true,compact:false,provider:'auto',groqModel:'openai/gpt-oss-120b',geminiModel:'gemini-3.5-flash',autoUpdate:true,micDevice:'',micSensitivity:'normal',micNoise:true,micEcho:true,micGain:true,wake:false,greet:true,city:'',agent:'claude',agentFull:false,quickOpen:true,projectsDir:'',lastProject:'',claudeModel:'claude-haiku-5-5',agentModel:AGENT_MODEL,brain:true,folders:[],confirmClicks:true,emailAddress:'',emailHost:'',contacts:[],briefing:true,lastBriefing:'',autostart:false,keepInTray:true,trayHintShown:false};
// Sempre ligado: iniciado com o Windows vem com --hidden e fica só na bandeja.
const startHidden=process.argv.includes('--hidden');let quitting=false;
let apiKeys=vaultLib.emptyVault();
function emit(type,data={}){win?.webContents.send('event',{type,...data});}
function setState(s){state=s;emit('state',{state:s});}
function audit(type,data={}){const entry={at:new Date().toISOString(),type,...data};fs.appendFileSync(path.join(dataDir,'audit.jsonl'),JSON.stringify(entry)+'\n');}
function status(){return {hidden:startHidden&&!win?.isVisible(),version:app.getVersion(),state,settings,paused:gate.paused,platform:process.platform,ramGB:Math.round(os.totalmem()/2**30),cpus:os.cpus().length,providers:vaultLib.statusOf(apiKeys),encryption:safeStorage.isEncryptionAvailable(),update:updater.available?{version:updater.available.version,notes:updater.available.notes}:null};}
function applyAutostart(){if(!['win32','darwin'].includes(process.platform))return;try{app.setLoginItemSettings({openAtLogin:!!settings.autostart,args:['--hidden']});}catch{}}
function showWindow(){if(!win)return;if(win.isMinimized())win.restore();win.show();win.focus();}
function saveSettings(){fs.writeFileSync(path.join(dataDir,'settings.json'),JSON.stringify(settings,null,2));}
function vaultFile(){return path.join(dataDir,'vault.enc');}
function loadVault(){let raw=null;try{const b=Buffer.from(fs.readFileSync(vaultFile(),'utf8'),'base64');raw=JSON.parse(safeStorage.decryptString(b));}catch{try{audit('vault-load-failed',{stage:'open'});}catch{}apiKeys=vaultLib.emptyVault();return;}const next=vaultLib.emptyVault();for(const p of vaultLib.PROVIDERS){try{if(raw&&typeof raw[p]==='string'&&raw[p])next[p]=vaultLib.validateKey(raw[p]);}catch{try{audit('vault-load-failed',{stage:p});}catch{}}}apiKeys=next;}
function persistVault(){if(!safeStorage.isEncryptionAvailable())throw Error('Criptografia indisponível neste sistema. Chave não salva.');const tmp=vaultFile()+'.tmp';fs.writeFileSync(tmp,safeStorage.encryptString(JSON.stringify(apiKeys)).toString('base64'));try{const back=JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(tmp,'utf8'),'base64')));if(vaultLib.statusOf(back).groq!==vaultLib.statusOf(apiKeys).groq)throw Error('verificação');}catch{try{fs.rmSync(tmp,{force:true});}catch{}throw Error('Falha ao conferir o cofre. Chave não salva.');}fs.rmSync(vaultFile(),{force:true});fs.renameSync(tmp,vaultFile());}
function clearSecrets(){apiKeys=vaultLib.emptyVault();}
async function authorize(action){const pending=gate.propose(action);setState('permission');const a=pending.action;const detail=a.type==='agent'?`O ${AGENTS[settings.agent]||'agente'} vai trabalhar nesta tarefa na pasta ${settings.lastProject||projectsDir()}:\n\n${a.task}${settings.agentFull?'\n\nModo liberado: o agente pode rodar qualquer comando.':''}`:a.type==='media'?`Mídia: ${MEDIA[a.key]}`:a.type==='open_app'?APPS[a.app]:a.type==='open_url'?a.url:a.type==='type_text'?`Colar este texto na janela que você escolher (substitui a área de transferência):\n${a.text}`:`Atalho: ${a.key}`;
 const result=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Permissão',message:'Autorizar esta ação?',detail,buttons:['Cancelar','Autorizar uma vez'],defaultId:0,cancelId:0,noLink:true});const allowed=gate.consume(pending.id,result.response===1);if(!allowed)return 'Ação cancelada.';audit('action-approved',{action:allowed.type});setState('executing');
 if(allowed.type==='open_app'){
 if(process.platform!=='win32')throw Error('Este comando exige Windows.');
 const exe=path.join(process.env.SystemRoot||'C:\\Windows',allowed.app==='explorador'?'':'System32',APPS[allowed.app]);
 await new Promise((resolve,reject)=>{const p=spawn(exe,[],{detached:true,stdio:'ignore',windowsHide:false});p.once('error',reject);p.once('spawn',()=>{p.unref();resolve()})});
 }else if(allowed.type==='open_url'){await shell.openExternal(allowed.url);}else if(allowed.type==='media'){await runMedia(allowed.key);}else if(allowed.type==='agent'){return startAgent({task:allowed.task,dir:settings.lastProject||projectsDir()});}else{
 if(process.platform!=='win32')throw Error('Este comando exige Windows.');emit('notice',{text:'Selecione a janela de destino. Ação em 5 segundos. Ctrl+Alt+Esc cancela.'});win.minimize();const token=epoch;await new Promise(r=>setTimeout(r,5000));if(epoch!==token||gate.paused)throw Error('Ação interrompida.');
 await new Promise((resolve,reject)=>{const p=spawn(python,['-u',path.join(root,'voice','windows_control.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});controlProcess=p;let out='';p.stdout.on('data',x=>out+=x);p.on('error',reject);p.on('exit',code=>{controlProcess=null;code===0?resolve():reject(Error('Ação interrompida ou falhou. '+out.slice(0,300)))});p.stdin.end(JSON.stringify(allowed));});
 }
 audit('action-completed',{action:allowed.type});return 'Comando executado.';
}
function runControl(payload,what='controle do Windows'){if(process.platform!=='win32')return Promise.reject(Error(`O ${what} exige Windows.`));return new Promise((resolve,reject)=>{const p=spawn(python,['-u',path.join(root,'voice','windows_control.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';p.stdout.on('data',x=>out+=x);p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`Falha no ${what}. `+out.slice(0,200))));p.stdin.end(JSON.stringify(payload));});}
function runMedia(key){return runControl({type:'media',key},'controle de mídia');}
function projectsDir(){return settings.projectsDir||path.join(app.getPath('documents'),'COSMO Projetos');}
function freshDir(name){const base=projectsDir();let dir=path.join(base,name),n=2;while(fs.existsSync(dir))dir=path.join(base,`${name}-${n++}`);return dir;}
// Abre um site pedido diretamente pelo usuário; com "abertura rápida" desligada, pede confirmação.
async function openSite(url,source){if(settings.quickOpen!==false&&source==='desktop'&&web.isQuickUrl(url)){await shell.openExternal(url);audit('quick-open',{host:new URL(url).hostname});return;}await authorize({type:'open_url',url});}
// O agente roda em segundo plano: o COSMO continua disponível e avisa ao terminar.
function startAgent({agent=settings.agent,task,dir,site=false}){
 if(agentRunner.busy)throw Error(`O ${AGENTS[agent]} ainda está trabalhando na tarefa anterior, senhor.`);
 fs.mkdirSync(dir,{recursive:true});settings.lastProject=dir;saveSettings();const name=AGENTS[agent]||agent;audit('agent-start',{agent,dir});emit('agent',{status:'start',agent:name,task,dir});
 agentRunner.run({agent,task,cwd:dir,full:!!settings.agentFull,model:settings.agentModel||AGENT_MODEL,onProgress:text=>emit('agent',{status:'progress',text})}).then(async out=>{
  let opened='';const index=path.join(dir,'index.html');if(site&&fs.existsSync(index)){const err=await shell.openPath(index);if(!err)opened=' Já abri no navegador.';}
  audit('agent-done',{agent});emit('agent',{status:'done',text:out.text});emit('proactive',{text:`Pronto, senhor. ${spoken(out.text)}${opened}`,kind:'agent'});win?.flashFrame(true);
 }).catch(e=>{audit('agent-failed',{agent});emit('agent',{status:'error',text:e.message});emit('proactive',{text:`Senhor, o ${name} não conseguiu concluir: ${spoken(e.message,200)}`,kind:'agent'});});
 return `Certo, senhor. O ${name} começou a trabalhar em ${path.basename(dir)}. Eu aviso quando terminar.`;}
async function confirmAgent(agent,task,dir){const r=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Agente',message:`Deixar o ${AGENTS[agent]} trabalhar nesta tarefa?`,detail:`${task}\n\nPasta: ${dir}\n${settings.agentFull?'Modo liberado: o agente pode rodar qualquer comando.':'Ele pode criar e editar arquivos nessa pasta e rodar comandos de desenvolvimento (npm, node, git, python).'}`,buttons:['Cancelar','Começar'],defaultId:1,cancelId:0,noLink:true});return r.response===1;}
// ===== Cérebro com ferramentas =====
function fileRoots(){const roots=['documents','downloads','desktop','pictures','music','videos'].map(k=>{try{return app.getPath(k)}catch{return null}});return [...roots,projectsDir(),...(Array.isArray(settings.folders)?settings.folders:[])].filter(Boolean);}
function files(){return new Files({roots:fileRoots(),undoFile:path.join(dataDir,'organize-undo.json')});}
function atTime(hhmm){const m=String(hhmm||'').match(/(\d{1,2})\s*[:h]\s*(\d{2})?/);if(!m)throw Error('Horário inválido.');const d=new Date();d.setHours(+m[1],+(m[2]||0),0,0);if(d<=Date.now())d.setDate(d.getDate()+1);return d.getTime();}
// Ferramentas que ainda dependem de módulos em construção ficam fora da lista do cérebro.
const BRAIN_PENDING=new Set();
function brainContext(source,token){const signal=controller.signal;const desk=what=>{if(source!=='desktop')throw Error(`${what} só pode ser feito no computador.`);};
 return {
  search:async q=>(await web.search(q,{signal})).map((r,i)=>`[${i+1}] ${r.title} — ${r.url}`).join('\n')||'Nenhum resultado.',
  research:async q=>{const r=await web.research(q,{signal});return (r.pages.length?r.pages:r.results).map((p,i)=>`[${i+1}] ${p.title} — ${p.url}\n${(p.text||'').slice(0,2500)}`).join('\n\n');},
  readPage:async url=>{const p=await web.readPage(url,{signal,max:8000});return `${p.title}\n${p.text}`;},
  weather:c=>weather(c||settings.city,fetch,signal),
  systemStatus:()=>statusReport(sysinfo(),{reminders:reminders.list().length}),
  youtube:async(q,only)=>{const url=only?'https://www.youtube.com/results?search_query='+encodeURIComponent(q):await web.youtubeUrl(q,{signal});await openSite(url,source);return 'Aberto: '+url;},
  openUrl:async url=>{const u=safeUrl(url);await openSite(u,source);return 'Aberto: '+u;},
  askAi:async(ai,q)=>{if(ai==='gemini'){clipboard.writeText(q);await openSite(web.SITES.gemini(),source);return 'Gemini aberto; pergunta copiada para colar.';}await openSite(web.SITES[ai](q),source);return `Enviado ao ${ai}.`;},
  media:async k=>{if(source!=='desktop')return authorize({type:'media',key:k});await runMedia(k);return MEDIA_SAY[k];},
  openApp:app=>authorize({type:'open_app',app}),
  memorySave:f=>memory.add(f)?'Guardado na memória.':'Guardado só nesta sessão (criptografia indisponível).',
  memoryList:()=>memory.list().join('\n')||'Nada guardado ainda.',
  reminderAdd:a=>{const at=Number(a.minutes_from_now)>0?Date.now()+Number(a.minutes_from_now)*60000:atTime(a.time);reminders.add(String(a.text||'lembrete').slice(0,300),at);emit('hud',{});return `Lembrete criado para ${formatAt(at)}.`;},
  reminderList:()=>reminders.list().map(r=>`${formatAt(r.at)} — ${r.text}`).join('\n')||'Nenhum lembrete.',
  codingAgent:async a=>{desk('Acionar o agente');let dir;
   if(a.project){dir=path.join(projectsDir(),slug(a.project));if(!fs.existsSync(dir))throw Error(`Projeto ${a.project} não existe.`);}
   else if(a.new_project_name||a.is_website||!settings.lastProject||!fs.existsSync(settings.lastProject))dir=freshDir(slug(a.new_project_name||a.task.slice(0,40)));else dir=settings.lastProject;
   const task=a.is_website?`${a.task}\n\nUse HTML, CSS e JavaScript puros com index.html na raiz desta pasta, responsivo e em português do Brasil, sem servidor nem instalação de pacotes.`:a.task;
   if(!await confirmAgent(settings.agent,task,dir))return 'William recusou a tarefa.';return startAgent({task,dir,site:!!a.is_website});},
  filesSearch:a=>files().search({query:a.query||'',extension:a.extension||'',days:Number(a.days)||0}).map(h=>`${h.path} (${human(h.size)}, ${new Date(h.modified).toLocaleDateString('pt-BR')})`).join('\n')||'Nenhum arquivo encontrado.',
  folderList:p=>{const f=files();const dir=f.resolveLoose(p);return dir+'\n'+f.list(dir).map(e=>`${e.dir?'[pasta] ':''}${e.name}${e.dir?'':` (${human(e.size)})`}`).join('\n');},
  fileRead:p=>files().read(p),
  fileOpen:async p=>{const f=files().canOpen(p);const err=await shell.openPath(f);if(err)throw Error(err);return 'Aberto.';},
  folderOrganize:async p=>{desk('Organizar pastas');const f=files();const plan=f.plan(p);if(!plan.moves.length)return 'Não há arquivos soltos para organizar.';const summary=summarizePlan(plan);
   const r=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Organizar',message:'Organizar esta pasta por tipo de arquivo?',detail:summary+'\n\nNada é apagado; os arquivos só mudam para subpastas. Dá para desfazer.',buttons:['Cancelar','Organizar'],defaultId:1,cancelId:0,noLink:true});
   if(r.response!==1)return 'William cancelou.';const done=f.apply(plan);audit('organize',{count:done.length});return `${done.length} arquivos organizados. ${summary}`;},
  folderUndo:()=>`${files().undo()} arquivos voltaram ao lugar original.`,
  optimize:()=>handleSkill({type:'optimize'},source,token),
  screenLook:q=>screenLook(q),
  screenClick:(t,d)=>{desk('Clicar na tela');return screenClick(t,d);},
  screenType:(t,e)=>{desk('Digitar na tela');return screenType(t,e);},
  pressKeys:k=>{desk('Usar o teclado');return pressKeys(k);},
  github:repo=>integ.githubOverview({token:apiKeys.github,repo,signal}),
  calendar:days=>calendarText(days,signal),
  email:limit=>emailText(limit),
  whatsapp:(c,m)=>{desk('Abrir o WhatsApp');return whatsappSend(c,m);},
  briefing:()=>briefingText(),
 };}
// ===== Integrações: agenda, e-mail, WhatsApp e resumo do dia =====
async function calendarText(days=1,signal,offset=0){const from=new Date();from.setDate(from.getDate()+offset);if(!secrets.ics)throw Error('Agenda não configurada. Em Configuração → Integrações, cole o "endereço secreto no formato iCal" do Google Agenda.');return (offset===1?'Amanhã: ':'')+integ.describeAgenda(integ.agenda(await integ.fetchCalendar(secrets.ics,{signal}),{days,now:from}),days).replace(/^Nenhum compromisso hoje\./,offset===1?'nenhum compromisso.':'Nenhum compromisso hoje.');}
async function emailText(limit=5){return integ.describeEmails(await integ.unreadEmails({address:settings.emailAddress,password:secrets.imap,host:settings.emailHost,limit}));}
async function whatsappSend(contact,message){const {name,phone}=integ.phoneOf(contact,settings.contacts);const u=integ.whatsappUrls(phone,String(message||'').slice(0,2000));
 try{await shell.openExternal(u.app);}catch{await shell.openExternal(u.web);}audit('whatsapp-opened');return `WhatsApp aberto com a mensagem para ${name}. Falta só o senhor apertar enviar.`;}
// Resumo do dia: cada parte é opcional e não trava as outras.
async function briefingText(){const now=new Date();const parts=[greeting(now)];const t=AbortSignal.timeout(15000);
 const [cal,mail,wx]=await Promise.allSettled([secrets.ics?integ.fetchCalendar(secrets.ics,{signal:t}).then(ics=>integ.agenda(ics,{days:1,now})):Promise.resolve(null),settings.emailAddress&&secrets.imap?integ.unreadEmails({address:settings.emailAddress,password:secrets.imap,host:settings.emailHost,limit:3}):Promise.resolve(null),settings.city?weather(settings.city,fetch,t):Promise.resolve(null)]);
 if(cal.status==='fulfilled'&&cal.value){const left=cal.value.filter(e=>e.allDay||e.at>=now);parts.push(left.length?`Hoje o senhor tem ${left.length} compromisso${left.length>1?'s':''}: `+left.slice(0,3).map(e=>`${e.allDay?'':e.at.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' '}${e.summary}`).join('; ')+'.':'Sua agenda está livre hoje.');}
 if(mail.status==='fulfilled'&&mail.value)parts.push(mail.value.total?`Há ${mail.value.total} e-mail${mail.value.total>1?'s':''} não lido${mail.value.total>1?'s':''}${mail.value.messages[0]?`, o mais recente de ${mail.value.messages[0].from}`:''}.`:'Nenhum e-mail novo.');
 const today=reminders.list().filter(r=>new Date(r.at).toDateString()===now.toDateString());if(today.length)parts.push(`${today.length} lembrete${today.length>1?'s':''} para hoje, o próximo às ${formatAt(today[0].at)}.`);
 if(wx.status==='fulfilled'&&wx.value)parts.push(wx.value);
 return parts.join(' ');}
function loadSecrets(){const d=secretStore.load({});secrets={imap:typeof d.imap==='string'?d.imap:'',ics:typeof d.ics==='string'?d.ics:''};}
// ===== Visão da tela e controle =====
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let lastPoint=null;
// Tira o COSMO da frente para enxergar e clicar no que está atrás dele.
async function hideSelf(){if(win&&win.isVisible()&&!win.isMinimized()){const focused=win.isFocused();win.minimize();await sleep(450);return focused;}return false;}
async function captureScreen(){const d=displays.getPrimaryDisplay();const size=screenLib.captureSize(d);const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:size.width,height:size.height}});const src=sources.find(x=>String(x.display_id)===String(d.id))||sources[0];if(!src||src.thumbnail.isEmpty())throw Error('Não consegui capturar a tela.');const real=src.thumbnail.getSize();return {...size,width:real.width,height:real.height,image:{mime:'image/jpeg',data:src.thumbnail.toJPEG(82).toString('base64')}};}
async function screenLook(q){const restore=await hideSelf();try{const shot=await captureScreen();audit('screen-look');return await llm.vision(screenLib.lookPrompt(q,shot.width,shot.height),shot.image,settings,apiKeys,controller.signal);}finally{if(restore){win.restore();win.focus();}}}
async function confirmScreen(message,detail){if(settings.confirmClicks===false)return true;const r=await dialog.showMessageBox({type:'question',title:'COSMO • Tela',message,detail,buttons:['Cancelar','Confirmar'],defaultId:1,cancelId:0,noLink:true});await sleep(300);return r.response===1;}
async function screenClick(target,double){if(process.platform!=='win32')throw Error('Clicar na tela exige Windows.');await hideSelf();const shot=await captureScreen();
 const p=screenLib.parsePoint(await llm.vision(screenLib.clickPrompt(target,shot.width,shot.height),shot.image,settings,apiKeys,controller.signal));if(!p.found)return `Não encontrei "${target}" na tela: ${p.reason}.`;
 const pt=screenLib.toPhysical(p,shot);if(!await confirmScreen(`${double?'Clicar duas vezes':'Clicar'} em "${p.label||target}"?`,`Posição na tela: ${pt.x}, ${pt.y}. O COSMO localizou este elemento pela imagem; confirme se é o certo.`))return 'William cancelou o clique.';
 await runControl({type:'click',x:pt.x,y:pt.y,double},'clique');lastPoint={...pt,at:Date.now()};audit('screen-click');return `Cliquei em ${p.label||target}.`;}
async function screenType(text,enter){if(process.platform!=='win32')throw Error('Digitar na tela exige Windows.');if(!lastPoint||Date.now()-lastPoint.at>180000)throw Error('Primeiro clique no campo onde devo digitar (use screen_click).');
 if(!await confirmScreen('Digitar este texto no campo selecionado?',`${text.slice(0,600)}${enter?'\n\nDepois aperto Enter.':''}\n\nO texto passa pela área de transferência (substitui o que estiver copiado).`))return 'William cancelou a digitação.';
 await runControl({type:'type_here',text:String(text).slice(0,4000),enter:!!enter,x:lastPoint.x,y:lastPoint.y},'digitação');audit('screen-type');return 'Texto digitado'+(enter?' e Enter pressionado.':'.');}
async function pressKeys(keys){if(process.platform!=='win32')throw Error('Atalhos exigem Windows.');if(!screenLib.KEYS.includes(keys))throw Error('Atalho não permitido.');await hideSelf();await runControl({type:'keys',keys},'atalho');audit('screen-keys',{keys});return 'Atalho pressionado.';}
function hasAi(){return !!(apiKeys.groq||apiKeys.gemini||apiKeys.anthropic);}
async function think(text,source,token){
 const tools=makeTools(brainContext(source,token)).filter(t=>!BRAIN_PENDING.has(t.name));
 const system=[BRAIN_SYSTEM,`Data e hora local: ${new Date().toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'short'})}.`,settings.city?`Cidade de William: ${settings.city}.`:'',memory.context()].filter(Boolean).join('\n\n');
 emit('steps',{status:'start'});
 try{const out=await runBrain({text,history,tools,llmCall:(t,specs)=>llm.chatTools(t,specs,settings,apiKeys,controller.signal,system),onStep:s=>{audit('brain-tool',{tool:s.name});emit('steps',{status:'step',label:s.label});},shouldContinue:()=>epoch===token&&!gate.paused});
  return {say:out.say};}
 finally{emit('steps',{status:'end'});}
}
async function handleSkill(k,source,token){
 const agentOnly=()=>{if(source!=='desktop')throw Error('Tarefas do agente só podem começar no computador.');};
 if(k.type==='agent_site'||k.type==='agent_new'||k.type==='agent_task'){agentOnly();const agent=k.agent||settings.agent;let dir,task,site=false;
  if(k.type==='agent_site'){dir=freshDir(slug(k.topic));task=sitePrompt(k.topic);site=true;}
  else if(k.type==='agent_new'){dir=freshDir(slug(k.task));task=`${k.task}. Crie o projeto completo nesta pasta e, ao terminar, explique em até 2 frases como usar.`;}
  else if(k.project){dir=path.join(projectsDir(),slug(k.project));if(!fs.existsSync(dir)){let list=[];try{list=fs.readdirSync(projectsDir(),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);}catch{}throw Error(`Não encontrei o projeto ${k.project}.`+(list.length?` Projetos: ${list.slice(0,8).join(', ')}.`:''));}task=k.task;}
  else{dir=settings.lastProject&&fs.existsSync(settings.lastProject)?settings.lastProject:projectsDir();task=k.task;}
  if(!await confirmAgent(agent,task,dir))return 'Tarefa cancelada, senhor.';if(epoch!==token)throw Error('Pedido cancelado.');return startAgent({agent,task,dir,site});}
 if(k.type==='briefing')return await briefingText();
 if(k.type==='calendar')return await calendarText(k.days,controller.signal,k.offset||0);
 if(k.type==='email')return await emailText(5);
 if(k.type==='whatsapp'){if(source!=='desktop')throw Error('O WhatsApp só pode ser aberto no computador.');return await whatsappSend(k.contact,k.message);}
 if(k.type==='open_projects'){fs.mkdirSync(projectsDir(),{recursive:true});const err=await shell.openPath(projectsDir());if(err)throw Error(err);return 'Pasta de projetos aberta, senhor.';}
 if(k.type==='youtube'){const url=k.search||!k.query?(k.query?'https://www.youtube.com/results?search_query='+encodeURIComponent(k.query):'https://www.youtube.com/'):await web.youtubeUrl(k.query,{signal:controller.signal});await openSite(url,source);return k.query?`Colocando ${k.query} no YouTube, senhor.`:'YouTube aberto, senhor.';}
 if(k.type==='ask_ai'){let q=k.query;if(!q&&!k.open)q=[...history].reverse().find(h=>h.role==='assistant')?.content||'';const names={chatgpt:'ChatGPT',claude:'Claude',gemini:'Gemini'};
  if(k.ai==='gemini'&&q){clipboard.writeText(q);await openSite(web.SITES.gemini(),source);return 'Abri o Gemini e copiei a pergunta, senhor. É só colar.';}
  await openSite(q?web.SITES[k.ai](q):web.SITES[k.ai]('').replace(/\?q=$/,''),source);return q?`Enviado ao ${names[k.ai]}, senhor.`:`${names[k.ai]} aberto, senhor.`;}
 if(k.type==='google'){await openSite(web.SITES.google(k.query),source);return `Pesquisando ${k.query} no Google, senhor.`;}
 if(k.type==='research'){const r=await web.research(k.query,{signal:controller.signal});const sources=(r.pages.length?r.pages:r.results).map((p,i)=>`[${i+1}] ${p.title} — ${p.url}`).join('\n');
  if(!apiKeys.groq&&!apiKeys.gemini)return {say:`Encontrei estes resultados, senhor: ${r.results.slice(0,3).map(x=>x.title).join('; ')}. Para eu ler e resumir, salve uma chave Groq ou Gemini no cofre.`,text:`Resultados para "${k.query}":\n${sources}`};
  const out=await llm.chatAuto([{role:'user',content:web.researchPrompt(k.query,r)}],{...settings,memory:'',now:new Date().toLocaleString('pt-BR')},apiKeys,controller.signal);if(epoch!==token)throw Error('Pedido cancelado.');
  return {say:out.say.replace(/\s*\[\d+(?:,\s*\d+)*\]/g,''),text:`${out.say}\n\nFontes:\n${sources}`};}
 if(k.type==='optimize'){const info=sysinfo();const tmp=os.tmpdir();const analysis={disk:optimize.diskFree(),temp:optimize.dirSize(tmp),top:await optimize.topProcesses(5),mem:info.mem};let say=optimize.report(analysis);
  if(source!=='desktop')return say+' Para limpar, peça no computador.';
  const r=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Otimização',message:'Fazer a limpeza agora?',detail:`${say}\n\nVou apagar arquivos temporários com mais de 1 dia (os que estiverem em uso são mantidos) e esvaziar a Lixeira. Nada mais é alterado.`,buttons:['Só a análise','Limpar agora'],defaultId:1,cancelId:0,noLink:true});
  if(r.response!==1)return say+' Não alterei nada.';const c=optimize.cleanTemp(tmp);let bin='';try{await runControl({type:'empty_recycle'},'esvaziamento da Lixeira');bin=' e esvaziei a Lixeira';}catch{}audit('optimize',{freed:c.freed,removed:c.removed});
  return `Limpeza concluída, senhor: liberei ${optimize.mb(c.freed)} MB de temporários${bin}. Para o PC iniciar mais rápido, diga: abra os aplicativos de inicialização.`;}
 if(k.type==='recycle'){if(source!=='desktop')throw Error('Esvaziar a Lixeira só é permitido no computador.');const r=await dialog.showMessageBox(win,{type:'warning',message:'Esvaziar a Lixeira?',detail:'Os arquivos da Lixeira serão apagados definitivamente.',buttons:['Cancelar','Esvaziar'],defaultId:0,cancelId:0});if(r.response!==1)return 'Mantive a Lixeira como está, senhor.';await runControl({type:'empty_recycle'},'esvaziamento da Lixeira');audit('recycle-emptied');return 'Lixeira esvaziada, senhor.';}
 if(k.type==='startup_apps'){if(process.platform!=='win32')throw Error('Exige Windows.');await shell.openExternal('ms-settings:startupapps');return 'Aqui estão os aplicativos de inicialização, senhor. Desligue os que não precisam abrir com o Windows.';}
 if(k.type==='task_manager'){if(process.platform!=='win32')throw Error('Exige Windows.');spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','Taskmgr.exe'),[],{detached:true,stdio:'ignore'}).unref();return 'Gerenciador de Tarefas aberto, senhor.';}
 throw Error('Comando desconhecido.');
}
const MEDIA_SAY={volume_up:'Volume aumentado, senhor.',volume_down:'Volume reduzido, senhor.',mute:'Som alternado, senhor.',play_pause:'Feito, senhor.',next:'Próxima faixa, senhor.',previous:'Faixa anterior, senhor.'};
function remindSay(r){return r.timer?'Senhor, o tempo do seu timer acabou.':r.alarm?`Senhor, são ${formatAt(r.at)}. Seu alarme.`:`Senhor, um lembrete: ${r.text}.`;}
async function handleJarvis(j,source,token){
 if(j.type==='memory_add'){const saved=memory.add(j.text);audit('memory-added');return saved?'Anotado, senhor. Vou me lembrar disso.':'Anotado, senhor, mas só até fechar o COSMO: a criptografia do sistema não está disponível.';}
 if(j.type==='memory_list'){const l=memory.list();return l.length?`Eu sei que ${l.slice(-10).join('; ')}.`:'Ainda não guardei nada sobre o senhor. Diga, por exemplo: Cosmo, lembre que eu prefiro café sem açúcar.';}
 if(j.type==='memory_clear'){if(source!=='desktop')throw Error('Apagar a memória só é permitido no computador.');const r=await dialog.showMessageBox(win,{type:'warning',message:'Apagar toda a memória do COSMO?',detail:'Tudo o que você pediu para ele lembrar será apagado deste computador.',buttons:['Cancelar','Apagar memória'],defaultId:0,cancelId:0});if(r.response!==1)return 'Mantive a memória, senhor.';memory.clear();audit('memory-cleared');return 'Memória apagada, senhor. Começamos do zero.';}
 if(j.type==='memory_forget'){const n=memory.forget(j.text);audit('memory-forget',{count:n});return n?`Esquecido, senhor. Removi ${n} lembrança${n>1?'s':''}.`:'Não encontrei nada sobre isso na minha memória, senhor.';}
 if(j.type==='reminder_add'){const delay=j.at-Date.now();reminders.add(j.text||'seu lembrete',j.at);audit('reminder-added',{kind:j.timer?'timer':j.alarm?'alarm':'reminder'});emit('hud',{});
  if(j.timer)return `Timer de ${describeDelay(delay)} iniciado, senhor.`;if(j.alarm)return `Alarme definido para as ${formatAt(j.at)}, senhor.`;
  return `Certo, senhor. ${delay<3600000?`Em ${describeDelay(delay)}`:`Às ${formatAt(j.at)}`} vou lembrá-lo de ${j.text||'seu compromisso'}.`;}
 if(j.type==='reminder_unclear')return 'Para quando, senhor? Diga, por exemplo: me lembre de ligar para o João em 10 minutos, ou às 15 horas.';
 if(j.type==='reminder_list'){const l=reminders.list();return l.length?`O senhor tem ${l.length} lembrete${l.length>1?'s':''}: `+l.slice(0,5).map(r=>`${r.text.replace(/\.$/,'')} às ${formatAt(r.at)}`).join('; ')+'.':'Nenhum lembrete pendente, senhor.';}
 if(j.type==='reminder_clear'){reminders.clear();emit('hud',{});return 'Todos os lembretes foram cancelados, senhor.';}
 if(j.type==='weather')return await weather(j.city||settings.city,fetch,controller.signal);
 if(j.type==='system_status')return statusReport(sysinfo(),{reminders:reminders.list().length});
 if(j.type==='media'){if(source!=='desktop')return await authorize({type:'media',key:j.key});await runMedia(j.key);audit('media',{key:j.key});return MEDIA_SAY[j.key];}
 if(j.type==='greeting')return greeting(new Date());
 throw Error('Comando desconhecido.');
}
async function checkUpdate(){const result=await updater.check();emit('update',{update:result});audit('update-checked',{found:result?result.version:null});return result?`Versão ${result.version} disponível. ${result.notes}`:'Você está na versão mais recente publicada.';}
function backupUserData(tag){const dest=path.join(dataDir,'updates',`backup-${tag}-${Date.now()}`);fs.mkdirSync(dest,{recursive:true});for(const f of ['settings.json','vault.enc','modes.json','history.json','audit.jsonl','memory.enc','reminders.enc','integrations.enc']){try{fs.copyFileSync(path.join(dataDir,f),path.join(dest,f));}catch{}}return dest;}
async function installUpdate(){if(!updater.available)throw Error('Nenhuma atualização verificada disponível. Verifique primeiro.');const m=updater.available;const answer=await dialog.showMessageBox(win,{type:'question',message:`Instalar COSMO ${m.version}?`,detail:m.notes+'\nO COSMO será fechado após abrir o instalador. O Windows poderá pedir confirmação. Seus dados serão preservados.',buttons:['Cancelar','Instalar'],cancelId:0,defaultId:0});if(answer.response!==1)return 'Instalação cancelada.';const token=epoch;setState('updating');const file=await updater.download();if(token!==epoch)throw Error('Atualização cancelada antes da execução.');const backup=backupUserData(m.version);audit('update-backup',{dest:backup});const err=await shell.openPath(file);if(err)throw Error(err);app.quit();return 'Instalador aberto.';}
async function handleChat(value,source='desktop'){
 const text=stripName(cleanText(value));if(intent(text).type==='stop'){stop();return {say:'Pausado. Microfone e controle desligados.'};}
 if(gate.paused)throw Error('COSMO pausado. Clique em Retomar no computador.');if(busy)throw Error('Já estou processando um pedido. Você pode interromper.');busy=true;const token=epoch;controller=new AbortController();setState('thinking');
 try{
 const i=intent(text);const j=jarvisIntent(text);let result;
 const k=j?null:skillIntent(text);
 if(j)result={say:await handleJarvis(j,source,token)};
 else if(k){const out=await handleSkill(k,source,token);result=typeof out==='string'?{say:out}:out;}
 else if(i.type==='time')result={say:`Agora são ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.`};
 else if(i.type==='updates')result={say:await checkUpdate()};
 else if(i.type==='changelog')result={say:updater.available?.notes||'Nenhuma atualização nova verificada. Esta versão inclui voz local, holograma e controle supervisionado.'};
 else if(i.type==='install_update'){if(source!=='desktop')throw Error('Instalação só pode começar no computador.');result={say:await installUpdate()};}
 else if(i.type==='work_mode_start'){if(source!=='desktop')throw Error('Modo Trabalho só pode ser iniciado no computador.');const report=modeStore.hasSaved('trabalho')?await voiceModes.start('trabalho',{shouldContinue:()=>!gate.paused&&epoch===token}):await workMode.start({shouldContinue:()=>!gate.paused&&epoch===token});if(report.cancelled)throw Error('Modo Trabalho interrompido.');audit('work-mode-start',{success:report.results?.length||0,errors:report.errors?.length||0});result={say:report.say};}
 else if(i.type==='work_mode_end'){if(source!=='desktop')throw Error('Modo Trabalho só pode ser encerrado no computador.');result={say:workMode.end()};voiceModes.end('trabalho');}
 else if(i.type.startsWith('mode_')){
  if(source!=='desktop')throw Error('Gerenciar modos por voz só é permitido diretamente no computador.');
  const name=i.name?normalizeName(i.name):null;
  let say;
  if(i.type==='mode_list'){
   const entries=modeStore.list();say='Modo Trabalho'+(modeStore.hasSaved('trabalho')?' (personalizado)':' (padrão)')+(entries.filter(m=>m.name!=='trabalho').length?'. Outros modos salvos: '+entries.filter(m=>m.name!=='trabalho').map(m=>m.name).join(', '):'. Você ainda não salvou outros modos.');
  }else if(i.type==='mode_save'){
   const targets=parseTargets(i.targets);
   if(modeStore.hasSaved(name)){
    const response=await dialog.showMessageBox(win,{type:'question',message:`Substituir o modo ${name}?`,detail:'O modo salvo será atualizado somente com os aplicativos e sites que você acabou de dizer.',buttons:['Cancelar','Substituir modo'],defaultId:0,cancelId:0});
    if(response.response!==1){say='Alteração cancelada. O modo antigo foi mantido.';}
   }
   if(!say){modeStore.save(name,targets);voiceModes.end(name);audit('mode-saved',{name,targets});say=`Modo ${name} salvo com ${targets.map(t=>LABELS[t]).join(', ')}. Diga: Cosmo, inicie o modo ${name}.`;}
  }else if(i.type==='mode_save_existing'){
   const existing=modeStore.get(name);if(!existing)throw Error(`Para criar esse modo, diga: Cosmo, salve o modo ${name} com Brave e ChatGPT.`);
   modeStore.save(name,existing);audit('mode-saved',{name,targets:existing});say=`Modo ${name} salvo no COSMO. Você poderá pedir para iniciar esse modo novamente.`;
  }else if(i.type==='mode_add'){
   const targets=parseTargets(i.targets);modeStore.add(name,targets);voiceModes.end(name);audit('mode-edited',{name,operation:'add',targets});say=`Atualizei e salvei o modo ${name}. Adicionados: ${targets.map(t=>LABELS[t]).join(', ')}.`;
  }else if(i.type==='mode_remove'){
   const targets=parseTargets(i.targets);modeStore.remove(name,targets);voiceModes.end(name);audit('mode-edited',{name,operation:'remove',targets});say=`Atualizei e salvei o modo ${name}. Removidos: ${targets.map(t=>LABELS[t]).join(', ')}.`;
  }else if(i.type==='mode_delete'){
   if(!modeStore.hasSaved(name))throw Error('Esse modo personalizado não existe.');
   const response=await dialog.showMessageBox(win,{type:'warning',message:`Excluir o modo ${name}?`,detail:'Isso apaga somente o atalho personalizado; não fecha programas nem remove arquivos.',buttons:['Cancelar','Excluir modo'],defaultId:0,cancelId:0});
   if(response.response!==1)say='Exclusão cancelada.';else{modeStore.delete(name);voiceModes.end(name);audit('mode-deleted',{name});say=`Modo ${name} excluído.`;}
  }else if(i.type==='mode_start'){
   const report=await voiceModes.start(name,{shouldContinue:()=>!gate.paused&&epoch===token});if(report.cancelled)throw Error('Abertura interrompida.');audit('mode-started',{name,success:report.results.length,errors:report.errors.length});say=report.say;
  }else if(i.type==='mode_end')say=voiceModes.end(name);
  else throw Error('Comando desconhecido.');
  result={say};
 }
 else if(i.type==='action')result={say:await authorize(i.action)};
 else if(settings.brain!==false&&hasAi())result=await think(text,source,token);
 else{result=await llm.chatAuto([...history,{role:'user',content:text}],{...settings,memory:memory.context(),now:new Date().toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'short'})},apiKeys,controller.signal);if(epoch!==token)throw Error('Pedido cancelado.');if(result.action)result={say:await authorize(result.action)};}
 if(epoch!==token)throw Error('Pedido cancelado.');history.push({role:'user',content:text},{role:'assistant',content:result.text||result.say});if(history.length>24)history.splice(0,history.length-24);if(settings.remember)fs.writeFileSync(path.join(dataDir,'history.json'),JSON.stringify(history));audit('request-completed',{source});if(source==='android')emit('remote',{text,reply:result.text||result.say});return result;
 }catch(e){audit('request-failed',{source});throw e;}finally{if(token===epoch){busy=false;setState(gate.paused?'paused':'idle');}}
}
function stop(){epoch++;try{workMode?.end();voiceModes?.stop();}catch{}controller?.abort();controlProcess?.kill();agentRunner.stop();voice?.stop();busy=false;gate.pause();setState('paused');emit('stop');audit('paused');}
function ipc(name,fn){ipcMain.handle(name,async(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Origem IPC recusada.');try{return {ok:true,data:await fn(...args)}}catch(error){return {ok:false,error:error.message}}});}
const single=app.requestSingleInstanceLock();if(!single)app.quit();else app.whenReady().then(()=>{
 dataDir=app.getPath('userData');workMode=new WorkMode();modeStore=new ModeStore(dataDir);voiceModes=new VoiceModes(modeStore);root=app.isPackaged?process.resourcesPath:path.join(__dirname,'..');const runtime=app.isPackaged?path.join(root,'runtime'):path.join(root,'resources');python=process.platform==='win32'?path.join(runtime,'python','python.exe'):(process.env.ENZO_PYTHON||'python3');
 try{settings={...defaults,...JSON.parse(fs.readFileSync(path.join(dataDir,'settings.json'),'utf8'))}}catch{settings={...defaults}};
  loadVault();
  const crypt={available:()=>safeStorage.isEncryptionAvailable(),encrypt:t=>safeStorage.encryptString(t),decrypt:b=>safeStorage.decryptString(b)};
  memory=new Memory(new SecureStore(path.join(dataDir,'memory.enc'),crypt));
  secretStore=new SecureStore(path.join(dataDir,'integrations.enc'),crypt);loadSecrets();
  reminders=new Reminders(new SecureStore(path.join(dataDir,'reminders.enc'),crypt),r=>{const text=remindSay(r);audit('reminder-fired');emit('proactive',{text,kind:'reminder'});emit('hud',{});try{if(Notification.isSupported())new Notification({title:'COSMO',body:text}).show();}catch{}win?.flashFrame(true);});
  try{if(!vaultLib.ORDER.includes(settings.provider)){settings.provider='auto';saveSettings();}}catch{}
 if(settings.remember){try{history.push(...JSON.parse(fs.readFileSync(path.join(dataDir,'history.json'),'utf8')).slice(-24))}catch{}}
 voice=new Voice(python,path.join(root,'voice','worker.py'),path.join(runtime,'models'));
 setTimeout(()=>voice.call('warmup').catch(()=>{}),3000);
 updater=new GitHubPrivateUpdater({owner:OWNER,repo:REPO,currentVersion:app.getVersion(),publicKey:PUBLIC_KEY_PEM,directory:path.join(dataDir,'updates'),tokenProvider:async()=>{if(apiKeys.github)return apiKeys.github;if(process.env.ENZO_GITHUB_TOKEN&&process.env.ENZO_GITHUB_TOKEN.trim())return process.env.ENZO_GITHUB_TOKEN.trim();throw Error('Token de leitura do GitHub ausente. Salve em Configuração → Cofre (GitHub).');}});
 win=new BrowserWindow({width:1160,height:780,minWidth:410,minHeight:520,backgroundColor:'#080e18',title:'COSMO',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 win.on('close',e=>{if(quitting||settings.keepInTray===false)return;e.preventDefault();win.hide();if(!settings.trayHintShown){settings.trayHintShown=true;saveSettings();try{tray?.displayBalloon?.({title:'COSMO',content:'Continuo aqui na bandeja, senhor. Para sair de vez, use Sair no ícone.'});}catch{}}});
 win.on('show',()=>emit('shown'));
 win.removeMenu();win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback,details)=>callback(wc===win.webContents&&permission==='media'&&details.mediaTypes?.every(x=>x==='audio')));
 session.defaultSession.setPermissionCheckHandler((wc,permission)=>wc===win.webContents&&permission==='media');
 win.loadFile(path.join(__dirname,'../ui/index.html'));win.once('ready-to-show',()=>{if(!startHidden)win.show();if(modeStore.loadError)emit('notice',{text:'Modos: arquivo salvo precisa de reparo. Não foi sobrescrito.'});});
 const icon=nativeImage.createFromBitmap(reactorBitmap(32),{width:32,height:32,scaleFactor:2});tray=new Tray(icon);tray.setToolTip('COSMO • pronto');
 const trayMenu=()=>Menu.buildFromTemplate([{label:'Abrir COSMO',click:showWindow},{label:'Ouvir agora (Ctrl+Alt+Espaço)',click:()=>emit('toggle-mic')},{label:'Resumo do dia',click:async()=>{try{emit('proactive',{text:await briefingText(),kind:'briefing'});}catch(e){emit('notice',{text:e.message});}}},{type:'separator'},{label:'Iniciar com o Windows',type:'checkbox',checked:!!settings.autostart,click:i=>{settings.autostart=i.checked;applyAutostart();saveSettings();}},{label:'Pausar tudo',click:stop},{type:'separator'},{label:'Sair',click:()=>{quitting=true;app.quit();}}]);
 tray.setContextMenu(trayMenu());tray.on('click',()=>win.isVisible()&&win.isFocused()?win.hide():showWindow());
 const refreshTray=()=>{try{tray.setContextMenu(trayMenu());tray.setToolTip(`COSMO • ${({idle:'pronto',listening:'ouvindo',thinking:'pensando',speaking:'falando',paused:'pausado'})[state]||state}`);}catch{}};setInterval(refreshTray,5000).unref();
 globalShortcut.register('CommandOrControl+Alt+Escape',stop);globalShortcut.register('CommandOrControl+Alt+Space',()=>emit('toggle-mic'));globalShortcut.register('CommandOrControl+Alt+C',()=>win.isVisible()&&win.isFocused()?win.hide():showWindow());
 companion=new Companion(path.join(__dirname,'../android/index.html'),async ip=>{const r=await dialog.showMessageBox(win,{type:'question',message:'Conectar este Android?',detail:`Pedido recebido de ${ip}. Confirme somente se acabou de digitar o código no seu aparelho.`,buttons:['Recusar','Conectar por 1 hora'],defaultId:0,cancelId:0});return r.response===1;},text=>handleChat(text,'android'),()=>({state,paused:gate.paused}));
 ipc('status',status);ipc('diagnostics',async()=>({voice:await voice.call('health'),providers:vaultLib.statusOf(apiKeys),encryption:safeStorage.isEncryptionAvailable(),runtime:process.platform,version:app.getVersion()}));ipc('dependency',async kind=>{if(kind==='vc'){if(process.platform!=='win32')throw Error('Componente exclusivo do Windows.');const r=await dialog.showMessageBox(win,{type:'question',message:'Abrir o instalador oficial Microsoft Visual C++?',detail:'Este componente é necessário para a voz. O Windows pode pedir permissão de administrador.',buttons:['Cancelar','Abrir instalador'],defaultId:0,cancelId:0});if(r.response===1){const err=await shell.openPath(path.join(runtime,'VC_redist.x64.exe'));if(err)throw Error(err);}return true;}throw Error('Componente desconhecido.');});ipc('chat',t=>handleChat(t));
 ipc('transcribe',async audio=>{if(gate.paused)throw Error('Microfone pausado.');if(typeof audio!=='string'||audio.length>3000000)throw Error('Áudio inválido.');return voice.call('transcribe',{audio})});
 ipc('speak',async text=>{if(gate.paused)throw Error('Voz pausada.');return voice.call('speak',{text:cleanText(text,6000)})});
 ipc('stop',()=>{stop();return true});ipc('resume',()=>{gate.resume();setState('idle');return true});
 ipc('configure',cfg=>{if(!cfg||typeof cfg!=='object')throw Error('Configuração inválida.');if(typeof cfg.provider==='string')settings.provider=vaultLib.validateOrder(cfg.provider);for(const k of ['groqModel','geminiModel'])if(typeof cfg[k]==='string'&&/^[-\w.:/]{1,100}$/.test(cfg[k]))settings[k]=cfg[k];if(typeof cfg.micDevice==='string'&&cfg.micDevice.length<=500)settings.micDevice=cfg.micDevice;if(typeof cfg.micSensitivity==='string'&&['alta','normal','baixa'].includes(cfg.micSensitivity))settings.micSensitivity=cfg.micSensitivity;if(typeof cfg.city==='string'&&cfg.city.length<=80)settings.city=cfg.city.trim();if(typeof cfg.emailAddress==='string'&&cfg.emailAddress.length<=120&&(!cfg.emailAddress||/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.emailAddress.trim())))settings.emailAddress=cfg.emailAddress.trim();if(typeof cfg.emailHost==='string'&&/^[\w.-]{0,120}$/.test(cfg.emailHost.trim()))settings.emailHost=cfg.emailHost.trim();if(Array.isArray(cfg.contacts))settings.contacts=cfg.contacts.filter(c=>c&&typeof c.name==='string'&&typeof c.phone==='string').slice(0,200).map(c=>({name:c.name.trim().slice(0,60),phone:c.phone.replace(/[^\d+]/g,'').slice(0,20)})).filter(c=>c.name&&c.phone);if(typeof cfg.agent==='string'&&AGENTS[cfg.agent])settings.agent=cfg.agent;for(const k of ['claudeModel','agentModel'])if(typeof cfg[k]==='string'&&/^[-\w.:]{1,100}$/.test(cfg[k]))settings[k]=cfg[k];for(const k of ['remember','continuous','keepMicOn','autoUpdate','micNoise','micEcho','micGain','wake','greet','agentFull','quickOpen','brain','confirmClicks','briefing','autostart','keepInTray'])if(typeof cfg[k]==='boolean')settings[k]=cfg[k];if(!settings.remember)fs.rmSync(path.join(dataDir,'history.json'),{force:true});if(typeof cfg.autostart==='boolean')applyAutostart();saveSettings();return settings});
 ipc('vault-set',cfg=>{if(!cfg||typeof cfg!=='object')throw Error('Dados inválidos.');const p=vaultLib.validateProvider(cfg.provider);if(typeof cfg.key==='string'&&cfg.key.trim()===''){apiKeys[p]='';persistVault();audit('vault-cleared',{provider:p});return vaultLib.statusOf(apiKeys);}apiKeys[p]=vaultLib.validateKey(cfg.key);persistVault();audit('vault-updated',{provider:p});return vaultLib.statusOf(apiKeys)});
 ipc('vault-status',()=>({configured:vaultLib.statusOf(apiKeys),encryption:safeStorage.isEncryptionAvailable()}));
 ipc('vault-clear',provider=>{const p=vaultLib.validateProvider(provider);apiKeys[p]='';persistVault();audit('vault-cleared',{provider:p});return vaultLib.statusOf(apiKeys)});
 ipc('clear-history',()=>{history.length=0;fs.rmSync(path.join(dataDir,'history.json'),{force:true});return true});
 ipc('sysinfo',()=>{const next=reminders.list()[0];return {...sysinfo(),reminders:reminders.list().length,next:next?{text:next.text,at:next.at}:null,memories:memory.list().length}});
 ipc('greeting',async()=>{const today=new Date().toDateString();if(settings.briefing!==false&&settings.lastBriefing!==today){settings.lastBriefing=today;saveSettings();try{return await briefingText();}catch{}}return greeting(new Date());});
 ipc('integrations-status',()=>({imap:!!secrets.imap,ics:!!secrets.ics,emailAddress:settings.emailAddress,emailHost:settings.emailHost,contacts:settings.contacts,persistent:secretStore.persistent}));
 ipc('integrations-set',cfg=>{if(!cfg||typeof cfg!=='object')throw Error('Dados inválidos.');if(!secretStore.persistent)throw Error('Criptografia indisponível neste sistema. Senha não salva.');
  if(typeof cfg.imap==='string'){const v=cfg.imap.replace(/\s+/g,'');if(v&&(v.length<8||v.length>200))throw Error('Senha de app inválida.');secrets.imap=v;}
  if(typeof cfg.ics==='string'){const v=cfg.ics.trim();if(v&&!/^(https|webcal):\/\/\S{10,2000}$/i.test(v))throw Error('Link iCal inválido.');secrets.ics=v;}
  secretStore.save(secrets);audit('integrations-updated');return {imap:!!secrets.imap,ics:!!secrets.ics};});
 ipc('integrations-test',async kind=>{if(kind==='calendar')return await calendarText(1);if(kind==='email')return await emailText(3);throw Error('Teste desconhecido.');});
 ipc('agent-status',()=>({available:agentRunner.available(),busy:agentRunner.busy,projectsDir:projectsDir(),agent:settings.agent}));
 ipc('pick-projects',async()=>{const r=await dialog.showOpenDialog(win,{title:'Pasta dos projetos do COSMO',defaultPath:projectsDir(),properties:['openDirectory','createDirectory']});if(r.canceled||!r.filePaths[0])return projectsDir();settings.projectsDir=r.filePaths[0];saveSettings();return projectsDir();});
 ipc('memory-list',()=>({facts:memory.list(),persistent:safeStorage.isEncryptionAvailable()}));
 ipc('memory-delete',index=>{memory.remove(index);audit('memory-deleted');return memory.list()});
 ipc('memory-clear',()=>{memory.clear();audit('memory-cleared');return []});
 ipc('check-update',checkUpdate);ipc('install-update',installUpdate);
 ipc('android',async enabled=>{if(enabled!==true){companion.stop();return null;}const r=await dialog.showMessageBox(win,{type:'warning',message:'Ativar conexão com Android nesta rede?',detail:'Use somente uma rede Wi-Fi privada e confiável. Esta conexão local usa HTTP, sem criptografia de transporte. Não envie senhas ou dados sensíveis. Os comandos de controle exigem aprovação no PC.',buttons:['Cancelar','Ativar'],defaultId:0,cancelId:0});if(r.response!==1)return null;return companion.start();});
 ipc('window',mode=>{if(mode==='compact'){settings.compact=!settings.compact;win.setAlwaysOnTop(settings.compact);win.setSize(settings.compact?440:1160,settings.compact?600:780);emit('compact',{enabled:settings.compact});return settings.compact;}if(mode==='minimize')win.minimize();return true});
 if(settings.autoUpdate!==false){updateTimer=setInterval(()=>updater.check().then(update=>emit('update',{update})).catch(()=>{}),6*3600000);setTimeout(()=>updater.check().then(update=>emit('update',{update})).catch(e=>emit('notice',{text:'Atualizações: '+e.message})),15000);}
});
app.on('before-quit',()=>{quitting=true;clearInterval(updateTimer);reminders?.stop();voice?.stop();companion?.stop();controller?.abort();controlProcess?.kill();clearSecrets();globalShortcut.unregisterAll()});app.on('window-all-closed',()=>app.quit());

app.on('second-instance',()=>showWindow());
