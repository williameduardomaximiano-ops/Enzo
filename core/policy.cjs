const crypto = require('node:crypto');
const APPS = Object.freeze({calculadora:'calc.exe',bloco:'notepad.exe',explorador:'explorer.exe',paint:'mspaint.exe'});
function cleanText(value, max=4000) { if(typeof value!=='string'||!value.trim()||value.length>max) throw Error('Texto inválido.'); return value.trim(); }
function safeUrl(value) { const u=new URL(cleanText(value,2048)); if(!['https:','http:'].includes(u.protocol)||u.username||u.password) throw Error('Endereço não permitido.'); return u.href; }
function validateAction(raw) {
 if(!raw||typeof raw!=='object') throw Error('Ação inválida.');
 switch(raw.type) {
 case 'open_app': if(!Object.hasOwn(APPS,raw.app)) throw Error('Aplicativo não autorizado.'); return {type:raw.type,app:raw.app};
 case 'open_url': return {type:raw.type,url:safeUrl(raw.url)};
 case 'type_text': return {type:raw.type,text:cleanText(raw.text,1500)};
 case 'agent': return {type:raw.type,task:cleanText(raw.task,4000)};
 case 'media': if(!['volume_up','volume_down','mute','play_pause','next','previous'].includes(raw.key)) throw Error('Comando de mídia bloqueado.');return {type:raw.type,key:raw.key};
 case 'hotkey': if(!['copy','paste','select_all','undo','save'].includes(raw.key)) throw Error('Atalho bloqueado.');return {type:raw.type,key:raw.key};
 default: throw Error('O ENZO não tem permissão para essa ação.');
 }
}
class Gate {
 constructor(clock=Date.now){this.clock=clock;this.pending=new Map();this.paused=false;}
 propose(raw){if(this.paused)throw Error('Controle pausado. Retome no computador.');const action=validateAction(raw);const id=crypto.randomUUID();this.pending.set(id,{action,expires:this.clock()+60000});return {id,action,expires:this.clock()+60000};}
 consume(id,approved){const p=this.pending.get(id);this.pending.delete(id);if(!p||p.expires<this.clock()||this.paused)throw Error('Autorização expirada ou cancelada.');if(!approved)return null;return p.action;}
 pause(){this.paused=true;this.pending.clear();}
 resume(){this.paused=false;}
}
module.exports={Gate,APPS,cleanText,safeUrl,validateAction};
