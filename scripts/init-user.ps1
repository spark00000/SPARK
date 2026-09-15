param([string]$ConfigPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root '.runtime\config\spark.local.json'}
$ConfigPath=[System.IO.Path]::GetFullPath($ConfigPath)
$example=Join-Path $root 'modules\transport\config\spark.example.json'
$authCli=Join-Path $root 'modules\transport\src\auth-cli.mjs'
if(Test-Path -LiteralPath $ConfigPath -PathType Leaf){throw "Config already exists; refusing to overwrite: $ConfigPath"}
if(-not (Test-Path -LiteralPath $example -PathType Leaf)){throw "Example config not found: $example"}
if(-not (Get-Command node.exe -ErrorAction SilentlyContinue)){throw 'Node.js is required'}

$generatedRaw=& node.exe $authCli generate --json
if($LASTEXITCODE -ne 0){throw 'SPARK access-key generation failed'}
$generated=$generatedRaw | ConvertFrom-Json
if(-not $generated.token -or -not $generated.sha256){throw 'SPARK access-key generation returned incomplete data'}

$config=Get-Content -LiteralPath $example -Raw | ConvertFrom-Json
$config.transport.auth.mode='bearer'
$config.transport.auth.bearerTokenSha256=[string]$generated.sha256
$directory=Split-Path -Parent $ConfigPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$json=$config | ConvertTo-Json -Depth 32
[System.IO.File]::WriteAllText($ConfigPath,$json+[Environment]::NewLine,[System.Text.UTF8Encoding]::new($false))
if(-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)){throw 'Config creation failed'}

Write-Host '[INIT-01] PASS - Private config created:' $ConfigPath
Write-Host '[INIT-02] PASS - 256-bit SPARK access key generated; only its SHA-256 digest was stored in config.'
Write-Host ''
Write-Host 'SPARK Access Key - copy this once into the ChatGPT app Access token/API key field:' -ForegroundColor Yellow
Write-Host ([string]$generated.token) -ForegroundColor Yellow
Write-Host ''
Write-Host 'Next:'
Write-Host '  1. Edit transport.allowedRoot and tunnel.id in the private config.'
Write-Host '  2. Put the OpenAI tunnel Runtime API key in the configured local key file.'
Write-Host '  3. Configure the ChatGPT custom app authentication as Access token/API key with Bearer scheme.'
Write-Host '  4. Paste the SPARK Access Key above into that app connection.'
Write-Host '  5. Run SPARK.cmd start.'
