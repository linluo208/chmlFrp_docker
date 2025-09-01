@echo off
:: ChmlFrp Docker 镜像导出/导入脚本 (Windows版本)
:: Author: linluo
:: Copyright: 2025
:: 防盗标识: linluo

chcp 65001 >nul
setlocal enabledelayedexpansion

:: 镜像信息
set IMAGE_NAME=2084738471/chmlfrp-panel:latest
set IMAGE_FILE=chmlfrp-panel.tar
set CONTAINER_NAME=chmlfrp-panel

:: 颜色定义 (简化版)
set "GREEN=[32m"
set "RED=[31m"
set "YELLOW=[33m"
set "BLUE=[34m"
set "NC=[0m"

goto check_docker

:log_info
echo [INFO] %~1
goto :eof

:log_warn
echo [WARN] %~1
goto :eof

:log_error
echo [ERROR] %~1
goto :eof

:log_step
echo [STEP] %~1
goto :eof

:check_docker
:: 检查Docker是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker未安装！请先安装Docker Desktop。"
    echo 下载地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: 检查Docker是否运行
docker info >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker服务未运行！请启动Docker Desktop。"
    pause
    exit /b 1
)

:: 处理命令行参数
if "%1"=="build" goto build_image
if "%1"=="export" goto export_image
if "%1"=="import" goto import_image
if "%1"=="run" goto run_container
if "%1"=="stop" goto stop_service
if "%1"=="status" goto show_status
if "%1"=="help" goto show_help
if "%1"=="/?" goto show_help

goto show_menu

:build_image
call :log_step "开始构建Docker镜像..."

:: 检查是否存在Dockerfile
if not exist "Dockerfile" (
    call :log_error "未找到Dockerfile！请确保在项目根目录运行此脚本。"
    pause
    exit /b 1
)

:: 构建镜像
call :log_info "正在构建镜像 %IMAGE_NAME% ..."
docker build -t "%IMAGE_NAME%" .

docker images | findstr "2084738471/chmlfrp-panel" >nul
if errorlevel 1 (
    call :log_error "镜像构建失败！"
    pause
    exit /b 1
) else (
    call :log_info "✅ 镜像构建成功！"
    docker images | findstr chmlfrp
)
goto menu_continue

:export_image
call :log_step "开始导出Docker镜像..."

:: 检查镜像是否存在
docker images | findstr "2084738471/chmlfrp-panel" >nul
if errorlevel 1 (
    call :log_warn "镜像 %IMAGE_NAME% 不存在！"
    set /p build_choice="是否现在构建镜像？(y/N): "
    if /i "!build_choice!"=="y" (
        call :build_image
    ) else (
        call :log_error "请先构建镜像"
        goto menu_continue
    )
)

:: 删除旧的导出文件
if exist "%IMAGE_FILE%" (
    call :log_warn "发现已存在的镜像文件，正在删除..."
    del /f "%IMAGE_FILE%"
)

:: 导出镜像
call :log_info "正在导出镜像到 %IMAGE_FILE% ..."
docker save -o "%IMAGE_FILE%" "%IMAGE_NAME%"

:: 检查文件
if exist "%IMAGE_FILE%" (
    for %%A in ("%IMAGE_FILE%") do set FILE_SIZE=%%~zA
    set /a FILE_SIZE_MB=!FILE_SIZE!/1048576
    
    call :log_info "✅ 镜像导出成功！"
    echo.
    echo ==================================
    echo 📦 文件信息:
    echo    文件名: %IMAGE_FILE%
    echo    大小: !FILE_SIZE_MB! MB
    echo ==================================
    echo.
    call :log_info "传输方法："
    echo   1. 宝塔文件管理器：
    echo      - 进入宝塔面板 → 文件 → 上传文件
    echo      - 选择 %IMAGE_FILE% 上传到 /root/ 目录
    echo.
    echo   2. WinSCP/FileZilla等FTP工具：
    echo      - 上传到服务器 /root/ 目录
    echo.
    echo   3. 网盘中转：
    echo      - 上传到百度网盘/阿里云盘等
    echo      - 在服务器上下载
    echo.
    call :log_info "上传完成后，在服务器运行："
    echo   bash export-import-image.sh import
    
    :: 创建导入说明
    echo ChmlFrp Docker 镜像导入说明 > 导入说明.txt
    echo ================================ >> 导入说明.txt
    echo. >> 导入说明.txt
    echo 1. 上传文件到服务器 >> 导入说明.txt
    echo    将 %IMAGE_FILE% 上传到服务器的 /root/ 目录 >> 导入说明.txt
    echo. >> 导入说明.txt
    echo 2. 上传脚本到服务器 >> 导入说明.txt
    echo    将 export-import-image.sh 也上传到服务器 >> 导入说明.txt
    echo. >> 导入说明.txt
    echo 3. 在服务器执行导入 >> 导入说明.txt
    echo    chmod +x export-import-image.sh >> 导入说明.txt
    echo    ./export-import-image.sh import >> 导入说明.txt
    echo. >> 导入说明.txt
    echo 4. 运行容器 >> 导入说明.txt
    echo    ./export-import-image.sh run >> 导入说明.txt
    echo. >> 导入说明.txt
    echo 文件大小: !FILE_SIZE_MB! MB >> 导入说明.txt
    
    call :log_info "📄 已生成 '导入说明.txt' 文件"
    
) else (
    call :log_error "导出失败！请检查磁盘空间和权限。"
)
goto menu_continue

:import_image
call :log_step "开始导入Docker镜像..."

:: 检查文件是否存在
if not exist "%IMAGE_FILE%" (
    call :log_error "镜像文件 %IMAGE_FILE% 不存在！"
    echo.
    call :log_info "请确保文件已下载到当前目录"
    echo 当前目录: %CD%
    echo 当前tar文件:
    dir *.tar 2>nul || echo   未找到 .tar 文件
    goto menu_continue
)

:: 显示文件信息
for %%A in ("%IMAGE_FILE%") do set FILE_SIZE=%%~zA
set /a FILE_SIZE_MB=!FILE_SIZE!/1048576

echo.
echo ==================================
echo 📦 准备导入的文件:
echo    文件名: %IMAGE_FILE%
echo    大小: !FILE_SIZE_MB! MB
echo ==================================
echo.

:: 确认导入
set /p import_choice="确认导入此镜像文件？(y/N): "
if not "!import_choice!"=="y" if not "!import_choice!"=="Y" (
    call :log_info "取消导入"
    goto menu_continue
)

:: 导入镜像
call :log_info "正在从 %IMAGE_FILE% 导入镜像..."
docker load -i "%IMAGE_FILE%"

:: 验证导入
docker images | findstr "2084738471/chmlfrp-panel" >nul
if errorlevel 1 (
    call :log_error "导入失败！请检查文件完整性。"
) else (
    call :log_info "✅ 镜像导入成功！"
    echo.
    echo ==================================
    echo 🐳 镜像信息:
    docker images | findstr chmlfrp
    echo ==================================
    echo.
    call :log_info "🚀 现在可以运行容器了！"
    echo   快速启动: %~nx0 run
    
    :: 询问是否立即运行
    set /p run_choice="是否立即启动容器？(y/N): "
    if /i "!run_choice!"=="y" call :run_container
)
goto menu_continue

:run_container
call :log_step "正在启动ChmlFrp管理面板..."

:: 检查镜像是否存在
docker images | findstr "2084738471/chmlfrp-panel" >nul
if errorlevel 1 (
    call :log_error "镜像不存在，请先导入镜像！"
    echo 运行: %~nx0 import
    goto menu_continue
)

:: 检查端口占用
netstat -an | findstr ":8888 " >nul
if not errorlevel 1 (
    call :log_warn "端口 8888 已被占用！"
    set /p port_choice="是否使用其他端口？输入端口号 (留空取消): "
    if "!port_choice!"=="" (
        call :log_info "取消启动"
        goto menu_continue
    )
    set FRONTEND_PORT=!port_choice!
) else (
    set FRONTEND_PORT=8888
)

:: 停止并删除已存在的容器
docker ps -a | findstr "%CONTAINER_NAME%" >nul
if not errorlevel 1 (
    call :log_warn "发现已存在的容器，正在停止并删除..."
    docker stop "%CONTAINER_NAME%" 2>nul
    docker rm "%CONTAINER_NAME%" 2>nul
)

:: 运行新容器
call :log_info "正在启动容器..."
docker run -d --name "%CONTAINER_NAME%" --restart unless-stopped -p "%FRONTEND_PORT%:80" -p "3001:3001" -p "7000:7000" -p "7400:7400" -p "7500:7500" "%IMAGE_NAME%"

:: 等待容器启动
call :log_info "等待容器启动..."
timeout /t 5 /nobreak >nul

:: 检查容器状态
docker ps | findstr "%CONTAINER_NAME%" >nul
if errorlevel 1 (
    call :log_error "容器启动失败！"
    echo.
    call :log_info "错误排查："
    echo   1. 查看容器日志: docker logs %CONTAINER_NAME%
    echo   2. 检查端口占用: netstat -an ^| findstr :%FRONTEND_PORT%
    echo   3. 检查镜像状态: docker images ^| findstr chmlfrp
) else (
    call :log_info "✅ 容器启动成功！"
    echo.
    echo ==================================
    echo 🎉 ChmlFrp 管理面板已启动！
    echo ==================================
    echo 🌐 访问地址:
    echo    本地访问: http://localhost:%FRONTEND_PORT%
    echo    局域网访问: http://你的IP:%FRONTEND_PORT%
    echo.
    echo 🔧 管理命令:
    echo    查看日志: docker logs %CONTAINER_NAME%
    echo    停止服务: docker stop %CONTAINER_NAME%
    echo    重启服务: docker restart %CONTAINER_NAME%
    echo ==================================
)
goto menu_continue

:stop_service
call :log_step "停止ChmlFrp服务"

docker ps | findstr "%CONTAINER_NAME%" >nul
if errorlevel 1 (
    call :log_warn "容器未运行"
) else (
    call :log_info "正在停止容器..."
    docker stop "%CONTAINER_NAME%"
    call :log_info "✅ 容器已停止"
)
goto menu_continue

:show_status
call :log_step "系统状态检查"

echo.
echo ==================================
echo 🐳 Docker环境
echo ==================================
docker --version
echo.

echo ==================================
echo 📦 镜像状态
echo ==================================
docker images | findstr "chmlfrp" >nul
if errorlevel 1 (
    echo 未找到ChmlFrp镜像
) else (
    docker images | findstr chmlfrp
)
echo.

echo ==================================
echo 🔄 容器状态
echo ==================================
docker ps -a | findstr "%CONTAINER_NAME%" >nul
if errorlevel 1 (
    echo 容器不存在
) else (
    docker ps -a | findstr chmlfrp
    docker ps | findstr "%CONTAINER_NAME%" >nul
    if errorlevel 1 (
        echo 容器已停止
    ) else (
        echo 容器正在运行中
    )
)
echo.

echo ==================================
echo 📁 文件状态
echo ==================================
if exist "%IMAGE_FILE%" (
    for %%A in ("%IMAGE_FILE%") do set FILE_SIZE=%%~zA
    set /a FILE_SIZE_MB=!FILE_SIZE!/1048576
    echo 镜像文件: %IMAGE_FILE% (!FILE_SIZE_MB! MB)
) else (
    echo 镜像文件: 不存在
)
echo.

echo ==================================
echo 🔌 端口占用情况
echo ==================================
for %%p in (8888 3001 7000 7400 7500) do (
    netstat -an | findstr ":%%p " >nul
    if errorlevel 1 (
        echo 端口 %%p: 空闲
    ) else (
        echo 端口 %%p: 已占用
    )
)
goto menu_continue

:show_menu
cls
echo.
echo ==================================================
echo 🐳 ChmlFrp Docker 镜像管理工具 (Windows版)
echo ==================================================
echo 📦 镜像管理:
echo   1. 构建镜像 (在源码目录运行)
echo   2. 导出镜像 (生成传输文件)
echo   3. 导入镜像 (从文件导入)
echo.
echo 🚀 服务管理:
echo   4. 运行容器
echo   5. 停止服务
echo   6. 查看状态
echo.
echo   0. 退出
echo ==================================================
set /p choice="请选择操作 [0-6]: "

if "%choice%"=="1" goto build_image
if "%choice%"=="2" goto export_image
if "%choice%"=="3" goto import_image
if "%choice%"=="4" goto run_container
if "%choice%"=="5" goto stop_service
if "%choice%"=="6" goto show_status
if "%choice%"=="0" goto exit_program

call :log_error "无效选择，请输入 0-6"
goto menu_continue

:menu_continue
echo.
pause
goto show_menu

:show_help
echo ChmlFrp Docker 镜像管理工具 (Windows版)
echo.
echo 用法: %~nx0 [命令]
echo.
echo 命令:
echo   build   - 构建镜像
echo   export  - 导出镜像文件
echo   import  - 导入镜像文件
echo   run     - 运行容器
echo   stop    - 停止服务
echo   status  - 查看状态
echo   help    - 显示帮助
echo.
echo 示例:
echo   %~nx0 export   # 导出镜像
echo   %~nx0 import   # 导入镜像
echo   %~nx0 run      # 运行容器
echo.
echo 不带参数运行将进入交互模式
goto :eof

:exit_program
call :log_info "退出程序"
exit /b 0
