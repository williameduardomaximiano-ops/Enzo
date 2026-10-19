// Assina o manifesto enzo-update.json no formato que updater/github-private.cjs aceita.
// Chave privada Ed25519: variável ENZO_SIGNING_KEY (PEM, usada no GitHub Actions) ou --key ARQUIVO.
// Antes de gravar, confere a assinatura com a chave PÚBLICA do app: um segredo errado falha aqui, não no PC do usuário.
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {PUBLIC_KEY_PEM}=require('../core/update-channel.cjs');const {verifyEnvelope}=require('../updater/github-private.cjs');

// Aceita o PEM como foi colado no segredo: com aspas, \\n literais, CRLF ou só o miolo em base64.
function normalizeKey(raw){let k=String(raw||'').trim().replace(/^["']|["']$/g,'').replace(/\\r\\n|\\n/g,'\n').replace(/\r\n/g,'\n').trim();
 if(/PUBLIC KEY/.test(k))throw Error('O segredo contém a chave PÚBLICA. Use o conteúdo de enzo-signing-private.pem.');
 if(/OPENSSH PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY/.test(k))throw Error('O segredo contém outro tipo de chave (SSH/RSA/EC). Use o enzo-signing-private.pem gerado por scripts/generate-signing-key.cjs.');
 if(!/-----BEGIN/.test(k)){const b=k.replace(/\s+/g,'');if(/^[A-Za-z0-9+/=]{40,}$/.test(b))k=`-----BEGIN PRIVATE KEY-----\n${b.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;}
 else k=k.replace(/-----BEGIN PRIVATE KEY-----\s*/,'-----BEGIN PRIVATE KEY-----\n').replace(/\s*-----END PRIVATE KEY-----/,'\n-----END PRIVATE KEY-----');
 let key;try{key=crypto.createPrivateKey(k);}catch{throw Error(`Chave privada inválida (${k.length} caracteres, ${/-----BEGIN PRIVATE KEY-----/.test(k)?'com':'sem'} cabeçalho BEGIN PRIVATE KEY). Copie o arquivo enzo-signing-private.pem inteiro, da linha BEGIN até a END.`);}
 if(key.asymmetricKeyType!=='ed25519')throw Error(`A chave é ${key.asymmetricKeyType}, mas o COSMO usa Ed25519. Use o enzo-signing-private.pem gerado por scripts/generate-signing-key.cjs.`);
 return key;}

function signRelease({installer,version,notes,privateKeyPem,publicKeyPem=PUBLIC_KEY_PEM}){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Versão inválida: '+version);
 const asset=`ENZO-${version}-Windows-x64.exe`;if(path.basename(installer)!==asset)throw Error(`O instalador deve se chamar ${asset}.`);
 const data=fs.readFileSync(installer);const text=String(notes||'').trim()||`Versão ${version}.`;if(text.length>10000)throw Error('Notas longas demais (máx. 10000).');
 const payload=JSON.stringify({version,asset,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),notes:text});
 const key=normalizeKey(privateKeyPem);
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
 catch(e){console.error('Falha ao assinar:',e.message.includes('Assinatura inválida')?'a chave privada é válida, mas não corresponde à chave pública do app (core/update-channel.cjs). Gere um par novo e troque a chave pública no código.':e.message);process.exit(1);}
}
module.exports={signRelease,normalizeKey};
