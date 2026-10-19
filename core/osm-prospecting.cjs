'use strict';
/** Busca pontual de estabelecimentos no OpenStreetMap, sem scraping de contas ou dados pessoais. */
const CITY_RE=/^[\p{L}\p{M}0-9 .,'-]{3,90}$/u;
const MAX=5;
const USER_AGENT='COSMO-AgapeStudio/0.1.7 (search requests initiated by user; OSM attribution)';
function cityInput(city){
 if(typeof city!=='string'||!CITY_RE.test(city.trim()))throw Error('Informe uma cidade válida (máximo 90 caracteres).');
 return city.trim();
}
function boundsFromNominatim(data){
 if(!Array.isArray(data)||!data.length||!Array.isArray(data[0].boundingbox)||data[0].boundingbox.length!==4)throw Error('Cidade não encontrada no OpenStreetMap.');
 const vals=data[0].boundingbox.map(Number);
 if(vals.some(v=>!Number.isFinite(v)))throw Error('Limites geográficos inválidos.');
 const [south,north,west,east]=vals;
 if(south>=north||west>=east||south< -90||north>90||west< -180||east>180)throw Error('Limites geográficos inválidos.');
 // Limitar a um quadrado central para manter consultas pontuais curtas.
 const midLat=(south+north)/2,midLon=(west+east)/2;
 const halfLat=Math.min((north-south)/2,.10),halfLon=Math.min((east-west)/2,.11);
 return [midLat-halfLat,midLon-halfLon,midLat+halfLat,midLon+halfLon].map(n=>Number(n.toFixed(6)));
}
function overpassQuery(bounds){
 if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Limites inválidos.');
 const [south,west,north,east]=bounds;
 return '[out:json][timeout:22];(nwr["amenity"="restaurant"]('+[south,west,north,east].join(',')+'););out center 300;';
}
function normalizePhone(value){
 if(!value||typeof value!=='string')return null;
 const raw=value.split(/[;,]/)[0].replace(/[^\d+]/g,'');
 const digits=raw.replace(/^\+/,'').replace(/\D/g,'');
 if(digits.length<10||digits.length>15)return null;
 return digits;
}
function normalizeRestaurant(elements){
 if(!Array.isArray(elements))throw Error('Resposta OSM inválida.');
 const seen=new Set(),out=[];
 for(const e of elements){
  if(!e||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||!e.tags||typeof e.tags!=='object')continue;
  const t=e.tags, name=String(t.name||'').trim();
  if(name.length<3||name.length>120||t.amenity!=='restaurant')continue;
  const lat=Number(e.lat??e.center?.lat),lon=Number(e.lon??e.center?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const key=name.toLocaleLowerCase('pt-BR')+'|'+Math.round(lat*200)+'|'+Math.round(lon*200);
  if(seen.has(key))continue;seen.add(key);
  const website=String(t.website||t['contact:website']||'').trim();
  const phone=normalizePhone(t.phone||t['contact:phone']||'');
  const address=[t['addr:street'],t['addr:housenumber'],t['addr:suburb']].filter(v=>typeof v==='string'&&v.length<120).join(', ');
  out.push({name,lat,lon,address:address||null,phone,website:website||null,osmUrl:'https://www.openstreetmap.org/'+e.type+'/'+e.id,
    opportunity:website?'Website cadastrado; oportunidade precisa de avaliação manual.':'Sem website cadastrado no OpenStreetMap; não significa que não tenha site.',
    source:'OpenStreetMap',verified:false});
 }
 // Contato conhecido, endereço e site ausente aumentam a utilidade de revisão, mas não provam potencial comercial.
 return out.sort((a,b)=>Number(!b.website)-Number(!a.website)||Number(Boolean(b.phone))-Number(Boolean(a.phone))||a.name.localeCompare(b.name,'pt-BR')).slice(0,MAX);
}
async function jsonFetch(fetcher,url,signal){
 const r=await fetcher(url,{headers:{'User-Agent':USER_AGENT,'Accept':'application/json'},signal,redirect:'error'});
 if(!r.ok)throw Error('Serviço de mapas não respondeu ('+r.status+'). Tente mais tarde.');
 const raw=await r.text();if(raw.length>2000000)throw Error('Resultado geográfico excedeu limite.');
 try{return JSON.parse(raw)}catch{throw Error('Resposta inválida do OpenStreetMap.');}
}
async function searchRestaurants(city,{fetcher=fetch,timeout=30000}={}){
 city=cityInput(city);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const nom='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&city='+encodeURIComponent(city);
  const geo=await jsonFetch(fetcher,nom,controller.signal);
  const bbox=boundsFromNominatim(geo);
  const query=overpassQuery(bbox);
  const url='https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query);
  const data=await jsonFetch(fetcher,url,controller.signal);
  return {city,source:'© OpenStreetMap contributors',searchedAt:new Date().toISOString(),candidates:normalizeRestaurant(data.elements)};
 }finally{clearTimeout(timer);}
}
module.exports={cityInput,boundsFromNominatim,overpassQuery,normalizeRestaurant,searchRestaurants,normalizePhone};
