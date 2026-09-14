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

function Start-NormalChatGPTApp(){
  $running=Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue
  if($running){Write-Host '[S2-10] PASS - ChatGPT already running';return}
  $app=Get-StartApps | Where-Object { $_.Name -eq 'ChatGPT' } | Select-Object -First 1
  if(-not $app){Fail-Step 'S2-10' 'ChatGPT Windows app is not registered in Start Apps'}
  Write-Host "[S2-10] Starting ChatGPT Windows app: $($app.AppID)"
  Start-Process explorer.exe -ArgumentList "shell:AppsFolder\$($app.AppID)"
  $deadline=(Get-Date).AddSeconds(10)
  do{
    Start-Sleep -Milliseconds 250
    if(Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue){Write-Host '[S2-10] PASS - ChatGPT running';return}
  }while((Get-Date)-lt$deadline)
  Fail-Step 'S2-10' 'ChatGPT launch was requested but no ChatGPT process appeared within 10 seconds'
}

function Test-ThemeRuntime(){
  $activePath=Join-Path $root 'theme\.runtime\active.json'
  if(-not (Test-Path -LiteralPath $activePath -PathType Leaf)){return $false}
  try{
    $active=Get-Content -LiteralPath $activePath -Raw | ConvertFrom-Json
    if(-not $active.port -or -not $active.watcherPid){return $false}
    $watcher=Get-CimInstance Win32_Process -Filter "ProcessId=$($active.watcherPid)" -ErrorAction SilentlyContinue
    if(-not $watcher -or -not $watcher.CommandLine -or $watcher.CommandLine.IndexOf('theme\src\watch.mjs',[System.StringComparison]::OrdinalIgnoreCase) -lt 0){return $false}
    $targets=Invoke-RestMethod -Uri "http://127.0.0.1:$($active.port)/json/list" -TimeoutSec 1
    return (@($targets).Count -gt 0 -and [bool](Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue))
  }catch{return $false}
}

function Start-ChatGPTExperience(){
  $themeEnabled=$true
  if($config.PSObject.Properties.Name -contains 'theme' -and $config.theme -and $config.theme.enabled -eq $false){$themeEnabled=$false}
  if(-not $themeEnabled){Start-NormalChatGPTApp;return}

  if(Test-ThemeRuntime){Write-Host '[S2-10] PASS - ChatGPT theme runtime already active';return}

  $selection='dark-red'
  if($config.PSObject.Properties.Name -contains 'theme' -and $config.theme.selection){$selection=[string]$config.theme.selection}
  $launcher=Join-Path $root 'theme\scripts\start-chatgpt-theme-changer.ps1'
  if(-not (Test-Path -LiteralPath $launcher -PathType Leaf)){Fail-Step 'S2-10' "Theme launcher not found: $launcher"}
  Write-Host "[S2-10] Starting ChatGPT with integrated theme: $selection"
  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $launcher -Theme $selection
  if($LASTEXITCODE -ne 0){Fail-Step 'S2-10' 'integrated ChatGPT theme launcher failed'}
  if(-not (Test-ThemeRuntime)){Fail-Step 'S2-10' 'theme launcher returned success but runtime validation failed'}
  Write-Host '[S2-10] PASS - ChatGPT + theme runtime active'
}

function Show-TunnelHealthDiagnostics(){
  Write-Host '[S2-09] ---- tunnel health diagnostics ----'
  $uris=@(
    'http://127.0.0.1:8080/healthz',
    'http://127.0.0.1:8080/readyz',
    'http://127.0.0.1:8080/health?details=true',
    'http://127.0.0.1:8080/health/mcp',
    'http://127.0.0.1:8080/health/control-plane'
  )
  foreach($uri in $uris){
    try{
      $response=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $uri
      Write-Host "[S2-09] $uri -> HTTP $($response.StatusCode)"
      if($response.Content){Write-Host $response.Content.Trim()}
    }catch{
      $status='request-failed'
      try{if($_.Exception.Response){$status='HTTP '+[int]$_.Exception.Response.StatusCode}}catch{}
      Write-Host "[S2-09] $uri -> $status : $($_.Exception.Message)"
    }
  }
  Write-Host '[S2-09] ---- end tunnel health diagnostics ----'
}

if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
if(-not (Test-Path $ConfigPath)){
  Write-Host '[S2-01] FAIL - local config not found.' -ForegroundColor Red
  Write-Host '         Copy config\spark-transport.example.json to config\spark-transport.local.json and edit allowedRoot/tunnel.id.'
  exit 2
}
$ConfigPath=(Resolve-Path $ConfigPath).Path
$env:SPARK_TRANSPORT_CONFIG=$ConfigPath
try{$config=Get-Content -Raw $ConfigPath | ConvertFrom-Json}catch{Fail-Step 'S2-01' "invalid JSON in local config: $($_.Exception.Message)"}
Write-Host "[S2-01] PASS - Config loaded: $ConfigPath"

Write-Host '[S2-02] Checking Node.js...'
& node --version
if($LASTEXITCODE -ne 0){Fail-Step 'S2-02' 'Node.js 20+ is required'}
Write-Host '[S2-02] PASS - Node.js available'

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

if($config.tunnel.enabled -eq $false){Write-Host '[S2-05] PASS - Tunnel disabled by config.';Start-ChatGPTExperience;Write-Host '[S2-11] PASS - Startup complete.';exit 0}
if(-not $config.tunnel.id -or $config.tunnel.id -like 'tunnel_x*'){Fail-Step 'S2-05' 'Set tunnel.id in local config'}

$keyFile=$config.tunnel.controlPlaneApiKeyFile
if(-not $keyFile){$keyFile='.runtime/secrets/control-plane-api-key.txt'}
$keyPath=Resolve-RepoRelative ([string]$keyFile)
if(-not (Test-Path $keyPath)){Fail-Step 'S2-05' "Tunnel key file not found: $keyPath"}
$keyPath=(Resolve-Path $keyPath).Path
$keyValue=(Get-Content -Raw $keyPath).Trim()
if(-not $keyValue){Fail-Step 'S2-05' "Tunnel key file is empty: $keyPath"}
$keyRef="file:$keyPath"
Write-Host "[S2-05] PASS - Tunnel key file: $keyPath (value hidden)"

$clientDir=$config.tunnel.clientDir
if(-not [System.IO.Path]::IsPathRooted($clientDir)){$clientDir=Join-Path $root $clientDir}
Write-Host "[S2-06] Checking tunnel-client: $clientDir"
& (Join-Path $root 'scripts\bootstrap-tunnel.ps1') -Version $config.tunnel.clientVersion -ClientDir $clientDir
if($LASTEXITCODE -ne 0){Fail-Step 'S2-06' 'tunnel-client bootstrap failed'}
$client=Join-Path $clientDir 'tunnel-client.exe'
if(-not (Test-Path $client)){Fail-Step 'S2-06' "tunnel-client.exe not found after bootstrap: $client"}
Write-Host "[S2-06] PASS - tunnel-client ready: $client"

$existingTunnelOwned=$false
$existingTunnelPidFile=Join-Path (Join-Path $root '.runtime') 'tunnel-client.pid'
if(Test-Path $existingTunnelPidFile){
  try{
    $existingTunnelPid=[int](Get-Content $existingTunnelPidFile | Select-Object -First 1)
    $existingTunnelProcess=Get-Process -Id $existingTunnelPid -ErrorAction Stop
    if($existingTunnelProcess.ProcessName -eq 'tunnel-client'){$existingTunnelOwned=$true}
  }catch{}
}
try{
  $ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz'
  if($ready.Content.Trim() -eq 'ready'){
    if(-not $existingTunnelOwned){Fail-Step 'S2-07' 'Port 8080 reports ready but is not owned by the SPARK tunnel PID file; refusing to reuse an unknown listener'}
    Write-Host "[S2-07] PASS - Existing SPARK tunnel ready, PID=$existingTunnelPid; profile doctor skipped to avoid health-listener port collision."
    Start-ChatGPTExperience
    Write-Host '[S2-11] PASS - Startup complete.'
    exit 0
  }
}catch{
  if($_.Exception.Message.StartsWith('[S2-07]')){throw}
}

$profile=$config.tunnel.profile
$runtime=Join-Path $root '.runtime';New-Item -ItemType Directory -Force $runtime|Out-Null
$profileDir=Join-Path $runtime 'tunnel-profiles';New-Item -ItemType Directory -Force $profileDir|Out-Null
$profilePath=Join-Path $profileDir ($profile + '.yaml')
Write-Host "[S2-07] Checking tunnel profile: $profile"
Write-Host "[S2-07] SPARK profile directory: $profileDir"

if(Test-Path $profilePath){
  & $client doctor --profile $profile --profile-dir $profileDir --explain *> (Join-Path $runtime 'tunnel-doctor.log')
  if($LASTEXITCODE -ne 0){
    $backupDir=Join-Path $runtime 'tunnel-profile-backups';New-Item -ItemType Directory -Force $backupDir|Out-Null
    $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupPath=Join-Path $backupDir ($profile + '-' + $stamp + '.yaml')
    Copy-Item -LiteralPath $profilePath -Destination $backupPath -Force
    if(-not (Test-Path $backupPath)){Fail-Step 'S2-07' 'failed to create tunnel profile recovery backup'}
    Write-Host "[S2-07] Existing SPARK profile failed doctor; backup verified: $backupPath"
    Write-Host '[S2-07] Reinitializing SPARK-owned profile...'
    & $client init --force --sample sample_mcp_remote_no_auth --profile $profile --profile-dir $profileDir --tunnel-id $config.tunnel.id --mcp-server-url $config.tunnel.localMcpUrl --control-plane-api-key-ref $keyRef
    if($LASTEXITCODE -ne 0){Fail-Step 'S2-07' 'tunnel profile reinit failed'}
  }
}else{
  Write-Host '[S2-07] SPARK-owned profile not found; initializing no-auth MCP profile...'
  & $client init --sample sample_mcp_remote_no_auth --profile $profile --profile-dir $profileDir --tunnel-id $config.tunnel.id --mcp-server-url $config.tunnel.localMcpUrl --control-plane-api-key-ref $keyRef
  if($LASTEXITCODE -ne 0){Fail-Step 'S2-07' 'tunnel profile init failed'}
}

& $client doctor --profile $profile --profile-dir $profileDir --explain *> (Join-Path $runtime 'tunnel-doctor.log')
if($LASTEXITCODE -ne 0){Fail-Step 'S2-07' 'tunnel doctor failed'}
Write-Host '[S2-07] PASS - tunnel profile ready'

try{
  $ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz'
  if($ready.Content.Trim() -eq 'ready'){Write-Host '[S2-08] PASS - Tunnel already ready.';Start-ChatGPTExperience;Write-Host '[S2-11] PASS - Startup complete.';exit 0}
}catch{}

Write-Host '[S2-08] Starting tunnel-client with direct CreateProcess semantics...'
$psi=New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName=$client
$psi.Arguments="run --profile `"$profile`" --profile-dir `"$profileDir`""
$psi.WorkingDirectory=$root
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$true
$proc=New-Object System.Diagnostics.Process
$proc.StartInfo=$psi
try{
  $started=$proc.Start()
  if(-not $started){Fail-Step 'S2-08' 'tunnel-client process did not start'}
}catch{
  Fail-Step 'S2-08' "tunnel-client launch failed: $($_.Exception.Message)"
}
Set-Content -Encoding ascii (Join-Path $runtime 'tunnel-client.pid') $proc.Id
Write-Host "[S2-08] PASS - tunnel-client started, PID=$($proc.Id)"

$readyTimeoutSeconds=60
Write-Host "[S2-09] Waiting for tunnel /readyz (up to $readyTimeoutSeconds seconds)..."
$deadline=(Get-Date).AddSeconds($readyTimeoutSeconds)
do{
  Start-Sleep -Milliseconds 500
  if($proc.HasExited){
    Show-TunnelHealthDiagnostics
    Fail-Step 'S2-09' "tunnel-client exited before readyz, exitCode=$($proc.ExitCode). Check .runtime\tunnel-doctor.log and run tunnel-client.exe run --profile $profile --profile-dir $profileDir manually for console diagnostics."
  }
  try{
    $ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8080/readyz'
    if($ready.Content.Trim() -eq 'ready'){Write-Host "[S2-09] PASS - tunnel ready (PID $($proc.Id))";Start-ChatGPTExperience;Write-Host '[S2-11] PASS - Startup complete.';exit 0}
  }catch{}
}while((Get-Date)-lt$deadline)

Show-TunnelHealthDiagnostics
if(-not $proc.HasExited){
  Write-Host "[S2-09] INFO - tunnel-client remains running as PID $($proc.Id) so readiness diagnostics are preserved. Run SPARK_Transport.cmd stop to clean it up."
}
Fail-Step 'S2-09' "tunnel-client did not become ready within $readyTimeoutSeconds seconds"
