// Tema JARVIS: relógio do HUD, estado espelhado e sequência de inicialização.
(()=>{
  const $=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  function tick(){const d=new Date();$('hud-clock').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;$('hud-date').textContent=d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase()}
  tick();setInterval(tick,1000);
  const label=$('state-label'),state=$('hud-state');
  if(label&&state){const sync=()=>{state.textContent=label.textContent};new MutationObserver(sync).observe(label,{childList:true,characterData:true,subtree:true});sync()}
  const boot=$('boot'),log=$('boot-log');if(!boot)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){boot.remove();return}
  const lines=['INICIALIZANDO NÚCLEO ENZO...','CARREGANDO MATRIZ HOLOGRÁFICA.......OK','SINTETIZADOR DE VOZ PT-BR...........OK','PROTOCOLOS DE SEGURANÇA.............OK','TODOS OS SISTEMAS OPERACIONAIS.'];
  let i=0;const step=()=>{if(i<lines.length){log.textContent+=lines[i++]+'\n';setTimeout(step,230)}else{boot.classList.add('done');setTimeout(()=>boot.remove(),700)}};
  boot.addEventListener('click',()=>boot.remove());step();
})();
