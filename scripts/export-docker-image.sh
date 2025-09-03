#!/bin/bash

# ChmlFrp Docker 镜像导出脚本
# Author: linluo
# 用于生成宝塔面板部署所需的镜像包

set -e

# 配置
IMAGE_NAME="2084738471/chmlfrp-panel"
IMAGE_TAG="latest"
EXPORT_DIR="./exports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="chmlfrp-panel-docker-image_${TIMESTAMP}.tar.gz"

echo "🚀 ChmlFrp Docker 镜像导出工具"
echo "================================="
echo "📦 镜像名称: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "📁 导出目录: ${EXPORT_DIR}"
echo "📄 文件名称: ${EXPORT_FILE}"
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装或不在PATH中"
    exit 1
fi

# 检查镜像是否存在
if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &> /dev/null; then
    echo "❌ 镜像 ${IMAGE_NAME}:${IMAGE_TAG} 不存在"
    echo "💡 请先构建镜像："
    echo "   docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -f Dockerfile ."
    exit 1
fi

# 创建导出目录
mkdir -p "${EXPORT_DIR}"

echo "📋 开始导出镜像..."

# 导出Docker镜像
echo "🔄 正在导出镜像到 tar 文件..."
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "${EXPORT_DIR}/${EXPORT_FILE}"

# 检查文件大小
FILE_SIZE=$(du -sh "${EXPORT_DIR}/${EXPORT_FILE}" | cut -f1)
echo "✅ 镜像导出完成！"
echo ""

# 显示结果信息
echo "📊 导出信息："
echo "   文件路径: ${EXPORT_DIR}/${EXPORT_FILE}"
echo "   文件大小: ${FILE_SIZE}"
echo "   创建时间: $(date)"
echo ""

# 生成校验和
echo "🔐 生成文件校验和..."
cd "${EXPORT_DIR}"
sha256sum "${EXPORT_FILE}" > "${EXPORT_FILE}.sha256"
echo "   校验文件: ${EXPORT_FILE}.sha256"
echo ""

# 显示使用说明
echo "📖 使用说明："
echo "1. 将 ${EXPORT_FILE} 上传到目标服务器"
echo "2. 在宝塔面板 Docker管理器 中选择该文件导入"
echo "3. 或使用命令: docker load < ${EXPORT_FILE%.gz}"
echo ""

# 显示宝塔部署命令
echo "🎯 宝塔面板部署命令："
echo "# 解压并导入镜像"
echo "gunzip -c ${EXPORT_FILE} | docker load"
echo ""
echo "# 创建并启动容器"
echo "docker run -d \\"
echo "  --name chmlfrp-panel \\"
echo "  -p 8888:80 \\"
echo "  -p 3001:3001 \\"
echo "  -v /www/chmlfrp/data:/app/data \\"
echo "  -v /www/chmlfrp/logs:/app/logs \\"
echo "  -v /www/chmlfrp/configs:/app/configs \\"
echo "  -e TZ=Asia/Shanghai \\"
echo "  --restart unless-stopped \\"
echo "  ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# 生成部署脚本
DEPLOY_SCRIPT="${EXPORT_DIR}/deploy-chmlfrp.sh"
cat > "${DEPLOY_SCRIPT}" << 'EOF'
#!/bin/bash
# ChmlFrp 一键部署脚本 - 适用于宝塔面板服务器
# 使用方法: bash deploy-chmlfrp.sh

set -e

IMAGE_FILE="chmlfrp-panel-docker-image_*.tar.gz"
CONTAINER_NAME="chmlfrp-panel"
WEB_PORT="8888"

echo "🚀 ChmlFrp 一键部署脚本"
echo "======================="

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "✅ Docker 安装完成"
fi

# 查找镜像文件
IMAGE_FILES=(${IMAGE_FILE})
if [ ${#IMAGE_FILES[@]} -eq 0 ]; then
    echo "❌ 未找到镜像文件 ${IMAGE_FILE}"
    echo "请确保镜像文件在当前目录"
    exit 1
fi

SELECTED_IMAGE="${IMAGE_FILES[0]}"
echo "📦 找到镜像文件: ${SELECTED_IMAGE}"

# 停止旧容器
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🔄 停止并删除旧容器..."
    docker stop ${CONTAINER_NAME} || true
    docker rm ${CONTAINER_NAME} || true
fi

# 导入镜像
echo "📥 导入Docker镜像..."
gunzip -c "${SELECTED_IMAGE}" | docker load

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p /www/chmlfrp/{data,logs,configs}

# 启动容器
echo "🚀 启动容器..."
docker run -d \
  --name ${CONTAINER_NAME} \
  -p ${WEB_PORT}:80 \
  -p 3001:3001 \
  -p 7000:7000 \
  -p 7400:7400 \
  -p 7500:7500 \
  -v /www/chmlfrp/data:/app/data \
  -v /www/chmlfrp/logs:/app/logs \
  -v /www/chmlfrp/configs:/app/configs \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  2084738471/chmlfrp-panel:latest

# 检查启动状态
echo "⏳ 等待服务启动..."
sleep 10

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ 容器启动成功！"
    echo ""
    echo "🎉 部署完成！"
    echo "📍 访问地址: http://$(hostname -I | awk '{print $1}'):${WEB_PORT}"
    echo "📍 本地访问: http://localhost:${WEB_PORT}"
    echo ""
    echo "📋 容器管理命令："
    echo "   查看日志: docker logs -f ${CONTAINER_NAME}"
    echo "   重启容器: docker restart ${CONTAINER_NAME}"
    echo "   停止容器: docker stop ${CONTAINER_NAME}"
    echo ""
else
    echo "❌ 容器启动失败！"
    echo "📋 查看日志: docker logs ${CONTAINER_NAME}"
    exit 1
fi
EOF

chmod +x "${DEPLOY_SCRIPT}"
echo "📜 已生成一键部署脚本: ${DEPLOY_SCRIPT}"
echo ""

echo "🎉 导出完成！"
echo "📦 可用文件："
echo "   - ${EXPORT_FILE} (Docker镜像)"
echo "   - ${EXPORT_FILE}.sha256 (校验和)"
echo "   - deploy-chmlfrp.sh (一键部署脚本)"
echo ""
echo "💡 上传这些文件到服务器即可开始部署！"
