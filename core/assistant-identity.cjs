'use strict';
/**
 * Marca pública COSMO. Mantemos "Enzo" como apelido legado apenas para
 * comandos e compatibilidade com configurações/versões já instaladas.
 * Não implementa wake word em segundo plano: só interpreta texto recebido.
 */
const NAME='COSMO';
const ADDRESS=/^(?:ei[\s,]+)?(?:cosmo|enzo)(?=\s|,|$)[\s,]*/i;
function stripInvocation(value){
  if(typeof value!=='string')return '';
  return value.trim().replace(ADDRESS,'').trim();
}
module.exports={NAME,stripInvocation};
