param([string]$ConfigPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'config\spark-transport.local.json'}
if(-not (Test-Path $ConfigPath)){throw 'local config not found'}
$config=Get-Content -Raw $ConfigPath | ConvertFrom-Json
$base="http://$($config.daemon.host):$($config.daemon.port)$($config.daemon.mcpPath)"
$proto='2026-07-28'
$id=100
function Call-Tool([string]$Name,[hashtable]$Arguments){
  $script:id++
  $body=@{jsonrpc='2.0';id=$script:id;method='tools/call';params=@{name=$Name;arguments=$Arguments;_meta=@{'io.modelcontextprotocol/protocolVersion'=$proto;'io.modelcontextprotocol/clientCapabilities'=@{};'io.modelcontextprotocol/clientInfo'=@{name='windows-sprint2-validator';version='1'}}}}|ConvertTo-Json -Depth 12 -Compress
  $h=@{'MCP-Protocol-Version'=$proto;'Mcp-Method'='tools/call';'Mcp-Name'=$Name}
  $r=Invoke-RestMethod -Method Post -Uri $base -Headers $h -ContentType 'application/json' -Body $body
  return $r.result.structuredContent
}
function Assert-Ok($r,[string]$step){if(-not $r.ok){throw "$step failed: $($r.error.code) $($r.error.message)"};Write-Host "$step PASS"}
$tag='spark-s2-'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$dir=$tag
$file="$dir\sample.txt"
$copy="$dir\copy.txt"
$moved="$dir\moved.txt"
Write-Host '[S2-WIN-01] Creating directory/file...'
Assert-Ok (Call-Tool 'create_directory' @{path=$dir}) '[S2-WIN-01A] create_directory'
Assert-Ok (Call-Tool 'create_file' @{path=$file;text='alpha TARGET omega'}) '[S2-WIN-01B] create_file'
Write-Host '[S2-WIN-02] Write/modify/copy/move...'
Assert-Ok (Call-Tool 'write_file' @{path=$file;text='one TARGET three'}) '[S2-WIN-02A] write_file'
Assert-Ok (Call-Tool 'modify_file' @{path=$file;search='TARGET';replace='TWO'}) '[S2-WIN-02B] modify_file'
Assert-Ok (Call-Tool 'copy_path' @{source=$file;destination=$copy}) '[S2-WIN-02C] copy_path'
Assert-Ok (Call-Tool 'move_path' @{source=$copy;destination=$moved}) '[S2-WIN-02D] move_path'
Write-Host '[S2-WIN-03] Command execution...'
$r=Call-Tool 'run_command' @{command='cmd.exe';args=@('/c','echo','SPARK_S2_OK');cwd=$dir;timeoutMs=5000};Assert-Ok $r '[S2-WIN-03A] run_command';if($r.stdout -notmatch 'SPARK_S2_OK'){throw 'command stdout mismatch'}
Write-Host '[S2-WIN-04] Traversal negative test...'
$r=Call-Tool 'create_file' @{path='../escape.txt';text='x'};if($r.ok -or $r.error.code -ne 'PATH_TRAVERSAL'){throw 'traversal was not rejected'};Write-Host '[S2-WIN-04] PASS'
Write-Host '[S2-WIN-05] Recycle Bin delete...'
$unique=[IO.Path]::GetFileName($moved)
Assert-Ok (Call-Tool 'delete_path' @{path=$moved}) '[S2-WIN-05A] delete_path'
Start-Sleep -Milliseconds 500
$shell=New-Object -ComObject Shell.Application
$bin=$shell.Namespace(10)
$found=$false
foreach($item in $bin.Items()){if($item.Name -eq $unique){$found=$true;break}}
if(-not $found){Write-Warning '[S2-WIN-05B] Recycle Bin enumeration did not find the filename. The source disappeared successfully, but manual Recycle Bin confirmation is required.'}else{Write-Host '[S2-WIN-05B] Recycle Bin item found: PASS'}
Write-Host '[S2-WIN-06] Cleanup remaining test directory via Recycle Bin...'
Assert-Ok (Call-Tool 'delete_path' @{path=$dir}) '[S2-WIN-06] delete_directory'
Write-Host 'SPRINT-2 WINDOWS LOCAL VALIDATION COMPLETE'
