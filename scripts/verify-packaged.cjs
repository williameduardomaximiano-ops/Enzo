'use strict';
// Execute after electron-builder creates dist/win-unpacked.
// Stop CI if the app.asar would fail at startup due to a missing local require().
const fs=require('node:fs');
const path=require('node:path');
const asar=require('@electron/asar');
const archive=path.resolve('dist/win-unpacked/resources/app.asar');
if(!fs.existsSync(archive))throw Error('COSMO app.asar not found: '+archive);
const files=new Set(asar.listPackage(archive).map(p=>p.replaceAll('\\','/').replace(/^\/+/,'')));
const entry='desktop/main.cjs';
const mandatory=['desktop/main.cjs','updater/github-private.cjs','core/update-channel.cjs'];
const code=asar.extractFile(archive,entry).toString('utf8');
for(const match of code.matchAll(/require\(['"]((?:\.\.\/|\.\/)[^'"]+)['"]\)/g)){
 const modulePath=path.posix.normalize(path.posix.join('desktop',match[1]));
 if(modulePath.startsWith('../'))throw Error('Unexpected main-process require: '+match[1]);
 mandatory.push(modulePath);
}
const missing=[...new Set(mandatory)].filter(p=>!files.has(p));
if(missing.length)throw Error('COSMO INSTALLER INVALID: missing startup modules inside app.asar: '+missing.join(', '));
console.log('COSMO installer verified: '+new Set(mandatory).size+' local startup modules present in app.asar.');
