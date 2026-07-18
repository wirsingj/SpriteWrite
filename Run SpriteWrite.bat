@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=%SPRITEWRITE_PORT%"
if not defined PORT set "PORT=5173"

set "SPRITEWRITE_PORT=%PORT%"
echo.
echo Starting SpriteWrite on port %PORT%...
echo.
echo Leave this window open while using the app.
echo Press Ctrl+C here when you want to stop the dev server.
echo.

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%"
npm run dev -- --port %PORT% --host 127.0.0.1 --strictPort
