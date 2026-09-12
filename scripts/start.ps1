param(
    [Parameter(Mandatory=$true)][string]$Root,
    [int]$Port = 8765
)
$env:SPARK_TRANSPORT_ROOT = $Root
$env:SPARK_TRANSPORT_PORT = "$Port"
npm run daemon:start
