# 📱 宝塔面板一键部署 ChmlFrp 管理面板

<div align="center">

![宝塔部署](https://img.shields.io/badge/宝塔面板-部署教程-green)
![Docker](https://img.shields.io/badge/Docker-Required-blue)
![一键部署](https://img.shields.io/badge/部署-一键完成-orange)

**最简单的 ChmlFrp 管理面板部署方式**

</div>

## 🎯 快速部署

### 📋 准备工作

1. **服务器要求**：
   - 操作系统：CentOS 7+、Ubuntu 18+、Debian 9+
   - 内存：建议 2GB+
   - 存储：建议 10GB+ 可用空间
   - 网络：能正常访问互联网

2. **安装宝塔面板**：
   ```bash
   # CentOS
   yum install -y wget && wget -O install.sh http://download.bt.cn/install/install_6.0.sh && sh install.sh
   
   # Ubuntu/Debian
   wget -O install.sh http://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
   ```

### 🚀 一键部署步骤

#### 步骤1：安装Docker

1. 登录宝塔面板
2. 进入 **软件商店**
3. 搜索 **Docker管理器**
4. 点击 **安装**

> 💡 如果软件商店没有，执行：`curl -fsSL https://get.docker.com | sh`

#### 步骤2：获取镜像

**方法A：从GitHub下载**
1. 访问：[GitHub Releases](https://github.com/your-username/chmlfrp-docker/releases)
2. 下载：`chmlfrp-panel-docker-image.tar.gz`

**方法B：直接构建**
```bash
git clone https://github.com/your-username/chmlfrp-docker.git
cd chmlfrp-docker
docker build -t 2084738471/chmlfrp-panel:latest -f Dockerfile .
```

#### 步骤3：导入镜像

**宝塔面板方式：**
1. Docker管理器 → **镜像管理**
2. 点击 **添加本地镜像**
3. 选择上传的 `.tar.gz` 文件
4. 点击 **导入**

**命令行方式：**
```bash
gunzip -c chmlfrp-panel-docker-image.tar.gz | docker load
```

#### 步骤4：创建容器

**宝塔面板创建：**

1. 找到镜像 `2084738471/chmlfrp-panel:latest`
2. 点击 **创建容器**
3. 配置参数：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 容器名称 | `chmlfrp-panel` | 便于管理 |
| 端口映射 | `8888:80` | Web访问端口 |
| 存储卷 | `/www/chmlfrp/data:/app/data` | 数据持久化 |
| 存储卷 | `/www/chmlfrp/logs:/app/logs` | 日志文件 |
| 存储卷 | `/www/chmlfrp/configs:/app/configs` | 配置文件 |
| 环境变量 | `TZ=Asia/Shanghai` | 时区设置 |
| 重启策略 | `unless-stopped` | 自动重启 |

**一键命令部署：**
```bash
# 创建数据目录
mkdir -p /www/chmlfrp/{data,logs,configs}

# 运行容器
docker run -d \
  --name chmlfrp-panel \
  -p 8888:80 \
  -p 3001:3001 \
  -v /www/chmlfrp/data:/app/data \
  -v /www/chmlfrp/logs:/app/logs \
  -v /www/chmlfrp/configs:/app/configs \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  2084738471/chmlfrp-panel:latest
```

#### 步骤5：开放端口

**宝塔面板设置：**
1. 进入 **安全** 设置
2. 添加端口：`8888` (TCP)
3. 备注：`ChmlFrp管理面板`

**防火墙命令：**
```bash
firewall-cmd --permanent --add-port=8888/tcp
firewall-cmd --reload
```

#### 步骤6：访问面板

🎉 **部署完成！**

- **访问地址**：`http://你的服务器IP:8888`
- **登录方式**：ChmlFrp账号或Token

## 🔧 管理维护

### 容器操作

```bash
# 查看状态
docker ps | grep chmlfrp-panel

# 查看日志
docker logs -f chmlfrp-panel

# 重启容器
docker restart chmlfrp-panel

# 停止容器
docker stop chmlfrp-panel

# 启动容器
docker start chmlfrp-panel
```

### 数据备份

```bash
# 备份配置
cp -r /www/chmlfrp/data /backup/chmlfrp-$(date +%Y%m%d)

# 恢复配置
cp -r /backup/chmlfrp-20240101/* /www/chmlfrp/data/
docker restart chmlfrp-panel
```

### 升级版本

```bash
# 1. 下载新版本镜像
# 2. 停止旧容器
docker stop chmlfrp-panel
docker rm chmlfrp-panel

# 3. 使用新镜像启动
docker run -d \
  --name chmlfrp-panel \
  -p 8888:80 \
  -v /www/chmlfrp/data:/app/data \
  -v /www/chmlfrp/logs:/app/logs \
  -v /www/chmlfrp/configs:/app/configs \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  2084738471/chmlfrp-panel:latest
```

## ❗ 常见问题

### Q1: 容器启动失败
**A:** 检查端口占用和权限
```bash
# 检查端口
netstat -tlnp | grep 8888

# 检查日志
docker logs chmlfrp-panel
```

### Q2: 无法访问面板
**A:** 检查防火墙和网络
```bash
# 测试端口连通性
telnet 服务器IP 8888

# 检查防火墙
firewall-cmd --list-ports
```

### Q3: 数据丢失
**A:** 确保正确挂载数据卷
```bash
# 检查挂载
docker inspect chmlfrp-panel | grep -A 10 Mounts
```

### Q4: 性能优化
**A:** 调整资源限制
```bash
# 限制内存和CPU
docker run -d \
  --name chmlfrp-panel \
  --memory="1g" \
  --cpus="1.0" \
  -p 8888:80 \
  ... # 其他参数
```

## 📞 技术支持

- **文档**: [完整部署文档](README.md)
- **问题反馈**: [GitHub Issues](https://github.com/your-username/chmlfrp-docker/issues)
- **交流讨论**: [讨论区](https://github.com/your-username/chmlfrp-docker/discussions)

## 🎬 视频教程

**宝塔面板部署演示** (制作中)
- [ ] 视频1：环境准备和Docker安装
- [ ] 视频2：镜像导入和容器创建
- [ ] 视频3：配置管理和故障排除

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star！**

Made with ❤️ by linluo

</div>
