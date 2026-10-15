const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const llm=require('../core/llm.cjs');
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>resolve(s));req.on('error',reject);});}
async function listen(handler){const srv=http.createServer(handler);await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;return {srv,port,close:async()=>{srv.closeAllConnections();await new Promise(r=>srv.close(r));}};}
test('resposta direta e proposta de ação',()=>{
 assert.equal(llm.parseReply('Olá, William.').say,'Olá, William.');
 const r=llm.parseReply(JSON.stringify({say:'Abrir?',action:{type:'open_app',app:'calculadora'}}));
 assert.equal(r.action.app,'calculadora');
 assert.equal(llm.modelMissing(404,''),true);
 assert.equal(llm.modelMissing(400,'model_decommissioned'),true);
 assert.equal(llm.modelMissing(500,'x'),false);
 assert.equal(llm.pickGroq(['whisper-large-v3','openai/gpt-oss-20b']),'openai/gpt-oss-20b');
 assert.equal(llm.pickGemini(['models/gemini-2.5-pro','models/gemini-3.5-flash']),'gemini-3.5-flash');
});
test('Groq e Gemini via mocks locais, com fallback Groq→Gemini',async()=>{
 const groq=await listen(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET')return res.end(JSON.stringify({data:[{id:'fallback-groq'},{id:'whisper-large-v3'}]}));
  const d=JSON.parse(await body(req));
  assert.equal(d.messages[0].role,'system');
  assert.equal(req.headers.authorization,'Bearer test-groq-key-12345');
  if(d.model==='dead-model'){res.statusCode=404;return res.end(JSON.stringify({error:{message:'The model `dead-model` does not exist'}}));}
  res.end(JSON.stringify({choices:[{message:{content:'Resposta Groq.'}}]}));
 });
 const gemini=await listen(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET')return res.end(JSON.stringify({models:[{name:'models/mock-flash',supportedGenerationMethods:['generateContent']}]}));
  assert.ok(req.url.includes(':generateContent'));
  assert.equal(req.headers['x-goog-api-key'],'test-gemini-key-12345');
  res.end(JSON.stringify({candidates:[{content:{parts:[{text:'Resposta Gemini.'}]}}]}));
 });
 process.env.ENZO_GROQ_BASE=`http://127.0.0.1:${groq.port}/openai/v1`;
 process.env.ENZO_GEMINI_BASE=`http://127.0.0.1:${gemini.port}/v1beta`;
 try{
  const s=new AbortController().signal;
  assert.equal((await llm.groqChat([{role:'user',content:'Oi'}],'test-model','test-groq-key-12345',s)).say,'Resposta Groq.');
  assert.equal((await llm.geminiChat([{role:'user',content:'Oi'}],'mock-flash','test-gemini-key-12345',s)).say,'Resposta Gemini.');
  assert.equal((await llm.groqChat([{role:'user',content:'Oi'}],'dead-model','test-groq-key-12345',s)).say,'Resposta Groq.');
  const auto=await llm.chatAuto([{role:'user',content:'Oi'}],{provider:'auto'}, {groq:'test-groq-key-12345',gemini:'test-gemini-key-12345'},s);
  assert.equal(auto.say,'Resposta Groq.');
  await groq.close();
  const fb=await llm.chatAuto([{role:'user',content:'Oi'}],{provider:'auto'},{groq:'test-groq-key-12345',gemini:'test-gemini-key-12345'},s);
  assert.equal(fb.say,'Resposta Gemini.');
  await assert.rejects(llm.chatAuto([{role:'user',content:'Oi'}],{},{},s),/Nenhuma chave configurada/);
  await gemini.close();
  try{await llm.chatAuto([{role:'user',content:'Oi'}],{provider:'auto'},{groq:'test-groq-key-12345',gemini:'test-gemini-key-12345'},s);assert.fail('deveria falhar');}
  catch(e){const m=String(e.message);assert.ok(m.includes('Groq e Gemini falharam'));assert.ok(!m.includes('test-groq-key-12345')&&!m.includes('test-gemini-key-12345'));}
 }finally{delete process.env.ENZO_GROQ_BASE;delete process.env.ENZO_GEMINI_BASE;await groq.close().catch(()=>{});await gemini.close();}
});
