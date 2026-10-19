'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const get=rel=>fs.readFileSync(path.resolve(__dirname,'..',rel),'utf8');

test('microfone permanece ativo após transcrição até desligar manualmente',()=>{
 const js=get('ui/app.js');
 assert.match(js,/async function toggleMic/);
 assert.match(js,/if\(active\)\{generation\+\+;closeMic\(\)/,'Botão deve desligar manualmente');
 assert.doesNotMatch(js,/if\(!settings\.continuous\)closeMic\(\)/,'Modo de uma única fala não pode desligar microfone');
 assert.match(js,/micStarting=true/,'ativação dupla deve ser bloqueada');
 assert.match(js,/micStarting=false/,'estado deve ser liberado no finally');
 assert.match(js,/dispositivo de áudio foi desconectado/,'avisar sobre perda física do microfone');
 assert.match(js,/Microfone ligado\. Ele permanece ativo até você desligar/);
});
test('opções visuais não podem fingir que uma troca de cor é um personagem novo',()=>{
 const html=get('ui/index.html');
 const app=get('ui/app.js');
 const renderer=get('ui/hologram.js');
 assert.match(html,/id="gold-import-home"/);
 assert.match(html,/id="gold-setup"/);
 assert.match(html,/id="avatar-gallery"[^>]*hidden/);
 assert.match(renderer,/if\(uniforms\.uPhotoMode\.value>0\.5\)/);
 assert.match(app,/if\(!uri\)\{\$\('#gold-setup'\)\.hidden=false/);
 assert.match(app,/await holo\.setImage\(result\.image\)/);
});
test('a imagem importada sobrevive ao fechamento sem envio para terceiros',()=>{
 const main=get('desktop/main.cjs');
 assert.match(main,/ipc\('hologram-get'/);
 assert.match(main,/ipc\('hologram-import'/);
 assert.match(main,/cosmo-hologram\.jpg/);
});
