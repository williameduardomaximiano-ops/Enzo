'use strict';
// Audit runtime source only; historic markdown and migration keys are outside the active execution path.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const dirs=['core','desktop','ui','updater'];
const bad=[];const pattern=/127\.0\.0\.1:11434|localhost:11434|ollama\.com|\/api\/tags|\/api\/pull|qwen2\.5:3b|installar ollama|instalar ollama|get-ollama|model-download|openrouter|ollama\s*\(/i;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const filename=path.join(dir,item.name);if(item.isDirectory()){if(!['assets','node_modules'].includes(item.name))walk(filename);}else if(/\.(?:cjs|js|html)$/.test(item.name)){const text=fs.readFileSync(filename,'utf8');if(pattern.test(text))bad.push(path.relative(root,filename));}}}
for(const folder of dirs)walk(path.join(root,folder));
if(bad.length){console.error('Referências de execução incompatíveis encontradas:',bad.join(', '));process.exitCode=1;}else console.log('OK: sem Ollama/OpenRouter no código de execução.');
