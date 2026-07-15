@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Accomplish UI - Installer
cd /d "%~dp0"

REM Nagabhushana: keep this one-click and simple.
set "ROOT=%~dp0"
set "APP_DIR=%ROOT%accomplish-ui"

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] Could not find the app folder:
  echo         %APP_DIR%
  pause
  exit /b 1
)

echo [1/3] Unblocking files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%ROOT%' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike '*\node_modules\*' } | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

echo [2/3] Checking Node.js...
where node >nul 2>&1 || (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install Node.js 24 LTS, then run INSTALL.bat again.
  pause
  exit /b 1
)
where pnpm >nul 2>&1 || (
  echo [ERROR] pnpm was not found on PATH.
  echo         Enable corepack or install pnpm 10.33.0.
  pause
  exit /b 1
)

echo [3/3] Installing dependencies...
cd /d "%APP_DIR%"
set "NODE_ENV=development"
call pnpm install --config.engine-strict=false --config.confirmModulesPurge=false --prod=false
if errorlevel 1 (
  echo [ERROR] pnpm install failed.
  pause
  exit /b 1
)

echo.
echo Setup complete.
echo Run LAUNCH-WEB.bat to start the UI.
pause
exit /b 0
