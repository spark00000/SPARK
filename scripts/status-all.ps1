param([string]$ConfigPath)
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath
Push-Location $root
try{Write-Host '[S2-STATUS-01] MCP daemon'; & npm run daemon:status}catch{}finally{Pop-Location}
Write-Host '[S2-STATUS-02] Tunnel readiness'
try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8080/readyz';Write-Host $r.Content.Trim()}catch{Write-Host 'not-ready'}
