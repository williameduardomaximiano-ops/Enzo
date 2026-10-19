const {test}=require('node:test');const assert=require('node:assert/strict');
const {intent}=require('../core/intent.cjs');
const vaultLib=require('../core/vault.cjs');
test('comandos de voz da Central de Atualizações',()=>{
 assert.equal(intent('Enzo, verificar atualizações').type,'updates');
 assert.equal(intent('Enzo, buscar atualizações').type,'updates');
 assert.equal(intent('Enzo, quais são as novidades?').type,'changelog');
 assert.equal(intent('Enzo, ler novidades').type,'changelog');
 assert.equal(intent('Enzo, baixar atualização').type,'install_update');
 assert.equal(intent('Enzo, instalar atualização').type,'install_update');
});
test('cofre aceita token GitHub sem expor valor',()=>{
 assert.equal(vaultLib.validateProvider('github'),'github');
 assert.deepEqual(vaultLib.statusOf({groq:'x',gemini:'',github:'y'}),{groq:true,gemini:false,github:true,anthropic:false});
 assert.throws(()=>vaultLib.validateKey('curta'));
});
