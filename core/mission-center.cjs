'use strict';
/** Projetos reais do COSMO; nunca executa tarefas ao criar uma missão. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const MAX_MISSIONS=100;
const CATEGORIES=Object.freeze(['site','landing','crm','ecommerce','app','prospeccao','geral']);
function category(goal){
 const s=goal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/\b(prospect|empresas|clientes potenciais|leads)\b/.test(s))return 'prospeccao';
 if(/\b(e-commerce|ecommerce|loja virtual|loja online)\b/.test(s))return 'ecommerce';
 if(/\b(crm|gestao de clientes|sistema de atendimento)\b/.test(s))return 'crm';
 if(/\b(landing page|pagina de vendas|pagina de captura)\b/.test(s))return 'landing';
 if(/\b(site|website|pagina web|portfolio)\b/.test(s))return 'site';
 if(/\b(app|aplicativo|sistema|saas|dashboard|automacao|automatizar|automacao de|controle de estoque)\b/.test(s))return 'app';
 return 'geral';
}
function validGoal(value) {
 if(typeof value!=='string')throw Error('Descreva a missão em texto.');
 const goal=value.trim();
 if(goal.length<10||goal.length>1500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(goal))throw Error('Missão deve ter de 10 a 1500 caracteres.');
 return goal;
}
function brief(goal,kind){
 return '# COSMO — briefing de missão\n\nCategoria: '+kind+'\n\nObjetivo aprovado pelo usuário:\n\n'+goal+
 '\n\n## Requisitos\n- Interface responsiva, conteúdo verdadeiro e acessibilidade.\n'+
 '- Não invente empresas, clientes, preços, avaliações, endereços ou depoimentos.\n'+
 '- Segurança: nenhuma chave de API no código, sem dados reais de clientes ou credenciais.\n'+
 '- Ao criar projetos, incluir README com instruções, testes e checklist de segurança.\n'+
 '- Não publicar, enviar mensagens, apagar arquivos fora desta pasta ou executar mudanças na conta do usuário sem confirmação.\n'+
 '- Se depender de API ou permissão não disponível, apresentar limitação claramente.\n';
}
function resolveCLI({env=process.env,exists=fs.existsSync,probe=spawnSync,platform=process.platform}={}){
 if(platform!=='win32')throw Error('A execução assistida requer Windows.');
 const custom=env.COSMO_OPENCODE_CLI||env.ENZO_OPENCODE_CLI;
 if(custom){
  if(!path.win32.isAbsolute(custom)||!custom.toLowerCase().endsWith('.exe')||!exists(custom))throw Error('COSMO_OPENCODE_CLI deve apontar para o executável opencode.exe existente.');
  return custom;
 }
 const p=probe('where.exe',['opencode'],{windowsHide:true,encoding:'utf8',timeout:3500,maxBuffer:8192,shell:false});
 if(p.error||p.status!==0)throw Error('OpenCode CLI não encontrado no PATH. Configure COSMO_OPENCODE_CLI com o caminho do opencode.exe.');
 const line=String(p.stdout||'').split(/\r?\n/).map(x=>x.trim()).find(x=>x.toLowerCase().endsWith('.exe')&&path.win32.isAbsolute(x));
 if(!line||!exists(line))throw Error('Não encontrei opencode.exe. Instale a versão CLI ou configure COSMO_OPENCODE_CLI.');
 return line;
}
function sanitizedEnvironment(env){
 const next={...env};
 for(const key of Object.keys(next))if(/^(?:GH_TOKEN|GITHUB_TOKEN|VERCEL_TOKEN|OPENAI_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|ANTHROPIC_API_KEY|ENZO_GITHUB_TOKEN)$/i.test(key))delete next[key];
 return next;
}
class MissionCenter {
 constructor(dataDir,{fsApi=fs,launcher=spawn,now=()=>new Date().toISOString()}={}){
  this.fs=fsApi;this.launcher=launcher;this.now=now;
  this.dir=path.join(dataDir,'cosmo-missions');this.file=path.join(this.dir,'index.json');this.active=null;
  this.fs.mkdirSync(this.dir,{recursive:true});this.items=[];this.load();
 }
 load(){
  try{
   const raw=JSON.parse(this.fs.readFileSync(this.file,'utf8'));
   if(!Array.isArray(raw)||raw.length>MAX_MISSIONS)throw Error('Índice de missões inválido.');
   this.items=raw.map(x=>{
    if(!x||typeof x.id!=='string'||!/^[a-f\d-]{36}$/.test(x.id)||typeof x.goal!=='string'||!CATEGORIES.includes(x.kind))throw Error('Missão inválida.');
    return {...x,status:x.status==='executando'?'interrompida':x.status};
   });
  }catch(e){if(e.code==='ENOENT')return;throw Error('Não foi possível abrir as missões. Preserve o arquivo '+this.file+': '+e.message);}
 }
 persist(){
  const temp=this.file+'.'+crypto.randomUUID()+'.tmp';
  this.fs.writeFileSync(temp,JSON.stringify(this.items,null,2),{flag:'wx',mode:0o600});
  try{this.fs.renameSync(temp,this.file)}catch(e){this.fs.rmSync(temp,{force:true});throw e;}
 }
 list(){return this.items.map(({id,goal,kind,status,createdAt,updatedAt,folder,lastError,previewUrl})=>({id,goal,kind,status,createdAt,updatedAt,folder,lastError,previewUrl:previewUrl||null})).reverse();}
 get(id){if(typeof id!=='string'||!/^[a-f\d-]{36}$/.test(id))throw Error('ID inválido.');const m=this.items.find(x=>x.id===id);if(!m)throw Error('Missão não encontrada.');return m;}
 folder(id){return path.join(this.dir,this.get(id).id);}
 create(input){
  const goal=validGoal(typeof input==='string'?input:input?.goal);
  if(this.items.length>=MAX_MISSIONS)throw Error('Limite de 100 missões. Exporte e arquive missões antigas.');
  const id=crypto.randomUUID(),kind=category(goal),at=this.now();
  const folder=path.join(this.dir,id);
  this.fs.mkdirSync(folder,{recursive:false});
  this.fs.writeFileSync(path.join(folder,'BRIEFING.md'),brief(goal,kind),{flag:'wx',mode:0o600});
  // No modo nao interativo, bloqueia terminal, leitura de .env e acesso fora do projeto.
  // Compatibilidade com o esquema de permissoes do OpenCode 1.x.
  const opencodeConfig={$schema:'https://opencode.ai/config.json',default_agent:'build',permission:{
   bash:'deny',external_directory:'deny',task:'deny',edit:'allow',
   read:{'*':'allow','*.env':'deny','*.env.*':'deny','*.env.example':'allow'},
   webfetch:'allow',websearch:'allow'
  }};
  this.fs.writeFileSync(path.join(folder,'opencode.json'),JSON.stringify(opencodeConfig,null,2),{flag:'wx',mode:0o600});

  const item={id,goal,kind,status:'rascunho',createdAt:at,updatedAt:at,folder,lastError:null};
  this.items.push(item);this.persist();return {...item};
 }
 update(item,status,lastError=null){item.status=status;item.lastError=lastError;item.updatedAt=this.now();this.persist();}
 /**
  * Um executor de OpenCode por vez. Requer confirmação externa no Windows.
  * Mesmo quando termina com exit code 0, status é "revisao": não publica nem envia nada.
  */
 async run(id,{approve,notify=()=>{},cli}={}){
  const item=this.get(id);if(this.active)throw Error('Já existe uma missão em execução.');
  if(!['rascunho','falhou','interrompida','revisao'].includes(item.status))throw Error('Missão não está pronta para executar.');
  if(typeof approve!=='function')throw Error('Confirmação humana obrigatória.');
  const folder=this.folder(id);const executable=cli||resolveCLI();
  const confirmed=await approve({goal:item.goal,kind:item.kind,folder,executable});
  if(!confirmed)return {status:item.status,reason:'Permissão negada; nenhuma ferramenta executada.'};
  if(this.active)throw Error('Outro processo iniciou uma missão.');
  const prompt='Você está numa pasta exclusiva do COSMO. Leia BRIEFING.md. Implemente o projeto descrito, com arquivos, validações e documentação. Não publique, não contate clientes e não acesse credenciais, diretórios externos ou serviços reais. Se precisar de uma autorização do OpenCode e não puder recebê-la neste modo, pare e registre o bloqueio. Ao final, informe claramente o que gerou, os testes executados e os problemas pendentes.';
  const log=path.join(folder,'execucao.log');
  const logFd=this.fs.openSync(log,'a');
  let child;
  try{
   child=this.launcher(executable,['run','--agent','build',prompt],{cwd:folder,windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false,env:sanitizedEnvironment(process.env)});
  }catch(e){this.fs.closeSync(logFd);this.update(item,'falhou',e.message);throw e;}
  this.active={id,child,stopRequested:false};
  this.update(item,'executando');notify({id,status:item.status});
  let written=0;const cap=200000;
  const append=chunk=>{
   if(written>=cap)return;
   const s=String(chunk).slice(0,cap-written);written+=s.length;
   this.fs.writeSync(logFd,s);
   notify({id,log:s.slice(-600)});
  };
  child.stdout?.on('data',append);child.stderr?.on('data',append);
  try{
   const result=await new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('exit',(code,signal)=>resolve({code,signal}));
   });
   const interrupted=this.active?.stopRequested;
   if(interrupted)this.update(item,'interrompida','Interrompida pelo usuário.');
   else if(result.code===0)this.update(item,'revisao');
   else this.update(item,'falhou','OpenCode finalizou com código '+String(result.code)+'. Consulte execucao.log.');
   notify({id,status:item.status});return {status:item.status,folder,log};
  }catch(e){this.update(item,'falhou',e.message);notify({id,status:item.status});throw e;}
  finally{this.active=null;this.fs.closeSync(logFd);}
 }
 stop(){
  if(!this.active)return false;
  this.active.stopRequested=true;
  try{this.active.child.kill()}catch{}
  return true;
 }
}
module.exports={MissionCenter,category,validGoal,resolveCLI,sanitizedEnvironment,brief};
