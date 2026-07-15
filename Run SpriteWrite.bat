@echo off
cd /d "%~dp0"
echo Starting SpriteWrite...
echo.
echo Leave this window open while using the app.
echo Press Ctrl+C here when you want to stop the dev server.
echo.
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173'"
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
