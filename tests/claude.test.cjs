const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
test('Claude: Haiku nas respostas, ferramentas em loop, raciocínio devolvido intacto e reserva só onde existe',async()=>{
 const seen=[];const server=http.createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{const b=JSON.parse(body);seen.push({headers:req.headers,body:b});res.setHeader('content-type','application/json');
  const hasResult=b.messages.some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='tool_result'));
  const content=hasResult?[{type:'text',text:'Pronto, senhor.'}]:[{type:'thinking',thinking:'',signature:'sig-1'},{type:'tool_use',id:'toolu_1',name:'get_datetime',input:{}},{type:'tool_use',id:'toolu_2',name:'weather',input:{city:'Curitiba'}}];
  res.end(JSON.stringify({id:'msg_'+seen.length,type:'message',role:'assistant',model:b.model,content,stop_reason:hasResult?'end_turn':'tool_use',usage:{input_tokens:1,output_tokens:1}}));});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.ENZO_ANTHROPIC_BASE=`http://127.0.0.1:${server.address().port}`;
 try{const claude=require('../core/claude.cjs');const {runBrain}=require('../core/brain.cjs');assert.equal(claude.DEFAULT_MODEL,'claude-haiku-5-5');
  const tools=[{name:'get_datetime',description:'hora',parameters:{type:'object',properties:{}},run:()=>'10:00'},{name:'weather',description:'clima',parameters:{type:'object',properties:{city:{type:'string'}}},run:a=>`sol em ${a.city}`}];
  const out=await runBrain({text:'Que horas são e como está o tempo?',tools,llmCall:(t,specs)=>claude.claudeTools(t,specs,{apiKey:'sk-ant-test-123456',system:'sys'})});
  assert.equal(out.say,'Pronto, senhor.');assert.equal(seen.length,2);
  const [a,b]=seen;assert.equal(a.body.model,'claude-haiku-5-5');assert.equal(a.headers['x-api-key'],'sk-ant-test-123456');assert.equal(a.body.fallbacks,undefined);assert.ok(!String(a.headers['anthropic-beta']||'').includes('server-side-fallback'));
  assert.deepEqual(a.body.tools[1],{name:'weather',description:'clima',input_schema:{type:'object',properties:{city:{type:'string'}}}});assert.equal(a.body.temperature,undefined);
  const asst=b.body.messages[1];assert.equal(asst.role,'assistant');assert.equal(asst.content[0].type,'thinking');assert.equal(asst.content[0].signature,'sig-1');
  const results=b.body.messages[2];assert.equal(results.role,'user');assert.deepEqual(results.content.map(c=>[c.tool_use_id,c.content]),[['toolu_1','10:00'],['toolu_2','sol em Curitiba']]);
  await claude.claudeChat([{role:'user',content:'oi'}],{apiKey:'sk-ant-test-123456',model:'claude-opus-5-5',system:'s'}).catch(()=>{});
  const opus=seen[2];assert.equal(opus.body.fallbacks,'default');assert.match(String(opus.headers['anthropic-beta']),/server-side-fallback-2026-07-01/);
 }finally{server.close();delete process.env.ENZO_ANTHROPIC_BASE;}});
test('Claude Code dos projetos usa Sonnet 5.5',()=>{const {buildCommand}=require('../core/agent.cjs');const c=buildCommand('claude','x',{bin:'/b/claude'});assert.equal(c.args[c.args.indexOf('--model')+1],'claude-sonnet-5-5');});
