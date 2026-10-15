// Central local: dados reais do IPC do ENZO e agenda salva no userData do Windows.
// Nenhum número de temperatura, compromisso ou sensor é inventado.
export function initDashboard({api,notify}) {
  const get=id=>document.getElementById(id);
  const fmtGB=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
  const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let selected=new Date();selected.setHours(12,0,0,0);
  let events=[];
  function pad(n){return String(n).padStart(2,'0')}
  function localISO(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  function clock(){
    const n=new Date();
    get('dash-clock').textContent=n.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    get('dash-today').textContent=n.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  }
  async function metrics(){
    try{
      const r=await api.metrics();if(!r.ok)throw Error(r.error);const m=r.data;
      get('dash-cpu').textContent=m.cpuPercent===null?'Calculando…':m.cpuPercent+'%';
      get('dash-ram').textContent=fmtGB(m.ramUsedGB)+' / '+fmtGB(m.ramTotalGB)+' GB';
      get('dash-temp').textContent=m.temperatureC===null?'Indisponível':m.temperatureC+' °C';
      get('dash-temp-detail').textContent=m.temperatureC===null?m.temperatureStatus:'Sensor local';
      get('dash-cores').textContent=m.logicalCores+' processadores lógicos';
    }catch(e){get('dash-cpu').textContent='Indisponível';get('dash-temp').textContent='Indisponível';get('dash-temp-detail').textContent='Métricas locais indisponíveis';}
  }
  function calendar(){
    const year=selected.getFullYear(),month=selected.getMonth();
    get('dash-month').textContent=selected.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    const root=get('dash-days');root.replaceChildren();
    for(const name of days){const d=document.createElement('span');d.textContent=name;d.className='calendar-weekday';root.append(d);}
    const start=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate();
    for(let i=0;i<start;i++)root.append(document.createElement('span'));
    for(let n=1;n<=count;n++){
      const date=new Date(year,month,n,12);
      const b=document.createElement('button');b.type='button';b.className='calendar-day';b.textContent=String(n);
      const key=localISO(date);
      b.classList.toggle('selected',key===localISO(selected));
      b.classList.toggle('has-event',events.some(e=>e.startsAt.startsWith(key)));
      b.setAttribute('aria-label',date.toLocaleDateString('pt-BR'));
      b.onclick=()=>{selected=date;calendar();renderAgenda();get('dash-when').value=key+'T09:00';};
      root.append(b);
    }
  }
  function renderAgenda(){
    const root=get('dash-agenda');root.replaceChildren();
    const key=localISO(selected),items=events.filter(e=>e.startsAt.startsWith(key));
    get('dash-agenda-date').textContent=selected.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'});
    if(!items.length){const p=document.createElement('p');p.textContent='Nenhum compromisso cadastrado para este dia.';p.className='muted';root.append(p);return;}
    for(const event of items) {
      const row=document.createElement('div');row.className='agenda-item';
      const text=document.createElement('span');text.textContent=event.startsAt.slice(11)+' • '+event.title;
      const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';remove.title='Excluir compromisso';remove.onclick=async()=>{
        try{const r=await api.agendaRemove(event.id);if(!r.ok)throw Error(r.error);await loadAgenda();}
        catch(e){notify('Agenda: '+e.message);}
      };
      row.append(text,remove);root.append(row);
    }
  }
  async function loadAgenda(){
    try{const r=await api.agendaList();if(!r.ok)throw Error(r.error);events=r.data;calendar();renderAgenda();}
    catch(e){notify('Agenda indisponível: '+e.message);}
  }
  get('dash-prev-month').onclick=()=>{selected=new Date(selected.getFullYear(),selected.getMonth()-1,1,12);calendar();renderAgenda()};
  get('dash-next-month').onclick=()=>{selected=new Date(selected.getFullYear(),selected.getMonth()+1,1,12);calendar();renderAgenda()};
  get('dash-agenda-form').addEventListener('submit',async e=>{
    e.preventDefault();
    try{const title=get('dash-title').value.trim(),startsAt=get('dash-when').value;const r=await api.agendaCreate({title,startsAt});if(!r.ok)throw Error(r.error);
      get('dash-title').value='';selected=new Date(startsAt);selected.setHours(12);await loadAgenda();notify('Compromisso salvo somente neste computador.');
    }catch(err){notify('Agenda: '+err.message);}
  });
  clock();setInterval(clock,1000);
  get('dash-when').value=localISO(selected)+'T09:00';
  void metrics();setInterval(()=>{if(!document.hidden)void metrics()},10000);
  void loadAgenda();
}
