# ChmlFrp Docker 管理面板 - 统一镜像
# Author: linluo
# 防盗标识: linluo

# ============ 前端构建阶段 ============
FROM node:18-alpine as frontend-build

LABEL stage=frontend-build
WORKDIR /app

# 复制前端依赖文件
COPY frontend/package*.json ./
RUN npm install --production=false

# 复制前端源码并构建
COPY frontend/ .
RUN npm run build

# ============ 后端准备阶段 ============
FROM node:18-alpine as backend-build

LABEL stage=backend-build
WORKDIR /app

# 安装必要工具
RUN apk add --no-cache curl wget

# 下载FRP客户端
RUN wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz && \
    tar -xzf frp_0.52.3_linux_amd64.tar.gz && \
    mv frp_0.52.3_linux_amd64/frpc /usr/local/bin/ && \
    mv frp_0.52.3_linux_amd64/frps /usr/local/bin/ && \
    rm -rf frp_0.52.3_linux_amd64*

# 复制后端依赖文件
COPY backend/package*.json ./
RUN npm install --production

# 复制后端源码
COPY backend/ .

# ============ 最终生产镜像 ============
FROM nginx:alpine

# 镜像信息
LABEL maintainer="linluo <linluo208@gmail.com>"
LABEL description="ChmlFrp Docker Management Panel - 内网穿透管理面板"
LABEL version="1.0.0"
LABEL author="linluo"

# 安装Node.js和必要工具
RUN apk add --no-cache nodejs npm curl wget supervisor

# 创建应用目录
RUN mkdir -p /app/backend /app/data /app/configs /app/logs

# 复制前端构建结果
COPY --from=frontend-build /app/build /usr/share/nginx/html

# 复制后端应用
COPY --from=backend-build /app /app/backend
COPY --from=backend-build /usr/local/bin/frpc /usr/local/bin/
COPY --from=backend-build /usr/local/bin/frps /usr/local/bin/

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 创建supervisor配置
RUN cat > /etc/supervisor/conf.d/chmlfrp.conf << 'EOF'
[supervisord]
nodaemon=true
user=root

[program:backend]
command=node index.js
directory=/app/backend
autostart=true
autorestart=true
stderr_logfile=/app/logs/backend.err.log
stdout_logfile=/app/logs/backend.out.log

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stderr_logfile=/app/logs/nginx.err.log
stdout_logfile=/app/logs/nginx.out.log
EOF

# 创建启动脚本
RUN cat > /start.sh << 'EOF'
#!/bin/sh
# ChmlFrp Docker 管理面板启动脚本
# Author: linluo

echo "🚀 启动 ChmlFrp 管理面板..."
echo "📍 前端地址: http://localhost"
echo "🔧 后端API: http://localhost:3001"
echo "👨‍💻 作者: linluo"
echo "🔒 防盗标识: linluo"

# 确保目录权限
chown -R nginx:nginx /usr/share/nginx/html
chmod -R 755 /app

# 启动supervisor管理所有进程
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/chmlfrp.conf
EOF

RUN chmod +x /start.sh

# 暴露端口
EXPOSE 80 3001 7000 7400 7500

# 数据卷
VOLUME ["/app/data", "/app/configs", "/app/logs"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# 启动命令
CMD ["/start.sh"]
