const {test}=require('node:test');const assert=require('node:assert/strict');
const {runBrain}=require('../core/brain.cjs');const llm=require('../core/llm.cjs');const {makeTools}=require('../core/tools.cjs');
test('cérebro encadeia ferramentas: pesquisa e depois agente, com erro tratado',async()=>{const calls=[];let round=0;
 const tools=[{name:'web_research',description:'',parameters:{type:'object',properties:{}},run:a=>{calls.push(['research',a.query]);return 'barbearias usam tons escuros'}},{name:'coding_agent',description:'',parameters:{type:'object',properties:{}},run:a=>{calls.push(['agent',a.task]);return 'agente iniciado'}},{name:'quebra',description:'',parameters:{type:'object',properties:{}},run:()=>{throw Error('sem rede')}}];
 const llmCall=async t=>{round++;const last=t[t.length-1];
  if(round===1)return {text:'',calls:[{id:'1',name:'web_research',args:{query:'tendências barbearia'}},{id:'2',name:'quebra',args:{}}]};
  if(round===2){assert.equal(last.role,'tool');assert.match(t[t.length-1].content,/ERRO: sem rede/);return {text:'',calls:[{id:'3',name:'coding_agent',args:{task:'site com tons escuros'}}]};}
  return {text:'Pronto, senhor. O agente começou o site.',calls:[]};};
 const steps=[];const out=await runBrain({text:'pesquisa e cria um site de barbearia',tools,llmCall,onStep:s=>steps.push(s.name)});
 assert.equal(out.say,'Pronto, senhor. O agente começou o site.');assert.deepEqual(calls,[['research','tendências barbearia'],['agent','site com tons escuros']]);assert.deepEqual(steps,['web_research','quebra','coding_agent']);});
test('cérebro para no limite de passos e cancela quando pedido',async()=>{let n=0;const tools=[{name:'x',description:'',parameters:{type:'object',properties:{}},run:()=>'ok'}];
 const out=await runBrain({text:'loop',tools,maxSteps:3,llmCall:async(t,specs)=>{n++;return specs.length?{text:'',calls:[{id:String(n),name:'x',args:{}}]}:{text:'Resumo final.',calls:[]}}});assert.equal(out.say,'Resumo final.');assert.equal(n,4);
 let go=true;await assert.rejects(runBrain({text:'a',tools,shouldContinue:()=>go,llmCall:async()=>{go=false;return {text:'',calls:[{id:'1',name:'x',args:{}}]}}}),/cancelado/);});
test('transcrição neutra vira formato Groq e Gemini',()=>{const t=[{role:'user',content:'oi'},{role:'assistant',content:'',calls:[{id:'c1',name:'weather',args:{city:'Rio'}}]},{role:'tool',id:'c1',name:'weather',content:'sol'}];
 const o=llm.toOpenAI(t,'SYS');assert.equal(o[0].content,'SYS');assert.equal(o[2].tool_calls[0].function.arguments,'{"city":"Rio"}');assert.deepEqual(o[3],{role:'tool',tool_call_id:'c1',content:'sol'});
 const g=llm.toGemini(t);assert.deepEqual(g[1].parts[0],{functionCall:{name:'weather',args:{city:'Rio'}}});assert.deepEqual(g[2],{role:'user',parts:[{functionResponse:{name:'weather',response:{result:'sol'}}}]});
 const keep=llm.toGemini([{role:'user',content:'a'},{role:'assistant',raw:{gemini:[{functionCall:{name:'x',args:{}},thoughtSignature:'S'}]},calls:[{id:'g',name:'x'}]}]);assert.equal(keep[1].parts[0].thoughtSignature,'S');});
test('catálogo de ferramentas tem esquemas válidos e nomes únicos',()=>{const tools=makeTools(new Proxy({},{get:()=>()=>'ok'}));const names=tools.map(t=>t.name);assert.equal(new Set(names).size,names.length);assert.ok(names.length>=30);
 for(const t of tools){assert.match(t.name,/^[a-z_]{3,40}$/);assert.equal(t.parameters.type,'object');assert.ok(t.description.length>10);for(const r of t.parameters.required||[])assert.ok(r in t.parameters.properties);}});
