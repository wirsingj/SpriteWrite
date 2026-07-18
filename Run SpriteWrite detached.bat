@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=%SPRITEWRITE_PORT%"
if not defined PORT set "PORT=5173"

set "SPRITEWRITE_PORT=%PORT%"
set "SPRITEWRITE_DEV_LOG=%CD%\spritewrite-dev.log"

echo.
echo Starting SpriteWrite in background on port %PORT%...
echo.
if exist "%SPRITEWRITE_DEV_LOG%" del "%SPRITEWRITE_DEV_LOG%" >nul 2>&1
echo.
echo Use task manager to stop this `npm run dev` session when done.
echo Debug log: %SPRITEWRITE_DEV_LOG%
echo.

start "" /B cmd /c "npm run dev -- --port %PORT% --host 127.0.0.1 --strictPort > spritewrite-dev.log 2>&1"
ping -n 2 127.0.0.1 >nul
