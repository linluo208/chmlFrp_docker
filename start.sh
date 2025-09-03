#!/bin/sh

# ChmlFrp Docker 启动脚本
echo "🚀 启动 ChmlFrp Docker 管理面板..."

# 设置时区
export TZ=Asia/Shanghai

# 检查并下载frp二进制文件
if [ ! -f "/app/frpc_real" ] || [ ! -f "/app/frps_real" ]; then
    echo "📥 下载FRP二进制文件..."
    
    # 尝试多个下载源
    DOWNLOAD_SUCCESS=false
    
    # 尝试官方GitHub Release
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "尝试从GitHub下载..."
        if timeout 30 wget --timeout=10 --tries=2 -O /tmp/frp.tar.gz "https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz" 2>/dev/null; then
            cd /tmp
            if tar -xzf frp.tar.gz 2>/dev/null; then
                mv frp_0.52.3_linux_amd64/frpc /app/frpc_real
                mv frp_0.52.3_linux_amd64/frps /app/frps_real
                chmod +x /app/frpc_real /app/frps_real
                rm -rf frp_0.52.3_linux_amd64* frp.tar.gz
                DOWNLOAD_SUCCESS=true
                echo "✅ GitHub下载成功"
            fi
        fi
    fi
    
    # 尝试备用下载源
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "尝试从备用源下载..."
        if timeout 30 wget --timeout=10 --tries=2 -O /tmp/frp.tar.gz "https://gitee.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz" 2>/dev/null; then
            cd /tmp
            if tar -xzf frp.tar.gz 2>/dev/null; then
                mv frp_0.52.3_linux_amd64/frpc /app/frpc_real
                mv frp_0.52.3_linux_amd64/frps /app/frps_real
                chmod +x /app/frpc_real /app/frps_real
                rm -rf frp_0.52.3_linux_amd64* frp.tar.gz
                DOWNLOAD_SUCCESS=true
                echo "✅ 备用源下载成功"
            fi
        fi
    fi
    
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "❌ 无法下载FRP二进制文件，尝试使用ghproxy镜像..."
        if timeout 30 wget --timeout=10 --tries=2 -O /tmp/frp.tar.gz "https://ghproxy.com/https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz" 2>/dev/null; then
            cd /tmp
            if tar -xzf frp.tar.gz 2>/dev/null; then
                mv frp_0.52.3_linux_amd64/frpc /app/frpc_real
                mv frp_0.52.3_linux_amd64/frps /app/frps_real
                chmod +x /app/frpc_real /app/frps_real
                rm -rf frp_0.52.3_linux_amd64* frp.tar.gz
                DOWNLOAD_SUCCESS=true
                echo "✅ ghproxy镜像下载成功"
            fi
        fi
    fi
    
    if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
        echo "❌ 所有下载源都失败，创建简单的frpc占位符以确保服务启动"
        echo '#!/bin/sh' > /app/frpc_real
        echo 'echo "FRP客户端未正确下载，请检查网络连接"' >> /app/frpc_real
        echo 'exit 1' >> /app/frpc_real
        chmod +x /app/frpc_real
        cp /app/frpc_real /app/frps_real
    else
        # 替换占位符
        cp /app/frpc_real /app/frpc
        cp /app/frps_real /app/frps
    fi
else
    echo "✅ FRP二进制文件已存在"
    cp /app/frpc_real /app/frpc
    cp /app/frps_real /app/frps
fi

# 启动Node.js应用
echo "🎯 启动后端服务..."
cd /app
exec npm start