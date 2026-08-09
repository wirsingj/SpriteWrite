@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=%~1"
set "REPO=%CD%"

if not defined PORT goto :StopAll

:StopPort
powershell -NoProfile -ExecutionPolicy Bypass -Command "$repo='%REPO%'; $port='%PORT%'; $procs=Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { (($_.CommandLine -like '*vite*' -and $_.CommandLine -like \"*--port $port*\") -or $_.CommandLine -like '*api/server.ts*' -or $_.CommandLine -like '*start-spritewrite.mjs*') -and $_.CommandLine -like \"*$repo*\" }; if ($procs) { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Output (\"Stopped {0} process(es) for SpriteWrite/API.\" -f @($procs).Count) } else { Write-Output \"No matching SpriteWrite dev/API process found.\" }"
goto :End

:StopAll
powershell -NoProfile -ExecutionPolicy Bypass -Command "$repo='%REPO%'; $procs=Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { ($_.CommandLine -like '*vite*' -or $_.CommandLine -like '*api/server.ts*' -or $_.CommandLine -like '*start-spritewrite.mjs*') -and $_.CommandLine -like \"*$repo*\" }; if ($procs) { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Output (\"Stopped {0} SpriteWrite dev/API process(es).\" -f @($procs).Count) } else { Write-Output 'No matching SpriteWrite dev/API process found.' }"

:End
