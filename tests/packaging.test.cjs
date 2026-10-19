'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=require('../package.json');
test('COSMO includes updater and all local main-process modules in Electron package',()=>{
 const files=pkg.build.files;
 assert.ok(files.includes('updater/**'),'updater/** must be included in electron-builder files');
 const main=fs.readFileSync(path.join(root,pkg.main),'utf8');
 for(const match of main.matchAll(/require\(['"]((?:\.\.\/|\.\/)[^'"]+)['"]\)/g)){
  const modulePath=path.resolve(root,path.dirname(pkg.main),match[1]);
  assert.ok(fs.existsSync(modulePath),'Missing startup module in source: '+match[1]);
  const directory=path.relative(root,modulePath).split(path.sep)[0];
  assert.ok(files.includes(directory+'/**'),'Main process needs packaged folder: '+directory);
 }
});
