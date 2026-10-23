param(
  [Parameter(Mandatory = $true)][string]$AabPath,
  [Parameter(Mandatory = $true)][string]$KeystorePath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$Alias = $env:TOOLSTOCK_KEY_ALIAS,
  [string]$StorePassword = $env:TOOLSTOCK_STORE_PASSWORD,
  [string]$KeyPassword = $env:TOOLSTOCK_KEY_PASSWORD
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $AabPath)) { throw "No existe el AAB: $AabPath" }
if (-not (Test-Path -LiteralPath $KeystorePath)) { throw "No existe el keystore: $KeystorePath" }
if ([string]::IsNullOrWhiteSpace($Alias) -or [string]::IsNullOrWhiteSpace($StorePassword)) { throw "Faltan alias o contraseña del keystore" }
if ([string]::IsNullOrWhiteSpace($KeyPassword)) { $KeyPassword = $StorePassword }

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) { New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null }
& jarsigner -keystore $KeystorePath -storetype PKCS12 -storepass $StorePassword -keypass $KeyPassword -signedjar $OutputPath $AabPath $Alias
if ($LASTEXITCODE -ne 0) { throw "jarsigner no pudo firmar el AAB" }
& jarsigner -verify -strict $OutputPath
if ($LASTEXITCODE -ne 0) { throw "La verificación de firma falló" }
Write-Output "AAB firmado y verificado: $OutputPath"
