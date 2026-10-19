'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {MissionCenter}=require('../core/mission-center.cjs');
const {publishPreview,parsePreviewUrl,deploySpec}=require('../core/vercel-preview.cjs');
test('URLs publicadas precisam ser HTTPS da Vercel',()=>{
 assert.equal(parsePreviewUrl('https://cosmo-example-123.vercel.app'),'https://cosmo-example-123.vercel.app/');
 assert.throws(()=>parsePreviewUrl('https://localhost/test'),/link público/);
});
test('deploy não usa --prod, shell nem executa sem consentimento',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-vercel-'));
 try{
  const store=new MissionCenter(dir);const item=store.create('Criar site para empresa local');
  fs.writeFileSync(path.join(item.folder,'index.html'),'<h1>Exemplo</h1>');
  store.update(store.get(item.id),'revisao');
  let calls=0;
  let result=await publishPreview(store,item.id,{cli:'C:\\tools\\vercel.exe',approve:async()=>false,launcher:()=>{calls++;}});
  assert.equal(result.reason,'Publicação cancelada.');
  assert.equal(calls,0);
  const launcher=(exe,args,opts)=>{
   calls++;assert.equal(opts.shell,false);assert.equal(opts.cwd,item.folder);
   assert.deepEqual(args,['deploy','--yes']);
   const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
   process.nextTick(()=>{child.stdout.emit('data',Buffer.from('https://meu-site-demo.vercel.app'));child.emit('exit',0)});
   child.kill=()=>child.emit('exit',1);
   return child;
  };
  result=await publishPreview(store,item.id,{cli:'C:\\tools\\vercel.exe',approve:async()=>true,launcher});
  assert.equal(result.status,'previa');assert.equal(calls,1);
  assert.equal(store.get(item.id).previewUrl,'https://meu-site-demo.vercel.app/');
  const direct=deploySpec('C:\\tools\\vercel.exe');
  assert.equal(direct.exe,'C:\\tools\\vercel.exe');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
