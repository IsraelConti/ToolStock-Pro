param([Parameter(Mandatory=$true)][string]$InstallerPath)
$ErrorActionPreference = 'Stop'
$installed = Join-Path $env:LOCALAPPDATA 'Programs\MaintenPro PC\app'
$nodePath = Join-Path $installed 'runtime\node.exe'
$installerProcess = $null
function Stop-OwnBroker {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -eq $nodePath -and $_.CommandLine -like '*desktop-session.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
try {
  $markerDir = Join-Path $env:LOCALAPPDATA 'MaintenPro\Session'
  New-Item -ItemType Directory -Path $markerDir -Force | Out-Null
  $marker = Join-Path $markerDir 'installer-lifecycle-marker.txt'
  Set-Content -LiteralPath $marker -Value 'existing-user-data' -Encoding ASCII
  Stop-OwnBroker
  $installerProcess = Start-Process -FilePath (Resolve-Path $InstallerPath) -ArgumentList '/S' -PassThru
  if (-not $installerProcess.WaitForExit(60000)) { throw 'Silent installation did not finish within 60 seconds.' }
  $installerProcess.Refresh()
  if ($installerProcess.ExitCode -ne 0) { throw ('Installer exit code: ' + $installerProcess.ExitCode) }
  foreach ($file in @('index.html','app.js','desktop-session.mjs','maintenpro.runtime.json','INICIAR_MAINTENPRO_PC.vbs','runtime\node.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $installed $file))) { throw ('Missing installed file: ' + $file) }
  }
  if ((Get-Content -LiteralPath $marker -Raw).Trim() -ne 'existing-user-data') { throw 'Existing user data changed.' }
  $runtime = Get-Content -LiteralPath (Join-Path $installed 'runtime\runtime-manifest.json') -Raw | ConvertFrom-Json
  if ((Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $runtime.nodeExeSha256) { throw 'Installed runtime checksum mismatch.' }
  $config = Get-Content -LiteralPath (Join-Path $installed 'maintenpro.runtime.json') -Raw | ConvertFrom-Json
  if (-not $config.desktopClientId -or -not $config.desktopClientSecret -or $config.entitlementBase -ne 'https://maintenpro-icapps.floot.app/_api') { throw 'Installed configuration missing.' }
  $unexpected = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $nodePath }
  if ($unexpected) { throw 'The silent installer unexpectedly started the long-running broker.' }
  Write-Output 'PASS: silent installation exits, files and runtime verify, existing user data remains, no broker holds the installer open.'
  $vbs = Join-Path $installed 'INICIAR_MAINTENPRO_PC.vbs'
  Start-Process -FilePath (Join-Path $env:WINDIR 'SysWOW64\wscript.exe') -ArgumentList ('"' + $vbs + '"') -WorkingDirectory $installed | Out-Null
  $healthy = $false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri 'http://127.0.0.1:41791/health' -TimeoutSec 1
      if ($health.app -eq 'maintenpro.pc' -and $health.version -eq '1.2.9') { $healthy=$true; break }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (-not $healthy) { throw 'Installed launcher did not start the broker.' }
  Write-Output 'PASS: installed launcher starts the native Windows broker.'
} finally {
  Stop-OwnBroker
  if ($installerProcess -and -not $installerProcess.HasExited) { Stop-Process -Id $installerProcess.Id -Force -ErrorAction SilentlyContinue }
}
