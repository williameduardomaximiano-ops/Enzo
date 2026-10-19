// Otimização segura do PC: relatório, limpeza de temporários antigos e processos que mais usam memória.
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {execFile}=require('node:child_process');

function dirSize(dir,limit=60000){let total=0,count=0;const stack=[dir];
 while(stack.length&&count<limit){const d=stack.pop();let entries;try{entries=fs.readdirSync(d,{withFileTypes:true});}catch{continue;}
  for(const e of entries){count++;const f=path.join(d,e.name);try{if(e.isSymbolicLink())continue;if(e.isDirectory())stack.push(f);else total+=fs.statSync(f).size;}catch{}}}
 return total;}
// Apaga itens da pasta temporária mais antigos que minAgeMs; arquivos em uso são ignorados.
function cleanTemp(dir=os.tmpdir(),{minAgeMs=24*3600000,now=Date.now()}={}){let freed=0,removed=0,skipped=0;let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return {freed,removed,skipped};}
 for(const e of entries){const f=path.join(dir,e.name);try{const st=fs.lstatSync(f);if(st.isSymbolicLink()||now-st.mtimeMs<minAgeMs){skipped++;continue;}const size=e.isDirectory()?dirSize(f):st.size;fs.rmSync(f,{recursive:true,force:true,maxRetries:0});freed+=size;removed++;}catch{skipped++;}}
 return {freed,removed,skipped};}
function diskFree(root=process.platform==='win32'?(process.env.SystemDrive||'C:')+'\\':'/'){try{const s=fs.statfsSync(root);return {free:s.bavail*s.bsize,total:s.blocks*s.bsize};}catch{return null;}}
// Saída CSV do tasklist: "nome","pid","sessão","n","123.456 K"
function parseTasklist(csv){const map=new Map();for(const line of String(csv).split(/\r?\n/)){const cols=line.match(/"([^"]*)"/g)?.map(c=>c.slice(1,-1));if(!cols||cols.length<5)continue;const kb=parseInt(cols[4].replace(/[^\d]/g,''),10);if(!Number.isFinite(kb))continue;const name=cols[0].replace(/\.exe$/i,'');map.set(name,(map.get(name)||0)+kb*1024);}
 return [...map.entries()].map(([name,bytes])=>({name,bytes})).sort((a,b)=>b.bytes-a.bytes);}
function topProcesses(n=5){if(process.platform!=='win32')return Promise.resolve([]);return new Promise(resolve=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','tasklist.exe'),['/fo','csv','/nh'],{windowsHide:true,timeout:8000},(err,out)=>resolve(err?[]:parseTasklist(out).slice(0,n))));}
function gb(b){return (b/2**30).toFixed(1).replace('.',',');}
function mb(b){return Math.round(b/2**20);}
function report({disk,temp,top,mem}){const parts=[];if(disk)parts.push(`${gb(disk.free)} GB livres de ${gb(disk.total)} GB no disco`);parts.push(`${mb(temp)} MB em arquivos temporários`);if(mem!=null)parts.push(`memória em ${mem}%`);
 let s=`Análise concluída, senhor: ${parts.join(', ')}.`;if(top?.length)s+=` Quem mais consome memória: ${top.slice(0,3).map(p=>`${p.name} com ${mb(p.bytes)} MB`).join(', ')}.`;return s;}

module.exports={dirSize,cleanTemp,diskFree,parseTasklist,topProcesses,report,mb,gb};
