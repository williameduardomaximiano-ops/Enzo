const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');const stt=require('../core/stt.cjs');
test('vocabulário: contatos, projetos e cidade entram na dica, com limite',()=>{const p=stt.buildPrompt({contacts:[{name:'Joãozinho'}],projects:['loja-da-maria'],city:'Curitiba',memory:['meu time é o Corinthians']});
 for(const w of ['Cosmo','Joãozinho','loja-da-maria','Curitiba','YouTube','Corinthians'])assert.ok(p.includes(w),w);assert.ok(stt.buildPrompt({contacts:Array.from({length:300},(_,i)=>({name:'Contato'+i}))}).length<=900);});
test('corrige o nome do assistente quando o reconhecimento troca',()=>{assert.equal(stt.fixName('Cosme, abre o YouTube'),'Cosmo, abre o YouTube');assert.equal(stt.fixName('bom dia cosmos'),'bom dia Cosmo');assert.equal(stt.fixName('que horas são, Kosmo?'),'que horas são, Cosmo?');assert.equal(stt.fixName('o cosmos é infinito e bonito'),'o cosmos é infinito e bonito');});
test('Groq: envia áudio, idioma e vocabulário; troca de modelo se o primeiro não existir',async()=>{const seen=[];const server=http.createServer((req,res)=>{let body=[];req.on('data',d=>body.push(d));req.on('end',()=>{const b=Buffer.concat(body).toString('latin1');const model=(b.match(/name="model"\r\n\r\n([^\r]+)/)||[])[1];seen.push({auth:req.headers.authorization,model,lang:/name="language"\r\n\r\npt/.test(b),prompt:/name="prompt"\r\n\r\n[^\r]*Cosmo/.test(b),file:/filename="fala.wav"/.test(b)&&b.includes('RIFF')});
  if(model==='whisper-large-v3-turbo'){res.statusCode=404;return res.end('{}')}res.setHeader('content-type','application/json');res.end(JSON.stringify({text:' Cosme, abre o YouTube. '}));});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const wav=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(40)]);process.env.ENZO_GROQ_BASE=base;
  const r=await stt.transcribe({audio:wav.toString('base64'),engine:'auto',groqKey:'gsk_test_12345678',prompt:stt.buildPrompt(),local:async()=>({text:'local'})});
  assert.deepEqual(r,{text:'Cosmo, abre o YouTube.',engine:'groq'});assert.deepEqual(seen.map(s=>s.model),['whisper-large-v3-turbo','whisper-large-v3']);assert.ok(seen.every(s=>s.lang&&s.prompt&&s.file&&s.auth==='Bearer gsk_test_12345678'));}
 finally{server.close();delete process.env.ENZO_GROQ_BASE;}});
test('motor: sem chave ou "somente no PC" usa o local; falha na nuvem cai no local',async()=>{const local=async p=>({text:'que horas são',p});
 assert.deepEqual(await stt.transcribe({audio:'',engine:'auto',groqKey:'',local}),{text:'que horas são',engine:'local'});
 let called=false;assert.equal((await stt.transcribe({audio:'',engine:'local',groqKey:'gsk_x',local,fetchImpl:()=>{called=true}})).engine,'local');assert.equal(called,false);
 const r=await stt.transcribe({audio:'AAAA',engine:'groq',groqKey:'gsk_x_12345678',local,fetchImpl:async()=>({ok:false,status:500})});assert.equal(r.engine,'local');assert.match(r.fallback,/500/);});
