param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\ToolStock Pro"
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = [Environment]::ExpandEnvironmentVariables($InstallRoot)
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
Copy-Item -Path (Join-Path $sourceRoot "src"), (Join-Path $sourceRoot "windows"), (Join-Path $sourceRoot "scripts"), (Join-Path $sourceRoot "package.json"), (Join-Path $sourceRoot "package-lock.json") -Destination $targetRoot -Recurse -Force

$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "ToolStock Pro.lnk"
$launcher = Join-Path $targetRoot "windows\start-toolstock.cmd"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $targetRoot
$shortcut.Description = "ToolStock Pro para Windows"
$shortcut.Save()
Write-Output "ToolStock Pro instalado para este usuario en $targetRoot"
Write-Output "Acceso directo creado en $shortcutPath"
