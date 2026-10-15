'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function localToday(date=new Date()){const p=n=>String(n).padStart(2,'0');return date.getFullYear()+'-'+p(date.getMonth()+1)+'-'+p(date.getDate());}
function validateEvent(event){
  if(!event||typeof event!=='object')throw Error('Evento inválido');
  const title=typeof event.title==='string'?event.title.trim():'';
  if(!title||title.length>120||/[\u0000-\u001f]/.test(title))throw Error('Título inválido');
  const date=event.date, time=event.time;
  if(typeof date!=='string'||!/^20\d\d-\d\d-\d\d$/.test(date))throw Error('Data inválida');
  const check=new Date(date+'T12:00:00');if(!Number.isFinite(check.getTime())||localToday(check)!==date)throw Error('Data inexistente');
  if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Horário inválido');
  return {title,date,time};
}
class LocalCalendar {
  constructor(dir){this.file=path.join(dir,'calendar.json');}
  list(){try{const all=JSON.parse(fs.readFileSync(this.file,'utf8'));return Array.isArray(all)?all.filter(e=>e&&typeof e.id==='string'&&typeof e.title==='string'&&typeof e.date==='string'&&typeof e.time==='string').slice(0,500).sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time)):[];}catch(e){if(e.code==='ENOENT')return [];throw Error('Agenda indisponível: verifique calendar.json antes de gravar');}}
  persist(all){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(all,null,2),{flag:'wx',mode:0o600});fs.renameSync(tmp,this.file);}catch(e){fs.rmSync(tmp,{force:true});throw e;}}
  add(raw){const clean=validateEvent(raw),all=this.list();if(all.length>=500)throw Error('Agenda cheia');const event={id:crypto.randomUUID(),...clean};all.push(event);this.persist(all);return event;}
  remove(id){if(typeof id!=='string'||!/^[\da-f-]{36}$/.test(id))throw Error('Identificador inválido');const all=this.list(),next=all.filter(x=>x.id!==id);if(next.length===all.length)throw Error('Evento não encontrado');this.persist(next);return true;}
}
module.exports={LocalCalendar,localToday,validateEvent};