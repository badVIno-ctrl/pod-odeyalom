@echo off
title Pod odeyalom
cd /d "%~dp0"
if not exist "tools\play-server.ps1" (
  echo.
  echo   Сначала распакуйте архив целиком, потом запустите ИГРАТЬ.bat из папки игры.
  echo.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools\play-server.ps1"
if errorlevel 1 pause
