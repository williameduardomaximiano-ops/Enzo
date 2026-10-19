const {app,BrowserWindow,ipcMain,dialog,shell,globalShortcut,session,Tray,Menu,nativeImage,safeStorage}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');const {spawn}=require('node:child_process');
const {Gate,APPS,cleanText}=require('../core/policy.cjs');const {MissionCenter}=require('../core/mission-center.cjs');const {MemoryStore}=require('../core/local-memory.cjs');const {Recovery}=require('../core/recovery.cjs');const {createDraft}=require('../core/outreach-draft.cjs');const {observeWindows}=require('../core/windows-observer.cjs');const {runScript,validateButton}=require('../core/windows-controls.cjs');const {searchRestaurants}=require('../core/osm-prospecting.cjs');const {publishPreview}=require('../core/vercel-preview.cjs');const {intent}=require('../core/intent.cjs');const {WorkMode}=require('../core/workmode.cjs');const {ModeStore,VoiceModes,parseTargets,normalizeName,LABELS}=require('../core/modes.cjs');const llm=require('../core/llm.cjs');const {Voice}=require('../core/voice.cjs');const {DashboardMetrics}=require('../core/dashboard-metrics.cjs');const {LocalCalendar}=require('../core/local-calendar.cjs');const {VOICES,TONES,voiceById,toneById,validateVoice,validateTone,matchVoiceIntent}=require('../core/voice-catalog.cjs');const {AVATARS,validateAvatar,avatarIntent,byId:avatarById}=require('../core/avatar-presets.cjs');const {GitHubPrivateUpdater}=require('../updater/github-private.cjs');const {OWNER,REPO,PUBLIC_KEY_PEM}=require('../core/update-channel.cjs');const {Companion}=require('../core/android.cjs');const vaultLib=require('../core/vault.cjs');
let win,tray,voice,updater,companion,workMode,modeStore,voiceModes,metrics,calendar,missions,memories,recovery,root,python,dataDir,settings,controller,busy=false,epoch=0,updateTimer,controlProcess;const gate=new Gate();const history=[];let state='idle';
const defaults={remember:false,continuous:false,compact:false,provider:'auto',groqModel:'openai/gpt-oss-120b',geminiModel:'gemini-3.5-flash',autoUpdate:true,micDevice:'',micSensitivity:'normal',micNoise:true,micEcho:true,micGain:true,voiceProfile:'piper-faber',voiceTone:'natural',avatarPreset:'original'};
let apiKeys=vaultLib.emptyVault();const observedWindows=new Map();const inspectedControls=new Map();
function emit(type,data={}){win?.webContents.send('event',{type,...data});}
function setState(s){state=s;emit('state',{state:s});}
function audit(type,data={}){const entry={at:new Date().toISOString(),type,...data};fs.appendFileSync(path.join(dataDir,'audit.jsonl'),JSON.stringify(entry)+'\n');}
function status(){return {version:app.getVersion(),state,settings,paused:gate.paused,platform:process.platform,ramGB:Math.round(os.totalmem()/2**30),cpus:os.cpus().length,providers:vaultLib.statusOf(apiKeys),encryption:safeStorage.isEncryptionAvailable(),update:updater.available?{version:updater.available.version,notes:updater.available.notes}:null};}
function saveSettings(){fs.writeFileSync(path.join(dataDir,'settings.json'),JSON.stringify(settings,null,2));}
function vaultFile(){return path.join(dataDir,'vault.enc');}
function loadVault(){let raw=null;try{const b=Buffer.from(fs.readFileSync(vaultFile(),'utf8'),'base64');raw=JSON.parse(safeStorage.decryptString(b));}catch{try{audit('vault-load-failed',{stage:'open'});}catch{}apiKeys=vaultLib.emptyVault();return;}const next=vaultLib.emptyVault();for(const p of vaultLib.PROVIDERS){try{if(raw&&typeof raw[p]==='string'&&raw[p])next[p]=vaultLib.validateKey(raw[p]);}catch{try{audit('vault-load-failed',{stage:p});}catch{}}}apiKeys=next;}
function persistVault(){if(!safeStorage.isEncryptionAvailable())throw Error('Criptografia indisponível neste sistema. Chave não salva.');const tmp=vaultFile()+'.tmp';fs.writeFileSync(tmp,safeStorage.encryptString(JSON.stringify(apiKeys)).toString('base64'));try{const back=JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(tmp,'utf8'),'base64')));if(vaultLib.statusOf(back).groq!==vaultLib.statusOf(apiKeys).groq)throw Error('verificação');}catch{try{fs.rmSync(tmp,{force:true});}catch{}throw Error('Falha ao conferir o cofre. Chave não salva.');}fs.rmSync(vaultFile(),{force:true});fs.renameSync(tmp,vaultFile());}
function clearSecrets(){apiKeys=vaultLib.emptyVault();}
async function authorize(action){const pending=gate.propose(action);setState('permission');const a=pending.action;const detail=a.type==='open_app'?APPS[a.app]:a.type==='open_url'?a.url:a.type==='type_text'?`Colar este texto na janela que você escolher (substitui a área de transferência):\n${a.text}`:`Atalho: ${a.key}`;
 const result=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Permissão',message:'Autorizar esta ação?',detail,buttons:['Cancelar','Autorizar uma vez'],defaultId:0,cancelId:0,noLink:true});const allowed=gate.consume(pending.id,result.response===1);if(!allowed)return 'Ação cancelada.';audit('action-approved',{action:allowed.type});setState('executing');
 if(allowed.type==='open_app'){
 if(process.platform!=='win32')throw Error('Este comando exige Windows.');
 const exe=path.join(process.env.SystemRoot||'C:\\Windows',allowed.app==='explorador'?'':'System32',APPS[allowed.app]);
 await new Promise((resolve,reject)=>{const p=spawn(exe,[],{detached:true,stdio:'ignore',windowsHide:false});p.once('error',reject);p.once('spawn',()=>{p.unref();resolve()})});
 }else if(allowed.type==='open_url'){await shell.openExternal(allowed.url);}else{
 if(process.platform!=='win32')throw Error('Este comando exige Windows.');emit('notice',{text:'Selecione a janela de destino. Ação em 5 segundos. Ctrl+Alt+Esc cancela.'});win.minimize();const token=epoch;await new Promise(r=>setTimeout(r,5000));if(epoch!==token||gate.paused)throw Error('Ação interrompida.');
 await new Promise((resolve,reject)=>{const p=spawn(python,['-u',path.join(root,'voice','windows_control.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});controlProcess=p;let out='';p.stdout.on('data',x=>out+=x);p.on('error',reject);p.on('exit',code=>{controlProcess=null;code===0?resolve():reject(Error('Ação interrompida ou falhou. '+out.slice(0,300)))});p.stdin.end(JSON.stringify(allowed));});
 }
 audit('action-completed',{action:allowed.type});return 'Comando executado.';
}
async function checkUpdate(){const result=await updater.check();emit('update',{update:result});audit('update-checked',{found:result?result.version:null});return result?`Versão ${result.version} disponível. ${result.notes}`:'Você está na versão mais recente publicada.';}
function backupUserData(tag){const dest=path.join(dataDir,'updates',`backup-${tag}-${Date.now()}`);fs.mkdirSync(dest,{recursive:true});for(const f of ['settings.json','vault.enc','modes.json','history.json','audit.jsonl','calendar.json']){try{fs.copyFileSync(path.join(dataDir,f),path.join(dest,f));}catch{}}return dest;}
async function installUpdate(){if(!updater.available)throw Error('Nenhuma atualização verificada disponível. Verifique primeiro.');const m=updater.available;const answer=await dialog.showMessageBox(win,{type:'question',message:`Instalar COSMO ${m.version}?`,detail:m.notes+'\nO COSMO será fechado após abrir o instalador. O Windows poderá pedir confirmação. Seus dados serão preservados.',buttons:['Cancelar','Instalar'],cancelId:0,defaultId:0});if(answer.response!==1)return 'Instalação cancelada.';const token=epoch;setState('updating');const file=await updater.download();if(token!==epoch)throw Error('Atualização cancelada antes da execução.');const backup=recovery.backup('pre-update');audit('update-backup',{id:backup.id});const err=await shell.openPath(file);if(err)throw Error(err);app.quit();return 'Instalador aberto.';}
async function handleChat(value,source='desktop'){
 const text=cleanText(value);if(intent(text).type==='stop'){stop();return {say:'Pausado. Microfone e controle desligados.'};}
 if(gate.paused)throw Error('COSMO pausado. Clique em Retomar no computador.');if(busy)throw Error('Já estou processando um pedido. Você pode interromper.');busy=true;const token=epoch;controller=new AbortController();setState('thinking');
 try{
 const i=avatarIntent(text)||matchVoiceIntent(text)||intent(text);let result;
 if(i.type==='avatar_select'){const preset=avatarById(validateAvatar(i.avatar));settings.avatarPreset=preset.id;saveSettings();emit('avatar',{avatar:preset.id});result={say:'Aparência '+preset.name+' selecionada e salva.'};}
 else if(i.type==='voice_select'){const profile=voiceById(validateVoice(i.voice));settings.voiceProfile=profile.id;saveSettings();result={say:'Voz '+profile.name+' selecionada. Você pode testá-la em Configuração, na seção Voz Neural.'};}
 else if(i.type==='voice_tone'){const tone=toneById(validateTone(i.tone));settings.voiceTone=tone.id;saveSettings();result={say:'Estilo de voz '+tone.name+' salvo.'};}
 else if(i.type==='memory_add'){
   if(source!=='desktop')throw Error('Salvar memórias exige o computador.');
   if(!memories)throw Error('Memória protegida indisponível neste Windows.');
   const m=memories.add(i.text);audit('memory-added',{id:m.id});
   result={say:'Memória salva de forma criptografada neste computador. Você pode vê-la ou apagá-la na aba Memória.'};
 }
 else if(i.type==='memory_search'){
   if(!memories)throw Error('Memória protegida indisponível neste Windows.');
   const items=memories.search(i.query);result={say:items.length?'Na memória local encontrei: '+items.map(x=>x.text).join(' | ').slice(0,1500):'Não encontrei essa informação na memória local.'};
 }
 else if(i.type==='mission_create'){if(source!=='desktop')throw Error('Missões devem ser criadas diretamente no computador.');const m=missions.create(i.goal);emit('mission',{id:m.id,status:m.status});result={say:'Missão criada: '+m.kind+'. Abra a aba Missões para revisar e autorizar o OpenCode. Nada foi executado ainda.'};}
 else if(i.type==='mission_list'){const entries=missions.list().slice(0,5);result={say:entries.length?'Últimas missões: '+entries.map(m=>m.kind+' ('+m.status+')').join('; '):'Nenhuma missão criada ainda.'};}
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
 else{result=await llm.chatAuto([...history,{role:'user',content:text}],settings,apiKeys,controller.signal);if(epoch!==token)throw Error('Pedido cancelado.');if(result.action)result={say:await authorize(result.action)};}
 if(epoch!==token)throw Error('Pedido cancelado.');history.push({role:'user',content:text},{role:'assistant',content:result.say});if(history.length>24)history.splice(0,history.length-24);if(settings.remember)fs.writeFileSync(path.join(dataDir,'history.json'),JSON.stringify(history));audit('request-completed',{source});if(source==='android')emit('remote',{text,reply:result.say});return result;
 }catch(e){audit('request-failed',{source});throw e;}finally{if(token===epoch){busy=false;setState(gate.paused?'paused':'idle');}}
}
function stop(){observedWindows.clear();inspectedControls.clear();epoch++;try{workMode?.end();voiceModes?.stop();missions?.stop();}catch{}controller?.abort();controlProcess?.kill();voice?.stop();busy=false;gate.pause();setState('paused');emit('stop');audit('paused');}
function ipc(name,fn){ipcMain.handle(name,async(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Origem IPC recusada.');try{return {ok:true,data:await fn(...args)}}catch(error){return {ok:false,error:error.message}}});}
const single=app.requestSingleInstanceLock();if(!single)app.quit();else app.whenReady().then(()=>{
 dataDir=app.getPath('userData');metrics=new DashboardMetrics();calendar=new LocalCalendar(dataDir);missions=new MissionCenter(dataDir);recovery=new Recovery(dataDir);if(safeStorage.isEncryptionAvailable())memories=new MemoryStore(dataDir,{encrypt:s=>safeStorage.encryptString(s),decrypt:b=>safeStorage.decryptString(b)});workMode=new WorkMode();modeStore=new ModeStore(dataDir);voiceModes=new VoiceModes(modeStore);root=app.isPackaged?process.resourcesPath:path.join(__dirname,'..');const runtime=app.isPackaged?path.join(root,'runtime'):path.join(root,'resources');python=process.platform==='win32'?path.join(runtime,'python','python.exe'):(process.env.ENZO_PYTHON||'python3');
 try{settings={...defaults,...JSON.parse(fs.readFileSync(path.join(dataDir,'settings.json'),'utf8'))}}catch{settings={...defaults}};
  loadVault();
  try{if(!vaultLib.ORDER.includes(settings.provider)){settings.provider='auto';saveSettings();}}catch{}
 if(settings.remember){try{history.push(...JSON.parse(fs.readFileSync(path.join(dataDir,'history.json'),'utf8')).slice(-24))}catch{}}
 voice=new Voice(python,path.join(root,'voice','worker.py'),path.join(runtime,'models'));
 updater=new GitHubPrivateUpdater({owner:OWNER,repo:REPO,currentVersion:app.getVersion(),publicKey:PUBLIC_KEY_PEM,directory:path.join(dataDir,'updates'),tokenProvider:async()=>{if(apiKeys.github)return apiKeys.github;if(process.env.ENZO_GITHUB_TOKEN&&process.env.ENZO_GITHUB_TOKEN.trim())return process.env.ENZO_GITHUB_TOKEN.trim();throw Error('Token de leitura do GitHub ausente. Salve em Configuração → Cofre (GitHub).');}});
 win=new BrowserWindow({width:1160,height:780,minWidth:410,minHeight:520,backgroundColor:'#080e18',title:'COSMO',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.removeMenu();win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback,details)=>callback(wc===win.webContents&&permission==='media'&&details.mediaTypes?.every(x=>x==='audio')));
 session.defaultSession.setPermissionCheckHandler((wc,permission)=>wc===win.webContents&&permission==='media');
 win.loadFile(path.join(__dirname,'../ui/index.html'));win.once('ready-to-show',()=>{win.show();if(modeStore.loadError)emit('notice',{text:'Modos: arquivo salvo precisa de reparo. Não foi sobrescrito.'});});
 const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAE0lEQVR42mNk+P+/HgMNgGE0DAMA5H4DHcXIo/8AAAAASUVORK5CYII=');tray=new Tray(icon);tray.setToolTip('COSMO');tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir COSMO',click:()=>{win.show();win.focus()}},{label:'Pausar tudo',click:stop},{label:'Sair',click:()=>app.quit()}]));tray.on('click',()=>win.show());
 globalShortcut.register('CommandOrControl+Alt+Escape',stop);globalShortcut.register('CommandOrControl+Alt+Space',()=>{win.show();emit('toggle-mic')});
 companion=new Companion(path.join(__dirname,'../android/index.html'),async ip=>{const r=await dialog.showMessageBox(win,{type:'question',message:'Conectar este Android?',detail:`Pedido recebido de ${ip}. Confirme somente se acabou de digitar o código no seu aparelho.`,buttons:['Recusar','Conectar por 1 hora'],defaultId:0,cancelId:0});return r.response===1;},text=>handleChat(text,'android'),()=>({state,paused:gate.paused}));
 ipc('outreach-draft',async data=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const draft=createDraft(data);
   const answer=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Primeiro contato',message:'Abrir rascunho no WhatsApp?',detail:'Empresa: '+draft.company+'\nDestino: '+draft.phone+'\nMensagem proposta:\n'+draft.message+'\n\nO WhatsApp será aberto, mas a mensagem NÃO será enviada pelo COSMO.',buttons:['Cancelar','Abrir rascunho'],defaultId:0,cancelId:0,noLink:true});
   if(answer.response!==1)return {opened:false,sent:false};
   await shell.openExternal(draft.url);
   audit('outreach-draft-opened',{sent:false});
   return {opened:true,sent:false};
 });
 ipc('observe-windows',async()=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const confirmation=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Acessibilidade',message:'Listar títulos das janelas abertas?',detail:'Apenas nomes das janelas e processos, sem ler conteúdo, capturar tela ou enviar dados à nuvem. Nenhuma janela será controlada.',buttons:['Cancelar','Permitir esta consulta'],defaultId:0,cancelId:0,noLink:true});
   if(confirmation.response!==1)return {windows:[],approved:false};
   const windows=await observeWindows();observedWindows.clear();inspectedControls.clear();for(const w of windows){observedWindows.set(w.processId,{title:w.title,expires:Date.now()+90000});}return {windows,approved:true};
 });
 ipc('controls-inspect',async pid=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const observed=observedWindows.get(pid);
   if(!observed||observed.expires<Date.now())throw Error('Janela não autorizada; consulte as janelas novamente.');
   const response=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Inspecionar controles',message:'Permitir listar botões acessíveis?',detail:'Janela: '+observed.title+'\nSomente nomes dos botões e IDs acessíveis. Nenhum clique será executado.',buttons:['Cancelar','Inspecionar'],cancelId:0,defaultId:0,noLink:true});
   if(response.response!==1)return {approved:false,controls:[]};
   const controls=await runScript(pid);
   inspectedControls.set(pid,{expires:Date.now()+60000,controls});
   return {approved:true,controls};
 });
 ipc('controls-click',async (pid,button)=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const observed=observedWindows.get(pid),recent=inspectedControls.get(pid);
   if(!observed||observed.expires<Date.now()||!recent||recent.expires<Date.now())throw Error('A inspeção expirou; leia os controles novamente.');
   const safe=validateButton(button);
   if(!recent.controls.some(x=>x.name===safe.name&&x.automationId===safe.automationId))throw Error('Botão não estava na lista de controles autorizados.');
   const response=await dialog.showMessageBox(win,{type:'warning',title:'COSMO • Clique autorizado',message:'Executar um clique acessível?',detail:'Janela: '+observed.title+'\nBotão: '+safe.name+'\nControle: '+safe.automationId+'\nO botão pode executar uma ação no aplicativo. Só permita se reconhecer sua finalidade.',buttons:['Cancelar','Autorizar um clique'],cancelId:0,defaultId:0,noLink:true});
   if(response.response!==1)return {clicked:false};
   if(gate.paused)throw Error('COSMO pausado.');
   recent.controls=[];observedWindows.delete(pid); // exigir nova inspeção antes de outro clique
   const result=await runScript(pid,safe);audit('uia-click',{processId:pid,button:safe.name.slice(0,40)});
   return {clicked:result.clicked===true};
 });
 ipc('missions-publish',async id=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const outcome=await publishPreview(missions,id,{
     approve:async ({folder,goal})=>{
       const answer=await dialog.showMessageBox(win,{type:'warning',title:'COSMO • Vercel Preview',message:'Autorizar publicação de uma prévia online?',detail:'Projeto: '+goal.slice(0,500)+'\nPasta: '+folder+'\nO deploy cria um projeto/preview na SUA conta Vercel, pode consumir cota e executar build remoto. Não publica em produção e não envia a clientes. Mantenha segredos fora do projeto.',buttons:['Cancelar','Publicar prévia'],cancelId:0,defaultId:0,noLink:true});
       return answer.response===1&&!gate.paused;
     },
     notify:e=>emit('mission',e)
   });
   if(outcome.previewUrl){audit('preview-published',{id});await shell.openExternal(outcome.previewUrl);}
   return outcome;
 });
 ipc('missions-open-live',async id=>{
   const url=missions.get(id).previewUrl;
   if(typeof url!=='string'||!/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/i.test(url))throw Error('Preview Vercel ainda não foi publicada.');
   await shell.openExternal(url);return true;
 });
 ipc('memory-status',()=>({available:!!memories,readError:memories?.readError||null,count:memories?.list().length||0}));
 ipc('memory-list',()=>{if(!memories)throw Error('Criptografia Windows indisponível.');return memories.list();});
 ipc('memory-add',note=>{if(gate.paused)throw Error('COSMO pausado.');if(!memories)throw Error('Criptografia Windows indisponível.');const result=memories.add(note);audit('memory-added',{id:result.id});return result;});
 ipc('memory-search',query=>{if(!memories)throw Error('Criptografia Windows indisponível.');return memories.search(query);});
 ipc('memory-remove',id=>{if(gate.paused)throw Error('COSMO pausado.');if(!memories)throw Error('Criptografia Windows indisponível.');const r=memories.remove(id);audit('memory-removed',{id});return r;});
 ipc('recovery-list',()=>recovery.list());
 ipc('recovery-backup',()=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const r=recovery.backup('manual');audit('backup-created',{id:r.id});return r;
 });
 ipc('recovery-restore',async id=>{
   if(gate.paused)throw Error('COSMO pausado.');
   recovery.verify(id);
   const response=await dialog.showMessageBox(win,{type:'warning',title:'COSMO • Restauração',message:'Restaurar dados locais deste backup?',detail:'Uma cópia de segurança dos dados atuais será criada primeiro. Configurações, chaves, histórico e memória poderão ser substituídos pelos dados anteriores. O aplicativo será reiniciado.',buttons:['Cancelar','Restaurar e reiniciar'],cancelId:0,defaultId:0,noLink:true});
   if(response.response!==1)return {restored:[],cancelled:true};
   const result=recovery.restore(id);
   audit('backup-restored',{id,safetyBackup:result.safetyBackup});
   app.relaunch();app.quit();
   return result;
 });
 ipc('prospecting-restaurants',async city=>{
   if(gate.paused)throw Error('COSMO pausado.');
   const question=await dialog.showMessageBox(win,{type:'question',title:'COSMO • Pesquisa de empresas',message:'Pesquisar restaurantes em fonte pública?',detail:'Cidade: '+String(city).slice(0,90)+'\nConsulta pontual no OpenStreetMap. Os resultados são sugestões não verificadas. Nenhum contato será realizado.',buttons:['Cancelar','Pesquisar 5 candidatos'],cancelId:0,defaultId:0,noLink:true});
   if(question.response!==1)return {cancelled:true,candidates:[]};
   const data=await searchRestaurants(city);audit('prospecting-read',{city:data.city,candidates:data.candidates.length});return data;
 });
 ipc('missions-list',()=>missions.list());
 ipc('missions-create',goal=>{if(gate.paused)throw Error('COSMO pausado. Retome primeiro.');const m=missions.create(goal);audit('mission-created',{id:m.id,kind:m.kind});emit('mission',{id:m.id,status:m.status});return m;});
 ipc('missions-run',async id=>{
   if(gate.paused)throw Error('COSMO pausado. Retome primeiro.');
   const outcome=await missions.run(id,{
     approve:async ({goal,folder,executable})=>{
       const answer=await dialog.showMessageBox(win,{type:'warning',title:'COSMO • Executar missão',message:'Permitir que OpenCode crie e modifique arquivos?',detail:'Objetivo: '+goal.slice(0,700)+'\nPasta exclusiva: '+folder+'\nExecutor: '+executable+'\nIMPORTANTE: OpenCode pode executar ferramentas e comandos. Não use dados sensíveis. Revise as permissões do agente antes de autorizar.\nCOSMO não publicará o projeto nem enviará mensagens.',buttons:['Cancelar','Autorizar execução'],cancelId:0,defaultId:0,noLink:true});
       return answer.response===1&&!gate.paused;
     },notify:e=>emit('mission',e)
   });
   audit('mission-result',{id,status:outcome.status||'cancelled'});return outcome;
 });
 ipc('missions-open',async id=>{const folder=missions.folder(id);const err=await shell.openPath(folder);if(err)throw Error(err);return true;});
 ipc('missions-preview',async id=>{
   const folder=missions.folder(id);
   const choices=[path.join(folder,'index.html'),path.join(folder,'dist','index.html')];
   const preview=choices.find(p=>fs.existsSync(p));
   if(!preview)throw Error('Prévia não encontrada. Veja o README na pasta; projetos com servidor precisam de inicialização aprovada separadamente.');
   const err=await shell.openPath(preview);if(err)throw Error(err);return true;
 });
 ipc('status',status);ipc('dashboard',async()=>({system:await metrics.snapshot(),events:calendar.list(),providers:vaultLib.statusOf(apiKeys)}));ipc('calendar-add',e=>calendar.add(e));ipc('calendar-remove',id=>calendar.remove(id));ipc('diagnostics',async()=>({voice:await voice.call('health'),providers:vaultLib.statusOf(apiKeys),encryption:safeStorage.isEncryptionAvailable(),runtime:process.platform,version:app.getVersion()}));ipc('dependency',async kind=>{if(kind==='vc'){if(process.platform!=='win32')throw Error('Componente exclusivo do Windows.');const r=await dialog.showMessageBox(win,{type:'question',message:'Abrir o instalador oficial Microsoft Visual C++?',detail:'Este componente é necessário para a voz. O Windows pode pedir permissão de administrador.',buttons:['Cancelar','Abrir instalador'],defaultId:0,cancelId:0});if(r.response===1){const err=await shell.openPath(path.join(runtime,'VC_redist.x64.exe'));if(err)throw Error(err);}return true;}throw Error('Componente desconhecido.');});ipc('chat',t=>handleChat(t));
 ipc('transcribe',async audio=>{if(gate.paused)throw Error('Microfone pausado.');if(typeof audio!=='string'||audio.length>3000000)throw Error('Áudio inválido.');return voice.call('transcribe',{audio})});
 ipc('speak',async text=>{if(gate.paused)throw Error('Voz pausada.');const profile=validateVoice(settings.voiceProfile||'piper-faber');const tone=validateTone(settings.voiceTone||'natural');const safeText=cleanText(text,6000);try{return await voice.call('speak',{text:safeText,voice:profile,tone});}catch(e){if(profile==='piper-faber')throw e;audit('voice-optional-fallback',{voice:profile});const result=await voice.call('speak',{text:safeText,voice:'piper-faber',tone:'natural'});return {...result,fallback:'Voz opcional indisponível: '+e.message+'. Foi usada a voz Faber para não deixar o COSMO sem falar.'};}});
 ipc('voice-catalog',async()=>({voices:VOICES,tones:TONES,engines:(await voice.call('health')).engines||{}}));ipc('avatar-catalog',()=>AVATARS);
 ipc('stop',()=>{stop();return true});ipc('resume',()=>{gate.resume();setState('idle');return true});
 ipc('configure',cfg=>{if(!cfg||typeof cfg!=='object')throw Error('Configuração inválida.');if(cfg.avatarPreset!==undefined)settings.avatarPreset=validateAvatar(cfg.avatarPreset);if(cfg.voiceProfile!==undefined)settings.voiceProfile=validateVoice(cfg.voiceProfile);if(cfg.voiceTone!==undefined)settings.voiceTone=validateTone(cfg.voiceTone);if(typeof cfg.provider==='string')settings.provider=vaultLib.validateOrder(cfg.provider);for(const k of ['groqModel','geminiModel'])if(typeof cfg[k]==='string'&&/^[-\w.:/]{1,100}$/.test(cfg[k]))settings[k]=cfg[k];if(typeof cfg.micDevice==='string'&&cfg.micDevice.length<=500)settings.micDevice=cfg.micDevice;if(typeof cfg.micSensitivity==='string'&&['alta','normal','baixa'].includes(cfg.micSensitivity))settings.micSensitivity=cfg.micSensitivity;for(const k of ['remember','continuous','autoUpdate','micNoise','micEcho','micGain'])if(typeof cfg[k]==='boolean')settings[k]=cfg[k];if(!settings.remember)fs.rmSync(path.join(dataDir,'history.json'),{force:true});saveSettings();return settings});
 ipc('vault-set',cfg=>{if(!cfg||typeof cfg!=='object')throw Error('Dados inválidos.');const p=vaultLib.validateProvider(cfg.provider);if(typeof cfg.key==='string'&&cfg.key.trim()===''){apiKeys[p]='';persistVault();audit('vault-cleared',{provider:p});return vaultLib.statusOf(apiKeys);}apiKeys[p]=vaultLib.validateKey(cfg.key);persistVault();audit('vault-updated',{provider:p});return vaultLib.statusOf(apiKeys)});
 ipc('vault-status',()=>({configured:vaultLib.statusOf(apiKeys),encryption:safeStorage.isEncryptionAvailable()}));
 ipc('vault-clear',provider=>{const p=vaultLib.validateProvider(provider);apiKeys[p]='';persistVault();audit('vault-cleared',{provider:p});return vaultLib.statusOf(apiKeys)});
 ipc('clear-history',()=>{history.length=0;fs.rmSync(path.join(dataDir,'history.json'),{force:true});return true});
 ipc('check-update',checkUpdate);ipc('install-update',installUpdate);
 ipc('android',async enabled=>{if(enabled!==true){companion.stop();return null;}const r=await dialog.showMessageBox(win,{type:'warning',message:'Ativar conexão com Android nesta rede?',detail:'Use somente uma rede Wi-Fi privada e confiável. Esta conexão local usa HTTP, sem criptografia de transporte. Não envie senhas ou dados sensíveis. Os comandos de controle exigem aprovação no PC.',buttons:['Cancelar','Ativar'],defaultId:0,cancelId:0});if(r.response!==1)return null;return companion.start();});
 ipc('window',mode=>{if(mode==='compact'){settings.compact=!settings.compact;win.setAlwaysOnTop(settings.compact);win.setSize(settings.compact?440:1160,settings.compact?600:780);emit('compact',{enabled:settings.compact});return settings.compact;}if(mode==='minimize')win.minimize();return true});
 if(settings.autoUpdate!==false){updateTimer=setInterval(()=>updater.check().then(update=>emit('update',{update})).catch(()=>{}),6*3600000);setTimeout(()=>updater.check().then(update=>emit('update',{update})).catch(e=>emit('notice',{text:'Atualizações: '+e.message})),15000);}
});
app.on('before-quit',()=>{clearInterval(updateTimer);voice?.stop();companion?.stop();controller?.abort();controlProcess?.kill();clearSecrets();globalShortcut.unregisterAll()});app.on('window-all-closed',()=>app.quit());

app.on('second-instance',()=>{if(win){win.restore();win.show();win.focus();}});
