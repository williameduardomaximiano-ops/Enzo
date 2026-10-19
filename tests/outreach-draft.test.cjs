'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDraft,validateOutreach}=require('../core/outreach-draft.cjs');
test('rascunho de apresentação usa URL HTTPS e nunca marca mensagem como enviada',()=>{
 const d=createDraft({company:'Oficina Exemplo',phone:'+55 (41) 99999-8888',siteUrl:'https://exemplo.vercel.app/'});
 assert.equal(d.sent,false);
 assert.equal(d.phone,'5541999998888');
 assert.ok(d.url.startsWith('https://wa.me/5541999998888?text='));
 assert.match(decodeURIComponent(d.url),/Oficina Exemplo/);
 assert.match(decodeURIComponent(d.url),/exemplo\.vercel\.app/);
});
test('sem URL pública e número completo recusa contato',()=>{
 assert.throws(()=>validateOutreach({company:'Loja',phone:'123',siteUrl:'https://exemplo.com'}),/WhatsApp/);
 assert.throws(()=>validateOutreach({company:'Loja',phone:'5541999998888',siteUrl:'http://exemplo.com'}),/HTTPS/);
 assert.throws(()=>validateOutreach({company:'Loja',phone:'5541999998888',siteUrl:'https://localhost'}),/local/);
 assert.throws(()=>validateOutreach({company:'Loja',phone:'5541999998888',siteUrl:'file:///C:/x'}),/HTTPS/);
});
