$ErrorActionPreference = 'Stop'
$stageRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourceApp = Join-Path $stageRoot 'app'
$installRoot = [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Programs', 'MaintenPro PC')
$targetApp = Join-Path $installRoot 'app'
$uninstallRoot = Join-Path $installRoot 'Uninstall\MaintenProPC'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MaintenProPC'

function Find-Chrome {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  if ($candidates) { return $candidates[0] }
  $command = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return $null
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $sourceApp 'index.html'))) {
    throw 'No se encuentra app\index.html. Extrae el ZIP completo antes de instalar.'
  }
  $chrome = Find-Chrome
  if (-not $chrome) { throw 'Google Chrome no está instalado en este ordenador.' }
  New-Item -ItemType Directory -Path $targetApp -Force | Out-Null
  Copy-Item -Path (Join-Path $sourceApp '*') -Destination $targetApp -Recurse -Force
  New-Item -ItemType Directory -Path $uninstallRoot -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Desinstalar.ps1') -Destination (Join-Path $uninstallRoot 'Desinstalar.ps1') -Force

  $indexPath = [System.IO.Path]::GetFullPath((Join-Path $targetApp 'index.html'))
  $appUrl = ([System.Uri]::new($indexPath)).AbsoluteUri
  $icon = Join-Path $targetApp 'maintenpro-icon.ico'
  $shell = New-Object -ComObject WScript.Shell
  $desktop = [Environment]::GetFolderPath('Desktop')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\MaintenPro'
  New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
  foreach ($shortcutPath in @((Join-Path $desktop 'MaintenPro PC.lnk'), (Join-Path $startMenu 'MaintenPro PC.lnk'))) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $chrome
    $shortcut.Arguments = "--app=`"$appUrl`""
    $shortcut.WorkingDirectory = $targetApp
    if (Test-Path -LiteralPath $icon) { $shortcut.IconLocation = "$icon,0" }
    $shortcut.Description = 'MaintenPro para PC'
    $shortcut.Save()
  }

  New-Item -Path $uninstallKey -Force | Out-Null
  Set-ItemProperty -Path $uninstallKey -Name DisplayName -Value 'MaintenPro PC'
  Set-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value '1.0'
  Set-ItemProperty -Path $uninstallKey -Name Publisher -Value 'MaintenPro'
  Set-ItemProperty -Path $uninstallKey -Name UninstallString -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallRoot\Desinstalar.ps1`""
  Set-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -Type DWord
  Set-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -Type DWord
  Start-Process -FilePath $chrome -ArgumentList "--app=`"$appUrl`""
  Write-Host 'MaintenPro PC se ha instalado para este usuario.'
} catch {
  Write-Error "No se pudo instalar MaintenPro PC durante la instalación: $($_.Exception.Message)"
  exit 1
}
