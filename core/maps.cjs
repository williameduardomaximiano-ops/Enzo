'use strict';
// Links oficiais do Google Maps: sem chave de API, sem geolocalização automática pelo COSMO.
function clean(value){
 const s=String(value||'').trim().replace(/\s+/g,' ');
 if(!s||s.length>300)throw Error('Informe um lugar ou endereço válido para o Google Maps.');
 return s;
}
function searchUrl(query){
 const u=new URL('https://www.google.com/maps/search/');
 u.searchParams.set('api','1');u.searchParams.set('query',clean(query));
 return u.toString();
}
function directionsUrl(destination,origin='',mode=''){
 const u=new URL('https://www.google.com/maps/dir/');
 u.searchParams.set('api','1');
 if(origin)u.searchParams.set('origin',clean(origin));
 u.searchParams.set('destination',clean(destination));
 if(mode&&['driving','walking','bicycling','transit'].includes(mode))u.searchParams.set('travelmode',mode);
 return u.toString();
}
const HOME='https://www.google.com/maps/';
function mapIntent(text){
 const raw=String(text||'').trim().replace(/^(?:(?:ei|ok)\s+)?(?:cosmo|cosmos|kosmo|enzo|jarvis)[,\s]+/i,'').replace(/[.!?]+$/,'').trim();
 const lower=raw.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/^(?:abra|abre|abrir|mostre|mostra|acesse|acesse o|entre no)\s+(?:o\s+)?(?:google\s+maps|maps)$/.test(lower))return {type:'maps_open'};
 // Comandos genéricos de rotas são tratados sem chamar uma IA.
 const route=lower.match(/^(?:como chegar|qual (?:e )?a rota|trac[ae] (?:uma? )?rota|mostre (?:a )?rota|rota|me leve|leve-me|navegue)(?:\s+no\s+(?:google\s+)?maps)?\s+(?:de\s+(.+?)\s+(?:ate|para|a)\s+|(?:ate|para|a|ao)\s+)(.+)$/);
 if(route){
  // Indices da versão normalizada coincidem com o texto original salvo em NFD? 
  // Para nomes acentuados, usamos a própria captura (a busca do Maps é tolerante a acentos).
  return {type:'maps_directions',origin:(route[1]||'').trim(),destination:route[2].trim()};
 }
 const mapFirst=lower.match(/^(?:pesquise|pesquisa|procure|procura|busque|busca|encontre|encontra|mostre|mostra)\s+(?:no\s+|pelo\s+)?(?:google\s+maps|maps)\s+(?:por\s+|sobre\s+)?(.+)$/);
 if(mapFirst)return {type:'maps_search',query:mapFirst[1].trim()};
 const mapLast=lower.match(/^(?:pesquise|pesquisa|procure|procura|busque|busca|encontre|encontra|mostre|mostra)\s+(.+?)\s+(?:no|pelo)\s+(?:google\s+maps|maps)$/);
 if(mapLast)return {type:'maps_search',query:mapLast[1].trim()};
 return null;
}
module.exports={searchUrl,directionsUrl,mapIntent,HOME};
