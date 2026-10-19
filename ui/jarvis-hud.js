// Tema JARVIS: relógio do HUD, estado espelhado e sequência de inicialização.
(()=>{
  const $=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,'0');
  function tick(){const d=new Date();$('hud-clock').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;$('hud-date').textContent=d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase()}
  const start=Date.now();
  function uptime(){const s=Math.floor((Date.now()-start)/1000),el=$('hud-uptime');if(el)el.textContent=`${pad(Math.floor(s/60))}:${pad(s%60)}`}
  tick();uptime();setInterval(()=>{tick();uptime()},1000);
  const label=$('state-label'),state=$('hud-state');
  if(label&&state){const sync=()=>{state.textContent=label.textContent};new MutationObserver(sync).observe(label,{childList:true,characterData:true,subtree:true});sync()}
  const boot=$('boot'),log=$('boot-log');if(!boot)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){boot.remove();return}
  const lines=['INICIALIZANDO NÚCLEO ENZO...','CARREGANDO MATRIZ HOLOGRÁFICA.......OK','SINTETIZADOR DE VOZ PT-BR...........OK','PROTOCOLOS DE SEGURANÇA.............OK','TODOS OS SISTEMAS OPERACIONAIS.'];
  let i=0;const step=()=>{if(i<lines.length){log.textContent+=lines[i++]+'\n';setTimeout(step,230)}else{boot.classList.add('done');setTimeout(()=>boot.remove(),700)}};
  boot.addEventListener('click',()=>boot.remove());step();
})();
// Efeitos: partículas, fluxo de dados e reação ao estado.
(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const presence=document.querySelector('.presence'),label=document.getElementById('state-label');
  if(presence&&label){const map=t=>/OUVI|ESCUT/i.test(t)?'listening':/FAL|RESPOND|PENS|PROCESS/i.test(t)?'speaking':'idle';
    const sync=()=>{presence.dataset.mode=map(label.textContent)};new MutationObserver(sync).observe(label,{childList:true,characterData:true,subtree:true});sync()}
  if(reduce)return;
  const cv=document.getElementById('fx');
  if(cv&&presence){const ctx=cv.getContext('2d');let w,h,ps=[];
    const size=()=>{w=cv.width=presence.clientWidth;h=cv.height=presence.clientHeight;ps=Array.from({length:90},()=>({a:Math.random()*6.28,r:30+Math.random()*Math.min(w,h)*.55,s:(Math.random()*.004+.001)*(Math.random()<.5?-1:1),z:Math.random()*1.8+.4,o:Math.random()}))};
    new ResizeObserver(size).observe(presence);size();
    (function loop(){if(!document.hidden){ctx.clearRect(0,0,w,h);const cx=w/2,cy=h*.46,boost=presence.dataset.mode==='speaking'?3:presence.dataset.mode==='listening'?2:1;
      for(const p of ps){p.a+=p.s*boost;p.o+=.02;const x=cx+Math.cos(p.a)*p.r,y=cy+Math.sin(p.a)*p.r*.9;ctx.globalAlpha=.35+.35*Math.sin(p.o);ctx.fillStyle=p.z>1.6?'#ffffff':'#7fdcff';ctx.shadowColor='#4cc9ff';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(x,y,p.z,0,6.28);ctx.fill()}}
      requestAnimationFrame(loop)})()}
  const st=document.getElementById('stream');
  if(st){const hex=()=>Math.floor(Math.random()*0xffffff).toString(16).toUpperCase().padStart(6,'0');let lines=[];
    setInterval(()=>{if(st.dataset.live)return;lines.push(`0x${hex()} ${hex()} ${['SYNC','OK','LINK','SCAN','CORE'][Math.random()*5|0]}`);if(lines.length>7)lines.shift();st.textContent=lines.join('\n')},350)}
})();
// Paralaxe: o HUD acompanha o mouse.
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const p=document.querySelector('.presence');if(!p)return;
  p.addEventListener('pointermove',e=>{const r=p.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;p.style.setProperty('--px',`${(x*14).toFixed(1)}px`);p.style.setProperty('--py',`${(y*14).toFixed(1)}px`)});
  p.addEventListener('pointerleave',()=>{p.style.setProperty('--px','0px');p.style.setProperty('--py','0px')})})();
