#Requires -Version 5.1
param([switch]$NoLaunch)
$ErrorActionPreference = 'Stop'

function Find-Chrome {
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($root in @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
    if ($root) {
      $candidates.Add((Join-Path $root 'Google\Chrome\Application\chrome.exe'))
    }
  }
  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) {
      return [System.IO.Path]::GetFullPath($path)
    }
  }
  foreach ($key in @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe'
  )) {
    $item = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
    $registered = $item.'(default)'
    if ($registered -and (Test-Path -LiteralPath $registered)) {
      return [System.IO.Path]::GetFullPath($registered)
    }
  }
  return $null
}

function Copy-AppDirectory {
  param([string]$From, [string]$To)
  New-Item -ItemType Directory -Path $To -Force | Out-Null
  Get-ChildItem -LiteralPath $From -Force | ForEach-Object {
    $target = Join-Path $To $_.Name
    if ($_.PSIsContainer) {
      Copy-AppDirectory -From $_.FullName -To $target
    } else {
      Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
  }
}

function New-MaintenProShortcut {
  param(
    [string]$ShortcutPath,
    [string]$ChromePath,
    [string]$AppUri,
    [string]$WorkingDirectory,
    [string]$IconPath
  )
  $folder = Split-Path -Parent $ShortcutPath
  if (-not (Test-Path -LiteralPath $folder)) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
  }
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $shortcut.Arguments = "`"$(Join-Path $WorkingDirectory 'INICIAR_MAINTENPRO_PC.vbs')`""
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.IconLocation = "$IconPath,0"
  $shortcut.Description = 'MaintenPro para PC'
  $shortcut.Save()
}

try {
  $packageRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
  $sourceApp = [System.IO.Path]::GetFullPath((Join-Path $packageRoot 'app'))
  $packagePrefix = $packageRoot.TrimEnd('\') + '\'
  if (-not $sourceApp.StartsWith($packagePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'La carpeta de la aplicación queda fuera del paquete extraído.'
  }
  foreach ($required in @('index.html', 'app.js', 'desktop.js', 'maintenpro-icon.ico', 'desktop-session.mjs', 'INICIAR_MAINTENPRO_PC.vbs', 'runtime\node.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceApp $required))) {
      throw "Falta $required. Extrae todo el ZIP antes de instalar."
    }
  }

  $chrome = Find-Chrome
  if (-not $chrome) {
    throw 'No se encontró Google Chrome. Instálalo para el usuario actual y vuelve a ejecutar el instalador.'
  }

  $installRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($env:LOCALAPPDATA, 'Programs', 'MaintenPro PC'))
  $localPrograms = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($env:LOCALAPPDATA, 'Programs'))
  $programsPrefix = $localPrograms.TrimEnd('\') + '\'
  if (-not $installRoot.StartsWith($programsPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'La ruta de instalación no pertenece al perfil del usuario actual.'
  }

  $destinationApp = [System.IO.Path]::GetFullPath((Join-Path $installRoot 'app'))
  if (Test-Path -LiteralPath $destinationApp) {
    $backup = Join-Path $installRoot ('app-anterior-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Copy-AppDirectory -From $destinationApp -To $backup
  }
  # Release only this application's executable before replacing its runtime.
  $ownedNode = Join-Path $destinationApp 'runtime\node.exe'
  $ownedScript = Join-Path $destinationApp 'desktop-session.mjs'
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -eq $ownedNode -and $_.CommandLine -like ('*' + $ownedScript + '*')
  } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction Stop }
  Copy-AppDirectory -From $sourceApp -To $destinationApp
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Desinstalar.ps1') -Destination (Join-Path $installRoot 'Desinstalar.ps1') -Force

  $uri = 'http://127.0.0.1:41791/'
  $iconPath = Join-Path $destinationApp 'maintenpro-icon.ico'
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'MaintenPro PC.lnk'
  $startShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'MaintenPro PC.lnk'
  New-MaintenProShortcut -ShortcutPath $desktopShortcut -ChromePath $chrome -AppUri $uri -WorkingDirectory $destinationApp -IconPath $iconPath
  New-MaintenProShortcut -ShortcutPath $startShortcut -ChromePath $chrome -AppUri $uri -WorkingDirectory $destinationApp -IconPath $iconPath

  $uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MaintenProPC'
  $uninstallCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $installRoot 'Desinstalar.ps1')`""
  New-Item -Path $uninstallKey -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name DisplayName -Value 'MaintenPro PC' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name Publisher -Value 'MaintenPro' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $installRoot -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value $iconPath -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name UninstallString -Value $uninstallCommand -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name QuietUninstallString -Value $uninstallCommand -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null

  Write-Host "MaintenPro PC quedó instalado para el usuario actual."
  Write-Host "Acceso directo: $desktopShortcut"
  Write-Host "Si usabas la vista previa anterior, exporta su copia JSON e importala en esta version. Los datos anteriores no se borran."
  if (-not $NoLaunch) {
    & (Join-Path $env:WINDIR 'System32\wscript.exe') (Join-Path $destinationApp 'INICIAR_MAINTENPRO_PC.vbs')
  }
  exit 0
} catch {
  Write-Host "No se pudo instalar MaintenPro PC durante esta operación: $($_.Exception.Message)"
  exit 1
}
