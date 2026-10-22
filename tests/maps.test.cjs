const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../core/maps.cjs');
test('Google Maps abre sem chave de API e sem acesso à localização',()=>{
 assert.equal(M.mapIntent('Cosmo, abra o Google Maps').type,'maps_open');
 assert.equal(M.mapIntent('abra maps').type,'maps_open');
 assert.equal(M.mapIntent('pesquise barbearias em Curitiba no Google Maps').query,'barbearias em curitiba');
 assert.deepEqual(M.mapIntent('Cosmo, rota de Curitiba para Colombo'),{type:'maps_directions',origin:'curitiba',destination:'colombo'});
 assert.deepEqual(M.mapIntent('Como chegar até a Rodoviária de Curitiba'),{type:'maps_directions',origin:'',destination:'a rodoviaria de curitiba'});
 assert.equal(M.mapIntent('qual é o melhor barbeiro?'),null);
});
test('Google Maps cria links oficiais válidos para buscas e trajetos',()=>{
 let u=new URL(M.searchUrl('barbearias Curitiba'));assert.equal(u.hostname,'www.google.com');
 assert.equal(u.pathname,'/maps/search/');assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('query'),'barbearias Curitiba');
 u=new URL(M.directionsUrl('Colombo PR','Curitiba PR','walking'));assert.equal(u.pathname,'/maps/dir/');
 assert.equal(u.searchParams.get('destination'),'Colombo PR');assert.equal(u.searchParams.get('origin'),'Curitiba PR');assert.equal(u.searchParams.get('travelmode'),'walking');
 assert.ok(!u.searchParams.has('key'));assert.throws(()=>M.searchUrl(''));
});
