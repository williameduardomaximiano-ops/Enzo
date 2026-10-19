// Integrações pessoais sem dependências: Google Agenda (link iCal secreto), e-mail (IMAP só leitura), WhatsApp e GitHub.
const tls=require('node:tls');

// ===== Agenda (iCal) =====
function unfold(ics){return String(ics).replace(/\r?\n[ \t]/g,'');}
function parseDate(value,params=''){const v=String(value).trim();let m;
 if((m=v.match(/^(\d{4})(\d{2})(\d{2})$/)))return {date:new Date(+m[1],+m[2]-1,+m[3]),allDay:true};
 if((m=v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)))return {date:m[7]?new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])):new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]),allDay:false};
 return null;}
function unescapeIcs(s){return String(s||'').replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1').trim();}
function parseIcs(ics){const events=[];for(const block of unfold(ics).split('BEGIN:VEVENT').slice(1)){const body=block.split('END:VEVENT')[0];const ev={exdates:[]};
 for(const line of body.split(/\r?\n/)){const i=line.indexOf(':');if(i<0)continue;const [key,...params]=line.slice(0,i).split(';');const value=line.slice(i+1);
  if(key==='SUMMARY')ev.summary=unescapeIcs(value);else if(key==='LOCATION')ev.location=unescapeIcs(value);else if(key==='DTSTART'){const d=parseDate(value,params.join(';'));if(d){ev.start=d.date;ev.allDay=d.allDay;}}else if(key==='DTEND'){const d=parseDate(value);if(d)ev.end=d.date;}else if(key==='RRULE')ev.rrule=Object.fromEntries(value.split(';').map(p=>p.split('=')));else if(key==='EXDATE'){for(const v of value.split(',')){const d=parseDate(v);if(d)ev.exdates.push(d.date.getTime());}}else if(key==='STATUS')ev.status=value;}
 if(ev.start&&ev.status!=='CANCELLED')events.push(ev);}return events;}
const DAYS={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
// Ocorrências entre from e to, com suporte às recorrências mais comuns (diária, semanal, mensal, anual).
function occurrences(ev,from,to){const out=[];const r=ev.rrule;const dur=(ev.end?ev.end-ev.start:0);
 const ok=d=>d>=from-dur&&d<to&&!ev.exdates.includes(d.getTime());
 if(!r){if(ok(ev.start))out.push(ev.start);return out;}
 const until=r.UNTIL?parseDate(r.UNTIL)?.date:null;const count=+r.COUNT||Infinity;const interval=+r.INTERVAL||1;let n=0;const d=new Date(ev.start);
 for(let guard=0;guard<5000&&d<to&&(!until||d<=until)&&n<count;guard++){
  if(r.FREQ==='WEEKLY'&&r.BYDAY){const week=new Date(d);for(const code of r.BYDAY.split(',')){const day=DAYS[code.slice(-2)];if(day==null)continue;const x=new Date(week);x.setDate(week.getDate()+((day-week.getDay()+7)%7));if(x<ev.start||(until&&x>until)||n>=count)continue;n++;if(ok(x))out.push(new Date(x));}d.setDate(d.getDate()+7*interval);continue;}
  n++;if(ok(d))out.push(new Date(d));
  if(r.FREQ==='DAILY')d.setDate(d.getDate()+interval);else if(r.FREQ==='WEEKLY')d.setDate(d.getDate()+7*interval);else if(r.FREQ==='MONTHLY')d.setMonth(d.getMonth()+interval);else if(r.FREQ==='YEARLY')d.setFullYear(d.getFullYear()+interval);else break;}
 return out;}
function agenda(ics,{days=1,now=new Date()}={}){const from=new Date(now);from.setHours(0,0,0,0);const to=new Date(from);to.setDate(to.getDate()+Math.max(1,Math.min(31,days)));const list=[];
 for(const ev of parseIcs(ics))for(const at of occurrences(ev,from,to))list.push({at,allDay:ev.allDay,summary:ev.summary||'(sem título)',location:ev.location||''});
 return list.sort((a,b)=>a.at-b.at);}
function describeAgenda(list,days=1){if(!list.length)return days>1?`Nenhum compromisso nos próximos ${days} dias.`:'Nenhum compromisso hoje.';
 return list.slice(0,12).map(e=>`${e.allDay?'dia todo':e.at.toLocaleString('pt-BR',{weekday:days>1?'short':undefined,hour:'2-digit',minute:'2-digit'})} — ${e.summary}${e.location?` (${e.location})`:''}`).join('\n');}
async function fetchCalendar(url,{fetchImpl=fetch,signal}={}){const u=String(url||'').trim().replace(/^webcal:/i,'https:');if(!/^https:\/\//i.test(u))throw Error('Salve o "endereço secreto no formato iCal" da sua agenda em Configuração.');
 const r=await fetchImpl(u,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});if(!r.ok)throw Error('Não consegui acessar a agenda ('+r.status+').');return r.text();}

// ===== E-mail (IMAP, somente leitura) =====
const IMAP_HOSTS={'gmail.com':'imap.gmail.com','googlemail.com':'imap.gmail.com','yahoo.com':'imap.mail.yahoo.com','yahoo.com.br':'imap.mail.yahoo.com','icloud.com':'imap.mail.me.com','me.com':'imap.mail.me.com','outlook.com':'outlook.office365.com','hotmail.com':'outlook.office365.com','live.com':'outlook.office365.com','uol.com.br':'imap.uol.com.br','bol.com.br':'imap.bol.com.br','terra.com.br':'imap.terra.com.br'};
function imapHost(address,override){if(override)return override;const d=String(address).split('@')[1]?.toLowerCase();if(!d)throw Error('Endereço de e-mail inválido.');return IMAP_HOSTS[d]||'imap.'+d;}
function quote(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
function decodeWords(s){return String(s).replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g,(_,cs,enc,txt)=>{try{const buf=enc.toUpperCase()==='B'?Buffer.from(txt,'base64'):Buffer.from(txt.replace(/_/g,' ').replace(/=([0-9A-F]{2})/gi,(m,h)=>String.fromCharCode(parseInt(h,16))),'binary');return new TextDecoder(/8859-1|latin/i.test(cs)?'latin1':'utf-8').decode(buf);}catch{return txt;}}).replace(/\?=\s+=\?/g,'');}
function parseFetch(raw){const msgs=[];for(const part of String(raw).split(/\r?\n\* \d+ FETCH /).slice(1)){const h=part.replace(/\r?\n[ \t]+/g,' ');const get=k=>(h.match(new RegExp(`^${k}:\\s*(.*)$`,'mi'))||[])[1]||'';const from=decodeWords(get('From')).replace(/<[^>]+>/,'').replace(/"/g,'').trim()||decodeWords(get('From'));msgs.push({from,subject:decodeWords(get('Subject'))||'(sem assunto)',date:get('Date')});}return msgs;}
function imapSession({host,port=993,user,password,timeoutMs=20000,connect=tls.connect}){return new Promise((resolve,reject)=>{let buf='',tag=0,pending=null;const sock=connect({host,port,servername:host});const timer=setTimeout(()=>{sock.destroy();reject(Error('O servidor de e-mail não respondeu.'));},timeoutMs);
 const send=cmd=>new Promise((res,rej)=>{const t='a'+(++tag);pending={t,res,rej,start:buf.length};sock.write(`${t} ${cmd}\r\n`);});
 sock.on('data',d=>{buf+=d.toString('utf8');if(!pending){if(/^\* (OK|PREAUTH)/m.test(buf)&&!sock._ready){sock._ready=true;run();}return;}const m=buf.slice(pending.start).match(new RegExp(`(?:^|\\n)${pending.t} (OK|NO|BAD)([^\\r\\n]*)`));if(m){const p=pending;pending=null;const out=buf.slice(p.start);m[1]==='OK'?p.res(out):p.rej(Error(m[1]==='NO'&&/auth|login|credential|password/i.test(m[2])?'Login de e-mail recusado. Use uma "senha de app" do Google/Yahoo.':'Erro do servidor de e-mail: '+m[2].trim().slice(0,120)));}});
 sock.on('error',e=>{clearTimeout(timer);reject(Error('Falha ao conectar no e-mail: '+e.message));});
 async function run(){try{await send(`LOGIN ${quote(user)} ${quote(password)}`);await send('EXAMINE INBOX');const s=await send('SEARCH UNSEEN');const ids=((s.match(/\* SEARCH([\d ]*)/)||[])[1]||'').trim().split(/\s+/).filter(Boolean);resolve({ids,fetch:async list=>list.length?parseFetch(await send(`FETCH ${list.join(',')} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`)):[],close:()=>{clearTimeout(timer);try{sock.write(`a${++tag} LOGOUT\r\n`);sock.end();}catch{}}});}catch(e){clearTimeout(timer);sock.destroy();reject(e);}}});}
async function unreadEmails({address,password,host,limit=5,connect}){if(!address||!password)throw Error('Configure seu e-mail e a senha de app em Configuração → Integrações.');const s=await imapSession({host:imapHost(address,host),user:address,password,connect});try{const last=s.ids.slice(-Math.max(1,Math.min(20,limit)));const msgs=(await s.fetch(last)).reverse();return {total:s.ids.length,messages:msgs};}finally{s.close();}}
function describeEmails({total,messages}){if(!total)return 'Nenhum e-mail não lido.';return `${total} e-mail${total>1?'s':''} não lido${total>1?'s':''}. Mais recentes:\n`+messages.map(m=>`${m.from}: ${m.subject}`).join('\n');}

// ===== WhatsApp =====
function phoneOf(contact,contacts=[]){const c=String(contact||'').trim();const saved=contacts.find(x=>x?.name&&x.name.toLowerCase()===c.toLowerCase())||contacts.find(x=>x?.name&&x.name.toLowerCase().includes(c.toLowerCase())&&c.length>2);let digits=String(saved?.phone||c).replace(/\D/g,'');
 if(!digits||digits.length<10)throw Error(saved?`O número de ${saved.name} parece inválido.`:`Não encontrei o contato "${c}". Salve-o em Configuração → Integrações com o número e DDD.`);if(digits.length<=11)digits='55'+digits;return {name:saved?.name||c,phone:digits};}
function whatsappUrls(phone,text){const q=`phone=${phone}&text=${encodeURIComponent(text)}`;return {app:`whatsapp://send?${q}`,web:`https://api.whatsapp.com/send?${q}`};}

// ===== GitHub =====
async function githubOverview({token,repo,fetchImpl=fetch,signal}){if(!token)throw Error('Salve um token do GitHub no cofre para eu acessar seus repositórios.');const h={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'COSMO'};const t=signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000);
 const get=async p=>{const r=await fetchImpl('https://api.github.com'+p,{headers:h,signal:t});if(r.status===401)throw Error('Token do GitHub inválido.');if(!r.ok)throw Error(`GitHub respondeu ${r.status} para ${p}.`);return r.json();};
 if(repo){if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('Repositório no formato dono/nome.');const [info,issues,commits]=await Promise.all([get(`/repos/${repo}`),get(`/repos/${repo}/issues?state=open&per_page=5`),get(`/repos/${repo}/commits?per_page=3`)]);
  const prs=issues.filter(i=>i.pull_request),only=issues.filter(i=>!i.pull_request);return `${info.full_name}: ${info.open_issues_count} itens abertos. PRs: ${prs.map(p=>`#${p.number} ${p.title}`).join('; ')||'nenhum'}. Issues: ${only.map(p=>`#${p.number} ${p.title}`).join('; ')||'nenhuma'}. Últimos commits: ${commits.map(c=>c.commit.message.split('\n')[0]).join('; ')}.`;}
 const repos=await get('/user/repos?sort=pushed&per_page=6');return 'Repositórios mais recentes: '+repos.map(r=>`${r.full_name} (${r.open_issues_count} abertos, atualizado ${new Date(r.pushed_at).toLocaleDateString('pt-BR')})`).join('; ')+'.';}

module.exports={parseIcs,agenda,describeAgenda,fetchCalendar,occurrences,imapHost,decodeWords,parseFetch,imapSession,unreadEmails,describeEmails,phoneOf,whatsappUrls,githubOverview};
