param([string]$ConfigPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark.local.json'}
$env:SPARK_CONFIG=$ConfigPath
$runtime=Join-Path $root '.runtime'
$pidFile=Join-Path $runtime 'tunnel-client.pid'

Write-Host '[S2-STOP-01] Stopping tunnel-client...'
if(Test-Path $pidFile){
  $tunnelPid=[int](Get-Content $pidFile | Select-Object -First 1)
  Stop-Process -Id $tunnelPid -ErrorAction SilentlyContinue
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "[S2-STOP-01] PASS - tunnel-client stop requested, PID=$tunnelPid"
}else{
  Write-Host '[S2-STOP-01] PASS - no tunnel PID file present'
}

Write-Host '[S2-STOP-02] Stopping MCP daemon...'
Push-Location $root
try{
  & npm run daemon:stop
  if($LASTEXITCODE -ne 0){throw 'daemon stop failed'}
}finally{Pop-Location}
Write-Host '[S2-STOP-02] PASS - MCP daemon stopped or already stopped'

Write-Host '[S2-STOP-03] Stopping integrated theme watcher...'
$themeActivePath=Join-Path $root 'modules\theme\.runtime\active.json'
if(Test-Path -LiteralPath $themeActivePath -PathType Leaf){
  try{
    $themeActive=Get-Content -LiteralPath $themeActivePath -Raw | ConvertFrom-Json
    if($themeActive.watcherPid){
      $watcher=Get-CimInstance Win32_Process -Filter "ProcessId=$($themeActive.watcherPid)" -ErrorAction SilentlyContinue
      if($watcher -and $watcher.CommandLine -and $watcher.CommandLine.IndexOf('modules\theme\src\watch.mjs',[System.StringComparison]::OrdinalIgnoreCase) -ge 0){
        Stop-Process -Id $watcher.ProcessId -Force -ErrorAction SilentlyContinue
      }
    }
  }catch{}
  Remove-Item -LiteralPath $themeActivePath -Force -ErrorAction SilentlyContinue
}
Write-Host '[S2-STOP-03] PASS - theme watcher stopped or not active'

Write-Host '[S2-STOP-04] Stopping ChatGPT Windows app...'
$chatProcesses=Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue
if($chatProcesses){
  $chatProcesses | Stop-Process -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
  Write-Host '[S2-STOP-04] PASS - ChatGPT stop requested'
}else{
  Write-Host '[S2-STOP-04] PASS - ChatGPT is not running'
}
