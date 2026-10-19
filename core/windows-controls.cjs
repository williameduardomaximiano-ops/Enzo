'use strict';
/** Inspeção de botões Windows UIAutomation, um processo por vez, sem OCR nem captura de pixels. */
const {execFile}=require('node:child_process');
const path=require('node:path');
const BASE=String.raw`
Add-Type -AssemblyName UIAutomationClient
$pidTarget=__PID__
$invoke=__INVOKE__
$expected=__EXPECTED__
$root=[System.Windows.Automation.AutomationElement]::RootElement
$windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$window=$null
foreach($w in $windows){try{if($w.Current.ProcessId -eq $pidTarget){$window=$w;break}}catch{}}
if($null -eq $window){throw 'Janela não encontrada'}
$condition=New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ControlTypeProperty),([System.Windows.Automation.ControlType]::Button)
$controls=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
$entries=@()
foreach($el in $controls){
 try{
  $name=[string]$el.Current.Name
  $automationId=[string]$el.Current.AutomationId
  if($name.Length -gt 120){$name=$name.Substring(0,120)}
  if($automationId.Length -gt 120){$automationId=$automationId.Substring(0,120)}
  if($el.Current.IsEnabled -and ($name -or $automationId)){
   $entries+=@{name=$name;automationId=$automationId;enabled=$true}
   if($entries.Count -ge 80){break}
  }
 }catch{}
}
if($invoke){
 $matching=@()
 foreach($el in $controls){
  try{
   if($el.Current.IsEnabled -and [string]$el.Current.Name -eq $expected.name -and [string]$el.Current.AutomationId -eq $expected.automationId){
    $matching+=,$el
   }
  }catch{}
 }
 if($matching.Count -ne 1){throw 'Controle não é único ou desapareceu'}
 $pattern=$matching[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
 if($null -eq $pattern){throw 'Este controle não aceita InvokePattern'}
 $pattern.Invoke()
 '{"clicked":true}'
}else{
 ConvertTo-Json -InputObject $entries -Depth 3 -Compress
}
`;
function numericPid(pid){if(!Number.isSafeInteger(pid)||pid<1||pid>2147483647)throw Error('Processo inválido.');return pid;}
function validateButton(info){
 if(!info||typeof info!=='object'||typeof info.name!=='string'||typeof info.automationId!=='string'||info.name.length>120||info.automationId.length>120||(!info.name&&!info.automationId))throw Error('Controle inválido.');
 if(/(?:delete|remove|exclu|apagar|desinstal|enviar|send|submit|pagar|pay|purchase|comprar|publish|publicar|confirmar pagamento|formatar|resetar)/i.test(info.name+' '+info.automationId))throw Error('Ação sensível bloqueada no modo automatizado.');
 return {name:info.name,automationId:info.automationId};
}
function parseControls(text){
 let raw;try{raw=JSON.parse(text)}catch{throw Error('Resposta de acessibilidade inválida.');}
 return (Array.isArray(raw)?raw:raw?[raw]:[]).slice(0,80)
  .filter(x=>x&&typeof x.name==='string'&&typeof x.automationId==='string'&&x.name.length<=120&&x.automationId.length<=120)
  .map(x=>({name:x.name,automationId:x.automationId,enabled:true}));
}
function runScript(pid,button=null,{platform=process.platform,run=execFile,env=process.env}={}){
 numericPid(pid);if(button!==null)button=validateButton(button);
 if(platform!=='win32')return Promise.reject(Error('Acessibilidade exige Windows.'));
 const json=button?JSON.stringify(button):'null';
 const payload=Buffer.from(json,'utf8').toString('base64');
 const expr=button?'$true':'$false';
 const expected="(ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('"+payload+"'))))";
 const script=BASE.replace('__PID__',String(pid)).replace('__INVOKE__',expr).replace('__EXPECTED__',expected);
 const cmd=Buffer.from(script,'utf16le').toString('base64');
 const exe=path.win32.join(env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 return new Promise((resolve,reject)=>{
  run(exe,['-NoProfile','-NonInteractive','-EncodedCommand',cmd],{windowsHide:true,timeout:11000,maxBuffer:48000,shell:false},(err,out)=>{
   if(err)return reject(Error('Falha ao acessar controle: '+err.message.slice(0,150)));
   try{resolve(button?JSON.parse(String(out)):parseControls(String(out)))}catch(e){reject(e)}
  });
 });
}
module.exports={runScript,parseControls,validateButton,numericPid};
