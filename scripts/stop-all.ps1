param([string]$ConfigPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath
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

Write-Host '[S2-STOP-03] Stopping ChatGPT Windows app...'
$chatProcesses=Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue
if($chatProcesses){
  $chatProcesses | Stop-Process -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
  Write-Host '[S2-STOP-03] PASS - ChatGPT stop requested'
}else{
  Write-Host '[S2-STOP-03] PASS - ChatGPT is not running'
}
