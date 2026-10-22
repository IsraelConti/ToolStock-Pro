#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

function Remove-IfPresent {
  param([string]$Path)
  if ($Path -and (Test-Path -LiteralPath $Path)) {
    Remove-Item -LiteralPath $Path -Force
  }
}

$installRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\MaintenPro PC'))
$programsRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs'))
$programsPrefix = $programsRoot.TrimEnd('\') + '\'
if (-not $installRoot.StartsWith($programsPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'La ruta de instalación no pertenece al perfil del usuario actual.'
}

# Stop only the runtime installed by MaintenPro before removing its files.
$ownedNode = Join-Path $installRoot 'app\runtime\node.exe'
$ownedScript = Join-Path $installRoot 'app\desktop-session.mjs'
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
  $_.ExecutablePath -eq $ownedNode -and $_.CommandLine -like ('*' + $ownedScript + '*')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction Stop }

Remove-IfPresent (Join-Path ([Environment]::GetFolderPath('Desktop')) 'MaintenPro PC.lnk')
Remove-IfPresent (Join-Path ([Environment]::GetFolderPath('Programs')) 'MaintenPro PC.lnk')

$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MaintenProPC'
if (Test-Path -LiteralPath $uninstallKey) {
  Remove-Item -LiteralPath $uninstallKey -Recurse -Force
}

if (Test-Path -LiteralPath $installRoot) {
  Remove-Item -LiteralPath $installRoot -Recurse -Force
}

Write-Host "Se quitó MaintenPro PC de este usuario."
Write-Host "Los registros guardados por Chrome no se borran desde este desinstalador."
Write-Host "Las copias JSON exportadas siguen en la carpeta donde se guardaron."
