$captureRoot = Split-Path -Parent $PSScriptRoot
$captureScript = Join-Path $PSScriptRoot 'capture.mjs'
$capturePidFile = Join-Path $captureRoot '.capture.pid'
if (Test-Path -LiteralPath $capturePidFile) {
  $captureExisting = Get-Process -Id (Get-Content -LiteralPath $capturePidFile) -ErrorAction SilentlyContinue
  if ($captureExisting -and $captureExisting.ProcessName -eq 'node') { exit 0 }
}
$captureProcess = Start-Process -FilePath 'node.exe' -ArgumentList @(('"' + $captureScript + '"'), '--watch') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $captureRoot '.capture-errors.log')
$captureProcess.Id | Set-Content -LiteralPath $capturePidFile
