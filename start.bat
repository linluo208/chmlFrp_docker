@echo off
REM ChmlFrp Docker管理面板启动脚本
REM Author: linluo
REM Copyright: 2025
REM 防盗标识: linluo
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==================================================
echo   ChmlFrp Docker 可视化管理面板
echo   Version: v1.0.0
echo ==================================================

:: 检查Docker是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Docker 未安装
    echo 请先安装Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: 检查Docker Compose是否安装
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Docker Compose 未安装
    echo 请确保Docker Desktop已正确安装
    pause
    exit /b 1
)

echo ✅ Docker 环境检查通过

:: 检查端口8888是否被占用
netstat -an | findstr ":8888 " >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  警告: 端口 8888 已被占用
    echo 请停止占用8888端口的服务，或修改docker-compose.yml中的端口配置
    set /p continue="是否继续? (y/N): "
    if /i not "!continue!"=="y" (
        exit /b 1
    )
)

:: 创建必要的目录
echo 📁 创建项目目录...
if not exist logs mkdir logs

:: 停止并删除旧容器
echo 🛑 停止旧容器...
docker-compose down

:: 构建并启动服务
echo 🚀 构建并启动服务...
docker-compose up -d --build

:: 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 10 /nobreak >nul

:: 检查服务状态
echo 🔍 检查服务状态...
docker-compose ps

:: 检查服务健康状态
echo 🏥 检查后端API健康状态...
curl -f http://localhost:3001/api/health >nul 2>&1
if not errorlevel 1 (
    echo ✅ 后端API服务正常
) else (
    echo ❌ 后端API服务异常
    echo 查看日志: docker-compose logs backend
)

echo.
echo ==================================================
echo 🎉 ChmlFrp 管理面板部署完成!
echo.
echo 📍 访问地址: http://localhost:8888
echo 🔧 管理命令:
echo    查看日志: docker-compose logs
echo    停止服务: docker-compose down
echo    重启服务: docker-compose restart
echo.
echo 📚 使用说明:
echo    1. 打开浏览器访问 http://localhost:8888
echo    2. 使用您的ChmlFrp账户登录
echo    3. 开始管理您的内网穿透隧道
echo.
echo ❓ 如遇问题，请查看 README.md 故障排除部分
echo ==================================================

:: 询问是否打开浏览器
set /p openBrowser="是否打开浏览器? (y/N): "
if /i "!openBrowser!"=="y" (
    start http://localhost:8888
)

pause
