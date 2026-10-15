// A interface nova não utiliza o holograma antigo (imagem 2.5D).
// O modelo humanoide 3D com rig facial será importado neste ponto futuramente.
// O módulo 3D terá contrato: setState, setLevel, dispose.
export function createAvatarSlot(element) {
  if (!element) throw Error('Área do humanoide ausente.');
  const status=element.querySelector('[data-avatar-status]');
  const meter=element.querySelector('[data-avatar-level]');
  return {
    setState(state) {
      element.dataset.state=state;
      if(status)status.textContent=({
        idle:'PRONTO PARA O NOVO AVATAR',
        listening:'OUVINDO',
        thinking:'PROCESSANDO',
        speaking:'FALANDO',
        permission:'AGUARDANDO PERMISSÃO',
        executing:'EXECUTANDO',
        paused:'PAUSADO',
        updating:'ATUALIZANDO'
      })[state]||'ENZO';
    },
    setLevel(value) {
      const n=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
      if(meter)meter.style.transform=`scaleX(${Math.max(.06,n)})`;
    },
    dispose() {}
  };
}
