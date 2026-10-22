Option Explicit
Dim shell, fs, folder, nodePath, scriptPath
Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
folder = fs.GetParentFolderName(WScript.ScriptFullName)
nodePath = fs.BuildPath(folder, "runtime\node.exe")
scriptPath = fs.BuildPath(folder, "desktop-session.mjs")
If Not fs.FileExists(nodePath) Then
  MsgBox "Instalacion incompleta: vuelve a extraer e instalar MaintenPro.", 16, "MaintenPro PC"
  WScript.Quit 1
End If
shell.CurrentDirectory = folder
shell.Run Chr(34) & nodePath & Chr(34) & " " & Chr(34) & scriptPath & Chr(34), 0, False
