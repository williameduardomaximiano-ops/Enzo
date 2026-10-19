// Ponte com agentes de programação (Claude Code e OpenCode) instalados no PC.
// O ENZO entrega a tarefa, acompanha o progresso e devolve o resultado; cada tarefa é aprovada antes no computador.
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');

const AGENTS=Object.freeze({claude:'Claude Code',opencode:'OpenCode'});
// Comandos de desenvolvimento liberados para o Claude Code sem o modo "liberar tudo".
const DEV_TOOLS=['Read','Edit','Write','Glob','Grep','WebSearch','WebFetch','TodoWrite','Bash(npm:*)','Bash(npx:*)','Bash(node:*)','Bash(git:*)','Bash(python:*)','Bash(py:*)','Bash(pip:*)','Bash(mkdir:*)','Bash(dir:*)','Bash(ls:*)'];
const APPEND='Você foi acionado pelo ENZO, o assistente pessoal de William. Trabalhe somente dentro da pasta atual, a menos que a tarefa diga outra pasta. Nunca apague arquivos fora da pasta do projeto. Ao final, responda em português do Brasil com no máximo 3 frases curtas dizendo o que foi feito e onde, pois a resposta será lida em voz alta.';

function candidates(name,env=process.env,platform=process.platform){
 const dirs=String(env.PATH||env.Path||'').split(path.delimiter).filter(Boolean);
 if(platform==='win32'){const home=env.USERPROFILE||os.homedir();dirs.push(path.join(home,'.local','bin'),path.join(env.APPDATA||path.join(home,'AppData','Roaming'),'npm'),path.join(home,'.opencode','bin'),path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Programs',name));}
 else dirs.push(path.join(os.homedir(),'.local','bin'),path.join(os.homedir(),'.opencode','bin'));
 const exts=platform==='win32'?['.exe','.cmd']:[''];return dirs.flatMap(d=>exts.map(e=>path.join(d,name+e)));
}
function findBin(name,env,platform){for(const c of candidates(name,env,platform)){try{if(fs.statSync(c).isFile())return c;}catch{}}return null;}

// Para .cmd no Windows o texto vai pelo stdin (Claude) ou higienizado (OpenCode), nunca interpretado pelo cmd.exe.
function sanitizeForCmd(text){return String(text).replace(/[\r\n]+/g,' ').replace(/["^&|<>%!`]/g,' ').replace(/\s+/g,' ').trim();}
function buildCommand(agent,task,{bin,full=false}={}){
 if(!AGENTS[agent])throw Error('Agente desconhecido.');
 const isCmd=/\.cmd$/i.test(bin||'');
 if(agent==='claude'){
  const args=['-p','--output-format','stream-json','--verbose','--append-system-prompt',APPEND];
  if(full)args.push('--permission-mode','bypassPermissions');else args.push('--permission-mode','acceptEdits','--allowedTools',...DEV_TOOLS);
  if(isCmd)return {bin,args:args.map(a=>/[\s"(]/.test(a)?`"${a.replace(/"/g,'')}"`:a),stdin:task,shell:true};
  return {bin,args,stdin:task,shell:false};
 }
 const prompt=`${task}\n\n${APPEND}`;
 if(isCmd)return {bin,args:['run',`"${sanitizeForCmd(prompt)}"`],stdin:null,shell:true};
 return {bin,args:['run',prompt],stdin:null,shell:false};
}

function describeTool(name,input={}){const f=input.file_path||input.path||input.notebook_path;const base=f?path.basename(String(f)):'';
 switch(name){case 'Write':return `Criando ${base}`;case 'Edit':case 'MultiEdit':return `Editando ${base}`;case 'Read':return `Lendo ${base}`;case 'Bash':return `Executando: ${String(input.command||'').slice(0,70)}`;case 'WebSearch':return `Pesquisando: ${String(input.query||'').slice(0,60)}`;case 'WebFetch':return `Lendo página: ${String(input.url||'').slice(0,60)}`;case 'Glob':case 'Grep':return 'Procurando nos arquivos';case 'TodoWrite':return 'Planejando as etapas';default:return `Usando ${name}`;}}
// Interpreta uma linha do stream-json do Claude Code.
function parseClaudeLine(line){let e;try{e=JSON.parse(line);}catch{return null;}
 if(e.type==='assistant'){const out=[];for(const c of e.message?.content||[]){if(c.type==='tool_use')out.push({progress:describeTool(c.name,c.input)});}return out;}
 if(e.type==='result')return [{result:String(e.result||''),error:!!e.is_error}];
 return null;}
function stripAnsi(s){return String(s).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g,'');}
function spoken(text,max=320){const t=String(text).replace(/[`*#>_]/g,'').replace(/\s+/g,' ').trim();if(t.length<=max)return t;const cut=t.slice(0,max);const end=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? '));return (end>60?cut.slice(0,end+1):cut+'…');}

class AgentRunner{
 constructor({resolveBin=findBin,spawnImpl=spawn,timeoutMs=30*60000}={}){this.resolveBin=resolveBin;this.spawnImpl=spawnImpl;this.timeoutMs=timeoutMs;this.proc=null;}
 get busy(){return !!this.proc;}
 available(){return Object.fromEntries(Object.keys(AGENTS).map(a=>[a,!!this.resolveBin(a)]));}
 run({agent='claude',task,cwd,full=false,onProgress=()=>{}}){
  if(this.proc)return Promise.reject(Error('O agente já está trabalhando em outra tarefa.'));
  if(typeof task!=='string'||!task.trim()||task.length>8000)return Promise.reject(Error('Tarefa inválida.'));
  const bin=this.resolveBin(agent);if(!bin)return Promise.reject(Error(`${AGENTS[agent]||agent} não encontrado no PC. Instale e faça login nele, ou escolha outro agente em Configuração.`));
  const cmd=buildCommand(agent,task.trim(),{bin,full});
  return new Promise((resolve,reject)=>{
   const p=this.spawnImpl(cmd.bin,cmd.args,{cwd,shell:cmd.shell,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,FORCE_COLOR:'0',NO_COLOR:'1'}});this.proc=p;
   let buf='',raw='',err='',result=null,failed=false;const timer=setTimeout(()=>{failed=true;p.kill();},this.timeoutMs);
   p.stdout.on('data',d=>{const s=d.toString();raw=(raw+s).slice(-20000);if(agent!=='claude'){const l=stripAnsi(s).trim().split('\n').pop();if(l)onProgress(l.slice(0,90));return;}buf+=s;let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);for(const ev of parseClaudeLine(line)||[]){if(ev.progress)onProgress(ev.progress);if('result' in ev)result=ev;}}});
   p.stderr.on('data',d=>{err=(err+d).slice(-2000);});
   p.on('error',e=>{clearTimeout(timer);this.proc=null;reject(e);});
   p.on('close',code=>{clearTimeout(timer);this.proc=null;
    if(failed)return reject(Error('A tarefa passou do tempo limite e foi interrompida.'));
    if(agent==='claude'){if(result&&!result.error)return resolve({text:result.result});return reject(Error((result?.result||stripAnsi(err)||`O agente terminou com código ${code}.`).slice(0,400)));}
    const text=stripAnsi(raw).trim();if(code===0)return resolve({text:text.slice(-4000)||'Tarefa concluída.'});reject(Error((stripAnsi(err)||text||`O agente terminou com código ${code}.`).slice(-400)));});
   if(cmd.stdin!=null)p.stdin.end(cmd.stdin);else p.stdin.end();
  });
 }
 stop(){if(this.proc){try{this.proc.kill();}catch{}this.proc=null;}}
}

function slug(text){return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'projeto';}
function sitePrompt(topic){return `Crie um site completo, moderno e bonito sobre: ${topic}. Use HTML, CSS e JavaScript puros nesta pasta, com index.html como página inicial, layout responsivo e textos em português do Brasil. Não dependa de servidor nem de instalação de pacotes. Ao terminar, diga em até 2 frases o que foi criado.`;}

module.exports={AgentRunner,AGENTS,DEV_TOOLS,buildCommand,parseClaudeLine,describeTool,findBin,candidates,sanitizeForCmd,spoken,slug,sitePrompt};
