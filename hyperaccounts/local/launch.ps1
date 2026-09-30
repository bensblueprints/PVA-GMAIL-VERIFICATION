$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioUrl = 'http://127.0.0.1:4371/'
try {
    $studioHealth = Invoke-RestMethod -Uri ($studioUrl + 'api/studio/health') -TimeoutSec 2
    if ($studioHealth.application -eq 'HyperAccounts') { Start-Process $studioUrl; exit }
} catch { }
if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'dist\client\index.html'))) { throw 'HyperAccounts must be built first. Run npm run build in the app folder.' }
$studioNode = (Get-Command node.exe -ErrorAction Stop).Source
$studioScript = Join-Path $PSScriptRoot 'server.mjs'
Start-Process -FilePath $studioNode -ArgumentList ('"' + $studioScript + '"') -WorkingDirectory $studioRoot -WindowStyle Hidden
for ($studioAttempt = 0; $studioAttempt -lt 20; $studioAttempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $studioHealth = Invoke-RestMethod -Uri ($studioUrl + 'api/studio/health') -TimeoutSec 2
        if ($studioHealth.application -eq 'HyperAccounts') { Start-Process $studioUrl; exit }
    } catch { }
}
throw 'HyperAccounts did not start. Check that port 4371 is available.'
