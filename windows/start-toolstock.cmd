@echo off
setlocal
set "TOOLSTOCK_ROOT=%~dp0.."
pushd "%TOOLSTOCK_ROOT%"
where node >nul 2>nul
if errorlevel 1 (
  echo ToolStock PC necesita Node.js 20 o posterior.
  echo Instala Node.js o utiliza el paquete portable preparado por el distribuidor.
  popd
  exit /b 1
)
if not exist "dist\index.html" (
  call npm run build
  if errorlevel 1 (
    popd
    exit /b 1
  )
)
node windows\desktop-session.mjs
set "EXIT_CODE=%errorlevel%"
popd
exit /b %EXIT_CODE%
