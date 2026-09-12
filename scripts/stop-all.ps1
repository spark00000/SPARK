param([string]$ConfigPath)
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath
$runtime=Join-Path $root '.runtime';$pidFile=Join-Path $runtime 'tunnel-client.pid'
Write-Host '[S2-STOP-01] Stopping tunnel-client...'
if(Test-Path $pidFile){$pid=[int](Get-Content $pidFile|Select-Object -First 1);Stop-Process -Id $pid -ErrorAction SilentlyContinue;Remove-Item $pidFile -Force -ErrorAction SilentlyContinue}
Write-Host '[S2-STOP-02] Stopping MCP daemon...'
Push-Location $root
try{& npm run daemon:stop}finally{Pop-Location}
