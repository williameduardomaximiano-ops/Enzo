// Recursos estilo JARVIS: memória, lembretes, clima, status do sistema, mídia e saudação.
const fs=require('node:fs'),os=require('node:os');

// Arquivo JSON criptografado. Sem criptografia disponível, os dados ficam só na memória da sessão.
class SecureStore{
 constructor(file,crypt){this.file=file;this.crypt=crypt;}
 get persistent(){return !!this.crypt?.available();}
 load(fallback){try{if(!this.persistent)return fallback;const raw=fs.readFileSync(this.file,'utf8');return JSON.parse(this.crypt.decrypt(Buffer.from(raw,'base64')));}catch{return fallback;}}
 save(data){if(!this.persistent)return false;const tmp=this.file+'.tmp';fs.writeFileSync(tmp,this.crypt.encrypt(JSON.stringify(data)).toString('base64'));fs.renameSync(tmp,this.file);return true;}
 clear(){fs.rmSync(this.file,{force:true});}
}

const MAX_FACTS=100,MAX_FACT=300;
class Memory{
 constructor(store){this.store=store;const d=store.load([]);this.facts=Array.isArray(d)?d.filter(f=>typeof f?.text==='string').slice(-MAX_FACTS):[];}
 add(text){const t=String(text||'').trim().replace(/\s+/g,' ');if(t.length<2||t.length>MAX_FACT)throw Error('Não consegui guardar isso. Diga algo mais curto.');
  if(!this.facts.some(f=>f.text.toLowerCase()===t.toLowerCase()))this.facts.push({text:t,at:new Date().toISOString()});
  if(this.facts.length>MAX_FACTS)this.facts.splice(0,this.facts.length-MAX_FACTS);return this.store.save(this.facts);}
 list(){return this.facts.map(f=>f.text);}
 remove(index){if(!Number.isInteger(index)||index<0||index>=this.facts.length)throw Error('Memória não encontrada.');this.facts.splice(index,1);this.store.save(this.facts);}
 forget(term){const k=norm(term);const before=this.facts.length;this.facts=this.facts.filter(f=>!norm(f.text).includes(k));this.store.save(this.facts);return before-this.facts.length;}
 clear(){this.facts=[];this.store.clear();}
 context(){return this.facts.length?'Fatos que William pediu para você lembrar:\n- '+this.list().join('\n- '):'';}
}

const MAX_REMINDERS=50,MAX_DELAY=7*24*3600*1000;
class Reminders{
 constructor(store,onFire,clock=Date.now){this.store=store;this.onFire=onFire;this.clock=clock;this.timers=new Map();this.items=[];
  const d=store.load([]);for(const r of Array.isArray(d)?d:[])if(typeof r?.text==='string'&&Number.isFinite(r?.at))this.schedule(r,false);this.persist();}
 schedule(r,save=true){const item={id:r.id||Math.random().toString(36).slice(2,10),text:String(r.text).slice(0,300),at:r.at};this.items.push(item);
  // Lembretes vencidos enquanto o ENZO estava fechado avisam alguns segundos após abrir, com a janela pronta.
  const ms=Math.max(save?0:8000,item.at-this.clock());const timer=setTimeout(()=>{this.timers.delete(item.id);this.items=this.items.filter(x=>x.id!==item.id);this.persist();this.onFire(item);},Math.min(ms,2**31-1));timer.unref?.();this.timers.set(item.id,timer);if(save)this.persist();return item;}
 add(text,at){if(this.items.length>=MAX_REMINDERS)throw Error('Limite de lembretes atingido.');if(!Number.isFinite(at)||at<=this.clock()||at-this.clock()>MAX_DELAY)throw Error('Só consigo lembrar de algo nos próximos 7 dias.');return this.schedule({text,at});}
 list(){return [...this.items].sort((a,b)=>a.at-b.at);}
 clear(){for(const t of this.timers.values())clearTimeout(t);this.timers.clear();this.items=[];this.store.clear();}
 stop(){for(const t of this.timers.values())clearTimeout(t);this.timers.clear();}
 persist(){this.store.save(this.items);}
}

function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[!?]/g,'').replace(/\.$/,'').trim();}
const WORDS={um:1,uma:1,dois:2,duas:2,tres:3,'três':3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,quinze:15,vinte:20,'vinte e cinco':25,trinta:30,quarenta:40,'quarenta e cinco':45,cinquenta:50,noventa:90};
const NUM='(\\d+(?:[.,]\\d+)?|vinte e cinco|quarenta e cinco|'+Object.keys(WORDS).filter(k=>!k.includes(' ')).join('|')+'|meia)';
const UNIT='(segundos?|seg|minutos?|min|horas?|h)';
function amount(n,unit){const v=n==='meia'?0.5:WORDS[n]??parseFloat(n.replace(',','.'));const u=unit.startsWith('s')?1000:unit.startsWith('h')?3600000:60000;return Math.round(v*u);}
function atClock(h,m,now){const d=new Date(now);d.setHours(+h,+(m||0),0,0);if(d.getTime()<=now)d.setDate(d.getDate()+1);return d.getTime();}
function clean(t){return t.trim().replace(/^(de|que|para|pra)\s+/,'').trim();}
function describeDelay(ms){const min=Math.round(ms/60000);if(ms<60000)return `${Math.round(ms/1000)} segundos`;if(min<60)return `${min} minuto${min>1?'s':''}`;const h=Math.floor(min/60),r=min%60;return `${h} hora${h>1?'s':''}${r?` e ${r} minutos`:''}`;}
function formatAt(at){return new Date(at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}

// Pedidos de lembrete, alarme e timer em português natural.
function parseReminder(text,now=Date.now()){
 const s=norm(text).replace(/^enzo[, ]*/,'');let m;
 if((m=s.match(new RegExp(`^(?:(?:coloque|coloca|crie|cria|inicie|inicia|ligue|liga) (?:um )?)?(?:timer|temporizador|cronometro) (?:de |para )?${NUM} ${UNIT}$`))))return {text:'O tempo do timer acabou.',at:now+amount(m[1],m[2]),timer:true};
 if((m=s.match(/^(?:(?:coloque|coloca|crie|cria|defina|ligue|liga) (?:um )?)?(?:alarme|despertador) (?:para |pras? )?(?:as )?(\d{1,2})(?:[:h](\d{2}))?(?: ?h(?:oras)?)?$/)))return {text:'Alarme.',at:atClock(m[1],m[2],now),alarm:true};
 if(!/^(?:me )?lembr|^(?:daqui a)/.test(s))return null;
 // Mantém acentos no texto do lembrete para a voz pronunciar corretamente.
 const lower=String(text).toLowerCase().replace(/[!?]/g,'').replace(/\.$/,'').trim().replace(/^enzo[, ]*/,'').replace(/,/g,'');
 const body=lower.replace(/^(?:por favor )?(?:me )?lembr(?:e|a|ar)(?: me)?(?: (?:por favor))?\s*/,'');
 const rel=new RegExp(`(?:^|\\s)(?:em|daqui a|daqui) ${NUM} ${UNIT}(?:\\s|$)`),abs=/(?:^|\s)(?:às|as|à|a|para as|para às|pras) (\d{1,2})(?:[:h](\d{2}))?(?: ?h(?:oras)?)?(?:\s|$)/;
 if((m=body.match(rel)))return {text:clean((body.slice(0,m.index)+' '+body.slice(m.index+m[0].length)).replace(/\s+/g,' ').replace(/^me lembre\s*/,'')),at:now+amount(m[1],m[2])};
 if((m=body.match(abs))&&+m[1]<24&&(!m[2]||+m[2]<60))return {text:clean((body.slice(0,m.index)+' '+body.slice(m.index+m[0].length)).replace(/\s+/g,' ')),at:atClock(m[1],m[2],now)};
 return {text:clean(body),at:null};
}

const MEDIA={volume_up:'aumentar o volume',volume_down:'diminuir o volume',mute:'silenciar o som',play_pause:'tocar ou pausar',next:'próxima faixa',previous:'faixa anterior'};
function jarvisIntent(text){
 const s=norm(text).replace(/^enzo[, ]*/,'');let m;
 const orig=String(text).trim().replace(/^enzo[, ]*/i,'').replace(/[.!?]+$/,'').trim();
 if((m=orig.match(/^(?:lembre|lembra|guarde|guarda|anote|anota|memorize|grave) (?:que|isso:?) (.+)$/i)))return {type:'memory_add',text:m[1]};
 if(/^(?:o que voce (?:lembra|sabe)(?: sobre mim| de mim)?|quais (?:sao )?(?:suas|as) memorias|(?:mostre|liste|mostra|lista) (?:a |sua |suas )?memorias?)$/.test(s))return {type:'memory_list'};
 if(/^(?:esqueca|esquece|apague|apaga|limpe|limpa) (?:tudo|toda a memoria|sua memoria|a memoria|as memorias|suas memorias)(?: sobre mim)?$/.test(s))return {type:'memory_clear'};
 if((m=s.match(/^(?:esqueca|esquece) (?:que |o que |sobre |de )?(.+)$/)))return {type:'memory_forget',text:m[1]};
 if(/^(?:quais (?:sao )?(?:os )?meus lembretes|(?:liste|mostre|lista|mostra) (?:os |meus )?lembretes|tenho (?:algum )?lembretes?)$/.test(s))return {type:'reminder_list'};
 if(/^(?:cancele|cancela|apague|apaga|limpe|limpa) (?:todos )?(?:os |meus )?(?:lembretes|alarmes|timers)$/.test(s))return {type:'reminder_clear'};
 const r=parseReminder(text);if(r)return r.at?{type:'reminder_add',...r}:{type:'reminder_unclear',text:r.text};
 if((m=s.match(/^(?:como (?:esta|ta|vai) (?:o tempo|o clima)|qual (?:e )?(?:a )?(?:previsao|temperatura)(?: do tempo)?|previsao do tempo|clima|tempo|vai chover|esta (?:frio|calor))(?:\s+(?:hoje|agora|amanha))?(?: (?:em|no|na|para) (.+?))?(?: hoje| agora)?$/)))return {type:'weather',city:m[1]?(orig.match(/\s(?:em|no|na|para)\s+(.+?)(?:\s+(?:hoje|agora|amanhã))?$/i)?.[1]||m[1]):null};
 if(/^(?:status|relatorio|diagnostico|estado)(?: (?:do|de) (?:sistema|computador|pc))?$|^como (?:esta|ta) (?:o )?(?:sistema|computador|pc)$/.test(s))return {type:'system_status'};
 if(/^(?:aumente|aumenta|sobe|suba|mais) (?:o )?volume$|^volume (?:mais alto|para cima|acima)$/.test(s))return {type:'media',key:'volume_up'};
 if(/^(?:diminua|diminui|abaixe|abaixa|baixe|baixa|menos) (?:o )?volume$|^volume (?:mais baixo|para baixo)$/.test(s))return {type:'media',key:'volume_down'};
 if(/^(?:silencie|silencia|mute|muta|tire o som|desligue o som|desliga o som|sem som)$/.test(s))return {type:'media',key:'mute'};
 if(/^(?:pause|pausa|pausar|toque|toca|tocar|continue|continua|retome) (?:a )?(?:musica|video|midia|som)$|^play$/.test(s))return {type:'media',key:'play_pause'};
 if(/^(?:proxima|pular|pule|passa|passe)(?: (?:a )?(?:musica|faixa))?$/.test(s))return {type:'media',key:'next'};
 if(/^(?:anterior|volta|volte)(?: (?:a )?(?:musica|faixa))?$|^musica anterior$/.test(s))return {type:'media',key:'previous'};
 if(/^(?:bom dia|boa tarde|boa noite|ola|oi|e ai|acorde|acorda|estou de volta|cheguei)$/.test(s))return {type:'greeting'};
 return null;
}

// Uso de CPU entre duas leituras.
let lastCpu=null;
function cpuPercent(){const t=os.cpus().reduce((a,c)=>{const tot=Object.values(c.times).reduce((x,y)=>x+y,0);return {idle:a.idle+c.times.idle,total:a.total+tot};},{idle:0,total:0});
 const prev=lastCpu;lastCpu=t;if(!prev||t.total===prev.total)return Math.round((1-t.idle/t.total)*100);return Math.max(0,Math.min(100,Math.round((1-(t.idle-prev.idle)/(t.total-prev.total))*100)));}
function sysinfo(){const total=os.totalmem(),free=os.freemem();return {cpu:cpuPercent(),mem:Math.round((1-free/total)*100),memGB:+(total/2**30).toFixed(1),uptime:Math.round(os.uptime()),cpus:os.cpus().length};}
function duration(sec){const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return h?`${h} hora${h>1?'s':''} e ${m} minuto${m!==1?'s':''}`:`${m} minuto${m!==1?'s':''}`;}
function statusReport(info,extra={}){const parts=[`Processador em ${info.cpu}%`,`memória em ${info.mem}% de ${info.memGB} GB`,`sistema ligado há ${duration(info.uptime)}`];
 if(extra.reminders)parts.push(`${extra.reminders} lembrete${extra.reminders>1?'s':''} ativo${extra.reminders>1?'s':''}`);
 const tone=info.cpu>85||info.mem>90?'Senhor, o sistema está sob carga pesada.':'Todos os sistemas operando normalmente, senhor.';return `${tone} ${parts.join(', ')}.`;}

function greeting(date=new Date(),name='senhor'){const h=date.getHours();const p=h<5?'Boa noite':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
 const hora=date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});return `${p}, ${name}. São ${hora}. Todos os sistemas estão operacionais.`;}

const WMO={0:'céu limpo',1:'predominantemente limpo',2:'parcialmente nublado',3:'nublado',45:'neblina',48:'neblina com geada',51:'garoa fraca',53:'garoa',55:'garoa forte',61:'chuva fraca',63:'chuva',65:'chuva forte',66:'chuva congelante',67:'chuva congelante forte',71:'neve fraca',73:'neve',75:'neve forte',80:'pancadas de chuva fracas',81:'pancadas de chuva',82:'pancadas de chuva fortes',95:'trovoadas',96:'trovoadas com granizo',99:'trovoadas fortes com granizo'};
async function weather(city,fetchImpl=fetch,signal){
 const name=String(city||'').trim();if(!name||name.length>80)throw Error('Diga a cidade: "Enzo, como está o tempo em Curitiba?" ou salve sua cidade em Configuração.');
 const t=signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
 const g=await fetchImpl('https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&name='+encodeURIComponent(name),{signal:t});
 if(!g.ok)throw Error('Serviço de clima indisponível.');const place=(await g.json())?.results?.[0];if(!place)throw Error(`Não encontrei a cidade ${name}.`);
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
 const f=await fetchImpl(url,{signal:t});if(!f.ok)throw Error('Serviço de clima indisponível.');const d=await f.json();const c=d?.current||{},day=d?.daily||{};
 const rain=day.precipitation_probability_max?.[0];const r=Math.round;
 return `Em ${place.name}, ${WMO[c.weather_code]||'condição desconhecida'}, ${r(c.temperature_2m)} graus, sensação de ${r(c.apparent_temperature)}. Hoje a mínima é ${r(day.temperature_2m_min?.[0])} e a máxima ${r(day.temperature_2m_max?.[0])} graus`+(Number.isFinite(rain)?`, com ${rain}% de chance de chuva.`:'.');
}

module.exports={SecureStore,Memory,Reminders,parseReminder,jarvisIntent,sysinfo,statusReport,greeting,weather,describeDelay,formatAt,MEDIA};
