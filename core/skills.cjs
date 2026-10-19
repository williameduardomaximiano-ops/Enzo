// Pedidos de "faça de tudo": agente de programação, internet, YouTube, ChatGPT e otimização do PC.
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[!?]/g,'').replace(/[.]+$/,'').trim().replace(/^(?:ei |ok )?(?:enzo|jarvis)[, ]*/,'');}
function original(s){return String(s).trim().replace(/^(?:ei |ok )?(?:enzo|jarvis)[, ]*/i,'').replace(/[.!?]+$/,'').trim();}
// Recupera o trecho com acentos a partir da mesma posição relativa no texto original.
function tail(orig,normalized,captured){if(!captured)return '';const at=normalized.lastIndexOf(captured);if(at<0)return captured;const o=original(orig);return o.length===normalized.length?o.slice(at,at+captured.length).trim():captured;}

const AI={chatgpt:'chatgpt','chat gpt':'chatgpt',gpt:'chatgpt',claude:'claude',gemini:'gemini'};
function skillIntent(text){
 const s=norm(text);let m;const cap=v=>tail(text,s,v);
 // Agente de programação
 if((m=s.match(/^(?:crie|cria|criar|faca|faz|fazer|monte|monta|construa|gere|desenvolva|desenvolve) (?:um |uma |o |a )?(?:site|website|pagina|landing page|portfolio)(?: (?:de|do|da|para|pra|sobre|com|que))?\s*(.*)$/)))return {type:'agent_site',topic:cap(m[1])||'uma página pessoal de apresentação'};
 if((m=s.match(/^(?:peca|pede|pedir|mande|manda|fala|diga|chame|chama) (?:pro|para o|ao|pra o|pra) (claude code|claude|opencode|open code)(?: (?:que|pra|para))?[,:]? (.+)$/)))return {type:'agent_task',agent:/open/.test(m[1])?'opencode':'claude',task:cap(m[2])};
 if((m=s.match(/^no projeto ([\w-]+)[,:]? (.+)$/)))return {type:'agent_task',project:m[1],task:cap(m[2])};
 if((m=s.match(/^(?:crie|cria|criar|faca|faz|programe|programa|desenvolva|desenvolve|monte|monta) (?:um |uma )?((?:app|aplicativo|programa|script|jogo|sistema|bot|extensao|api|planilha automatica)\b.*)$/)))return {type:'agent_new',task:cap(m[1])};
 if(/^(?:abra|abre|abrir|mostre|mostra) (?:a )?(?:pasta (?:de|dos) )?projetos$/.test(s))return {type:'open_projects'};
 // YouTube
 if((m=s.match(/^(?:pesquise|pesquisa|procure|procura|busque|busca) (?:no youtube|youtube) (?:por |sobre )?(.+)$/)))return {type:'youtube',query:cap(m[1]),search:true};
 if((m=s.match(/^(?:toque|toca|tocar|coloque|coloca|colocar|bota|bote|abra|abre|abrir|ponha|poe|passa|passe|reproduza|quero ver|quero ouvir|assistir)(?: (?:o|a|um|uma))?(?: (?:video|musica|clipe))?(?: (?:de|do|da))? (.+?) (?:no|pelo|do) youtube$/))||(m=s.match(/^youtube[,:]? (.+)$/))||(m=s.match(/^(?:toque|toca|coloque|coloca|bota|ponha|reproduza) (?:a musica|o video|o clipe|musica|video|clipe) (.+)$/)))return {type:'youtube',query:cap(m[1])};
 if(/^(?:abra|abre|abrir|entre no|entra no) (?:o )?youtube$/.test(s))return {type:'youtube',query:''};
 // ChatGPT, Claude e Gemini no navegador
 if((m=s.match(/^(?:mande|manda|envie|envia|pergunte|pergunta|fale|fala|leve|leva|pesquise|pesquisa|cole|cola)(?: isso)? (?:pro|para o|ao|no|pra|pro o|na) (chat gpt|chatgpt|gpt|claude|gemini)[,:]?(?: (?:que|sobre|isso))?\s*(.*)$/)))return {type:'ask_ai',ai:AI[m[1]],query:cap(m[2])};
 if((m=s.match(/^(?:mande|manda|envie|envia|pergunte|pergunta|leve|leva) (.+?) (?:pro|para o|ao|pra|no) (chat gpt|chatgpt|gpt|claude|gemini)$/)))return {type:'ask_ai',ai:AI[m[2]],query:m[1]==='isso'?'':cap(m[1])};
 if(/^(?:abra|abre|abrir) (?:o )?(?:chat gpt|chatgpt)$/.test(s))return {type:'ask_ai',ai:'chatgpt',query:'',open:true};
 // Google e pesquisa com fontes
 if((m=s.match(/^(?:pesquise|pesquisa|procure|procura|busque|busca|abra|abre) (?:no google|o google)(?: sobre| por)? (.+)$/))||(m=s.match(/^google[,:]? (.+)$/)))return {type:'google',query:cap(m[1])};
 if((m=s.match(/^(?:pesquise|pesquisa|pesquisar|procure|procura|busque|busca|investigue)(?: (?:na internet|na web|online|pra mim|para mim))*(?: (?:sobre|por|o que e|quem e|como))? (.+)$/)))return {type:'research',query:cap(m[1])};
 if((m=s.match(/^(?:o que (?:ha|tem) de novo|quais (?:sao )?as (?:ultimas )?noticias|ultimas noticias|noticias)(?: (?:sobre|de|do|da|no|na))? (.+)$/)))return {type:'research',query:'notícias recentes sobre '+cap(m[1])};
 // Otimização do PC
 if(/^(?:otimize|otimiza|otimizar|acelere|acelera|acelerar|limpe|limpa|limpar|melhore|melhora|de uma geral no|faca uma limpeza no|faz uma limpeza no)(?: o| meu)? (?:pc|computador|windows|sistema|notebook)$|^(?:o |meu )?(?:pc|computador|notebook) (?:esta|ta) (?:lento|travando|pesado)$|^(?:limpe|limpa|limpar|apague|apaga) (?:os )?(?:arquivos )?temporarios$/.test(s))return {type:'optimize'};
 if(/^(?:esvazie|esvazia|esvaziar|limpe|limpa|limpar) (?:a )?lixeira$/.test(s))return {type:'recycle'};
 if(/^(?:abra|abre|mostre|mostra|gerencie|gerenciar)? ?(?:os )?(?:aplicativos|apps|programas) (?:de inicializacao|que iniciam com o windows|que abrem sozinhos)$/.test(s))return {type:'startup_apps'};
 if(/^(?:abra|abre|abrir) (?:o )?gerenciador de tarefas$/.test(s))return {type:'task_manager'};
 return null;
}
module.exports={skillIntent};
