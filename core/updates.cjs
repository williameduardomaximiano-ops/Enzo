const crypto=require('node:crypto');const fs=require('node:fs/promises');const path=require('node:path');
function version(s){if(typeof s!=='string'||!/^\d+\.\d+\.\d+$/.test(s))throw Error('Versão inválida.');return s.split('.').map(Number);}
function newer(a,b){const x=version(a),y=version(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
function verifyManifest(envelope,key,current){
 if(!key)throw Error('Canal de atualizações ainda não configurado.');
 if(!envelope||typeof envelope.payload!=='string'||envelope.payload.length>40000||typeof envelope.signature!=='string')throw Error('Manifesto inválido.');
 if(!crypto.verify(null,Buffer.from(envelope.payload),key,Buffer.from(envelope.signature,'base64')))throw Error('Assinatura de atualização inválida.');
 const m=JSON.parse(envelope.payload);if(!newer(m.version,current))return null;
 if(!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isSafeInteger(m.size)||m.size<1000||m.size>2e9)throw Error('Pacote inválido.');
 const u=new URL(m.url);if(u.protocol!=='https:'||u.username||u.password||!u.pathname.endsWith('.exe'))throw Error('URL de atualização inválida.');
 if(typeof m.notes!=='string'||m.notes.length>10000)throw Error('Notas inválidas.');return m;
}
class Updater{
 constructor({url,key,current,directory}){Object.assign(this,{url,key,current,directory});this.available=null;this.file=null;}
 async check(){if(!this.url||!this.key)throw Error('Nenhum canal de distribuição publicado. Esta versão não anuncia atualizações fictícias.');if(new URL(this.url).protocol!=='https:')throw Error('Canal exige HTTPS.');const r=await fetch(this.url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Não foi possível consultar o canal.');const text=await r.text();if(text.length>60000)throw Error('Manifesto muito grande.');this.available=verifyManifest(JSON.parse(text),this.key,this.current);this.file=null;return this.available;}
 async download(){const m=this.available;if(!m)throw Error('Busque uma atualização válida primeiro.');await fs.mkdir(this.directory,{recursive:true});const dest=path.join(this.directory,`ENZO-${m.version}.exe`),tmp=dest+'.part';const r=await fetch(m.url,{signal:AbortSignal.timeout(300000)});if(!r.ok||new URL(r.url).protocol!=='https:')throw Error('Download recusado.');const hash=crypto.createHash('sha256');let size=0;const f=await fs.open(tmp,'w',0o600);try{for await(const chunk of r.body){size+=chunk.length;if(size>m.size)throw Error('Tamanho incorreto.');hash.update(chunk);await f.write(chunk);}if(size!==m.size||hash.digest('hex')!==m.sha256)throw Error('Integridade do instalador inválida.');}catch(e){await f.close();await fs.rm(tmp,{force:true});throw e;}await f.close();await fs.rename(tmp,dest);this.file=dest;return dest;}
}
module.exports={Updater,verifyManifest,newer};
