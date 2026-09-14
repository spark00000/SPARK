param([string]$ConfigPath)
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath

Write-Host '[S2-STATUS-01] MCP daemon'
Push-Location $root
try{& npm run daemon:status}catch{}finally{Pop-Location}

Write-Host '[S2-STATUS-02] Tunnel readiness'
try{
  $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8080/readyz'
  if($r.Content.Trim() -eq 'ready'){Write-Host 'ready'}else{Write-Host $r.Content.Trim()}
}catch{Write-Host 'not-ready'}

Write-Host '[S2-STATUS-03] ChatGPT Windows app'
$chatProcesses=Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue
if($chatProcesses){
  $ids=($chatProcesses | Select-Object -ExpandProperty Id) -join ','
  Write-Host "running (PID(s): $ids)"
}else{
  Write-Host 'not-running'
}
