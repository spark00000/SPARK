param([string]$ConfigPath)
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark.local.json'}
$env:SPARK_CONFIG=$ConfigPath

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

Write-Host '[S2-STATUS-04] Integrated theme runtime'
$activePath=Join-Path $root 'modules\theme\.runtime\active.json'
if(-not (Test-Path -LiteralPath $activePath -PathType Leaf)){
  Write-Host 'not-active'
}else{
  try{
    $active=Get-Content -LiteralPath $activePath -Raw | ConvertFrom-Json
    $watcher=Get-CimInstance Win32_Process -Filter "ProcessId=$($active.watcherPid)" -ErrorAction SilentlyContinue
    $watcherOk=($watcher -and $watcher.CommandLine -and $watcher.CommandLine.IndexOf('modules\theme\src\watch.mjs',[System.StringComparison]::OrdinalIgnoreCase) -ge 0)
    $cdpOk=$false
    try{$targets=Invoke-RestMethod -Uri "http://127.0.0.1:$($active.port)/json/list" -TimeoutSec 1;$cdpOk=@($targets).Count -gt 0}catch{}
    if($watcherOk -and $cdpOk){Write-Host "active (theme=$($active.themeSelection), CDP=127.0.0.1:$($active.port), watcherPid=$($active.watcherPid))"}
    else{Write-Host "degraded (theme=$($active.themeSelection), watcher=$watcherOk, cdp=$cdpOk)"}
  }catch{Write-Host "invalid-state: $($_.Exception.Message)"}
}
