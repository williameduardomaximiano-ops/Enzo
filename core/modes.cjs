'use strict';
/** Modos personalizados criados por comandos explícitos de voz local.
 *  Nenhuma execução de shell, URL ou caminho arbitrário é persistida aqui.
 */
const fs=require('node:fs');
const path=require('node:path');
const {openBraveWorkspace,openOpenCode,openHermes,detachedLaunch}=require('./workmode.cjs');

const BUILTIN_WORK=Object.freeze(['brave','chatgpt','claude','opencode','hermes']);
const URLS=Object.freeze({chatgpt:'https://chatgpt.com/',claude:'https://claude.ai/',youtube:'https://www.youtube.com/',google:'https://www.google.com/'});
const LOCAL_APPS=Object.freeze({calculadora:'calc.exe',bloco:'notepad.exe',paint:'mspaint.exe',explorador:'explorer.exe'});
const LABELS=Object.freeze({brave:'Brave',chatgpt:'ChatGPT',claude:'Claude',opencode:'OpenCode',hermes:'Hermes',youtube:'YouTube',google:'Google',calculadora:'Calculadora',bloco:'Bloco de notas',paint:'Paint',explorador:'Explorador de arquivos'});
const ALIASES=Object.freeze({
 'brave':'brave','navegador':'brave','chatgpt':'chatgpt','chat gpt':'chatgpt','claude':'claude','claude ai':'claude',
 'opencode':'opencode','open code':'opencode','hermes':'hermes','hermes agent':'hermes','ermes':'hermes',
 'youtube':'youtube','you tube':'youtube','google':'google','calculadora':'calculadora','calc':'calculadora',
 'bloco de notas':'bloco','notepad':'bloco','paint':'paint','explorador':'explorador','explorador de arquivos':'explorador'
});
const RESERVED=new Set(['privacidade','seguranca','atualizacoes']);
function norm(text){return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
function normalizeName(name){const n=norm(name).replace(/^(?:de |do |da )/,'');if(n.length<2||n.length>40||!/^[a-z0-9][a-z0-9 -]*$/.test(n)||RESERVED.has(n))throw Error('Nome inválido. Use um nome curto, como estudo ou trabalho.');return n;}
function parseTargets(input){
  if(typeof input!=='string'||input.length>300)throw Error('Lista de programas inválida.');
  const terms=norm(input).replace(/\s+(?:e|mais)\s+/g,',').split(/[,;]+/).map(s=>s.trim().replace(/^(?:o |a |os |as )/,'')).filter(Boolean);
  if(!terms.length||terms.length>8)throw Error('Informe entre 1 e 8 programas ou sites.');
  const targets=[];
  for(const term of terms){const key=ALIASES[term];if(!key)throw Error('Não reconheci "'+term+'". Informe apenas aplicativos ou sites permitidos.');if(!targets.includes(key))targets.push(key);}
  return targets;
}
function validateTargets(targets){
  if(!Array.isArray(targets)||targets.length<1||targets.length>8||targets.some(t=>typeof t!=='string'||!Object.hasOwn(LABELS,t))||new Set(targets).size!==targets.length)throw Error('Lista de aplicativos não permitida.');
  return [...targets];
}
class ModeStore {
  constructor(directory,{fsApi=fs}={}){this.fs=fsApi;this.file=path.join(directory,'modes.json');this.data={version:1,modes:{}};this.loadError=null;this.load();}
  load(){
    try{
      const raw=JSON.parse(this.fs.readFileSync(this.file,'utf8'));
      if(raw.version!==1||!raw.modes||typeof raw.modes!=='object'||Array.isArray(raw.modes))throw Error('Formato inesperado.');
      const entries=Object.entries(raw.modes);
      if(entries.length>20)throw Error('Limite excedido.');
      const valid={};for(const [name,targets]of entries){const safe=normalizeName(name);if(safe!==name)throw Error('Nome modificado.');valid[name]=validateTargets(targets);}
      this.data={version:1,modes:valid};
    }catch(err){if(err.code!=='ENOENT')this.loadError='Não foi possível ler os modos salvos. O arquivo foi preservado. Restaure o backup antes de editar modos: '+err.message;}
  }
  persist(){
    if(this.loadError)throw Error(this.loadError);
    const temp=this.file+'.tmp';
    this.fs.writeFileSync(temp,JSON.stringify(this.data,null,2),{encoding:'utf8',mode:0o600,flag:'w'});
    try{this.fs.renameSync(temp,this.file);}catch(err){try{this.fs.rmSync(temp,{force:true});}catch{}throw err;}
  }
  get(name){const n=normalizeName(name);return this.data.modes[n]?[...this.data.modes[n]]:(n==='trabalho'?[...BUILTIN_WORK]:null);}
  hasSaved(name){return Object.hasOwn(this.data.modes,normalizeName(name));}
  list(){return Object.entries(this.data.modes).map(([name,targets])=>({name,targets:[...targets]}));}
  save(name,targets){const n=normalizeName(name);const t=validateTargets(targets);if(!Object.hasOwn(this.data.modes,n)&&Object.keys(this.data.modes).length>=20)throw Error('Limite de 20 modos atingido.');const previous=this.data.modes[n];this.data.modes[n]=t;try{this.persist();}catch(err){if(previous)this.data.modes[n]=previous;else delete this.data.modes[n];throw err;}return n;}
  add(name,targets){const n=normalizeName(name),before=this.get(n);if(!before)throw Error('Modo não encontrado. Diga: Cosmo, crie o modo '+n+' com Brave.');return this.save(n,[...new Set([...before,...validateTargets(targets)])]);}
  remove(name,targets){const n=normalizeName(name),before=this.get(n);if(!before)throw Error('Modo não encontrado.');const filtered=before.filter(x=>!validateTargets(targets).includes(x));if(!filtered.length)throw Error('O modo não pode ficar vazio; exclua o modo se não precisar dele.');return this.save(n,filtered);}
  delete(name){const n=normalizeName(name);if(!this.hasSaved(n))throw Error('Modo personalizado não encontrado.');const backup=this.data.modes[n];delete this.data.modes[n];try{this.persist();}catch(err){this.data.modes[n]=backup;throw err;}}
}
async function defaultLaunchTarget(key,{platform=process.platform,env=process.env,launch=detachedLaunch}={}) {
  if(platform!=='win32')throw Error('Comando disponível apenas no Windows.');
  if(key==='opencode')return openOpenCode({platform,env,launch});
  if(key==='hermes')return openHermes({platform,env,launch});
  if(Object.hasOwn(LOCAL_APPS,key)){
    const exe=key==='explorador'?path.join(env.SystemRoot||'C:\\Windows',LOCAL_APPS[key]):path.join(env.SystemRoot||'C:\\Windows','System32',LOCAL_APPS[key]);
    await launch(exe,[]);return LABELS[key]+' iniciado.';
  }
  throw Error('Destino não permitido fora do Brave.');
}
class VoiceModes {
  constructor(store,{openBrowser=openBraveWorkspace,launchTarget=defaultLaunchTarget}={}){
    this.store=store;this.openBrowser=openBrowser;this.launchTarget=launchTarget;this.seen=new Map();this.runId=0;this.running=null;
  }
  async start(name,{shouldContinue=()=>true}={}){
    const n=normalizeName(name);const targets=this.store.get(n);if(!targets)throw Error('Modo '+n+' não encontrado. Peça para salvar o modo primeiro.');
    if(this.running)throw Error('Já estou abrindo outro modo. Aguarde ou diga Parar Tudo.');
    const id=++this.runId;
    const running=async()=>{
      const results=[],errors=[];const seen=this.seen.get(n)||new Set();
      const browserTargets=targets.filter(t=>t==='brave'||Object.hasOwn(URLS,t));
      const browserKey='browser:'+browserTargets.join(',');
      const tasks=[];
      if(browserTargets.length)tasks.push({id:browserKey,label:'Brave',run:()=>this.openBrowser({urls:browserTargets.filter(t=>Object.hasOwn(URLS,t)).map(t=>URLS[t])})});
      for(const key of targets.filter(t=>t!=='brave'&&!Object.hasOwn(URLS,t)))tasks.push({id:key,label:LABELS[key],run:()=>this.launchTarget(key)});
      for(const task of tasks){
        if(id!==this.runId||!shouldContinue())return {cancelled:true,results,errors,say:'Modo '+n+' interrompido. Os programas já abertos permanecem abertos.'};
        if(seen.has(task.id))continue;
        try{results.push(await task.run());if(id===this.runId)seen.add(task.id);}
        catch(error){errors.push(task.label+': '+error.message);}
      }
      if(id!==this.runId||!shouldContinue())return {cancelled:true,results,errors,say:'Modo '+n+' interrompido. Os programas já abertos permanecem abertos.'};
      this.seen.set(n,seen);
      return {cancelled:false,results,errors,say:errors.length?'Modo '+n+' iniciado parcialmente. '+results.join(' ')+' '+errors.join(' '):results.length?'Modo '+n+' iniciado. '+results.join(' '):'Modo '+n+' já está ativo.'};
    };
    this.running=running();try{return await this.running;}finally{this.running=null;}
  }
  end(name){const n=normalizeName(name);this.runId++;this.seen.delete(n);return 'Modo '+n+' encerrado no COSMO. Os programas continuam abertos.';}
  stop(){this.runId++;this.seen.clear();}
}
module.exports={BUILTIN_WORK,URLS,LABELS,ALIASES,ModeStore,VoiceModes,parseTargets,normalizeName,norm,defaultLaunchTarget};
