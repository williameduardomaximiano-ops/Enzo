'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {MissionCenter,category,validGoal,sanitizedEnvironment,resolveCLI}=require('../core/mission-center.cjs');
const {intent}=require('../core/intent.cjs');
function withStore(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-mission-test-'));
 return Promise.resolve().then(()=>fn(new MissionCenter(dir),dir)).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
}
test('categorias abrangem site, CRM, e-commerce e outros projetos',()=>{
 assert.equal(category('Criar um CRM para a Broda Barbearia'),'crm');
 assert.equal(category('Criar um site moderno para uma loja'),'site');
 assert.equal(category('Desenvolver uma loja virtual para celulares'),'ecommerce');
 assert.equal(category('Construir landing page de captação'),'landing');
 assert.equal(category('Prospectar empresas para vender sites'),'prospeccao');
 assert.equal(category('Automatizar controle de estoque'),'app');
});
test('COSMO cria missões por voz mas não inicia execução',async()=>withStore(async store=>{
 const command=intent('Cosmo, crie um CRM para uma barbearia');
 assert.equal(command.type,'mission_create');
 const m=store.create(command.goal);
 assert.equal(m.status,'rascunho');
 assert.equal(store.active,null);
 assert.ok(fs.existsSync(path.join(m.folder,'BRIEFING.md')));
 assert.ok(fs.readFileSync(path.join(m.folder,'BRIEFING.md'),'utf8').includes('barbearia'));
 assert.equal(intent('Cosmo, liste minhas missões').type,'mission_list');
 assert.equal(store.list()[0].id,m.id);
}));
test('rejeita missão vazia ou texto excessivo',()=>{
 assert.throws(()=>validGoal('curta'),/10/);
 assert.throws(()=>validGoal('A'.repeat(1501)),/1500/);
});
test('dados sobrevivem ao reiniciar; exclusão não é automática',async()=>withStore(async (store,dir)=>{
 const m=store.create('Criar uma landing page para a loja Alfa');
 const reloaded=new MissionCenter(dir);
 assert.equal(reloaded.list()[0].id,m.id);
 assert.equal(reloaded.get(m.id).status,'rascunho');
 assert.ok(fs.existsSync(m.folder));
}));
test('sem autorização, nenhum executor é aberto',async()=>withStore(async store=>{
 const m=store.create('Criar um CRM responsivo para loja');
 let calls=0;
 store.launcher=()=>{calls++;throw Error('não deveria executar')};
 const result=await store.run(m.id,{cli:'C:\\Fake\\opencode.exe',approve:async()=>false});
 assert.match(result.reason,/negada/);
 assert.equal(calls,0);
 assert.equal(store.get(m.id).status,'rascunho');
}));
test('execução aprovada gera log e termina em revisão, não em publicado',async()=>withStore(async store=>{
 const m=store.create('Criar um site para barbearia de exemplo');
 let options,argv;
 store.launcher=(exe,args,opts)=>{
  argv=args;options=opts;
  const child=new EventEmitter();
  child.stdout=new PassThrough();child.stderr=new PassThrough();
  process.nextTick(()=>{child.stdout.emit('data',Buffer.from('Gerou index.html'));child.emit('exit',0,null)});
  child.kill=()=>child.emit('exit',null,'SIGTERM');
  return child;
 };
 const result=await store.run(m.id,{cli:'C:\\tools\\opencode.exe',approve:async()=>true});
 assert.equal(result.status,'revisao');
 assert.equal(argv[0],'run');assert.equal(argv[1],'--agent');assert.equal(argv[2],'build');
 assert.equal(options.shell,false);
 assert.equal(options.cwd,m.folder);
 assert.ok(fs.readFileSync(result.log,'utf8').includes('Gerou index.html'));
}));
test('ambiente do agente não recebe tokens de hospedagem e IA',()=>{
 const e=sanitizedEnvironment({PATH:'x',GH_TOKEN:'secret',OPENAI_API_KEY:'secret',VERCEL_TOKEN:'secret',ENZO_GITHUB_TOKEN:'secret'});
 assert.equal(e.PATH,'x');
 assert.equal(e.GH_TOKEN,undefined);assert.equal(e.OPENAI_API_KEY,undefined);
 assert.equal(e.VERCEL_TOKEN,undefined);assert.equal(e.ENZO_GITHUB_TOKEN,undefined);
});
test('o caminho CLI deve apontar a exe aprovada; sem cmd arbitrário',()=>{
 assert.equal(resolveCLI({platform:'win32',env:{COSMO_OPENCODE_CLI:'C:\\Tools\\opencode.exe'},exists:p=>p==='C:\\Tools\\opencode.exe'}),'C:\\Tools\\opencode.exe');
 assert.throws(()=>resolveCLI({platform:'win32',env:{COSMO_OPENCODE_CLI:'C:\\Tools\\opencode.cmd'},exists:()=>true}),/opencode.exe/);
});
