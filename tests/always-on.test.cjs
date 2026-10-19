const {test}=require('node:test');const assert=require('node:assert/strict');const {reactorBitmap}=require('../core/icon.cjs');const fs=require('node:fs');
test('ícone da bandeja: BGRA 32x32 com anel ciano e núcleo branco, fundo transparente',()=>{const b=reactorBitmap(32);assert.equal(b.length,32*32*4);const px=(x,y)=>[...b.subarray((y*32+x)*4,(y*32+x)*4+4)];
 assert.equal(px(0,0)[3],0);const center=px(16,16);assert.ok(center[0]>240&&center[1]>240&&center[2]>240&&center[3]>240);const ring=px(16,3);assert.ok(ring[3]>100&&ring[0]>ring[2]);});
test('sempre ligado: login com --hidden, fechar vai para a bandeja e sair de verdade é explícito',()=>{const main=fs.readFileSync(require.resolve('../desktop/main.cjs'),'utf8');
 assert.match(main,/setLoginItemSettings\(\{openAtLogin:!!settings\.autostart,args:\['--hidden'\]\}\)/);assert.match(main,/backgroundThrottling:false/);assert.match(main,/win\.on\('close',e=>\{if\(quitting\|\|settings\.keepInTray===false\)return;e\.preventDefault\(\);win\.hide\(\)/);
 assert.match(main,/app\.on\('before-quit',\(\)=>\{quitting=true;/);assert.match(main,/if\(!startHidden\)win\.show\(\)/);});
