const {test}=require('node:test');const assert=require('node:assert/strict');const {Duplex}=require('node:stream');
const I=require('../core/integrations.cjs');const {skillIntent}=require('../core/skills.cjs');
const ICS=['BEGIN:VCALENDAR','BEGIN:VEVENT','DTSTART:20261019T120000Z','DTEND:20261019T130000Z','SUMMARY:Reunião com a equipe','LOCATION:Sala 2\\, prédio A','END:VEVENT',
 'BEGIN:VEVENT','DTSTART;TZID=America/Sao_Paulo:20260105T090000','SUMMARY:Academia','RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR','EXDATE;TZID=America/Sao_Paulo:20261021T090000','END:VEVENT',
 'BEGIN:VEVENT','DTSTART;VALUE=DATE:20261019','SUMMARY:Aniversário da Ana','END:VEVENT',
 'BEGIN:VEVENT','DTSTART:20261019T150000','SUMMARY:Cancelado','STATUS:CANCELLED','END:VEVENT',
 'BEGIN:VEVENT','DTSTART:20250101T080000','SUMMARY:Remédio','RRULE:FREQ=DAILY;UNTIL=20261020T235959Z','END:VEVENT','END:VCALENDAR'].join('\r\n');
test('agenda iCal: eventos, recorrência semanal com exceção, dia todo e cancelados',()=>{const now=new Date(2026,9,19,7,0);
 const day=I.agenda(ICS,{days:1,now});assert.deepEqual(day.map(e=>e.summary),['Aniversário da Ana','Remédio','Academia','Reunião com a equipe']);assert.equal(day.find(e=>e.summary==='Reunião com a equipe').location,'Sala 2, prédio A');
 const week=I.agenda(ICS,{days:7,now});const gym=week.filter(e=>e.summary==='Academia').map(e=>e.at.getDate());assert.deepEqual(gym,[19,23]);assert.equal(week.filter(e=>e.summary==='Remédio').length,2);
 assert.match(I.describeAgenda(day),/Reunião com a equipe \(Sala 2, prédio A\)/);assert.equal(I.describeAgenda([]),'Nenhum compromisso hoje.');});
function fakeImap(script){return ()=>{const sock=new Duplex({read(){},write(chunk,enc,cb){const line=chunk.toString();const tag=line.split(' ')[0];const reply=script(line.slice(tag.length+1).trim(),tag);setImmediate(()=>sock.push(reply));cb();}});sock.end=()=>{};setImmediate(()=>sock.push('* OK IMAP pronto\r\n'));return sock;};}
test('e-mail IMAP: login, não lidos e cabeçalhos decodificados, sem marcar como lido',async()=>{const cmds=[];
 const connect=fakeImap((cmd,tag)=>{cmds.push(cmd);if(cmd.startsWith('LOGIN'))return `${tag} OK logado\r\n`;if(cmd.startsWith('EXAMINE'))return `* 10 EXISTS\r\n${tag} OK [READ-ONLY] ok\r\n`;if(cmd==='SEARCH UNSEEN')return `* SEARCH 3 7 9\r\n${tag} OK busca\r\n`;
  if(cmd.startsWith('FETCH'))return `* 7 FETCH (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {80}\r\nFrom: "Banco" <a@b.com>\r\nSubject: =?UTF-8?B?RmF0dXJhIGRpc3BvbsOtdmVs?=\r\n\r\n)\r\n* 9 FETCH (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {60}\r\nFrom: Maria <m@x.com>\r\nSubject: =?ISO-8859-1?Q?Reuni=E3o?=\r\n\r\n)\r\n${tag} OK fetch\r\n`;return `${tag} OK\r\n`;});
 const r=await I.unreadEmails({address:'eu@gmail.com',password:'abcd efgh',limit:2,connect});assert.equal(r.total,3);assert.deepEqual(r.messages.map(m=>[m.from,m.subject]),[['Maria','Reunião'],['Banco','Fatura disponível']]);
 assert.ok(cmds[0].startsWith('LOGIN "eu@gmail.com" "abcd efgh"'));assert.ok(cmds.includes('EXAMINE INBOX'));assert.ok(cmds.some(c=>c.startsWith('FETCH 7,9 (BODY.PEEK[')));
 assert.match(I.describeEmails(r),/^3 e-mails não lidos/);assert.equal(I.imapHost('x@gmail.com'),'imap.gmail.com');assert.equal(I.imapHost('x@empresa.com.br'),'imap.empresa.com.br');
 await assert.rejects(I.unreadEmails({address:'eu@gmail.com',password:'errada123',connect:fakeImap((c,t)=>`${t} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`)}),/senha de app/);
 await assert.rejects(I.unreadEmails({address:'',password:''}),/Configure/);});
test('WhatsApp: contato salvo, número com DDD e link com texto',()=>{const contacts=[{name:'João Silva',phone:'(41) 99999-0000'},{name:'Mãe',phone:'+55 11 98888-7777'}];
 assert.deepEqual(I.phoneOf('joão',contacts),{name:'João Silva',phone:'5541999990000'});assert.equal(I.phoneOf('Mãe',contacts).phone,'5511988887777');assert.equal(I.phoneOf('11 97777-6666',[]).phone,'5511977776666');assert.throws(()=>I.phoneOf('Pedro',contacts),/Não encontrei/);
 assert.equal(I.whatsappUrls('5541999990000','vou atrasar 10 min').app,'whatsapp://send?phone=5541999990000&text=vou%20atrasar%2010%20min');});
test('GitHub: resumo de repositório e lista recente',async()=>{const f=async url=>({ok:true,status:200,json:async()=>url.includes('/issues')?[{number:3,title:'Bug no login'},{number:4,title:'Nova tela',pull_request:{}}]:url.includes('/commits')?[{commit:{message:'Corrige voz\n\ndetalhes'}}]:url.includes('/user/repos')?[{full_name:'w/enzo',open_issues_count:2,pushed_at:'2026-10-18T10:00:00Z'}]:{full_name:'w/enzo',open_issues_count:2}});
 assert.match(await I.githubOverview({token:'t',repo:'w/enzo',fetchImpl:f}),/PRs: #4 Nova tela\. Issues: #3 Bug no login\. Últimos commits: Corrige voz/);assert.match(await I.githubOverview({token:'t',fetchImpl:f}),/w\/enzo \(2 abertos/);await assert.rejects(I.githubOverview({token:''}),/token/);});
test('comandos rápidos de agenda, e-mail, resumo e WhatsApp',()=>{assert.deepEqual(skillIntent('o que tenho amanhã'),{type:'calendar',days:1,offset:1});assert.equal(skillIntent('tenho e-mails novos').type,'email');assert.equal(skillIntent('como está meu dia').type,'briefing');
 assert.deepEqual(skillIntent('manda mensagem pro João dizendo que chego às 8'),{type:'whatsapp',contact:'João',message:'chego às 8'});});
