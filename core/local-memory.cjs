'use strict';
/** Memória local explícita; conteúdo cifrado usando Windows DPAPI via Electron.safeStorage. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX=200;
function validateNote(value){
 if(typeof value!=='string')throw Error('Memória precisa ser texto.');
 const text=value.trim();
 if(text.length<8||text.length>700||/[\u0000-\u001f]/.test(text))throw Error('Memória deve ter entre 8 e 700 caracteres.');
 if(/(?:gsk_[a-z0-9]{15,}|AIza[a-z0-9_-]{20,}|gh[psu]_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|-----BEGIN PRIVATE KEY-----)/i.test(text))
  throw Error('Não salve chaves ou segredos na memória.');
 return text;
}
function words(s){return [...new Set(s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g)||[])].filter(w=>!['para','como','com','que','uma','uns','das','dos','sobre','meus','essa','esse','esta','estou','voce'].includes(w));}
class MemoryStore {
 constructor(directory,{fsApi=fs,encrypt,decrypt}={}){
  if(typeof encrypt!=='function'||typeof decrypt!=='function')throw Error('Memória exige criptografia ativa.');
  this.fs=fsApi;this.encrypt=encrypt;this.decrypt=decrypt;this.file=path.join(directory,'memory-v1.enc');this.items=[];this.readError=null;
  this.load();
 }
 load(){
  let data;try{data=this.fs.readFileSync(this.file);}catch(e){if(e.code==='ENOENT')return;throw e;}
  try{
   const parsed=JSON.parse(this.decrypt(data));
   if(!Array.isArray(parsed)||parsed.length>MAX)throw Error('Estrutura de memória inválida.');
   this.items=parsed.map(x=>{
    if(!x||typeof x.id!=='string'||!/^[a-f\d-]{36}$/.test(x.id)||typeof x.text!=='string'||x.text.length>700||typeof x.at!=='string')throw Error('Item inválido.');
    return {id:x.id,text:x.text,at:x.at};
   });
  }catch(e){this.readError='Memórias protegidas não puderam ser lidas. Arquivo preservado; restaure um backup antes de gravar. '+e.message;}
 }
 save(){
  if(this.readError)throw Error(this.readError);
  const temp=this.file+'.'+crypto.randomUUID()+'.tmp';
  const data=this.encrypt(JSON.stringify(this.items));
  if(!Buffer.isBuffer(data)||!data.length)throw Error('Criptografia inválida.');
  this.fs.writeFileSync(temp,data,{mode:0o600,flag:'wx'});
  try{this.fs.renameSync(temp,this.file);}catch(e){this.fs.rmSync(temp,{force:true});throw e;}
 }
 add(raw){
  const text=validateNote(raw);
  const id=crypto.randomUUID();
  if(this.items.length>=MAX)throw Error('Limite de memórias atingido.');
  if(this.items.some(x=>x.text.toLocaleLowerCase('pt-BR')===text.toLocaleLowerCase('pt-BR')))throw Error('Essa memória já está salva.');
  this.items.push({id,text,at:new Date().toISOString()});this.save();return {id,at:this.items.at(-1).at};
 }
 list(){return this.items.map(x=>({id:x.id,text:x.text,at:x.at})).reverse();}
 search(query){
  if(typeof query!=='string'||query.length>150)throw Error('Consulta inválida.');
  const w=words(query);
  if(!w.length)return [];
  return this.items.map(x=>{
   const terms=words(x.text),score=w.filter(t=>terms.some(y=>y===t||y.startsWith(t)||t.startsWith(y))).length;
   return {...x,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.at.localeCompare(a.at)).slice(0,8).map(({id,text,at})=>({id,text,at}));
 }
 remove(id){
  if(typeof id!=='string'||!/^[a-f\d-]{36}$/.test(id))throw Error('Identificador inválido.');
  const next=this.items.filter(x=>x.id!==id);
  if(next.length===this.items.length)throw Error('Memória não encontrada.');
  this.items=next;this.save();return true;
 }
}
module.exports={MemoryStore,validateNote,words};
