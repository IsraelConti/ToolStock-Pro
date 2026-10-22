@echo off
if not exist "%~dp0runtime\node.exe" (
  echo La instalacion esta incompleta. Extrae e instala todo el paquete de MaintenPro.
  pause
  exit /b 1
)
"%~dp0runtime\node.exe" "%~dp0desktop-session.mjs"
