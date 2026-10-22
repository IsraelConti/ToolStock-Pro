@echo off
setlocal
set "SCRIPT=%~dp0installer\Instalar.ps1"
if not exist "%SCRIPT%" (
  echo No se encuentra el instalador. Extrae todo el ZIP antes de ejecutarlo.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
if errorlevel 1 pause
endlocal
