$ErrorActionPreference = 'Stop'
$installRoot = [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Programs', 'MaintenPro PC')
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MaintenProPC'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'MaintenPro PC.lnk'
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\MaintenPro'
try {
  Remove-Item -LiteralPath $desktopShortcut -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $startMenu -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $uninstallKey -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $installRoot) {
    Remove-Item -LiteralPath $installRoot -Recurse -Force
  }
  Write-Host 'MaintenPro PC se ha desinstalado. Los datos guardados en el perfil de Google Chrome no se borran desde este desinstalador.'
} catch {
  Write-Error "No se pudo desinstalar MaintenPro PC: $($_.Exception.Message)"
  exit 1
}
