'use strict';
const os = require('node:os');

// Dados locais do sistema, sem chamadas de rede e sem sensores simulados.
function totals(cpus) {
  return cpus.reduce((r, cpu) => {
    for (const [key, value] of Object.entries(cpu.times)) r[key] = (r[key] || 0) + value;
    return r;
  }, {});
}
function createMonitor() {
  let before = totals(os.cpus());
  let last = null, lastAt = 0;
  return {
    snapshot() {
      const now = Date.now();
      if (last && now - lastAt < 2000) return last;
      const current = totals(os.cpus());
      const previousTotal = Object.values(before).reduce((a,b)=>a+b,0);
      const total = Object.values(current).reduce((a,b)=>a+b,0);
      const elapsed = total - previousTotal;
      const idle = current.idle - before.idle;
      before = current;
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const cpuPercent = elapsed > 0 ? Math.max(0, Math.min(100, Math.round((elapsed-idle)*100/elapsed))) : null;
      last = {
        cpuPercent,
        ramUsedGB: Math.round((totalMemory-freeMemory)/1073741824*10)/10,
        ramTotalGB: Math.round(totalMemory/1073741824*10)/10,
        logicalCores: os.cpus().length,
        uptimeSeconds: Math.floor(os.uptime()),
        temperatureC: null,
        temperatureStatus: 'Sensor não conectado',
        at: new Date(now).toISOString()
      };
      lastAt = now;
      return last;
    }
  };
}
module.exports = {createMonitor};
