'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeRestaurant,searchRestaurants,cityInput,boundsFromNominatim}=require('../core/osm-prospecting.cjs');
const restaurant=(id,name,website='',phone='')=>({id,type:'node',lat:-25.432,lon:-49.271,tags:{amenity:'restaurant',name,website,phone}});
test('lista cinco estabelecimentos reais do cadastro, sem fabricar telefones',()=>{
 const list=normalizeRestaurant(Array.from({length:8},(_,i)=>restaurant(i+1,'Restaurante '+(i+1),i%2?'https://exemplo.com':'',i<4?'5541999999999':'')));
 assert.equal(list.length,5);
 assert.ok(list.every(x=>x.source==='OpenStreetMap'&&x.verified===false));
 assert.ok(list.every(x=>x.osmUrl.startsWith('https://www.openstreetmap.org/node/')));
 assert.ok(list.some(x=>x.opportunity.includes('não significa')));
});
test('requisições apenas nos dois domínios esperados',async()=>{
 const visited=[];
 const fake=async url=>{
  visited.push(url);
  if(url.startsWith('https://nominatim.openstreetmap.org/'))return {ok:true,text:async()=>JSON.stringify([{boundingbox:['-25.6','-25.3','-49.5','-49.1']}])};
  return {ok:true,text:async()=>JSON.stringify({elements:[restaurant(100,'Restaurante Exemplo')]})};
 };
 const r=await searchRestaurants('Curitiba',{fetcher:fake,timeout:1000});
 assert.equal(r.candidates.length,1);
 assert.equal(r.candidates[0].name,'Restaurante Exemplo');
 assert.equal(visited.length,2);
 assert.ok(visited[1].startsWith('https://overpass-api.de/'));
});
test('rejeita cidades com URLs e bbox inválida',()=>{
 assert.throws(()=>cityInput('https://site.com'),/cidade/);
 assert.throws(()=>boundsFromNominatim([{boundingbox:['a','b','c','d']}]),/geográficos/);
});
