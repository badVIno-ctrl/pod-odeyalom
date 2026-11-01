@echo off
title Pod odeyalom - razrabotka
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Для разработки нужен Node.js 20.19 или новее: https://nodejs.org
  echo   Чтобы просто играть, запустите ИГРАТЬ.bat
  echo.
  pause
  exit /b 1
)
if not exist "node_modules" call npm install
call npm run dev
pause
