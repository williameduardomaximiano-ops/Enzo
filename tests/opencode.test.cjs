const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../core/opencode.cjs');
test('OpenCode: DeepSeek é primeiro para texto e respeita escolha explícita',()=>{
 const list=[
 {modelID:'mimo-v2.6-flash-free',name:'MiMo',vision:true},
 {modelID:'deepseek-v4.1-flash-free',name:'DeepSeek',vision:false},
 {modelID:'nemotron-3.5-super-vl-free',name:'Nemotron',vision:true},
 {modelID:'big-pickle',name:'Big Pickle',vision:false},
 ];
 assert.equal(O.ordered(list)[0].modelID,'deepseek-v4.1-flash-free');
 assert.equal(O.ordered(list,null,true)[0].modelID,'nemotron-3.5-super-vl-free');
 assert.equal(O.ordered(list,'mimo-v2.6-flash-free')[0].modelID,'mimo-v2.6-flash-free');
 assert.throws(()=>O.ordered(list,'modelo-pago'),/não aparece/);
});
test('OpenCode: só modelos gratuitos passam e entrada de mídia não é geração',()=>{
 assert.equal(O.isFree('deepseek-v4.1-flash-free',{name:'DeepSeek'}),true);
 assert.equal(O.isFree('big-pickle',{}),true);
 assert.equal(O.isFree('modelo-pago',{cost:{input:0.1,output:0}}),false);
 assert.equal(O.mediaIntent('Cosmo, crie um vídeo da barbearia'),'video');
 assert.equal(O.mediaIntent('Faça uma foto da barbearia'),'image');
 assert.equal(O.mediaIntent('Gere um áudio para mim'),'audio');
 assert.equal(O.mediaIntent('Veja a imagem na tela'),null);
 assert.match(O.mediaNotice('video'),/Ainda não há um gerador de vídeos/);
});
