'use strict';
/**
 * Valida o app.asar REAL, não apenas os fontes.
 * Falha antes de criar um instalador caso um import local esteja ausente.
 */
const fs=require('node:fs');
const path=require('node:path');


const REQUIRED=[
 'package.json','desktop/main.cjs','desktop/preload.cjs',
 'updater/github-private.cjs','core/update-channel.cjs','core/intent.cjs',
 'ui/index.html','ui/bundle.js','ui/style.css',
 'android/index.html'
];
const normalize=s=>String(s).replaceAll('\\','/').replace(/^\/+/,'');
function verifyEntries(list,files=REQUIRED) {
 const entries=new Set(list.map(normalize));
 const missing=files.filter(f=>!entries.has(f));
 if(missing.length)throw Error('Arquivos ausentes em app.asar: '+missing.join(', '));
 return entries;
}
function localImports(source){
 const imports=[];
 // O código principal usa require(...) estático para dependências locais.
 for(const match of String(source).matchAll(/\brequire\s*\(\s*(['"])(\.[^'"]+)\1\s*\)/g))imports.push(match[2]);
 return imports;
}
function verifyRelative(entry,requirePath,entries){
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(entry),requirePath));
 if(base.startsWith('../')||base.startsWith('/')||base==='..')throw Error('Import fora do pacote: '+entry+' -> '+requirePath);
 const candidates=[base,base+'.cjs',base+'.js',base+'.json',base+'/index.cjs',base+'/index.js',base+'/package.json'];
 if(!candidates.some(f=>entries.has(f)))throw Error('Import local inexistente em app.asar: '+entry+' -> '+requirePath);
}
function verifyArchive(archive){
 const asar=require('@electron/asar');
 if(!fs.existsSync(archive))throw Error('app.asar não foi gerado: '+archive);
 const entries=verifyEntries(asar.listPackage(archive));
 let checked=0;
 for(const entry of entries){
  if(!/^(desktop|core|updater|android)\/.*\.(?:js|cjs)$/.test(entry))continue;
  // Lemos os bytes realmente empacotados, não os arquivos do repositório.
  const code=asar.extractFile(archive,entry).toString('utf8');
  for(const reference of localImports(code)){verifyRelative(entry,reference,entries);checked++;}
 }
 if(!checked)throw Error('Nenhum import do processo principal foi verificado.');
 const updaterCode=asar.extractFile(archive,'updater/github-private.cjs').toString('utf8');
 if(!updaterCode.includes('GitHubPrivateUpdater'))throw Error('Arquivo updater empacotado não é o esperado.');
 console.log('COSMO: app.asar válido, '+entries.size+' entradas, '+checked+' imports locais presentes.');
 return {entries:entries.size,imports:checked};
}
if(require.main===module) {
 try{
  const archive=path.resolve(process.argv[2]||'dist/win-unpacked/resources/app.asar');
  verifyArchive(archive);
 }catch(e){console.error('ERRO DE EMPACOTAMENTO COSMO:',e.message);process.exitCode=1;}
}
module.exports={REQUIRED,normalize,verifyEntries,verifyRelative,verifyArchive,localImports};
