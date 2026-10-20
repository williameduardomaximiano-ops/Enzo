const {spawn}=require('node:child_process');const readline=require('node:readline');const crypto=require('node:crypto');
// Processo Python de voz (worker.py) falando JSON por linha. Se ele cair, o próximo pedido o reinicia;
// escrever num processo já fechado (EOF/EPIPE) rejeita o pedido em vez de derrubar o app.
class Voice{
 constructor(python,script,models,{timeoutMs=60000}={}){Object.assign(this,{python,script,models,timeoutMs});this.pending=new Map();this.process=null;}
 alive(){const p=this.process;return !!p&&p.exitCode===null&&p.signalCode===null&&!p.stdin.destroyed&&p.stdin.writable;}
 start(){if(this.alive())return;if(this.process)this.reset(Error('Serviço de voz parou.'));const p=spawn(this.python,['-u',this.script],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,ENZO_MODELS:this.models,PYTHONIOENCODING:'utf-8',HF_HUB_OFFLINE:'1'}});this.process=p;let error='';
  const died=e=>{if(this.process!==p)return;this.reset(Object.assign(Error('Serviço de voz parou. '+(error.trim().split('\n').pop()||e?.message||'')),{retry:true}));};
  p.stderr.on('data',x=>{error=(error+x).slice(-500)});p.stdin.on('error',died);
  readline.createInterface({input:p.stdout}).on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}const q=this.pending.get(m.id);if(!q)return;clearTimeout(q.timer);this.pending.delete(m.id);m.error?q.reject(Error(m.error)):q.resolve({...m.result,ms:m.ms});});
  p.on('error',died);p.on('exit',()=>died());}
 reset(e){const p=this.process;this.process=null;if(p&&p.exitCode===null)try{p.kill()}catch{}for(const q of this.pending.values()){clearTimeout(q.timer);q.reject(e);}this.pending.clear();}
 fail(e){this.reset(e);}
 call(op,data={}){return this.send(op,data).catch(e=>e.retry?this.send(op,data):Promise.reject(e));}
 // Se o processo cair (ao escrever ou durante o pedido), o erro vem com retry=true e o pedido é reenviado uma vez a um processo novo.
 send(op,data){return new Promise((resolve,reject)=>{try{this.start()}catch(e){return reject(e)}const p=this.process,id=crypto.randomUUID();
  const timer=setTimeout(()=>{this.pending.delete(id);this.stop();reject(Error('Tempo de voz excedido. O serviço será reiniciado.'));},this.timeoutMs);
  this.pending.set(id,{resolve,reject,timer});
  const unsent=e=>{if(this.process===p)this.reset(Object.assign(Error('Serviço de voz parou. '+(e?.message||'')),{retry:true}));};
  try{p.stdin.write(JSON.stringify({id,op,...data})+'\n',e=>{if(e)unsent(e)});}catch(e){unsent(e);}});}
 stop(){this.reset(Error('Voz interrompida.'));}
}
module.exports={Voice};
