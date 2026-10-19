// HUD com dados reais do computador (CPU, memória, lembretes), quando o ENZO roda no Electron.
(()=>{
  const api=window.enzo;if(!api?.sysinfo)return;
  const $=id=>document.getElementById(id);const cpu=[];let battery=null;
  navigator.getBattery?.().then(b=>{battery=b}).catch(()=>{});
  const dur=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}H${String(m).padStart(2,'0')}`:`${m} MIN`};
  const row=(k,v)=>`${k.padEnd(9,'.')} ${v}`;
  async function refresh(){
    let r;try{r=await api.sysinfo();}catch{return}if(!r?.ok)return;const d=r.data;
    cpu.push(d.cpu);if(cpu.length>16)cpu.shift();
    const lines=[row('CPU',`${d.cpu}% · ${d.cpus} NÚCLEOS`),row('MEMÓRIA',`${d.mem}% DE ${d.memGB} GB`),row('LIGADO',dur(d.uptime)),row('LEMBRETES',d.reminders)];
    if(battery)lines.push(row('BATERIA',`${Math.round(battery.level*100)}%${battery.charging?' ⚡':''}`));
    if(d.next)lines.push(row('PRÓXIMO',`${new Date(d.next.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} ${d.next.text.slice(0,12).toUpperCase()}`));
    const st=$('stream');if(st){st.dataset.live='1';st.textContent=lines.join('\n');}
    const bars=document.querySelectorAll('.bars i'),recent=cpu.slice(-bars.length);
    document.querySelector('.bars')?.classList.add('live');bars.forEach((b,i)=>{const v=recent[i-(bars.length-recent.length)];b.style.height=(v==null?2:Math.max(4,v))+'%'});
    const poly=document.querySelector('.spark polyline');if(poly&&cpu.length>1){poly.setAttribute('points',cpu.map((v,i)=>`${(i/(cpu.length-1)*160).toFixed(1)},${(48-v*0.46).toFixed(1)}`).join(' '));poly.parentElement.classList.add('live');}
  }
  refresh();setInterval(refresh,2000);window.addEventListener('enzo-hud',refresh);
})();
