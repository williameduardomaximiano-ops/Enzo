'use strict';
/** Publica somente previews Vercel depois de aprovação explícita. */
const path=require('node:path'),fs=require('node:fs');
const {spawn,spawnSync}=require('node:child_process');
const {sanitizedEnvironment}=require('./mission-center.cjs');
function vercelExecutable({platform=process.platform,env=process.env,exists=fs.existsSync,probe=spawnSync}={}){
 if(platform!=='win32')throw Error('A publicação pelo COSMO exige Windows.');
 let p=env.COSMO_VERCEL_CLI;
 if(!p){
  const r=probe('where.exe',['vercel'],{windowsHide:true,encoding:'utf8',timeout:3500,shell:false,maxBuffer:8192});
  if(r.status!==0||r.error)throw Error('Vercel CLI indisponível. Instale e faça login com "vercel login".');
  p=String(r.stdout).split(/\r?\n/).map(x=>x.trim()).find(x=>/\.(?:exe|cmd)$/i.test(x)&&path.win32.isAbsolute(x));
 }
 if(typeof p!=='string'||!path.win32.isAbsolute(p)||!/\.(?:exe|cmd)$/i.test(p)||!exists(p))throw Error('Executável da Vercel não encontrado.');
 // Se for .cmd, impede metacaracteres interpretáveis pelo cmd.exe.
 if(p.toLowerCase().endsWith('.cmd')&&!/^[A-Za-z]:\\[a-zA-Z0-9 _().\\-]+\.cmd$/i.test(p))throw Error('Caminho da Vercel contém caracteres não permitidos.');
 return p;
}
function deploySpec(executable,{root=process.env.SystemRoot||'C:\\Windows'}={}){
 if(executable.toLowerCase().endsWith('.exe'))return {exe:executable,args:['deploy','--yes']};
 const cmd=path.win32.join(root,'System32','cmd.exe');
 return {exe:cmd,args:['/d','/s','/c','"'+executable+'" deploy --yes']};
}
function parsePreviewUrl(stdout){
 const matches=String(stdout||'').match(/https:\/\/[a-z0-9][a-z0-9-]*\.vercel\.app\/?/gi)||[];
 const s=matches.at(-1);
 if(!s)throw Error('Deploy finalizado sem link público de preview verificável.');
 const url=new URL(s);if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app'))throw Error('Endereço inválido.');
 return url.toString();
}
function hasSource(folder,fsApi=fs){return ['index.html','package.json','vercel.json','app','src','pages'].some(name=>fsApi.existsSync(path.join(folder,name)));}
async function publishPreview(center,id,{approve,notify=()=>{},cli,launcher=spawn}={}){
 const item=center.get(id),folder=center.folder(id);
 if(!['revisao','previa'].includes(item.status))throw Error('Primeiro conclua e revise a missão antes de publicar.');
 if(center.active)throw Error('Já existe uma operação em andamento.');
 if(!hasSource(folder,center.fs))throw Error('Projeto não contém arquivos de site para publicar. Veja o BRIEFING.md.');
 const binary=cli||vercelExecutable();
 if(typeof approve!=='function')throw Error('Publicação exige autorização.');
 const ok=await approve({folder,goal:item.goal,executable:binary});
 if(!ok)return {status:item.status,reason:'Publicação cancelada.'};
 if(center.active)throw Error('Já existe uma operação em andamento.');
 const spec=deploySpec(binary);
 const child=launcher(spec.exe,spec.args,{cwd:folder,windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false,env:sanitizedEnvironment(process.env)});
 center.active={id,child,stopRequested:false};
 center.update(item,'publicando');
 notify({id,status:item.status});
 let output='',all='';
 const append=(data,isStdout=false)=>{
  const s=String(data||'');all=(all+s).slice(-16000);
  if(isStdout)output=(output+s).slice(-8000);
  notify({id,log:s.slice(-500)});
 };
 child.stdout?.on('data',x=>append(x,true));child.stderr?.on('data',x=>append(x,false));
 try{
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code)=>resolve(code))});
  if(center.active?.stopRequested){center.update(item,'interrompida','Deploy interrompido.');return {status:item.status};}
  if(code!==0)throw Error('Vercel encerrou com código '+code+'. '+all.slice(-750));
  const previewUrl=parsePreviewUrl(output);
  item.previewUrl=previewUrl;
  center.update(item,'previa');
  notify({id,status:item.status,previewUrl});
  return {status:item.status,previewUrl};
 }catch(e){center.update(item,'falhou',e.message);notify({id,status:item.status});throw e;}
 finally{center.active=null;}
}
module.exports={publishPreview,vercelExecutable,deploySpec,parsePreviewUrl,hasSource};
