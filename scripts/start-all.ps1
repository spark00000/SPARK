param([string]$ConfigPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Fail-Step([string]$Id,[string]$Message){
  Write-Host "[$Id] FAIL - $Message" -ForegroundColor Red
  throw "[$Id] $Message"
}

function Resolve-RepoRelative([string]$Value){
  if([System.IO.Path]::IsPathRooted($Value)){return $Value}
  return Join-Path $root $Value
}

if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
if(-not (Test-Path $ConfigPath)){
  Write-Host '[S2-01] FAIL - local config not found.' -ForegroundColor Red
  Write-Host '         Copy config\spark-transport.example.json to config\spark-transport.local.json and edit allowedRoot/tunnel.id.'
  exit 2
}
$ConfigPath=(Resolve-Path $ConfigPath).Path
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath
$config=Get-Content -Raw $ConfigPath | ConvertFrom-Json
Write-Host "[S2-01] PASS - Config loaded: $ConfigPath"

Write-Host '[S2-02] Checking Node.js...'
& node --version
if($LASTEXITCODE -ne 0){Fail-Step 'S2-02' 'Node.js 20+ is required'}
Write-Host '[S2-02] PASS - Node.js available'

# Resolve the daemon log exactly as the Node config does for the normal Windows PoC paths.
if($config.daemon.stateDir){
  $daemonStateDir=Resolve-RepoRelative ([string]$config.daemon.stateDir)
}else{
  $privateBase=$env:LOCALAPPDATA
  if(-not $privateBase){$privateBase=$env:APPDATA}
  if(-not $privateBase){$privateBase=$env:USERPROFILE}
  $daemonStateDir=Join-Path $privateBase 'SPARK_Transport'
}
$daemonLog=Join-Path $daemonStateDir 'spark-transport.log'

Write-Host '[S2-03] Starting MCP daemon...'
Push-Location $root
try {
  & npm run daemon:start
  if($LASTEXITCODE -ne 0){
    Write-Host '[S2-03] FAIL - daemon start returned a non-zero exit code.' -ForegroundColor Red
    Write-Host "[S2-03] Daemon log: $daemonLog"
    if(Test-Path $daemonLog){
      Write-Host '[S2-03] ---- daemon log tail ----'
      Get-Content -Path $daemonLog -Tail 40
      Write-Host '[S2-03] ---- end daemon log ----'
    }else{
      Write-Host '[S2-03] Daemon log file does not exist.'
    }
    throw '[S2-03] daemon start failed'
  }
} finally { Pop-Location }
Write-Host '[S2-03] PASS - MCP daemon started'

$health="http://$($config.daemon.host):$($config.daemon.port)$($config.daemon.healthPath)"
Write-Host "[S2-04] Health check: $health"
try{$r=Invoke-RestMethod -TimeoutSec 3 $health}catch{Fail-Step 'S2-04' "daemon health request failed: $($_.Exception.Message)"}
if($r.status -ne 'ok'){Fail-Step 'S2-04' 'daemon health response was not ok'}
Write-Host "[S2-04] PASS - daemon healthy, version=$($r.version)"

if($config.tunnel.enabled -eq $false){Write-Host '[S2-05] PASS - Tunnel disabled by config. Startup complete.';exit 0}
if(-not $config.tunnel.id -or $config.tunnel.id -like 'tunnel_x*'){Fail-Step 'S2-05' 'Set tunnel.id in local config'}

$keyRef=$config.tunnel.controlPlaneApiKeyRef
$defaultSecretFile=Join-Path $root '.runtime\secrets\control-plane-api-key.txt'
if(-not $keyRef){
  if(Test-Path $defaultSecretFile){$keyRef='file:.runtime/secrets/control-plane-api-key.txt'}else{$keyRef='env:CONTROL_PLANE_API_KEY'}
}
if($keyRef -like 'env:*'){
  $envName=$keyRef.Substring(4)
  if(-not $envName){Fail-Step 'S2-05' 'Invalid env: secret reference'}
  $envValue=[Environment]::GetEnvironmentVariable($envName)
  if(-not $envValue){
    if(Test-Path $defaultSecretFile){
      $keyRef="file:$((Resolve-Path $defaultSecretFile).Path)"
      Write-Host '[S2-05] PASS - Environment key not set; using repo-local gitignored secret file.'
    }else{
      Fail-Step 'S2-05' "Secret environment variable '$envName' is not set and default secret file was not found: $defaultSecretFile"
    }
  }else{
    Write-Host "[S2-05] PASS - Tunnel key source: env:$envName (value hidden)"
  }
}elseif($keyRef -like 'file:*'){
  $secretPath=$keyRef.Substring(5)
  if(-not [System.IO.Path]::IsPathRooted($secretPath)){$secretPath=Join-Path $root $secretPath}
  if(-not (Test-Path $secretPath)){Fail-Step 'S2-05' "Secret file not found: $secretPath"}
  $secretPath=(Resolve-Path $secretPath).Path
  $secretValue=(Get-Content -Raw $secretPath).Trim()
  if(-not $secretValue){Fail-Step 'S2-05' "Secret file is empty: $secretPath"}
  $keyRef="file:$secretPath"
  Write-Host "[S2-05] PASS - Tunnel key source: file:$secretPath (value hidden)"
}else{
  Fail-Step 'S2-05' 'controlPlaneApiKeyRef must use env:VARNAME or file:path'
}

$clientDir=$config.tunnel.clientDir
if(-not [System.IO.Path]::IsPathRooted($clientDir)){$clientDir=Join-Path $root $clientDir}
Write-Host "[S2-06] Checking tunnel-client: $clientDir"
& (Join-Path $root 'scripts\bootstrap-tunnel.ps1') -Version $config.tunnel.clientVersion -ClientDir $clientDir
if($LASTEXITCODE -ne 0){Fail-Step 'S2-06' 'tunnel-client bootstrap failed'}
$client=Join-Path $clientDir 'tunnel-client.exe'
if(-not (Test-Path $client)){Fail-Step 'S2-06' "tunnel-client.exe not found after bootstrap: $client"}
Write-Host "[S2-06] PASS - tunnel-client ready: $client"

$profile=$config.tunnel.profile
$runtime=Join-Path $root '.runtime';New-Item -ItemType Directory -Force $runtime|Out-Null
Write-Host "[S2-07] Checking tunnel profile: $profile"
& $client doctor --profile $profile --explain *> (Join-Path $runtime 'tunnel-doctor.log')
if($LASTEXITCODE -ne 0){
  Write-Host '[S2-07] Profile not ready; initializing no-auth MCP profile...'
  & $client init --sample sample_mcp_remote_no_auth --profile $profile --tunnel-id $config.tunnel.id --mcp-server-url $config.tunnel.localMcpUrl --control-plane-api-key-ref $keyRef
  if($LASTEXITCODE -ne 0){Fail-Step 'S2-07' 'tunnel profile init failed'}
  & $client doctor --profile $profile --explain
  if($LASTEXITCODE -ne 0){Fail-Step 'S2-07' 'tunnel doctor failed after init'}
}
Write-Host '[S2-07] PASS - tunnel profile ready'

try{$ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz';if($ready.Content.Trim() -eq 'ready'){Write-Host '[S2-08] PASS - Tunnel already ready.';exit 0}}catch{}
Write-Host '[S2-08] Starting tunnel-client...'
$proc=Start-Process -FilePath $client -ArgumentList @('run','--profile',$profile) -WorkingDirectory $root -WindowStyle Minimized -PassThru
Set-Content -Encoding ascii (Join-Path $runtime 'tunnel-client.pid') $proc.Id
Write-Host "[S2-08] PASS - tunnel-client started, PID=$($proc.Id)"

Write-Host '[S2-09] Waiting for tunnel /readyz...'
$deadline=(Get-Date).AddSeconds(20)
do{Start-Sleep -Milliseconds 500;try{$ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz';if($ready.Content.Trim() -eq 'ready'){Write-Host "[S2-09] PASS - tunnel ready (PID $($proc.Id))";exit 0}}catch{}}while((Get-Date)-lt$deadline)
Fail-Step 'S2-09' 'tunnel-client did not become ready within 20 seconds'
