'use strict';
// Aparências do mesmo holograma autorizado: não são modelos 3D rigados adicionais.
const AVATARS=Object.freeze([
{id:'original',name:'ENZO Original',color:'#55d6ef',filter:'none',description:'Imagem holográfica original preservada'},
{id:'humanoid-blue',name:'Humanoide Azul',color:'#408fff',filter:'hue-rotate(9deg) saturate(1.3)',description:'Luz azul cibernética'},
{id:'sentinel-cyan',name:'Sentinela Ciano',color:'#48f4df',filter:'hue-rotate(-24deg) saturate(1.35)',description:'Holograma ciano vibrante'},
{id:'phantom-violet',name:'Fantasma Violeta',color:'#a883ff',filter:'hue-rotate(65deg) saturate(1.4)',description:'Holograma de energia violeta'},
{id:'titan-silver',name:'Titânio Prata',color:'#cbd9ec',filter:'saturate(.15) brightness(1.14)',description:'Holograma metálico claro'},
{id:'fusion-amber',name:'Fusão Âmbar',color:'#ffbd63',filter:'hue-rotate(167deg) saturate(1.7)',description:'Holograma em tons de âmbar'}
].map(a=>Object.freeze(a)));
function byId(id){return AVATARS.find(a=>a.id===id)||null;}
function validateAvatar(id){if(typeof id!=='string'||!byId(id))throw Error('Modelo de aparência desconhecido');return id;}
function avatarIntent(text){
 if(typeof text!=='string')return null;
 const t=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.!?]/g,'').replace(/^\s*enzo[, ]*/,'').trim();
 const m=t.match(/^(?:mude|troque|coloque|use|selecion(e|a)|alter(e|a)) (?:o )?(?:visual|holograma|avatar|modelo)(?: (?:para|pro|pra))? (original|humanoide azul|sentinela ciano|fantasma violeta|titanio prata|fusao ambar)$/);
 const ids={'original':'original','humanoide azul':'humanoid-blue','sentinela ciano':'sentinel-cyan','fantasma violeta':'phantom-violet','titanio prata':'titan-silver','fusao ambar':'fusion-amber'};
 return m?{type:'avatar_select',avatar:ids[m[2]]}:null;
}
module.exports={AVATARS,byId,validateAvatar,avatarIntent};