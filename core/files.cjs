// Arquivos do dia a dia: busca, leitura, listagem e organização com desfazer, só dentro das pastas liberadas.
const fs=require('node:fs');const path=require('node:path');

const BLOCKED_OPEN=/\.(exe|msi|bat|cmd|com|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|scr|pif|reg|lnk|hta|cpl|jar)$/i;
const TEXT=/\.(txt|md|csv|json|xml|html?|css|js|ts|tsx|jsx|py|java|c|cpp|cs|go|rs|php|rb|sql|ini|cfg|conf|yaml|yml|log|env\.example|bat|ps1|sh)$/i;
const CATEGORIES={Imagens:/\.(jpe?g|png|gif|bmp|webp|svg|heic|ico|tiff?)$/i,'Vídeos':/\.(mp4|mkv|avi|mov|wmv|webm|flv)$/i,'Músicas':/\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i,Documentos:/\.(pdf|docx?|odt|rtf|txt|md|pptx?|odp|xlsx?|ods|csv|epub)$/i,Compactados:/\.(zip|rar|7z|tar|gz|bz2|xz|iso)$/i,Instaladores:/\.(exe|msi|msix|appx|apk)$/i,'Código':/\.(js|ts|py|java|c|cpp|cs|go|rs|php|rb|html?|css|json|sql|sh|ps1)$/i};

class Files{
 constructor({roots,undoFile}){this.roots=roots.filter(Boolean).map(r=>path.resolve(r));this.undoFile=undoFile;}
 // Só permite caminhos dentro das pastas liberadas (sem escapar por "..").
 resolve(p){const abs=path.resolve(String(p||''));const ok=this.roots.some(r=>abs===r||abs.startsWith(r+path.sep));if(!ok)throw Error(`Sem permissão para ${abs}. Pastas liberadas: ${this.roots.join('; ')}.`);return abs;}
 resolveLoose(p){const s=String(p||'').trim();if(!s)return this.roots[0];if(path.isAbsolute(s))return this.resolve(s);const lower=s.toLowerCase();const root=this.roots.find(r=>path.basename(r).toLowerCase()===lower||(lower==='downloads'&&/downloads$/i.test(r))||(/(documentos|documents)/.test(lower)&&/documents$/i.test(r))||(/(area de trabalho|área de trabalho|desktop)/.test(lower)&&/desktop$/i.test(r)));if(root)return root;for(const r of this.roots){const c=path.join(r,s);if(fs.existsSync(c))return this.resolve(c);}throw Error(`Não encontrei a pasta "${s}".`);}
 search({query='',extension='',days=0,limit=15}={}){const words=String(query).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(/\s+/).filter(w=>w.length>1);const ext=String(extension).replace(/^\./,'').toLowerCase();const since=days>0?Date.now()-days*86400000:0;const hits=[];let seen=0;
  for(const root of this.roots){const stack=[[root,0]];while(stack.length&&seen<80000){const [dir,depth]=stack.pop();let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{continue;}
   for(const e of entries){seen++;if(e.name.startsWith('.')||e.name==='node_modules'||e.name==='$RECYCLE.BIN')continue;const f=path.join(dir,e.name);if(e.isDirectory()){if(depth<6)stack.push([f,depth+1]);continue;}if(!e.isFile())continue;
    const name=e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');if(ext&&!name.endsWith('.'+ext))continue;if(words.length&&!words.every(w=>name.includes(w)))continue;let st;try{st=fs.statSync(f);}catch{continue;}if(since&&st.mtimeMs<since)continue;hits.push({path:f,size:st.size,modified:st.mtimeMs});}}}
  return hits.sort((a,b)=>b.modified-a.modified).slice(0,limit);}
 list(p){const dir=this.resolveLoose(p);return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>!e.name.startsWith('.')).slice(0,200).map(e=>{let size=0,modified=0;try{const st=fs.statSync(path.join(dir,e.name));size=st.size;modified=st.mtimeMs;}catch{}return {name:e.name,dir:e.isDirectory(),size,modified};});}
 read(p,max=20000){const f=this.resolve(p);const st=fs.statSync(f);if(!st.isFile())throw Error('Não é um arquivo.');
  if(/\.docx$/i.test(f))return readDocx(f).slice(0,max);if(!TEXT.test(f))throw Error('Consigo ler arquivos de texto, código, CSV e Word (.docx). Para outros formatos, peça para abrir o arquivo.');
  if(st.size>2*2**20)throw Error('Arquivo grande demais para ler (máximo 2 MB).');return fs.readFileSync(f,'utf8').slice(0,max);}
 canOpen(p){const f=this.resolve(p);if(BLOCKED_OPEN.test(f))throw Error('Por segurança, não abro programas ou scripts. Abra esse arquivo manualmente se confiar nele.');if(!fs.existsSync(f))throw Error('Arquivo não encontrado.');return f;}
 // Plano de organização por tipo, só para arquivos soltos na pasta (subpastas ficam intactas).
 plan(p){const dir=this.resolveLoose(p);const moves=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(!e.isFile()||e.name.startsWith('.')||/^desktop\.ini$/i.test(e.name))continue;const cat=Object.entries(CATEGORIES).find(([,re])=>re.test(e.name))?.[0]||'Outros';moves.push({from:path.join(dir,e.name),to:path.join(dir,cat,e.name)});}return {dir,moves};}
 apply({moves}){const done=[];for(const m of moves){let to=m.to,n=2;fs.mkdirSync(path.dirname(to),{recursive:true});while(fs.existsSync(to)){const ext=path.extname(m.to);to=m.to.slice(0,-ext.length||undefined)+` (${n++})`+ext;}try{fs.renameSync(m.from,to);done.push({from:m.from,to});}catch{}}
  if(this.undoFile)fs.writeFileSync(this.undoFile,JSON.stringify({at:Date.now(),moves:done}));return done;}
 undo(){let data;try{data=JSON.parse(fs.readFileSync(this.undoFile,'utf8'));}catch{throw Error('Não há organização para desfazer.');}let n=0;for(const m of [...data.moves].reverse()){try{if(!fs.existsSync(m.from)){this.resolve(m.from);fs.renameSync(m.to,m.from);n++;}}catch{}}fs.rmSync(this.undoFile,{force:true});return n;}
}
function summarizePlan({dir,moves}){const by={};for(const m of moves){const c=path.basename(path.dirname(m.to));by[c]=(by[c]||0)+1;}return `${moves.length} arquivos em ${dir}: `+Object.entries(by).map(([c,n])=>`${n} para ${c}`).join(', ');}

// .docx é um ZIP; extrai word/document.xml sem dependências (entrada "stored" ou "deflate").
function readDocx(file){const zlib=require('node:zlib');const b=fs.readFileSync(file);let i=0;
 while((i=b.indexOf(Buffer.from([0x50,0x4b,0x03,0x04]),i))>=0){const method=b.readUInt16LE(i+8),csize=b.readUInt32LE(i+18),nlen=b.readUInt16LE(i+26),xlen=b.readUInt16LE(i+28);const name=b.slice(i+30,i+30+nlen).toString();const start=i+30+nlen+xlen;
  if(name==='word/document.xml'){const data=b.slice(start,start+csize);const xml=(method===8?zlib.inflateRawSync(data):data).toString('utf8');return xml.replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();}
  i=start+csize;}
 throw Error('Documento Word sem texto legível.');}
function human(bytes){return bytes>2**30?(bytes/2**30).toFixed(1)+' GB':bytes>2**20?(bytes/2**20).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';}
module.exports={Files,summarizePlan,readDocx,human,BLOCKED_OPEN,CATEGORIES};
