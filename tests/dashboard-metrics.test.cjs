'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DashboardMetrics,cpuPercent}=require('../core/dashboard-metrics.cjs');
test('percentual de CPU calculado por amostras reais',()=>{
 const a=[{idle:100,total:1000},{idle:100,total:1000}];
 const b=[{idle:110,total:1100},{idle:120,total:1100}];
 assert.equal(cpuPercent(a,b),85);
 assert.equal(cpuPercent(null,b),null);
});
test('snapshot de RAM e CPU não inventa temperaturas',async()=>{
 const d=new DashboardMetrics(),s=await d.snapshot();
 assert.ok(s.ram.totalGB>0);
 assert.ok(s.ram.usedPercent>=0&&s.ram.usedPercent<=100);
 assert.equal(s.cpuTemperatureC,null);
 assert.equal(typeof s.cpuName,'string');
});
