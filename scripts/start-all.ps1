param([string]$ConfigPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
if(-not (Test-Path $ConfigPath)){Write-Host '[S2-CFG-01] ERROR: local config not found.';Write-Host "Copy config\spark-transport.example.json to config\spark-transport.local.json and edit allowedRoot/tunnel.id.";exit 2}
$ConfigPath=(Resolve-Path $ConfigPath).Path
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath
$config=Get-Content -Raw $ConfigPath | ConvertFrom-Json
Write-Host "[S2-CFG-01] Config loaded: $ConfigPath"

Write-Host '[S2-RUN-01] Checking Node.js...'
& node --version
if($LASTEXITCODE -ne 0){throw 'Node.js 20+ is required'}

Write-Host '[S2-DAEMON-01] Starting MCP daemon...'
Push-Location $root
try { & npm run daemon:start; if($LASTEXITCODE -ne 0){throw 'daemon start failed'} } finally { Pop-Location }
$health="http://$($config.daemon.host):$($config.daemon.port)$($config.daemon.healthPath)"
Write-Host "[S2-DAEMON-02] Health check: $health"
$r=Invoke-RestMethod -TimeoutSec 3 $health
if($r.status -ne 'ok'){throw 'daemon health check failed'}
Write-Host '[S2-DAEMON-02] PASS'

if($config.tunnel.enabled -eq $false){Write-Host '[S2-TUN-00] Tunnel disabled by config. Done.';exit 0}
if(-not $config.tunnel.id -or $config.tunnel.id -like 'tunnel_x*'){throw '[S2-TUN-01] Set tunnel.id in local config'}
$keyRef=$config.tunnel.controlPlaneApiKeyRef
if(-not $keyRef){$keyRef='env:CONTROL_PLANE_API_KEY'}
if($keyRef -like 'env:*'){
  $envName=$keyRef.Substring(4)
  if(-not $envName){throw '[S2-TUN-01] Invalid env: secret reference'}
  $envValue=[Environment]::GetEnvironmentVariable($envName)
  if(-not $envValue){throw "[S2-TUN-01] Secret environment variable '$envName' is not set"}
}elseif($keyRef -like 'file:*'){
  $secretPath=$keyRef.Substring(5)
  if(-not [System.IO.Path]::IsPathRooted($secretPath)){$secretPath=Join-Path $root $secretPath}
  if(-not (Test-Path $secretPath)){throw "[S2-TUN-01] Secret file not found: $secretPath"}
  $secretPath=(Resolve-Path $secretPath).Path
  $keyRef="file:$secretPath"
}else{
  throw '[S2-TUN-01] controlPlaneApiKeyRef must use env:VARNAME or file:path'
}
$clientDir=$config.tunnel.clientDir
if(-not [System.IO.Path]::IsPathRooted($clientDir)){$clientDir=Join-Path $root $clientDir}
& (Join-Path $root 'scripts\bootstrap-tunnel.ps1') -Version $config.tunnel.clientVersion -ClientDir $clientDir
$client=Join-Path $clientDir 'tunnel-client.exe'
$profile=$config.tunnel.profile
$runtime=Join-Path $root '.runtime';New-Item -ItemType Directory -Force $runtime|Out-Null

Write-Host "[S2-TUN-05] Checking tunnel profile: $profile"
& $client doctor --profile $profile --explain *> (Join-Path $runtime 'tunnel-doctor.log')
if($LASTEXITCODE -ne 0){
  Write-Host '[S2-TUN-06] Profile not ready; initializing no-auth MCP profile...'
  & $client init --sample sample_mcp_remote_no_auth --profile $profile --tunnel-id $config.tunnel.id --mcp-server-url $config.tunnel.localMcpUrl --control-plane-api-key-ref $keyRef
  if($LASTEXITCODE -ne 0){throw 'tunnel profile init failed'}
  & $client doctor --profile $profile --explain
  if($LASTEXITCODE -ne 0){throw 'tunnel doctor failed after init'}
}

try{$ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz';if($ready.Content.Trim() -eq 'ready'){Write-Host '[S2-TUN-07] Tunnel already ready.';exit 0}}catch{}
Write-Host '[S2-TUN-07] Starting tunnel-client...'
$proc=Start-Process -FilePath $client -ArgumentList @('run','--profile',$profile) -WorkingDirectory $root -WindowStyle Minimized -PassThru
Set-Content -Encoding ascii (Join-Path $runtime 'tunnel-client.pid') $proc.Id
$deadline=(Get-Date).AddSeconds(20)
do{Start-Sleep -Milliseconds 500;try{$ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz';if($ready.Content.Trim() -eq 'ready'){Write-Host "[S2-TUN-08] PASS - tunnel ready (PID $($proc.Id))";exit 0}}catch{}}while((Get-Date)-lt$deadline)
throw 'tunnel-client did not become ready within 20 seconds'
