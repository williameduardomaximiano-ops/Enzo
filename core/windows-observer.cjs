'use strict';
const path=require('node:path');
const {execFile}=require('node:child_process');
const SCRIPT=String.raw`
Add-Type -AssemblyName UIAutomationClient
$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$items = @()
foreach ($w in $windows) {
  try {
    $title = [string]$w.Current.Name
    if ([string]::IsNullOrWhiteSpace($title)) { continue }
    $items += @{ title=$title.Substring(0,[Math]::Min($title.Length,180)); processId=[int]$w.Current.ProcessId }
    if ($items.Count -ge 30) { break }
  } catch {}
}
ConvertTo-Json -InputObject $items -Compress -Depth 3
`;
function parseWindows(raw){
 let items;try{items=JSON.parse(raw)}catch{throw Error('Windows UI Automation devolveu dados inválidos.');}
 if(items===null)return [];
 if(!Array.isArray(items))items=[items];
 return items.slice(0,30).filter(x=>x&&typeof x.title==='string'&&x.title.length<300&&Number.isSafeInteger(x.processId)&&x.processId>0).map(x=>({title:x.title,processId:x.processId}));
}
function observeWindows({platform=process.platform,env=process.env,run=execFile}={}){
 if(platform!=='win32')return Promise.reject(Error('Leitura de janelas exige Windows.'));
 const ps=path.win32.join(env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const arg=Buffer.from(SCRIPT,'utf16le').toString('base64');
 return new Promise((resolve,reject)=>{
  run(ps,['-NoProfile','-NonInteractive','-EncodedCommand',arg],{windowsHide:true,timeout:9000,maxBuffer:25000,shell:false},(err,out)=>{
   if(err)return reject(Error('Não foi possível ler janelas por acessibilidade: '+err.message));
   try{resolve(parseWindows(String(out)))}catch(e){reject(e)}
  });
 });
}
module.exports={observeWindows,parseWindows,SCRIPT};
