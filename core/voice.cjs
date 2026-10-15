const {spawn}=require('node:child_process');const readline=require('node:readline');const crypto=require('node:crypto');
class Voice{
 constructor(python,script,models){Object.assign(this,{python,script,models});this.pending=new Map();this.process=null;}
 start(){if(this.process)return;const p=spawn(this.python,['-u',this.script],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,ENZO_MODELS:this.models,PYTHONIOENCODING:'utf-8',HF_HUB_OFFLINE:'1'}});this.process=p;let error='';p.stderr.on('data',x=>{error=(error+x).slice(-500)});readline.createInterface({input:p.stdout}).on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}const q=this.pending.get(m.id);if(!q)return;clearTimeout(q.timer);this.pending.delete(m.id);m.error?q.reject(Error(m.error)):q.resolve({...m.result,ms:m.ms});});p.on('error',e=>{if(this.process===p)this.fail(e)});p.on('exit',()=>{if(this.process===p)this.fail(Error('Serviço de voz parou. '+error))});}
 fail(e){for(const q of this.pending.values()){clearTimeout(q.timer);q.reject(e);}this.pending.clear();this.process=null;}
 call(op,data={}){this.start();return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{this.stop();reject(Error('Tempo de voz excedido. O serviço será reiniciado.'));},60000);this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({id,op,...data})+'\n',e=>{if(e){clearTimeout(timer);this.pending.delete(id);reject(e)}});});}
 stop(){const p=this.process;this.process=null;if(p)p.kill();this.fail(Error('Voz interrompida.'));}
}
module.exports={Voice};
