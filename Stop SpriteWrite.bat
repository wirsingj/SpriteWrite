@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=%~1"
set "REPO=%CD%"

if not defined PORT goto :StopAll

:StopPort
powershell -NoProfile -ExecutionPolicy Bypass -Command "$repo='%REPO%'; $port='%PORT%'; $procs=Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*vite*' -and $_.CommandLine -like \"*$repo*\" -and $_.CommandLine -like \"*--port $port*\" }; if ($procs) { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Output (\"Stopped {0} process(es) on port {1}.\" -f @($procs).Count, $port) } else { Write-Output \"No matching SpriteWrite dev process found on port ${port}.\" }"
goto :End

:StopAll
powershell -NoProfile -ExecutionPolicy Bypass -Command "$repo='%REPO%'; $procs=Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*vite*' -and $_.CommandLine -like \"*$repo*\" }; if ($procs) { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Output (\"Stopped {0} process(es).\" -f @($procs).Count) } else { Write-Output 'No matching SpriteWrite dev process found.' }"

:End
