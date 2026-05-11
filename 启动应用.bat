@echo off
chcp 65001 >nul
title 视频字幕截取工具

echo ========================================
echo   视频字幕截取工具 - 正在启动...
echo ========================================
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [提示] 检测到未安装依赖，正在安装...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接或 npm 配置
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成
    echo.
)

REM 启动开发服务器
echo [提示] 正在启动开发服务器...
echo.

REM 等待服务器启动后打开浏览器
start /b cmd /c "timeout /t 3 >nul && start http://localhost:5173"

call npm run dev

pause

