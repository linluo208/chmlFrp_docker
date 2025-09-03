# ChmlFrp Docker 管理面板

<div align="center">

![ChmlFrp Logo](https://img.shields.io/badge/ChmlFrp-Docker-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![React](https://img.shields.io/badge/React-18+-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**功能完整的 ChmlFrp 内网穿透 Docker 管理面板**

</div>

## 🌟 项目特色

- 🐳 **一键部署** - Docker Compose 快速启动
- 🔄 **断线重连** - 智能监控，自动重启异常隧道
- 🌐 **域名管理** - 集成多家DNS服务商API，自动配置域名解析
- 📊 **实时监控** - 隧道状态、流量统计、节点监控
- 🔐 **安全认证** - Token失效自动检测，多端登录保护
- 🎨 **现代界面** - 基于Ant Design的美观UI
- ⚡ **高性能** - 并发隧道管理，资源优化

## 📦 快速开始

### 环境要求

- Docker & Docker Compose
- 2GB+ 内存
- ChmlFrp 账户和Token

### 一键部署

```bash
# 克隆项目
git clone https://github.com/your-username/chmlfrp-docker.git
cd chmlfrp-docker

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps
```

### 访问面板

- **管理面板**: http://localhost:8888
- **后端API**: http://localhost:3001

默认会自动打开浏览器访问管理面板。

## 📱 宝塔面板部署教程

**适用于使用宝塔面板的用户，一键部署ChmlFrp管理面板**

### 📋 部署步骤

#### 1. 安装Docker环境

**在宝塔面板中安装Docker：**

1. 登录宝塔面板
2. 进入 **软件商店**
3. 搜索 **Docker管理器**
4. 点击 **安装**
5. 等待安装完成

> 💡 **提示**: 如果软件商店没有Docker管理器，请在终端执行：
> ```bash
> curl -fsSL https://get.docker.com | sh
> sudo systemctl start docker
> sudo systemctl enable docker
> ```

#### 2. 下载镜像包

**从GitHub获取预构建镜像：**

1. 访问项目发布页面：[GitHub Releases](https://github.com/linluo208/chmlFrp_docker/releases/tag/chmlFrp_docker)
2. 下载最新版本的镜像包：`chmlfrp-panel.tar`
3. 将压缩包上传到服务器任意位置（建议：`/root/chmlfrp/`）

> 📦 **镜像大小**: 约300MB，包含完整的前后端应用

#### 3. 导入Docker镜像

**在宝塔面板Docker管理中导入镜像：**

1. 进入 **Docker管理器**
2. 点击 **镜像管理** 选项卡
3. 点击 **添加本地镜像**
4. 选择上传的压缩包文件：`chmlfrp-panel-docker-image.tar.gz`
5. 点击 **导入** 等待完成

**命令行方式导入（可选）：**
```bash
# 解压并导入镜像
cd /root/chmlfrp/
tar -xzf chmlfrp-panel-docker-image.tar.gz
docker load < chmlfrp-panel-docker-image.tar
```

#### 4. 创建容器

**通过宝塔面板创建容器：**

1. 在 **镜像管理** 中找到 `chmlfrp-panel:latest`
2. 点击 **创建容器**
3. 配置容器参数：

**基础配置：**
- **容器名称**: `chmlfrp-panel`
- **内存限制**: `1GB` （推荐）
- **CPU限制**: `1核` （推荐）

**端口映射：**
| 服务端口 | 容器端口 | 说明 |
|----------|----------|------|
| 8888 | 80 | Web管理面板 |
| 3001 | 3001 | 后端API（可选） |
| 7000 | 7000 | FRP服务端口（可选） |

**存储卷挂载：**
| 宿主机路径 | 容器路径 | 说明 |
|------------|----------|------|
| `/www/chmlfrp/data` | `/app/data` | 配置数据 |
| `/www/chmlfrp/logs` | `/app/logs` | 日志文件 |
| `/www/chmlfrp/configs` | `/app/configs` | FRP配置 |

**环境变量：**
```bash
TZ=Asia/Shanghai
NODE_ENV=production
```

**重启策略：**
- 选择：`unless-stopped` （推荐）

#### 5. 启动容器

1. 点击 **创建** 按钮
2. 等待容器创建完成
3. 在 **容器管理** 中启动容器
4. 查看容器状态确保运行正常

**预期启动日志：**
```
🚀 启动 ChmlFrp 管理面板...
📍 前端地址: http://localhost
🔧 后端API: http://localhost:3001
👨‍💻 作者: linluo
🔒 防盗标识: linluo

正在启动后端服务...
等待后端服务启动...
✅ 后端服务已启动
启动nginx前端服务...
```

#### 6. 配置防火墙

**开放必要端口：**

1. 进入宝塔面板 **安全** 设置
2. 添加端口规则：
   - **端口**: `8888`
   - **协议**: `TCP`
   - **策略**: `允许`
   - **备注**: `ChmlFrp管理面板`

**或使用命令行：**
```bash
# 开放8888端口
firewall-cmd --permanent --add-port=8888/tcp
firewall-cmd --reload

# 验证端口开放
firewall-cmd --list-ports
```

#### 7. 访问管理面板

🎉 **部署完成！**

- **访问地址**: `http://您的服务器IP:8888`
- **例如**: `http://192.168.1.100:8888`

**登录方式：**
- 使用您的ChmlFrp账号密码登录
- 或者直接使用ChmlFrp Token登录

### 🔧 管理维护

#### 容器管理

**通过宝塔面板：**
- **启动容器**: Docker管理器 → 容器管理 → 启动
- **停止容器**: Docker管理器 → 容器管理 → 停止
- **重启容器**: Docker管理器 → 容器管理 → 重启
- **查看日志**: Docker管理器 → 容器管理 → 日志

**命令行方式：**
```bash
# 查看容器状态
docker ps

# 查看日志
docker logs -f chmlfrp-panel

# 重启容器
docker restart chmlfrp-panel

# 停止容器
docker stop chmlfrp-panel

# 启动容器
docker start chmlfrp-panel
```

#### 数据备份

**备份重要数据：**
```bash
# 创建备份目录
mkdir -p /backup/chmlfrp/$(date +%Y%m%d)

# 备份配置数据
cp -r /www/chmlfrp/data /backup/chmlfrp/$(date +%Y%m%d)/
cp -r /www/chmlfrp/configs /backup/chmlfrp/$(date +%Y%m%d)/

# 备份日志（可选）
cp -r /www/chmlfrp/logs /backup/chmlfrp/$(date +%Y%m%d)/
```

#### 镜像升级

**升级到新版本：**
1. 下载新版本镜像包
2. 在Docker管理器中导入新镜像
3. 停止当前容器
4. 删除旧容器（保留数据卷）
5. 使用新镜像创建容器
6. 启动新容器

### ❗ 常见问题

**Q: 容器启动失败？**
A: 检查端口是否被占用，确保8888端口没有被其他服务使用

**Q: 无法访问管理面板？**
A: 
1. 检查防火墙是否开放8888端口
2. 确认容器状态是否正常运行
3. 查看容器日志排查错误

**Q: 数据丢失问题？**
A: 确保正确挂载数据卷，重要数据都存储在 `/www/chmlfrp/data` 目录

**Q: 性能优化建议？**
A: 
- 推荐配置：2核CPU + 2GB内存
- 定期清理日志文件
- 使用SSD存储提升I/O性能

### 📞 技术支持

如果在部署过程中遇到问题：
1. 查看[故障排除](#🐛-故障排除)章节
2. 提交[GitHub Issues](https://github.com/your-username/chmlfrp-docker/issues)
3. 参与[讨论区](https://github.com/your-username/chmlfrp-docker/discussions)交流

---

## 🛠️ 功能特性

### 🎯 核心功能

| 功能 | 说明 | 状态 |
|------|------|------|
| 隧道管理 | 创建、编辑、删除隧道 | ✅ |
| 实时状态 | 隧道运行状态监控 | ✅ |
| 流量统计 | 实时流量和历史数据 | ✅ |
| 节点选择 | 支持所有ChmlFrp节点 | ✅ |
| 域名绑定 | 自定义域名和免费二级域名 | ✅ |

### 🚀 高级功能

| 功能 | 说明 | 状态 |
|------|------|------|
| 断线重连 | 网络断线自动重连机制 | ✅ |
| DNS自动配置 | 支持阿里云、腾讯云等DNS API | ✅ |
| 批量操作 | 一键启停多个隧道 | ✅ |
| 配置导出 | 导出FRP配置文件 | ✅ |
| 日志查看 | 实时查看运行日志 | ✅ |

### 🔐 安全特性

| 功能 | 说明 | 状态 |
|------|------|------|
| Token管理 | 安全的Token存储和验证 | ✅ |
| 自动退出 | Token失效自动退出登录 | ✅ |
| 多端保护 | 其他设备Token重置检测 | ✅ |
| 请求代理 | 后端代理所有API请求 | ✅ |

## 📋 使用指南

### 1. 登录系统

支持两种登录方式：
- **用户名密码登录**: 使用ChmlFrp账号密码
- **Token登录**: 直接使用ChmlFrp Token

### 2. 隧道管理

#### 创建隧道
1. 点击"新建隧道"按钮
2. 填写隧道基本信息：
   - 隧道名称（唯一标识）
   - 本地IP地址（默认127.0.0.1）
   - 本地端口
   - 协议类型（TCP/UDP/HTTP/HTTPS）
3. 选择节点（显示在线状态和VIP标识）
4. 配置高级选项：
   - 数据加密
   - 数据压缩
   - 自定义域名

#### 域名配置
- **免费二级域名**: 自动从可用列表选择
- **自定义域名**: 支持DNS自动配置
- **CNAME记录**: 自动更新DNS解析

#### 隧道操作
- **启动/停止**: 单个隧道控制
- **批量操作**: 选择多个隧道统一操作
- **状态监控**: 实时查看运行状态
- **流量统计**: 查看进出流量数据

### 3. DNS管理

#### 支持的DNS服务商
- 阿里云DNS
- 腾讯云DNS
- CloudFlare
- 华为云DNS

#### 配置步骤
1. 进入"域名管理"页面
2. 添加DNS服务商配置：
   - 选择服务商类型
   - 输入API凭证
   - 测试连接
3. 选择要管理的域名
4. 系统自动配置CNAME记录

### 4. 系统监控

#### 仪表盘
- 系统运行时间
- 用户信息概览
- 隧道统计
- 流量使用情况

#### 节点状态
- 节点在线率
- 带宽使用情况
- VIP节点标识
- 支持建站标识

## ⚙️ 配置说明

### 环境变量

```bash
# ChmlFrp API配置
CHMLFRP_API_BASE=http://cf-v1.uapis.cn

# 端口配置
FRONTEND_PORT=8888
BACKEND_PORT=3001

# 日志级别
LOG_LEVEL=info
```

### Docker配置

```yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "${FRONTEND_PORT:-8888}:80"
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "3001:3001"
    volumes:
      - frp-data:/app/data
    restart: unless-stopped

volumes:
  frp-data:

networks:
  default:
    name: frp-network
```

### 断线重连配置

```javascript
// 重连参数
{
  "autoReconnectEnabled": true,      // 启用自动重连
  "reconnectInterval": 5000,         // 重连间隔5秒
  "maxReconnectAttempts": 10,        // 最大重连次数
  "monitoringInterval": 30000,       // 监控间隔30秒
  "heartbeatInterval": 20,           // 心跳间隔20秒
  "heartbeatTimeout": 60             // 心跳超时60秒
}
```

## 🔧 开发指南

### 项目结构

```
chmlfrp-docker/
├── frontend/                 # React前端
│   ├── src/
│   │   ├── components/      # React组件
│   │   ├── utils/          # 工具函数
│   │   └── App.js          # 主应用
│   └── package.json
├── backend/                 # Node.js后端
│   ├── frp-manager.js      # FRP管理器
│   ├── dns-providers.js    # DNS服务商
│   ├── index.js           # 主服务器
│   └── package.json
├── docker-compose.yml      # Docker编排
├── Dockerfile.frontend     # 前端镜像
├── Dockerfile.backend      # 后端镜像
└── nginx.conf             # Nginx配置
```

### 本地开发

#### 后端开发
```bash
cd backend
npm install
npm run dev
```

#### 前端开发
```bash
cd frontend
npm install
npm start
```

### API文档

#### 隧道管理API
```javascript
// 获取隧道列表
GET /api/tunnel?token={token}

// 创建隧道
POST /api/create_tunnel
{
  "token": "user_token",
  "tunnelname": "my-tunnel",
  "node": "node-name",
  "porttype": "tcp",
  "localport": 8080,
  "encryption": false,
  "compression": false
}

// 启动单个隧道
POST /api/frp/start-tunnel
{
  "tunnel": {...},
  "userToken": "user_token"
}
```

#### DNS管理API
```javascript
// 获取域名列表
POST /api/dns/domains
{
  "provider": "aliyun",
  "accessKeyId": "key",
  "accessKeySecret": "secret"
}

// 创建DNS记录
POST /api/dns/records/create
{
  "provider": "aliyun",
  "domain": "example.com",
  "record": "api",
  "value": "1.2.3.4",
  "type": "A"
}
```

### 扩展开发

#### 添加新的DNS服务商
1. 编辑 `backend/dns-providers.js`
2. 实现标准接口：
   ```javascript
   {
     getDomains: async (config) => {...},
     getRecords: async (config, domain) => {...},
     createRecord: async (config, domain, record) => {...},
     updateRecord: async (config, domain, record) => {...},
     deleteRecord: async (config, domain, recordId) => {...}
   }
   ```

#### 自定义前端组件
1. 在 `frontend/src/components/` 创建新组件
2. 遵循Ant Design设计规范
3. 使用统一的API调用方式

## 📊 性能优化

### 前端优化
- ✅ 组件懒加载
- ✅ API请求缓存
- ✅ 图片资源优化
- ✅ 代码分割

### 后端优化
- ✅ 并发隧道管理
- ✅ 请求代理缓存
- ✅ 资源池管理
- ✅ 错误重试机制

### Docker优化
- ✅ 多阶段构建
- ✅ 镜像体积优化
- ✅ 数据持久化
- ✅ 容器重启策略

## 🐛 故障排除

### 常见问题

#### 1. 容器启动失败
```bash
# 查看日志
docker-compose logs backend
docker-compose logs frontend

# 重新构建
docker-compose down
docker-compose up -d --build
```

#### 2. 隧道连接失败
- 检查FRP配置是否正确
- 确认节点状态是否在线
- 查看隧道日志: `docker exec -it backend-container cat /app/frpc.log`

#### 3. DNS配置失败
- 验证API凭证是否正确
- 检查域名是否在DNS服务商管理
- 确认网络连接是否正常

#### 4. Token失效问题
- 检查Token是否已过期
- 确认在其他设备是否重置了Token
- 重新登录获取新Token

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 查看FRP日志
docker exec chmlfrp_docker-backend-1 tail -f /app/frpc.log
```

### 数据备份

```bash
# 备份配置数据
docker cp chmlfrp_docker-backend-1:/app/configs ./backup/

# 备份日志
docker cp chmlfrp_docker-backend-1:/app/frpc.log ./backup/
```

## 🤝 贡献指南

### 报告问题
- 使用GitHub Issues报告bug
- 提供详细的错误信息和复现步骤
- 包含环境信息（操作系统、Docker版本等）

### 提交代码
1. Fork项目到你的GitHub
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 创建Pull Request

### 开发规范
- 遵循现有代码风格
- 添加适当的注释
- 更新相关文档
- 确保功能测试通过

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

- [ChmlFrp](https://www.chmlfrp.cn/) - 提供优质的内网穿透服务
- [FRP](https://github.com/fatedier/frp) - 强大的内网穿透工具
- [Ant Design](https://ant.design/) - 优秀的React UI组件库
- [Docker](https://www.docker.com/) - 容器化技术支持

## 📞 联系方式

- **GitHub**: [项目地址](https://github.com/your-username/chmlfrp-docker)
- **Issues**: [问题反馈](https://github.com/your-username/chmlfrp-docker/issues)
- **Discussions**: [交流讨论](https://github.com/your-username/chmlfrp-docker/discussions)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

Made with ❤️ by linluo

</div>