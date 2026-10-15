'use strict';
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
function cpuSample(){return os.cpus().map(c=>({idle:c.times.idle,total:Object.values(c.times).reduce((a,b)=>a+b,0)}));}
function cpuPercent(a,b){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length)return null;let idle=0,total=0;for(let i=0;i<a.length;i++){idle+=b[i].idle-a[i].idle;total+=b[i].total-a[i].total;}return total>0?Math.max(0,Math.min(100,Math.round((1-idle/total)*100))):null;}
function findNvidiaSmi(){if(process.platform!=='win32')return null;const root=process.env.SystemRoot||'C:\\Windows';const dirs=[path.join(root,'System32','nvidia-smi.exe'),path.join(process.env.ProgramFiles||'C:\\Program Files','NVIDIA Corporation','NVSMI','nvidia-smi.exe')];return dirs.find(p=>fs.existsSync(p))||null;}
function gpuStats(){const file=findNvidiaSmi();if(!file)return Promise.resolve(null);return new Promise(resolve=>{execFile(file,['--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:2500,maxBuffer:8192,shell:false},(err,stdout)=>{if(err||!stdout)return resolve(null);const line=stdout.trim().split(/\r?\n/)[0]||'';const p=line.split(',').map(x=>x.trim());if(p.length!==5)return resolve(null);const numbers=p.slice(1).map(Number);if(!numbers.every(Number.isFinite))return resolve(null);resolve({name:p[0].slice(0,80),temperatureC:numbers[0],usagePercent:numbers[1],usedMB:numbers[2],totalMB:numbers[3]});});});}
class DashboardMetrics{
  constructor(){this.last=null;}
  async snapshot(){
    const before=this.last;const now=cpuSample();this.last=now;
    const total=os.totalmem(),free=os.freemem(),gpu=await gpuStats();
    return {at:new Date().toISOString(),cpuPercent:before?cpuPercent(before,now):null,ram:{totalGB:+(total/1073741824).toFixed(1),usedGB:+((total-free)/1073741824).toFixed(1),usedPercent:total?Math.round((total-free)/total*100):null},gpu,cpuTemperatureC:null,uptimeSeconds:Math.floor(os.uptime()),cpuName:(os.cpus()[0]?.model||'CPU').slice(0,100)};
  }
}
module.exports={DashboardMetrics,cpuPercent,gpuStats};