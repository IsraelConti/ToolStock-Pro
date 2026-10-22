Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma
Name "MaintenPro PC"
OutFile "${OUTPUT}"
Icon "..\maintenpro-icon.ico"
BrandingText "MaintenPro"
VIProductVersion "1.2.9.0"
VIAddVersionKey /LANG=1034 "ProductName" "MaintenPro PC"
VIAddVersionKey /LANG=1034 "FileDescription" "Instalador de MaintenPro para Windows"
VIAddVersionKey /LANG=1034 "FileVersion" "1.2.9"
VIAddVersionKey /LANG=1034 "LegalCopyright" "MaintenPro · Israel Continente Nieto"
!include "MUI2.nsh"
!define MUI_WELCOMEPAGE_TITLE "MaintenPro para Windows"
!define MUI_WELCOMEPAGE_TEXT "Instala MaintenPro para tu usuario, con un acceso directo en el escritorio.$\r$\n$\r$\nNecesitas Google Chrome. El acceso completo al PC está incluido con tu suscripción activa de Android y la misma cuenta de Google.$\r$\n$\r$\nNo se necesitan permisos de administrador."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "Spanish"

Section "MaintenPro PC"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\MaintenPro"
  File /r "${STAGE}\*"
  DetailPrint "Instalando MaintenPro en el perfil del usuario…"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\MaintenPro\installer\Instalar.ps1"'
  Pop $0
  StrCmp $0 "0" installed
    MessageBox MB_OK|MB_ICONSTOP "No se completó la instalación. Comprueba que Google Chrome esté instalado y vuelve a intentarlo. El registro de esta ventana muestra el detalle."
    SetErrorLevel 1
    Abort
  installed:
    DetailPrint "MaintenPro instalado. Puedes abrirlo desde el escritorio."
SectionEnd
