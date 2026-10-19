const PROVIDERS=Object.freeze(['groq','gemini','github','anthropic']);
const ORDER=Object.freeze(['auto','groq','gemini','claude']);
function validateProvider(p){if(!PROVIDERS.includes(p))throw Error('Provedor desconhecido.');return p;}
function validateOrder(p){if(!ORDER.includes(p))throw Error('Prioridade inválida.');return p;}
function validateKey(key){
 if(typeof key!=='string')throw Error('Chave inválida.');
 const k=key.trim();
 if(k.length<8||k.length>1000||/\s/.test(k))throw Error('Chave inválida. Cole apenas a chave, sem espaços.');
 return k;
}
function emptyVault(){return {groq:'',gemini:'',github:'',anthropic:''};}
function statusOf(vault={}){return {groq:!!vault.groq,gemini:!!vault.gemini,github:!!vault.github,anthropic:!!vault.anthropic};}
module.exports={PROVIDERS,ORDER,validateProvider,validateOrder,validateKey,emptyVault,statusOf};
