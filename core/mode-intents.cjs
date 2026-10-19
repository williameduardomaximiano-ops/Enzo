'use strict';
/** Interpretador determinístico de comandos de modo; não utiliza a IA. */
const {norm}=require('./modes.cjs');const {stripInvocation}=require('./assistant-identity.cjs');
function modeIntent(text){
 const s=norm(stripInvocation(text)).replace(/[.!?]+$/,'').trim();
 if(/^(?:quais sao |listar |liste |mostre |mostrar )(?:os )?(?:meus )?modos(?: salvos)?$/.test(s)||/^(?:meus modos|modos salvos)$/.test(s))return {type:'mode_list'};
 let m=s.match(/^(?:crie|criar|cria|salve|salvar|salva|grave|gravar) (?:um |o )?modo (?:chamado )?(.+?) com (.+)$/);
 if(m)return {type:'mode_save',name:m[1],targets:m[2]};
 m=s.match(/^(?:salve|salvar|salva|grave|gravar) (?:o )?modo (.+)$/);
 if(m)return {type:'mode_save_existing',name:m[1]};
 m=s.match(/^(?:adicione|adicionar|adiciona|coloque|coloca) (.+?) (?:ao|no) modo (.+)$/);
 if(m)return {type:'mode_add',name:m[2],targets:m[1]};
 m=s.match(/^(?:remova|remover|retire|tire) (.+?) (?:do|de) modo (.+)$/);
 if(m)return {type:'mode_remove',name:m[2],targets:m[1]};
 m=s.match(/^(?:apague|apagar|exclua|excluir) (?:o )?modo (.+)$/);
 if(m)return {type:'mode_delete',name:m[1]};
 m=s.match(/^(?:inicie|iniciar|inicia|abra|abrir|abre|ative|ativar|ativa|executar|execute) (?:o )?modo (?:de )?(.+)$/);
 if(m)return {type:'mode_start',name:m[1]};
 m=s.match(/^(?:encerre|encerrar|encerra|desative|desativar|desativa|pare|parar|finalizar|finalize) (?:o )?modo (?:de )?(.+)$/);
 if(m)return {type:'mode_end',name:m[1]};
 return null;
}
module.exports={modeIntent};
