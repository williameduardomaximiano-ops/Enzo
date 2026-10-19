const {modeIntent}=require('./mode-intents.cjs');const {stripInvocation}=require('./assistant-identity.cjs');
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.!?]/g,'').trim();}
function intent(text){const s=norm(stripInvocation(text));
 if(/^(pare|parar|cancele|cancelar|silencio|modo privacidade)$/.test(s))return {type:'stop'};
 const raw=stripInvocation(text);
 let memory=raw.match(/^(?:memorize|memorizar|lembre|lembre-se) (?:que |de que )?(.+)$/i);
 if(memory)return {type:'memory_add',text:memory[1].trim()};
 memory=raw.match(/^(?:o que (?:voce |você )?(?:lembra|sabe) (?:sobre|de)|pesquise (?:na )?mem[oó]ria(?: sobre)?)\s+(.+)$/i);
 if(memory)return {type:'memory_search',query:memory[1].trim()};
 if(/^(?:liste|listar|mostre|mostrar) (?:minhas|as) missoes$/.test(s)||/^(?:minhas missoes|missoes salvas)$/.test(s))return {type:'mission_list'};
 const original=String(text).trim().replace(/^(?:(?:ei[, ]+)?(?:cosmo|enzo)[, ]*)/i,'').trim();
 const mission=original.match(/^(?:nova miss[aã]o|crie (?:uma )?miss[aã]o|criar (?:uma )?miss[aã]o)(?: para| de|:)?\s+(.+)$/i);
 if(mission)return {type:'mission_create',goal:mission[1].trim()};
 if(/^(?:crie|criar|desenvolva|desenvolver|construa|construir)\s+(?:um|uma|o|a)\s+(?:site|landing page|crm|e-commerce|ecommerce|loja virtual|loja online|aplicativo|app|sistema)\b/i.test(original))return {type:'mission_create',goal:original};

 if(/^(?:(?:iniciar|inicia|ative|ativar|abrir|abre|come[cç]ar|comece|ligar|liga|entrar no|entre no) (?:o )?)?modo (?:de )?trabalho$/.test(s)||/^(vamos trabalhar|hora de trabalhar|iniciar expediente|inicia o expediente)$/.test(s))return {type:'work_mode_start'};
 if(/^(?:encerrar|encerre|desativar|desative|sair do|finalizar|finalize|fechar|feche) (?:o )?modo (?:de )?trabalho$/.test(s))return {type:'work_mode_end'};
 const mode=modeIntent(text);if(mode)return mode;
 if(/^(buscar|verificar|procurar)( novas)? atualizacoes$/.test(s))return {type:'updates'};
 if(/^(ouvir|ler|quais( sao)?( as)?)( novidades)?$/.test(s))return {type:'changelog'};
 if(/^(instalar|baixar|autorizar|confirmar)( a)? atualizacao$/.test(s))return {type:'install_update'};
 if(/^(que horas( sao)?|hora atual)$/.test(s))return {type:'time'};
 if(/^(abr(a|ir)|inici(ar|e)) (a |o )?calculadora$/.test(s))return {type:'action',action:{type:'open_app',app:'calculadora'}};
 if(/^(abr(a|ir)|inici(ar|e)) (o )?bloco de notas$/.test(s))return {type:'action',action:{type:'open_app',app:'bloco'}};
 if(/^abr(a|ir) (o )?(explorador|explorador de arquivos)$/.test(s))return {type:'action',action:{type:'open_app',app:'explorador'}};
 if(/^abr(a|ir) (o )?(navegador|brave)$/.test(s))return {type:'action',action:{type:'open_url',url:'https://www.google.com'}};
 const link=stripInvocation(text).match(/^abr(?:a|ir)\s+(https?:\/\/\S+)$/i);if(link)return {type:'action',action:{type:'open_url',url:link[1]}};
 return {type:'chat'};
}
module.exports={intent};
