@echo off
chcp 65001 >nul
title DeepSeek Console

set "APP_DIR=%~dp0"
set "APP_PORT=3000"
set "APP_URL=http://localhost:%APP_PORT%"

cd /d "%APP_DIR%"

:: 检查 Node.js 是否安装
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [提示] 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

:: 构建前端
echo [构建] 正在构建前端...
call npm run build
if errorlevel 1 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)

:: 检查端口是否已被占用
netstat -ano | findstr ":%APP_PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [提示] 端口 %APP_PORT% 已被占用，服务可能已在运行
    echo 正在打开浏览器...
    start "" "%APP_URL%"
    echo.
    echo 按任意键退出...
    pause >nul
    exit /b 0
)

:: 在新窗口中启动后端服务
echo [启动] DeepSeek Console 正在启动...
start "DeepSeek Server" /min cmd /c "node src/server.js"

:: 等待服务就绪（最多等 10 秒）
set /a "tries=0"
:wait_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":%APP_PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto ready
set /a "tries+=1"
if %tries% lss 10 goto wait_loop

echo [警告] 服务启动超时，尝试直接打开浏览器...

:ready
echo [就绪] 服务已启动：%APP_URL%
start "" "%APP_URL%"
echo.
echo ============================================
echo  源码监听已启动，修改文件后将自动重新构建
echo  关闭此窗口将停止监听和服务
echo ============================================
echo.

:: 前台运行 vite build --watch，监听源码变化自动构建
:: 关闭此窗口时，后端服务窗口也会一并关闭
npx vite build --watch
