// Palavra de ativação: só repassa frases que chamam o ENZO pelo nome, no começo ou no fim.
const NAME='(?:enzo|enso|ênzo|jarvis)';
const GREET='(?:bom dia|boa tarde|boa noite|olá|ola|oi|e aí|e ai|fala)';
const START=new RegExp(`^(?:(?:ei|ok|${GREET})[, ]+)?${NAME}\\b[,.!? ]*`,'i');
const END=new RegExp(`[, ]+${NAME}[.!? ]*$`,'i');
function wakeWord(text){
 if(typeof text!=='string')return null;
 const s=text.trim().replace(/^[^\p{L}]+/u,'');
 const m=s.match(START);
 if(m){const rest=s.slice(m[0].length).trim();const greet=m[0].match(new RegExp(`^${GREET}`,'i'));return rest||(greet?greet[0]:'');}
 const e=s.match(END);if(e&&e.index>0)return s.slice(0,e.index).trim();
 return null;
}
// Remove o nome do ENZO do começo ou do fim, para os comandos locais reconhecerem a frase.
function stripName(text){return String(text).trim().replace(new RegExp(`^(?:ei|ok)?[, ]*${NAME}[, ]+`,'i'),'').replace(END,'').trim()||String(text).trim();}
module.exports={wakeWord,stripName};
