'use strict';
/**
 * Abre somente RASCUNHO de primeiro contato, não envia mensagens.
 * Não implementa disparos em massa ou acesso ao WhatsApp Web do usuário.
 */
function validateOutreach(input){
 if(!input||typeof input!=='object')throw Error('Dados de contato inválidos.');
 const company=String(input.company||'').trim();
 if(company.length<2||company.length>100||/[\r\n<>{}]/.test(company))throw Error('Nome da empresa inválido.');
 const phone=String(input.phone||'').replace(/[()\s.+-]/g,'');
 if(!/^[1-9]\d{9,14}$/.test(phone))throw Error('Informe número WhatsApp com DDI e DDD. Ex.: 5541999999999.');
 const url=String(input.siteUrl||'').trim();
 let site;try{site=new URL(url)}catch{throw Error('Informe uma prévia HTTPS válida.');}
 if(site.protocol!=='https:'||!site.hostname||site.username||site.password||url.length>1000)throw Error('Prévia precisa de endereço HTTPS válido e público.');
 if(site.hostname==='localhost'||site.hostname.endsWith('.local'))throw Error('Não use URL local para abordagem comercial.');
 return {company,phone,siteUrl:site.toString()};
}
function createDraft(input){
 const d=validateOutreach(input);
 const message='Olá! Tudo bem? Sou da Ágape Studio. Preparei uma sugestão de presença digital para '+d.company+'. Caso seja do seu interesse, posso te mostrar uma prévia sem compromisso: '+d.siteUrl+' Posso te explicar rapidamente a ideia?';
 return {company:d.company,phone:d.phone,message,url:'https://wa.me/'+d.phone+'?text='+encodeURIComponent(message),sent:false};
}
module.exports={validateOutreach,createDraft};
