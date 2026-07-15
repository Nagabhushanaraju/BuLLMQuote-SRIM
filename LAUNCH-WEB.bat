@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Accomplish UI - Launch
cd /d "%~dp0"

REM Nagabhushana: launch from the current repo root.
set "ROOT=%~dp0"
set "APP_DIR=%ROOT%accomplish-ui"

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] Could not find the app folder:
  echo         %APP_DIR%
  pause
  exit /b 1
)

where node >nul 2>&1 || (
  echo [ERROR] Node.js was not found on PATH.
  pause
  exit /b 1
)
where pnpm >nul 2>&1 || (
  echo [ERROR] pnpm was not found on PATH.
  pause
  exit /b 1
)

cd /d "%APP_DIR%"
if not exist "node_modules" (
  echo [INFO] Dependencies are missing. Run INSTALL.bat first.
  pause
  exit /b 1
)

set "DAEMON_DIR=%APP_DIR%\apps\daemon"
set "DATA_DIR=%ROOT%.srim-local-data"
set "UI_PORT=5180"
set "DAEMON_PORT=9234"

echo.
echo [INFO] Stopping old SRIM processes on ports %UI_PORT% and %DAEMON_PORT%...
REM Nagabhushana: only stop processes bound to this launcher's ports.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=@(%UI_PORT%,%DAEMON_PORT%); $pids=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $pids) { if ($id -and $id -ne $PID) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=@(%UI_PORT%,%DAEMON_PORT%); $left=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }; if ($left) { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Could not clear ports %UI_PORT%/%DAEMON_PORT%.
  echo         Close the application using them and run this launcher again.
  pause
  exit /b 1
)

if not exist "%DAEMON_DIR%\dist\index.js" (
  echo [INFO] Building SRIM daemon...
  cd /d "%DAEMON_DIR%"
  set "PATH=%DAEMON_DIR%\node_modules\.bin;%PATH%"
  call node scripts\build.cjs || exit /b 1
)

echo Starting SRIM authentication daemon on port %DAEMON_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:ACCOMPLISH_TEST_LOGIN = '1'; Start-Process -FilePath 'node' -ArgumentList @('dist/index.js', '--data-dir', '%DATA_DIR%') -WorkingDirectory '%DAEMON_DIR%' -WindowStyle Hidden"

echo Waiting for the daemon health check...
for /l %%N in (1,1,20) do (
  powershell -NoProfile -Command "try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:%DAEMON_PORT%/health).StatusCode -eq 200) { exit 0 } } catch {} ; exit 1" >nul 2>&1
  if not errorlevel 1 goto daemon_ready
  timeout /t 1 /nobreak >nul
)
echo [ERROR] SRIM daemon did not become healthy on port %DAEMON_PORT%.
echo         Check the daemon build or run INSTALL.bat again.
pause
exit /b 1

:daemon_ready
echo [OK] SRIM daemon is healthy.

echo Starting SRIM UI on port %UI_PORT%...
echo.
echo Open: http://localhost:%UI_PORT%/
echo Login: digibull / srim-test-2026
echo Press Ctrl+C in this window to stop the UI.
cd /d "%APP_DIR%\apps\web"
set "PORT=%UI_PORT%"
call node node_modules\vite\bin\vite.js --host 0.0.0.0 --port %UI_PORT%
