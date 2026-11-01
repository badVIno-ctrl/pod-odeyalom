@echo off
title Pod odeyalom - itch.io
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  echo.
  echo   Node.js найден, собираю игру заново...
  if not exist "node_modules" call npm install
  call npm run build
  if errorlevel 1 echo   Сборка не удалась, беру готовую папку dist.
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools\make-itch-zip.ps1"
echo.
pause
