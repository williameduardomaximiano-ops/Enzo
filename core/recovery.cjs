'use strict';
/** Backups verificados somente de arquivos explícitos de dados do usuário. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILES=Object.freeze(['settings.json','vault.enc','modes.json','history.json','calendar.json','memory-v1.enc','cosmo-hologram.jpg']);
const checksum=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
class Recovery {
 constructor(dataDir,{fsApi=fs}={}){
  this.fs=fsApi;this.dataDir=dataDir;this.dir=path.join(dataDir,'cosmo-backups');this.fs.mkdirSync(this.dir,{recursive:true});
 }
 safeFile(source){const s=this.fs.lstatSync(source);if(!s.isFile()||s.isSymbolicLink()||s.size>8*1024*1024)throw Error('Arquivo de dados inválido para backup.');return this.fs.readFileSync(source);}
 backup(label='manual'){
  if(!/^[a-z0-9_-]{1,40}$/i.test(label))throw Error('Identificador de backup inválido.');
  const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8);
  const dir=path.join(this.dir,id);this.fs.mkdirSync(dir,{recursive:false});
  const files={};
  try{
   for(const name of FILES){
    const file=path.join(this.dataDir,name);
    if(!this.fs.existsSync(file))continue;
    const bytes=this.safeFile(file);
    this.fs.writeFileSync(path.join(dir,name),bytes,{mode:0o600,flag:'wx'});
    files[name]={size:bytes.length,sha256:checksum(bytes)};
   }
   const manifest={version:1,id,label,createdAt:new Date().toISOString(),files};
   this.fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
   return {id,label,createdAt:manifest.createdAt,files:Object.keys(files)};
  }catch(e){this.fs.rmSync(dir,{recursive:true,force:true});throw e;}
 }
 verify(id){
  if(!/^\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]{8}$/.test(id))throw Error('Identificador de backup inválido.');
  const dir=path.join(this.dir,id),manifest=JSON.parse(this.fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  if(manifest.version!==1||manifest.id!==id||typeof manifest.files!=='object'||Array.isArray(manifest.files))throw Error('Manifesto inválido.');
  const data={};
  for(const [name,meta] of Object.entries(manifest.files)){
   if(!FILES.includes(name)||!Number.isSafeInteger(meta.size)||meta.size<0||meta.size>8*1024*1024||!/^[a-f0-9]{64}$/.test(meta.sha256))throw Error('Manifesto contém arquivo inválido.');
   const bytes=this.safeFile(path.join(dir,name));
   if(bytes.length!==meta.size||checksum(bytes)!==meta.sha256)throw Error('Integridade do backup comprometida: '+name);
   data[name]=bytes;
  }
  return {manifest,data};
 }
 list(){
  const list=[];
  for(const id of this.fs.readdirSync(this.dir).slice(-100)){
   try{const {manifest}=this.verify(id);list.push({id,label:manifest.label,createdAt:manifest.createdAt,files:Object.keys(manifest.files)});}catch{}
  }
  return list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }
 restore(id){
  // Verificação completa antes de escrever. Requer confirmação humana pela camada Electron.
  const {data}=this.verify(id);
  const fallback=this.backup('pre-restore');
  const stage=[];
  try{
   for(const [name,bytes] of Object.entries(data)){
    const dest=path.join(this.dataDir,name),temp=dest+'.'+crypto.randomUUID()+'.tmp';
    this.fs.writeFileSync(temp,bytes,{mode:0o600,flag:'wx'});stage.push([temp,dest]);
   }
   for(const [temp,dest] of stage)this.fs.renameSync(temp,dest);
   return {restored:Object.keys(data),safetyBackup:fallback.id,restartRequired:true};
  }catch(e){
   for(const [temp] of stage)try{this.fs.rmSync(temp,{force:true})}catch{}
   throw Error('Restauração interrompida. Backup anterior permanece disponível: '+fallback.id+'. '+e.message);
  }
 }
}
module.exports={Recovery,FILES,checksum};
