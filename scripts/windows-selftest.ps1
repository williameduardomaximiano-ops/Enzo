$ErrorActionPreference = 'Stop'
$EnzoPath = Join-Path $env:LOCALAPPDATA 'Programs\ENZO'
if (-not (Test-Path "$EnzoPath\ENZO.exe")) { throw 'Instalação padrão não encontrada. Ajuste $EnzoPath para a pasta escolhida.' }
$EnzoPython = Join-Path $EnzoPath 'resources\runtime\python\python.exe'
$EnzoModels = Join-Path $EnzoPath 'resources\runtime\models'
$env:ENZO_MODELS = $EnzoModels
$EnzoReport = Join-Path $env:USERPROFILE 'Desktop\ENZO-diagnostico.txt'
"ENZO — diagnóstico local $(Get-Date -Format o)" | Set-Content -Encoding UTF8 $EnzoReport
"Windows: $([Environment]::OSVersion.VersionString) · x64: $([Environment]::Is64BitOperatingSystem)" | Add-Content $EnzoReport
& $EnzoPython -c "import piper, faster_whisper, onnxruntime; print('Importação dos motores: OK')" 2>&1 | Add-Content $EnzoReport
'{"id":"health","op":"health"}' | & $EnzoPython -u "$EnzoPath\resources\voice\worker.py" 2>&1 | Add-Content $EnzoReport
$EnzoData = Join-Path $env:APPDATA 'enzo-assistente'; try { $cfg = Get-Content (Join-Path $EnzoData 'settings.json') -Raw | ConvertFrom-Json; "IA: provedor=$($cfg.provider) groq=$($cfg.groqModel) gemini=$($cfg.geminiModel)" | Add-Content $EnzoReport } catch { 'IA: sem configuração salva.' | Add-Content $EnzoReport }; if (Test-Path (Join-Path $EnzoData 'vault.enc')) { 'Cofre: arquivo presente (chaves não exibidas).' | Add-Content $EnzoReport } else { 'Cofre: vazio. Salve as chaves em Configuração → Cofre.' | Add-Content $EnzoReport }
Write-Host "Relatório salvo em $EnzoReport. Ele não comprova microfone, reprodução, controle ou instalação de atualizações."
