// Catálogo de ferramentas do cérebro. Cada ferramenta chama uma habilidade real do COSMO através do contexto (ctx).
// Ações que alteram algo passam por confirmação dentro do próprio ctx.
const S=(props,required=[])=>({type:'object',properties:props,required});
const str=(description)=>({type:'string',description});
const num=(description)=>({type:'number',description});

function makeTools(ctx){
 const t=[];const add=(name,description,parameters,run,label)=>t.push({name,description,parameters,run,label});
 // Informação
 add('get_datetime','Data e hora atuais do PC.',S({}),()=>new Date().toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'short'}),()=>'Consultando o relógio');
 add('web_search','Pesquisa na internet e devolve títulos e links dos resultados.',S({query:str('termos de busca')},['query']),a=>ctx.search(a.query),a=>`Pesquisando: ${a.query}`);
 add('web_research','Pesquisa na internet e lê as melhores páginas, devolvendo trechos com as fontes. Use para perguntas sobre fatos atuais, notícias, preços, tutoriais.',S({query:str('o que pesquisar')},['query']),a=>ctx.research(a.query),a=>`Pesquisando e lendo: ${a.query}`);
 add('read_webpage','Lê o texto de uma página da internet.',S({url:str('endereço https')},['url']),a=>ctx.readPage(a.url),a=>`Lendo ${a.url}`);
 add('weather','Clima atual e previsão do dia.',S({city:str('cidade; vazio usa a cidade salva')}),a=>ctx.weather(a.city),()=>'Consultando o clima');
 add('system_status','Uso de CPU, memória e tempo ligado do PC.',S({}),()=>ctx.systemStatus(),()=>'Verificando o sistema');
 add('daily_briefing','Resumo do dia: agenda, e-mails não lidos, lembretes e clima.',S({}),()=>ctx.briefing(),()=>'Preparando o resumo do dia');
 // Navegador e mídia
 add('open_youtube','Abre o YouTube tocando o primeiro vídeo da busca (ou só a busca).',S({query:str('música, vídeo ou assunto'),only_search:{type:'boolean',description:'true para só mostrar a lista de resultados'}},['query']),a=>ctx.youtube(a.query,a.only_search),a=>`Abrindo no YouTube: ${a.query}`);
 add('open_website','Abre um site no navegador.',S({url:str('endereço https')},['url']),a=>ctx.openUrl(a.url),a=>`Abrindo ${a.url}`);
 add('ask_chatbot','Abre o ChatGPT, Claude ou Gemini no navegador já com a pergunta.',S({ai:{type:'string',enum:['chatgpt','claude','gemini']},question:str('texto a enviar')},['ai','question']),a=>ctx.askAi(a.ai,a.question),a=>`Enviando ao ${a.ai}`);
 add('media_control','Controla o som e a música do PC.',S({action:{type:'string',enum:['volume_up','volume_down','mute','play_pause','next','previous']}},['action']),a=>ctx.media(a.action),a=>`Mídia: ${a.action}`);
 add('open_app','Abre um aplicativo do Windows permitido.',S({app:{type:'string',enum:['calculadora','bloco','explorador','paint']}},['app']),a=>ctx.openApp(a.app),a=>`Abrindo ${a.app}`);
 // Memória e lembretes
 add('memory_save','Guarda um fato duradouro sobre William (preferências, dados úteis).',S({fact:str('fato curto, em português')},['fact']),a=>ctx.memorySave(a.fact),()=>'Guardando na memória');
 add('memory_list','Lista o que você lembra sobre William.',S({}),()=>ctx.memoryList(),()=>'Consultando a memória');
 add('reminder_add','Cria um lembrete/alarme. Informe minutes_from_now OU time (HH:MM, hoje ou amanhã).',S({text:str('do que lembrar'),minutes_from_now:num('daqui a quantos minutos'),time:str('horário HH:MM')},['text']),a=>ctx.reminderAdd(a),a=>`Criando lembrete: ${a.text}`);
 add('reminder_list','Lista lembretes pendentes.',S({}),()=>ctx.reminderList(),()=>'Consultando lembretes');
 // Agente de programação
 add('coding_agent','Entrega uma tarefa ao agente de programação (Claude Code/OpenCode) que cria e edita arquivos de verdade: sites, apps, scripts, jogos, alterações em projetos. Roda em segundo plano e avisa ao terminar. A tarefa deve ser completa e autossuficiente.',S({task:str('descrição completa do que fazer'),project:str('nome de um projeto existente (opcional)'),new_project_name:str('nome para um projeto novo (opcional)'),is_website:{type:'boolean',description:'true se o resultado é um site para abrir no navegador'}},['task']),a=>ctx.codingAgent(a),a=>'Acionando o agente de programação');
 // Arquivos
 add('files_search','Procura arquivos pelo nome nas pastas liberadas (Documentos, Downloads, Área de Trabalho...).',S({query:str('palavras do nome'),extension:str('ex.: pdf, docx'),days:num('modificados nos últimos N dias')}),a=>ctx.filesSearch(a),a=>`Procurando arquivos: ${a.query||a.extension||''}`);
 add('folder_list','Lista o conteúdo de uma pasta liberada (ex.: Downloads, Documentos ou caminho completo).',S({path:str('pasta')},['path']),a=>ctx.folderList(a.path),a=>`Abrindo a pasta ${a.path}`);
 add('file_read','Lê o texto de um arquivo (txt, md, csv, código, docx).',S({path:str('caminho completo')},['path']),a=>ctx.fileRead(a.path),a=>'Lendo arquivo');
 add('file_open','Abre um arquivo ou pasta no programa padrão do Windows.',S({path:str('caminho completo')},['path']),a=>ctx.fileOpen(a.path),a=>'Abrindo arquivo');
 add('folder_organize','Organiza os arquivos soltos de uma pasta em subpastas por tipo (Imagens, Documentos...). Pede confirmação e pode ser desfeito.',S({path:str('pasta, ex.: Downloads')},['path']),a=>ctx.folderOrganize(a.path),a=>`Organizando ${a.path}`);
 add('folder_organize_undo','Desfaz a última organização de pasta.',S({}),()=>ctx.folderUndo(),()=>'Desfazendo organização');
 // Otimização
 add('optimize_pc','Analisa o PC e, com confirmação, limpa temporários e a Lixeira.',S({}),()=>ctx.optimize(),()=>'Otimizando o PC');
 // Tela
 add('screen_look','Tira um print da tela e responde a uma pergunta sobre ela (erros, o que está aberto, ler textos).',S({question:str('o que observar na tela')},['question']),a=>ctx.screenLook(a.question),()=>'Olhando a tela');
 add('screen_click','Clica em um elemento visível na tela, descrito em palavras. Pede confirmação.',S({target:str('elemento a clicar, ex.: botão Enviar'),double:{type:'boolean',description:'clique duplo'}},['target']),a=>ctx.screenClick(a.target,!!a.double),a=>`Clicando em ${a.target}`);
 add('screen_type','Digita um texto no campo em foco (depois de clicar nele).',S({text:str('texto'),press_enter:{type:'boolean'}},['text']),a=>ctx.screenType(a.text,!!a.press_enter),()=>'Digitando');
 add('press_keys','Pressiona um atalho de teclado.',S({keys:{type:'string',enum:['enter','tab','escape','copy','paste','select_all','undo','save','new_tab','close_tab','alt_tab']}},['keys']),a=>ctx.pressKeys(a.keys),a=>`Teclas: ${a.keys}`);
 // Integrações
 add('calendar_events','Compromissos da agenda (Google Agenda via link iCal).',S({days:num('quantos dias a partir de hoje (padrão 1)')}),a=>ctx.calendar(a.days||1),()=>'Consultando a agenda');
 add('email_unread','E-mails não lidos mais recentes (remetente e assunto).',S({limit:num('quantidade, padrão 5')}),a=>ctx.email(a.limit||5),()=>'Verificando e-mails');
 add('whatsapp_message','Abre o WhatsApp com a mensagem pronta para um contato salvo ou número; William só precisa apertar enviar.',S({contact:str('nome do contato salvo ou número com DDD'),message:str('texto da mensagem')},['contact','message']),a=>ctx.whatsapp(a.contact,a.message),a=>`Preparando WhatsApp para ${a.contact}`);
 add('github_overview','Resumo do GitHub de William: repositórios recentes, issues e pull requests abertos.',S({repo:str('repositório owner/nome (opcional)')}),a=>ctx.github(a.repo),()=>'Consultando o GitHub');
 return t;
}
module.exports={makeTools};
