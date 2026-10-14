'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const ALLOWED_REDIRECTS=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);
function parseVersion(s){
  if(typeof s!=='string'||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(s))throw Error('Versão inválida');
  const p=s.split('.').map(Number);if(!p.every(Number.isSafeInteger))throw Error('Versão excessiva');return p;
}
function newer(a,b){const x=parseVersion(a),y=parseVersion(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;}
function verifyEnvelope(e,key,current){
  if(!e||typeof e.payload!=='string'||Buffer.byteLength(e.payload)>40000||typeof e.signature!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(e.signature))throw Error('Manifesto malformado');
  if(!crypto.verify(null,Buffer.from(e.payload),key,Buffer.from(e.signature,'base64')))throw Error('Assinatura de atualização inválida');
  const m=JSON.parse(e.payload);
  if(!newer(m.version,current))return null;
  if(typeof m.asset!=='string'||!/^ENZO-\d+\.\d+\.\d+-Windows-x64\.exe$/.test(m.asset)||m.asset!=='ENZO-'+m.version+'-Windows-x64.exe')throw Error('Nome de instalador não permitido');
  if(typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isSafeInteger(m.size)||m.size<1024||m.size>2e9)throw Error('Arquivo inválido');
  if(typeof m.notes!=='string'||m.notes.length>10000)throw Error('Notas inválidas');
  return Object.freeze({version:m.version,asset:m.asset,sha256:m.sha256,size:m.size,notes:m.notes});
}
class GitHubPrivateUpdater{
  constructor({owner,repo,currentVersion,publicKey,directory,tokenProvider,fetchImpl=globalThis.fetch}){
    for(const [k,v] of Object.entries({owner,repo}))if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(v))throw Error('Repositório inválido: '+k);
    parseVersion(currentVersion);
    const key=publicKey?.type==='public'?publicKey:crypto.createPublicKey(publicKey);
    if(key.asymmetricKeyType!=='ed25519')throw Error('Chave pública deve ser Ed25519');
    if(!path.isAbsolute(directory)||typeof tokenProvider!=='function')throw Error('Diretório ou cofre não configurado');
    Object.assign(this,{owner,repo,currentVersion,key,directory,tokenProvider,fetchImpl,available:null,release:null});
  }
  url(segment){return 'https://api.github.com/repos/'+this.owner+'/'+this.repo+'/'+segment;}
  async headers(){
    const token=await this.tokenProvider();
    if(typeof token!=='string'||!token.trim()||/\s/.test(token))throw Error('GitHub privado: token de leitura não configurado');
    return {Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ENZO-Updater/1.0'};
  }
  async metadata(){
    const r=await this.fetchImpl(this.url('releases/latest'),{headers:await this.headers(),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(r.status===404)throw Error('Sem release estável ou acesso ao repositório privado negado');
    if(!r.ok)throw Error('GitHub HTTP '+r.status);
    const t=await r.text();if(Buffer.byteLength(t)>150000)throw Error('Metadados excessivos');
    return JSON.parse(t);
  }
  async asset(assetId){
    if(!Number.isSafeInteger(assetId)||assetId<=0)throw Error('Asset inválido');
    let url=this.url('releases/assets/'+assetId);
    let headers={...await this.headers(),Accept:'application/octet-stream'};
    for(let i=0;i<4;i++){
      const r=await this.fetchImpl(url,{headers,redirect:'manual',signal:AbortSignal.timeout(300000)});
      if([301,302,303,307,308].includes(r.status)){
        const next=r.headers.get('location');if(!next)throw Error('Redirecionamento inválido');
        const target=new URL(next,url);
        if(target.protocol!=='https:'||target.username||target.password||!ALLOWED_REDIRECTS.has(target.hostname))throw Error('Redirecionamento não autorizado');
        url=target.toString();headers={'User-Agent':'ENZO-Updater/1.0'};continue; // Nunca encaminhar token à CDN.
      }
      if(!r.ok)throw Error('Download HTTP '+r.status);
      return r;
    }
    throw Error('Redirecionamentos excessivos');
  }
  async check(){
    this.available=null;this.release=null;
    const release=await this.metadata();
    if(!release||!Array.isArray(release.assets)||release.draft||release.prerelease)throw Error('Release inválida');
    const manifests=release.assets.filter(a=>a.name==='enzo-update.json');
    if(manifests.length!==1||!Number.isSafeInteger(manifests[0].id))throw Error('Manifesto assinado ausente');
    const res=await this.asset(manifests[0].id);
    let bytes=0;const chunks=[];
    for await(const chunk of res.body){bytes+=chunk.length;if(bytes>60000)throw Error('Manifesto excessivo');chunks.push(Buffer.from(chunk));}
    const env=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const manifest=verifyEnvelope(env,this.key,this.currentVersion);
    if(!manifest)return null;
    if(release.tag_name!=='v'+manifest.version)throw Error('Versão do GitHub e manifesto divergem');
    const candidates=release.assets.filter(a=>a.name===manifest.asset);
    if(candidates.length!==1||!Number.isSafeInteger(candidates[0].id)||candidates[0].size!==manifest.size)throw Error('Instalador não corresponde ao manifesto');
    this.available=manifest;this.release={assetId:candidates[0].id};
    return manifest;
  }
  async download(){
    if(!this.available||!this.release)throw Error('Consulte a versão antes de baixar');
    const m=this.available;
    await fs.mkdir(this.directory,{recursive:true,mode:0o700});
    const destination=path.join(this.directory,m.asset);
    const temp=path.join(this.directory,'.'+m.asset+'.'+crypto.randomUUID()+'.part');
    const res=await this.asset(this.release.assetId);
    const digester=crypto.createHash('sha256');let count=0,handle=null;
    try{
      handle=await fs.open(temp,'wx',0o600);
      for await(const chunk of res.body){
        count+=chunk.length;if(count>m.size)throw Error('Tamanho não confere');
        digester.update(chunk);await handle.write(chunk);
      }
      await handle.sync();await handle.close();handle=null;
      if(count!==m.size||digester.digest('hex')!==m.sha256)throw Error('SHA-256 inválido: pacote recusado');
      await fs.rename(temp,destination);
      return destination; // Não executa: o Electron exige confirmação do proprietário.
    }catch(e){if(handle)await handle.close();await fs.rm(temp,{force:true});throw e;}
  }
}
module.exports={GitHubPrivateUpdater,verifyEnvelope,newer};