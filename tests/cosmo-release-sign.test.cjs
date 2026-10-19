'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {verifyEnvelope}=require('../updater/github-private.cjs');

test('manifesto da primeira release COSMO valida no atualizador ENZO 0.1.4',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cosmo-sign-'));
 try{
  const kp=crypto.generateKeyPairSync('ed25519');
  const privateKey=path.join(directory,'private.pem');
  fs.writeFileSync(privateKey,kp.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});
  const exe=path.join(directory,'ENZO-0.1.5-Windows-x64.exe');
  fs.writeFileSync(exe,Buffer.alloc(2048,3));
  const notes=path.join(directory,'notes.txt');
  fs.writeFileSync(notes,'COSMO 0.1.5');
  const out=path.join(directory,'enzo-update.json');
  execFileSync(process.execPath,[path.join(__dirname,'../scripts/sign-release.cjs'),privateKey,exe,'0.1.5','https://github.com/',notes,out]);
  const signed=JSON.parse(fs.readFileSync(out,'utf8'));
  const verified=verifyEnvelope(signed,kp.publicKey,'0.1.4');
  assert.equal(verified.version,'0.1.5');
  assert.equal(verified.asset,'ENZO-0.1.5-Windows-x64.exe');
  assert.equal(verified.notes,'COSMO 0.1.5');
  assert.equal(verified.size,2048);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
