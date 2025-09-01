#!/bin/bash
# ChmlFrp Docker管理面板启动脚本
# Author: linluo
# Copyright: 2025
# 防盗标识: linluo

# ChmlFrp Docker 可视化管理面板启动脚本

echo "=================================================="
echo "  ChmlFrp Docker 可视化管理面板"
echo "  版本: v1.0.0"
echo "=================================================="

# 检查Docker和Docker Compose是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker 环境检查通过"

# 检查端口是否被占用
if netstat -tuln | grep -q ":80 "; then
    echo "⚠️  警告: 端口 80 已被占用"
    echo "请停止占用80端口的服务，或修改docker-compose.yml中的端口配置"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建必要的目录
echo "📁 创建项目目录..."
mkdir -p logs

# 停止并删除旧容器
echo "🛑 停止旧容器..."
docker-compose down

# 构建并启动服务
echo "🚀 构建并启动服务..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 检查服务健康状态
echo "🏥 检查后端API健康状态..."
if curl -f http://localhost:3001/api/health &> /dev/null; then
    echo "✅ 后端API服务正常"
else
    echo "❌ 后端API服务异常"
    echo "查看日志: docker-compose logs backend"
fi

echo ""
echo "=================================================="
echo "🎉 ChmlFrp 管理面板部署完成!"
echo ""
echo "📍 访问地址: http://localhost"
echo "🔧 管理命令:"
echo "   查看日志: docker-compose logs"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart"
echo ""
echo "📚 使用说明:"
echo "   1. 打开浏览器访问 http://localhost"
echo "   2. 使用您的ChmlFrp账户登录"
echo "   3. 开始管理您的内网穿透隧道"
echo ""
echo "❓ 如遇问题，请查看 README.md 故障排除部分"
echo "=================================================="
