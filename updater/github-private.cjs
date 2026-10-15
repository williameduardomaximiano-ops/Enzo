'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const REDIRECT_HOSTS = new Set(['release-assets.githubusercontent.com','objects.githubusercontent.com','github.com']);
const UA = 'ENZO-Updater/1.0';
function parseVersion(s) {
  if (typeof s !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(s)) throw Error('Versão inválida');
  const parts=s.split('.').map(Number);
  if(!parts.every(Number.isSafeInteger))throw Error('Versão excessiva');
  return parts;
}
function newer(a, b) {
  const x=parseVersion(a), y=parseVersion(b);
  for (let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i];
  return false;
}
function validateConfig(c) {
  for(const s of ['owner','repo']) if(typeof c[s]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(c[s])) throw Error(`Identificador inválido: ${s}`);
  parseVersion(c.currentVersion);
  const key=c.publicKey?.type==='public' ? c.publicKey : crypto.createPublicKey(c.publicKey);
  if(key.asymmetricKeyType!=='ed25519') throw Error('Chave pública não é Ed25519');
  if(typeof c.tokenProvider!=='function')throw Error('Token deve vir do cofre protegido do Windows');
  if(typeof c.directory!=='string'||!path.isAbsolute(c.directory))throw Error('Diretório local inválido');
  return key;
}
function verifyEnvelope(input, pubKey, currentVersion) {
  if(!input||typeof input.payload!=='string'||Buffer.byteLength(input.payload)>40000||typeof input.signature!=='string'|| !/^[A-Za-z0-9+/]+={0,2}$/.test(input.signature))throw Error('Manifesto malformado');
  if(!crypto.verify(null, Buffer.from(input.payload,'utf8'),pubKey,Buffer.from(input.signature,'base64')))throw Error('Assinatura inválida: atualização recusada');
  const p=JSON.parse(input.payload);
  if(!p||typeof p!=='object'||!newer(p.version,currentVersion))return null;
  if(typeof p.asset!=='string'||!/^ENZO-[0-9]+\.[0-9]+\.[0-9]+-Windows-x64\.exe$/.test(p.asset)||p.asset!==`ENZO-${p.version}-Windows-x64.exe`)throw Error('Nome de instalador não autorizado');
  if(typeof p.sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error('Hash inválido');
  if(!Number.isSafeInteger(p.size)||p.size<1024||p.size>2000000000)throw Error('Tamanho inválido');
  if(typeof p.notes!=='string'||p.notes.length>10000)throw Error('Notas inválidas');
  return Object.freeze({version:p.version,asset:p.asset,size:p.size,sha256:p.sha256,notes:p.notes});
}
function limitedJson(text,max) { if(Buffer.byteLength(text)>max)throw Error('Resposta excessiva');return JSON.parse(text); }
class GitHubPrivateUpdater {
  constructor(config) {
    this.config=config;
    this.publicKey=validateConfig(config);
    this.fetchImpl=config.fetchImpl||globalThis.fetch;
    this.available=null;
    this.release=null;
  }
  apiUrl(resource){return `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/${resource}`;}
  async authHeaders(){
    const token=await this.config.tokenProvider();
    if(typeof token!=='string'||!token.trim()||/\s/.test(token))throw Error('Autenticação de leitura do repositório privado ausente');
    return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':UA};
  }
  async apiJson(resource){
    const r=await this.fetchImpl(this.apiUrl(resource),{headers:await this.authHeaders(),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(r.status===404)throw Error('Nenhuma versão publicada ou acesso GitHub não autorizado');
    if(!r.ok)throw Error(`GitHub API: HTTP ${r.status}`);
    const body=await r.text();return limitedJson(body,150000);
  }
  async assetResponse(assetId) {
    if(!Number.isSafeInteger(assetId)||assetId<=0)throw Error('ID do instalador inválido');
    let url=this.apiUrl(`releases/assets/${assetId}`);
    let headers={...await this.authHeaders(),Accept:'application/octet-stream'};
    for(let redirects=0;redirects<4;redirects++){
      const response=await this.fetchImpl(url,{headers,redirect:'manual',signal:AbortSignal.timeout(300000)});
      if([301,302,303,307,308].includes(response.status)){
        const next=response.headers.get('location'); if(!next)throw Error('Redirecionamento sem destino');
        const parsed=new URL(next,url);
        if(parsed.protocol!=='https:'||!REDIRECT_HOSTS.has(parsed.hostname)||parsed.username||parsed.password)throw Error('Redirecionamento não confiável');
        url=parsed.toString();headers={'User-Agent':UA};continue; // nunca enviar token a CDN ou endereço redirecionado
      }
      if(!response.ok)throw Error(`Falha no download: HTTP ${response.status}`);
      if(response.url && new URL(response.url).protocol!=='https:')throw Error('Download inseguro');
      return response;
    }
    throw Error('Redirecionamentos excessivos');
  }
  async assetText(assetId,limit) {
    const response=await this.assetResponse(assetId);
    let length=0;const chunks=[];
    for await(const chunk of response.body){
      length+=chunk.length;if(length>limit)throw Error('Arquivo de manifesto excessivo');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async check() {
    this.available=null;this.release=null;
    const info=await this.apiJson('releases/latest');
    if(!info||!Array.isArray(info.assets)||info.draft||info.prerelease)throw Error('Release estável inválida');
    const m=info.assets.filter(a=>a.name==='enzo-update.json');
    if(m.length!==1||!Number.isSafeInteger(m[0].id))throw Error('Release sem manifesto assinado único');
    const envelope=limitedJson(await this.assetText(m[0].id,60000),60000);
    const manifest=verifyEnvelope(envelope,this.publicKey,this.config.currentVersion);
    if(!manifest)return null;
    if(info.tag_name!==`v${manifest.version}`)throw Error('Versão do GitHub diverge do manifesto');
    const candidates=info.assets.filter(a=>a.name===manifest.asset);
    if(candidates.length!==1 || !Number.isSafeInteger(candidates[0].id) || candidates[0].size!==manifest.size)throw Error('Instalador ausente ou tamanho divergente');
    this.available=manifest;this.release={assetId:candidates[0].id};
    return manifest;
  }
  async download() {
    if(!this.available||!this.release)throw Error('Verifique uma atualização antes de baixar');
    const manifest=this.available;
    await fs.mkdir(this.config.directory,{recursive:true,mode:0o700});
    const destination=path.join(this.config.directory,manifest.asset);
    const tmp=path.join(this.config.directory,`.${manifest.asset}.${crypto.randomUUID()}.part`);
    const response=await this.assetResponse(this.release.assetId);
    const digester=crypto.createHash('sha256');let count=0,fd;
    try{
      fd=await fs.open(tmp,'wx',0o600);
      for await (const chunk of response.body) {
        count+=chunk.length;
        if(count>manifest.size)throw Error('Download excede tamanho assinado');
        digester.update(chunk); await fd.write(chunk);
      }
      await fd.sync();await fd.close();fd=null;
      if(count!==manifest.size || digester.digest('hex')!==manifest.sha256)throw Error('Hash ou tamanho inválido: pacote recusado');
      await fs.rename(tmp,destination);
      return destination; // NÃO executa instalador; integração Electron solicita confirmação visual
    } catch(error){if(fd)await fd.close();await fs.rm(tmp,{force:true});throw error;}
  }
}
module.exports={GitHubPrivateUpdater,verifyEnvelope,newer};
