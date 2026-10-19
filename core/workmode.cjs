'use strict';
/** Abre exclusivamente executáveis conhecidos e URLs HTTPS predefinidas. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');

const TABS = Object.freeze(['https://chatgpt.com/', 'https://claude.ai/']);
function findBrave(env = process.env, exists = fs.existsSync) {
  const bases = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean);
  for (const base of bases) {
    const candidate = path.join(base, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
    if (exists(candidate)) return candidate;
  }
  return null;
}
function findKnownApp(appName, {env = process.env, exists = fs.existsSync} = {}) {
  const config = appName === 'opencode'
    ? {envVar:'ENZO_OPENCODE_PATH', files:['OpenCode.exe','opencode.exe','OpenCode Desktop.exe'], folders:['OpenCode','opencode']}
    : appName === 'hermes'
      ? {envVar:'ENZO_HERMES_PATH', files:['Hermes.exe','Hermes Agent.exe','hermes.exe'], folders:['Hermes','Hermes Agent','hermes-agent']}
      : null;
  if (!config) throw Error('Aplicativo desconhecido.');
  const custom = env[config.envVar];
  if (typeof custom === 'string' && path.win32.isAbsolute(custom) && config.files.some(file => file.toLowerCase() === path.win32.basename(custom).toLowerCase()) && exists(custom)) return custom;
  const bases = [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs'), env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean);
  for (const base of bases) for (const folder of config.folders) for (const file of config.files) {
    const candidate = path.join(base, folder, file);
    if (exists(candidate)) return candidate;
  }
  return null;
}
function findOpenCodeApp(env = process.env, exists = fs.existsSync) {return findKnownApp('opencode', {env,exists});}
function findHermesApp(env = process.env, exists = fs.existsSync) {return findKnownApp('hermes', {env,exists});}
function hasCli(command, probe = spawnSync) {
  if (!['opencode','hermes'].includes(command)) return false;
  try {const found = probe('where.exe', [command], {windowsHide:true,encoding:'utf8',timeout:3500,maxBuffer:8192});return !found.error && found.status === 0;}
  catch {return false;}
}
function hasOpenCodeCli(probe = spawnSync) {return hasCli('opencode',probe);}
function hasHermesCli(probe = spawnSync) {return hasCli('hermes',probe);}
function detachedLaunch(command,args=[],options={},launch=spawn) {
  return new Promise((resolve,reject)=>{
    let child;
    try {child = launch(command,args,{detached:true,stdio:'ignore',windowsHide:false,...options});}
    catch(err) {reject(err);return;}
    child.once('error',reject);
    child.once('spawn',()=>{child.unref?.();resolve();});
  });
}
async function openBraveWorkspace({platform=process.platform, env=process.env, exists=fs.existsSync, launch=detachedLaunch, urls=TABS} = {}) {
  if (platform !== 'win32') throw Error('Modo Trabalho exige Windows.');
  // Apenas URLs predefinidas, jamais um endereço fornecido pelo modelo/voz.
  const allowed = new Set(['https://chatgpt.com/','https://claude.ai/','https://www.youtube.com/','https://www.google.com/']);
  if (!Array.isArray(urls) || urls.some(url=>!allowed.has(url))) throw Error('URL não permitida no modo.');
  const brave=findBrave(env,exists);
  if(!brave) throw Error('Brave não encontrado. Verifique a instalação.');
  await launch(brave,['--new-window',...urls]);
  return 'Brave iniciado'+(urls.length?' com '+urls.length+' abas.':'.');
}
async function openKnownApp(appName,{platform=process.platform,env=process.env,exists=fs.existsSync,probe=spawnSync,launch=detachedLaunch}={}) {
  if(platform!=='win32')throw Error('Este modo exige Windows.');
  if(!['opencode','hermes'].includes(appName))throw Error('Aplicativo não permitido.');
  const gui=findKnownApp(appName,{env,exists});
  if(gui){await launch(gui,[]);return `${appName==='opencode'?'OpenCode':'Hermes'} (aplicativo) iniciado.`;}
  if(!hasCli(appName,probe))throw Error(`${appName==='opencode'?'OpenCode':'Hermes'} não encontrado. Verifique a instalação e o PATH.`);
  const home=env.USERPROFILE && exists(env.USERPROFILE) ? env.USERPROFILE : os.homedir();
  // Constante do código e comando verificado; nenhuma interpolação da transcrição.
  await launch('powershell.exe',['-NoLogo','-NoProfile','-NoExit','-Command',appName],{cwd:home});
  return `${appName==='opencode'?'OpenCode':'Hermes'} (terminal) iniciado.`;
}
function openOpenCode(options={}) {return openKnownApp('opencode',options);}
function openHermes(options={}) {return openKnownApp('hermes',options);}

class WorkMode {
  constructor({openBrowser=openBraveWorkspace,openEditor=openOpenCode,openAssistant=openHermes}={}) {
    this.openBrowser=openBrowser;this.openEditor=openEditor;this.openAssistant=openAssistant;
    this.braveOpened=false;this.editorOpened=false;this.hermesOpened=false;
    this.active=false;this.runId=0;this.running=null;
  }
  async start({shouldContinue=()=>true}={}) {
    if(this.running)return this.running;
    const id=++this.runId;
    const work=async()=>{
      const results=[],errors=[];
      for(const [flag,label,launch] of [['braveOpened','Brave',this.openBrowser],['editorOpened','OpenCode',this.openEditor],['hermesOpened','Hermes',this.openAssistant]]){
        if(id!==this.runId||!shouldContinue())return {active:false,cancelled:true,results,errors,say:'Modo Trabalho interrompido. Os programas abertos permanecem abertos.'};
        if(!this[flag])try{results.push(await launch());if(id===this.runId)this[flag]=true;}
        catch(error){errors.push(`${label}: ${error.message}`);}
      }
      if(id!==this.runId||!shouldContinue())return {active:false,cancelled:true,results,errors,say:'Modo Trabalho interrompido. Os programas já abertos permanecem abertos.'};
      this.active=this.braveOpened||this.editorOpened||this.hermesOpened;
      const say=!this.active?'Não consegui iniciar o Modo Trabalho. '+errors.join(' ')
        :errors.length?'Modo Trabalho iniciado parcialmente. '+results.join(' ')+' '+errors.join(' ')
        :!results.length?'Modo Trabalho já está ativo. Brave, ChatGPT, Claude, OpenCode e Hermes foram solicitados anteriormente.'
        :'Modo Trabalho ativado! '+results.join(' ')+' Pronto para trabalhar.';
      return {active:this.active,cancelled:false,results,errors,say};
    };
    this.running=work();try{return await this.running;}finally{this.running=null;}
  }
  end(){this.runId++;this.braveOpened=false;this.editorOpened=false;this.hermesOpened=false;this.active=false;return 'Modo Trabalho encerrado no COSMO. Mantive as janelas e programas abertos para não perder seu trabalho.';}
}
module.exports={TABS,WorkMode,findBrave,findOpenCodeApp,findHermesApp,hasOpenCodeCli,hasHermesCli,openBraveWorkspace,openOpenCode,openHermes,detachedLaunch,openKnownApp};
