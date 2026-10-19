'use strict';
// Signing key must remain outside the repository and the distributed application.
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const [keyPath,exe,version,url,notesPath,out]=process.argv.slice(2);
if(!out){
  console.error('node scripts/sign-release.cjs PRIVATE_KEY INSTALLER VERSION HTTPS_URL NOTES_FILE OUTPUT_JSON');
  process.exit(1);
}
if(new URL(url).protocol!=='https:')throw Error('HTTPS obrigatório');
if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))throw Error('Versão inválida');
const asset=path.basename(exe);
// Maintains backwards-compatible installer filename for already-installed ENZO updaters,
// even though the app UI and executable are branded COSMO.
if(asset!=='ENZO-'+version+'-Windows-x64.exe')throw Error('Nome de instalador incompatível com atualizador legado');
const data=fs.readFileSync(exe);
const notes=fs.readFileSync(notesPath,'utf8');
const payload=JSON.stringify({version,asset,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),notes});
const signature=crypto.sign(null,Buffer.from(payload),fs.readFileSync(keyPath)).toString('base64');
fs.writeFileSync(out,JSON.stringify({payload,signature},null,2));
console.log('Manifesto assinado Ed25519 gerado para '+asset);
