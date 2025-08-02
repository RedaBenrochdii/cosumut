Set shell = CreateObject("WScript.Shell")

' Chemin de base = dossier où est placé ce script
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Backend
backendPath = scriptDir & "\ncosumar-main\backend"
shell.CurrentDirectory = backendPath
shell.Run "cmd /c start /min cmd /c npm run dev", 0

' Frontend
frontendPath = scriptDir & "\ncosumar-main\src"
shell.CurrentDirectory = frontendPath
shell.Run "cmd /c start /min cmd /c npm run dev", 0
