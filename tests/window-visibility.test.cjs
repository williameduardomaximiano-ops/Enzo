'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {rectanglesOverlap}=require('../core/window-visibility.cjs');
const primary={x:0,y:0,width:1920,height:1080};
test('janela no segundo monitor não cobre a captura do monitor principal',()=>{
 assert.equal(rectanglesOverlap({x:1920,y:0,width:1160,height:780},primary),false);
});
test('janela sobre o monitor principal precisa ser ocultada para captura',()=>{
 assert.equal(rectanglesOverlap({x:300,y:100,width:1160,height:780},primary),true);
});
test('janela cruzando a borda dos monitores cobre parte da captura',()=>{
 assert.equal(rectanglesOverlap({x:1800,y:40,width:600,height:800},primary),true);
});
test('monitores com coordenadas negativas funcionam',()=>{
 assert.equal(rectanglesOverlap({x:-1700,y:100,width:800,height:600},{x:-1920,y:0,width:1920,height:1080}),true);
 assert.equal(rectanglesOverlap({x:0,y:50,width:500,height:500},{x:-1920,y:0,width:1920,height:1080}),false);
});
test('bordas que apenas se tocam não representam sobreposição',()=>{
 assert.equal(rectanglesOverlap({x:1920,y:0,width:500,height:500},primary),false);
});
test('dimensões ou coordenadas inválidas são rejeitadas',()=>{
 assert.equal(rectanglesOverlap({x:0,y:0,width:0,height:100},primary),false);
 assert.equal(rectanglesOverlap({x:NaN,y:0,width:100,height:100},primary),false);
 assert.equal(rectanglesOverlap(null,primary),false);
});
