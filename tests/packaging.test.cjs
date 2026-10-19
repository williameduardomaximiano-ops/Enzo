'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {verifyEntries,verifyRelative,localImports}=require('../scripts/verify-packaged.cjs');
const packageFile=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package.json'),'utf8'));

test('electron-builder inclui módulo do atualizador no aplicativo',()=>{
 assert.ok(packageFile.build.files.includes('updater/**'),'updater/** precisa ser empacotado no app.asar');
 assert.match(packageFile.scripts['build:win'],/verify:win/,'build deve validar conteúdo ANTES do NSIS');
});
test('falha se import updater não constar no pacote',()=>{
 const files=['desktop/main.cjs','core/intent.cjs','package.json'];
 assert.throws(()=>verifyEntries(files),/updater\/github-private.cjs/);
 assert.throws(()=>verifyRelative('desktop/main.cjs','../updater/github-private.cjs',new Set(files)),/inexistente/);
});
test('confere todos os imports locais do arquivo de inicialização',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../desktop/main.cjs'),'utf8');
 const imports=localImports(source);
 assert.ok(imports.includes('../updater/github-private.cjs'));
 for(const dependency of imports){
  const resolved=path.resolve(__dirname,'../desktop',dependency);
  assert.ok(fs.existsSync(resolved),'Arquivo de origem inexistente: '+dependency);
 }
});
