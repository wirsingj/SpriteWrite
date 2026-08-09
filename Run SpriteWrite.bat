@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=%SPRITEWRITE_PORT%"
if not defined PORT set "PORT=5173"

set "SPRITEWRITE_PORT=%PORT%"
if not defined SPRITEWRITE_API_PORT set /A SPRITEWRITE_API_PORT=%PORT% + 1
if "%SPRITEWRITE_API_PORT%"=="%PORT%" (
  if "%PORT%"=="65535" (
    set /A SPRITEWRITE_API_PORT=%PORT% - 1
  ) else (
    set /A SPRITEWRITE_API_PORT=%PORT% + 1
  )
)

set "API_PORT=%SPRITEWRITE_API_PORT%"


echo.
echo Starting SpriteWrite on port %SPRITEWRITE_PORT%...
echo API port: %API_PORT%
echo.
echo Leave this window open while using the app.
echo Press Ctrl+C here when you want to stop the dev server.
echo.

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%SPRITEWRITE_PORT%"
npm run dev -- --port %SPRITEWRITE_PORT% --host 127.0.0.1 --strictPort
