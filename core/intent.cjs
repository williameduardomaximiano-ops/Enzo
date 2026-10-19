const {modeIntent}=require('./mode-intents.cjs');
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.!?]/g,'').trim();}
function intent(text){const s=norm(text).replace(/^(?:cosmo|cosmos|kosmo|enzo)[, ]*/,'');
 if(/^(pare|parar|cancele|cancelar|silencio|modo privacidade)$/.test(s))return {type:'stop'};
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
 const link=text.match(/^(?:(?:cosmo|cosmos|kosmo|enzo)[, ]*)?abr(?:a|ir)\s+(https?:\/\/\S+)$/i);if(link)return {type:'action',action:{type:'open_url',url:link[1]}};
 return {type:'chat'};
}
module.exports={intent};
