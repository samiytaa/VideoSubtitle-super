@echo off
setlocal
title Video Subtitle Capture Tool

echo ========================================
echo   Video Subtitle Capture Tool Launcher
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 18+.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please reinstall Node.js.
  pause
  exit /b 1
)

echo [INFO] Node:
node -v
echo [INFO] npm:
call npm -v
echo.

if defined ELECTRON_RUN_AS_NODE (
  echo [INFO] Clearing ELECTRON_RUN_AS_NODE for web startup...
  set "ELECTRON_RUN_AS_NODE="
)

if not exist "node_modules" (
  echo [INFO] Installing root dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Root dependency install failed.
    pause
    exit /b 1
  )
)

if not exist "integrated\web2api\node_modules" (
  echo [INFO] Installing Web2API dependencies...
  pushd integrated\web2api
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] Web2API dependency install failed.
    pause
    exit /b 1
  )
  popd
)

echo [INFO] Starting web services...
echo [INFO] Frontend: http://localhost:5173
echo [INFO] API:      http://127.0.0.1:3000
echo.

start "" cmd /c "timeout /t 4 >nul && start http://localhost:5173"
call npm run dev
if errorlevel 1 (
  echo.
  echo [ERROR] Web services failed to start.
  pause
  exit /b 1
)

pause
