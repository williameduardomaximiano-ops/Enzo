// Assina o manifesto enzo-update.json no formato que updater/github-private.cjs aceita.
// Chave privada Ed25519: variável ENZO_SIGNING_KEY (PEM, usada no GitHub Actions) ou --key ARQUIVO.
// Antes de gravar, confere a assinatura com a chave PÚBLICA do app: um segredo errado falha aqui, não no PC do usuário.
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {PUBLIC_KEY_PEM}=require('../core/update-channel.cjs');const {verifyEnvelope}=require('../updater/github-private.cjs');

function signRelease({installer,version,notes,privateKeyPem,publicKeyPem=PUBLIC_KEY_PEM}){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Versão inválida: '+version);
 const asset=`ENZO-${version}-Windows-x64.exe`;if(path.basename(installer)!==asset)throw Error(`O instalador deve se chamar ${asset}.`);
 const data=fs.readFileSync(installer);const text=String(notes||'').trim()||`Versão ${version}.`;if(text.length>10000)throw Error('Notas longas demais (máx. 10000).');
 const payload=JSON.stringify({version,asset,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),notes:text});
 let key;try{key=crypto.createPrivateKey(privateKeyPem);}catch{throw Error('Chave privada inválida.');}
 const envelope={payload,signature:crypto.sign(null,Buffer.from(payload),key).toString('base64')};
 const checked=verifyEnvelope(envelope,crypto.createPublicKey(publicKeyPem),'0.0.0');
 if(!checked||checked.version!==version)throw Error('Manifesto não confere.');
 return envelope;}

if(require.main===module){
 const args=process.argv.slice(2);const k=args.indexOf('--key');const keyFile=k>=0?args.splice(k,2)[1]:null;
 const [installer,version,notesFile,out]=args;
 if(!out){console.error('Uso: node scripts/sign-github-release.cjs INSTALADOR VERSAO NOTAS.md SAIDA.json [--key CHAVE_PRIVADA.pem]\n(ou defina ENZO_SIGNING_KEY com o PEM da chave privada)');process.exit(1);}
 const privateKeyPem=keyFile?fs.readFileSync(keyFile,'utf8'):process.env.ENZO_SIGNING_KEY;
 if(!privateKeyPem)throw Error('Chave privada ausente: defina ENZO_SIGNING_KEY ou use --key.');
 try{const env=signRelease({installer,version,notes:fs.existsSync(notesFile)?fs.readFileSync(notesFile,'utf8'):'',privateKeyPem});fs.writeFileSync(out,JSON.stringify(env,null,2));console.log(`Manifesto assinado e conferido: ${out}`);}
 catch(e){console.error('Falha ao assinar:',e.message.includes('Assinatura inválida')?'a chave privada não corresponde à chave pública do app (core/update-channel.cjs).':e.message);process.exit(1);}
}
module.exports={signRelease};
