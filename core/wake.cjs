// Palavra de ativação: só repassa frases que começam chamando o ENZO.
const WAKE=/^(?:(?:ei|ok|oi|olá|ola|e ai|e aí|fala)[, ]+)?(?:enzo|enso|ênzo|jarvis)\b[,.!? ]*/i;
function wakeWord(text){
 if(typeof text!=='string')return null;
 const s=text.trim().replace(/^[^\p{L}]+/u,'');
 const m=s.match(WAKE);if(!m)return null;
 return s.slice(m[0].length).trim();
}
module.exports={wakeWord};
