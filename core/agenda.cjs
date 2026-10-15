'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const FORMAT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function validDate(value) {
  if(typeof value!=='string'||!FORMAT.test(value))return false;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return false;
  const [ymd,hm]=value.split('T');const [year,month,day]=ymd.split('-').map(Number),[h,m]=hm.split(':').map(Number);
  return date.getFullYear()===year&&date.getMonth()+1===month&&date.getDate()===day&&date.getHours()===h&&date.getMinutes()===m;
}
class Agenda {
  constructor(dataDir) {this.filename=path.join(dataDir,'agenda-local.json');}
  list() {
    try {
      const stat=fs.statSync(this.filename);
      if(stat.size>120000)throw Error('Arquivo de agenda excede o limite permitido.');
      const entries=JSON.parse(fs.readFileSync(this.filename,'utf8'));
      if(!Array.isArray(entries))throw Error('Agenda inválida.');
      return entries.filter(e=>e&&typeof e.id==='string'&&typeof e.title==='string'&&e.title.length<=100&&validDate(e.startsAt)).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,200);
    } catch(e) {if(e.code==='ENOENT')return [];throw e;}
  }
  write(entries) {
    const temp=this.filename+'.tmp-'+process.pid;
    fs.writeFileSync(temp,JSON.stringify(entries,null,2),{flag:'wx',mode:0o600});
    try {fs.renameSync(temp,this.filename)} catch(e) {try{fs.rmSync(temp,{force:true})}catch{}throw e;}
  }
  create(entry) {
    const title=typeof entry?.title==='string'?entry.title.trim():'';
    const startsAt=entry?.startsAt;
    if(!title||title.length>100||!validDate(startsAt))throw Error('Informe título e data/hora válidos.');
    const entries=this.list();if(entries.length>=200)throw Error('Limite de 200 compromissos atingido.');
    const added={id:crypto.randomUUID(),title,startsAt};
    entries.push(added);this.write(entries);return added;
  }
  remove(id) {
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw Error('Identificador inválido.');
    const entries=this.list(),filtered=entries.filter(e=>e.id!==id);
    if(entries.length===filtered.length)throw Error('Compromisso não encontrado.');
    this.write(filtered);return true;
  }
}
module.exports={Agenda,validDate};
