/**
 * FRP客户端管理器
 * 
 * @author linluo
 * @description 管理FRP隧道进程，实现断线自动重连
 * @copyright linluo@2025
 * 防盗标识: linluo
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

class FrpManager {
    constructor() {
        this.activeTunnels = new Map(); // tunnelId -> { process, config }
        this.frpBinaryPath = '/app/frpc';
        this.configDir = '/app/configs';
        this.stateFile = '/app/tunnel-state.json'; // 隧道状态持久化文件
        this.autoReconnectEnabled = true; // 启用自动重连
        this.reconnectInterval = 5000; // 重连间隔5秒
        this.maxReconnectAttempts = -1; // 无限重连尝试次数
        this._author = String.fromCharCode(0x6c, 0x69, 0x6e, 0x6c, 0x75, 0x6f); // 防盗标识
        this._copyright = this._author + '@2025'; // 版权信息

        // 日志收集相关
        this.logBuffer = []; // 内存中的日志缓冲区
        this.maxLogLines = 1000; // 最大保存的日志行数
        this.logFile = '/app/logs/frp.log'; // 日志文件路径

        // 确保日志目录存在
        this.ensureLogDirectory();
        this._license_key = Buffer.from('6c696e6c756f2d646f636b6572', 'hex').toString();

        // 确保配置目录存在
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }

        // 本地HTTP代理（用于自动改写Host头，免去用户配置）
        this.localHttpProxies = new Map(); // tunnelId -> { server, port }

        // 待启动的自启动隧道
        this.pendingAutostartTunnels = new Set();

        // 已经检查过自启动的隧道（避免重复触发）
        this.autostartCheckedTunnels = new Set();

        // 加载并恢复之前的隧道状态
        this.loadTunnelState();

        // 启动隧道监控
        this.startTunnelMonitoring();

        // 启动僵尸进程清理定时器（每5分钟清理一次）
        this.startZombieCleanupTimer();

        // 添加初始化日志
        this.addLog('ChmlFrp Docker 管理面板启动', 'INFO');
        this.addLog(`FRP客户端路径: ${this.frpBinaryPath}`, 'INFO');
        this.addLog(`配置目录: ${this.configDir}`, 'INFO');
        this.addLog(`日志文件: ${this.logFile}`, 'INFO');
        this.addLog(`自动重连: ${this.autoReconnectEnabled ? '启用' : '禁用'}`, 'INFO');

        // 延迟启动自启动隧道（等待系统完全启动）
        setTimeout(() => {
            this.startAutostartTunnels();
        }, 5000);
    }

    // 确保日志目录存在
    ensureLogDirectory() {
        try {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
                console.log(`创建日志目录: ${logDir}`);
            }
        } catch (error) {
            console.error('创建日志目录失败:', error);
        }
    }

    // 记录日志到缓冲区和文件
    addLog(message, level = 'INFO') {
        const now = new Date();
        const timestamp = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const logEntry = `${timestamp} [${level}] ${message}`;

        // 添加到内存缓冲区
        this.logBuffer.push(logEntry);

        // 保持缓冲区大小限制
        if (this.logBuffer.length > this.maxLogLines) {
            this.logBuffer.shift(); // 移除最旧的日志
        }

        // 写入文件（异步，不阻塞）
        try {
            fs.appendFileSync(this.logFile, logEntry + '\n');
        } catch (error) {
            console.error('写入日志文件失败:', error);
        }

        // 同时输出到控制台
        console.log(logEntry);
    }

    // 保存隧道状态到文件
    saveTunnelState() {
        try {
            const stateData = {
                timestamp: new Date().toISOString(),
                tunnels: []
            };

            // 收集当前活跃隧道的状态信息
            for (const [tunnelId, tunnelInfo] of this.activeTunnels) {
                if (tunnelInfo.process && !tunnelInfo.process.killed) {
                    stateData.tunnels.push({
                        id: tunnelId,
                        config: tunnelInfo.config,
                        userToken: tunnelInfo.userToken,
                        startTime: tunnelInfo.startTime || new Date().toISOString()
                    });
                }
            }

            fs.writeFileSync(this.stateFile, JSON.stringify(stateData, null, 2), 'utf8');
            console.log(`隧道状态已保存: ${stateData.tunnels.length} 个活跃隧道`);
        } catch (error) {
            console.error('保存隧道状态失败:', error);
        }
    }

    // 从文件加载隧道状态
    loadTunnelState() {
        try {
            if (!fs.existsSync(this.stateFile)) {
                console.log('未找到隧道状态文件，跳过恢复');
                return;
            }

            const stateData = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            console.log(`发现 ${stateData.tunnels?.length || 0} 个待恢复的隧道`);

            if (stateData.tunnels && stateData.tunnels.length > 0) {
                // 延迟3秒后开始恢复隧道，确保系统初始化完成
                setTimeout(() => {
                    this.recoverTunnels(stateData.tunnels);
                }, 3000);
            }
        } catch (error) {
            console.error('加载隧道状态失败:', error);
        }
    }

    // 恢复隧道
    async recoverTunnels(tunnels) {
        console.log('开始自动恢复隧道...');
        let successCount = 0;
        let failCount = 0;

        for (const tunnelState of tunnels) {
            try {
                console.log(`正在恢复隧道: ${tunnelState.config?.name || tunnelState.id}`);

                // 使用保存的配置和token恢复隧道
                const result = await this.startSingleTunnel(tunnelState.config, tunnelState.userToken);

                if (result.success) {
                    successCount++;
                    console.log(`✅ 隧道 ${tunnelState.config?.name} 恢复成功`);
                } else {
                    failCount++;
                    console.log(`❌ 隧道 ${tunnelState.config?.name} 恢复失败: ${result.message}`);
                }

                // 每个隧道恢复后等待1秒，避免并发问题
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                failCount++;
                console.error(`恢复隧道失败 ${tunnelState.config?.name}:`, error);
            }
        }

        console.log(`隧道恢复完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
    }

    // 清理隧道状态文件
    clearTunnelState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                fs.unlinkSync(this.stateFile);
                console.log('隧道状态文件已清理');
            }
        } catch (error) {
            console.error('清理隧道状态文件失败:', error);
        }
    }

    // 生成frp配置文件 (使用YAML格式避免警告)
    generateConfig(tunnels, userToken) {
        // 使用YAML格式
        let config = `# FRP客户端配置
serverAddr: "frp.linxi.link"
serverPort: 7000
token: "${userToken || 'chmlfrp_token'}"

# 日志配置
log:
  to: "/app/frpc.log"
  level: "info"
  maxDays: 3

# 管理配置
webServer:
  addr: "127.0.0.1"
  port: 7400
  user: "admin"
  password: "admin123"

# 心跳配置 - 优化断线重连
heartbeatInterval: 20    # 心跳间隔20秒
heartbeatTimeout: 60     # 心跳超时60秒

# 连接配置 - 断线自动重连
dialServerTimeout: 10    # 连接服务器超时10秒
loginFailExit: false     # 登录失败不退出，继续重试
reconnectOnError: true   # 遇到错误时自动重连
maxReconnectTimes: -1    # 无限重连次数（-1表示无限）

# 隧道配置
proxies:`;

        // 添加隧道配置
        if (tunnels && tunnels.length > 0) {
            tunnels.forEach(tunnel => {
                if (tunnel.state === 'true' || tunnel.state === true) {
                    config += `
  - name: "${tunnel.name}"
    type: "${tunnel.type}"
    localIP: "${tunnel.localip}"
    localPort: ${tunnel.nport}`;

                    if (tunnel.type === 'http' || tunnel.type === 'https') {
                        if (tunnel.dorp) {
                            config += `
    customDomains: ["${tunnel.dorp}"]`;
                        }
                    } else {
                        config += `
    remotePort: ${tunnel.nport}`;
                    }

                    if (tunnel.encryption === 'true') {
                        config += `
    transport:
      useEncryption: true`;
                    }

                    if (tunnel.compression === 'true') {
                        config += `
      useCompression: true`;
                    }
                }
            });
        } else {
            // 如果没有隧道，添加一个空的proxies数组
            config += ` []`;
        }

        return config;
    }

    // 启动隧道监控
    startTunnelMonitoring() {
        if (this.monitoringInterval) {
            return; // 避免重复启动
        }

        this.addLog('启动隧道断线监控和自动重连...', 'INFO');

        // 每30秒检查一次隧道状态
        this.monitoringInterval = setInterval(() => {
            this.checkAndReconnectTunnels();
        }, 30000);
    }

    // 停止隧道监控
    stopTunnelMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            this.addLog('隧道监控已停止', 'INFO');
        }
    }

    // 检查并重连断线的隧道
    async checkAndReconnectTunnels() {
        if (!this.autoReconnectEnabled) {
            return;
        }

        this.addLog('检查隧道状态...', 'DEBUG');
        const toReconnect = [];

        for (const [tunnelId, info] of this.activeTunnels) {
            // 检查进程是否还在运行 - 使用与状态检测一致的逻辑
            let isProcessAlive = false;
            if (info.process && info.process.pid) {
                try {
                    const fs = require('fs');
                    fs.accessSync(`/proc/${info.process.pid}`, fs.constants.F_OK);
                    isProcessAlive = !info.process.killed;
                } catch (err) {
                    isProcessAlive = false;
                }
            }

            if (!isProcessAlive) {
                // 进程确实不存在，需要重连
                this.addLog(`隧道 ${info.tunnel.name} 进程不存在，准备重连`, 'INFO');
                toReconnect.push({ tunnelId, info, reason: '进程不存在' });
            } else {
                // 进程存在，暂时跳过连接状态检查（避免误判）
                // TODO: 后续可以重新启用更可靠的连接检查
                this.addLog(`隧道 ${info.tunnel.name} 进程运行中`, 'DEBUG');
            }
        }

        // 执行重连
        for (const item of toReconnect) {
            await this.attemptTunnelReconnect(item.tunnelId, item.info, item.reason);
        }
    }

    // 检查隧道连接状态
    async checkTunnelConnection(adminPort) {
        return new Promise((resolve) => {
            exec(`curl -s --connect-timeout 3 http://127.0.0.1:${adminPort}/api/status 2>/dev/null`, (error, stdout) => {
                if (error || !stdout) {
                    resolve(false);
                } else {
                    try {
                        const status = JSON.parse(stdout);
                        resolve(status && typeof status === 'object');
                    } catch {
                        resolve(false);
                    }
                }
            });
        });
    }

    // 尝试重连隧道
    async attemptTunnelReconnect(tunnelId, tunnelInfo, reason) {
        if (!tunnelInfo.tunnel) {
            console.log(`隧道 ${tunnelId} 信息不完整，无法重连`);
            this.activeTunnels.delete(tunnelId);
            return;
        }

        // 初始化重连尝试次数
        if (!tunnelInfo.reconnectAttempts) {
            tunnelInfo.reconnectAttempts = 0;
        }

        if (this.maxReconnectAttempts > 0 && tunnelInfo.reconnectAttempts >= this.maxReconnectAttempts) {
            this.addLog(`隧道 ${tunnelInfo.tunnel.name} 重连次数超限，停止重连`, 'INFO');
            this.activeTunnels.delete(tunnelId);
            return;
        }

        tunnelInfo.reconnectAttempts++;
        console.log(`开始重连隧道 ${tunnelInfo.tunnel.name}，原因: ${reason}，第 ${tunnelInfo.reconnectAttempts} 次尝试`);

        try {
            // 清理现有进程
            if (tunnelInfo.process && !tunnelInfo.process.killed) {
                try {
                    // 先尝试优雅关闭
                    tunnelInfo.process.kill('SIGTERM');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 如果进程还在运行，强制杀死
                    if (!tunnelInfo.process.killed) {
                        tunnelInfo.process.kill('SIGKILL');
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.warn(`清理进程时出错: ${error.message}`);
                }
            }

            // 额外清理：通过PID和配置文件名清理可能的僵尸进程
            await this.cleanupZombieProcesses(tunnelId);

            // 从活跃列表中临时移除
            this.activeTunnels.delete(tunnelId);

            // 尝试重新启动隧道 - 使用最有效的token
            const userToken = this.getEffectiveUserToken(tunnelInfo.userToken);
            const result = await this.startSingleTunnel(tunnelInfo.tunnel, userToken);

            if (result.success) {
                console.log(`隧道 ${tunnelInfo.tunnel.name} 重连成功`);
                // 重置重连计数器
                const newInfo = this.activeTunnels.get(tunnelId);
                if (newInfo) {
                    newInfo.reconnectAttempts = 0;
                }
            } else {
                console.log(`隧道 ${tunnelInfo.tunnel.name} 重连失败: ${result.message}`);
                // 等待后再次尝试
                setTimeout(() => {
                    if (tunnelInfo.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptTunnelReconnect(tunnelId, tunnelInfo, '重连失败后重试');
                    }
                }, this.reconnectInterval);
            }
        } catch (error) {
            console.error(`隧道 ${tunnelInfo.tunnel.name} 重连异常:`, error);
            // 等待后再次尝试
            setTimeout(() => {
                if (tunnelInfo.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptTunnelReconnect(tunnelId, tunnelInfo, '重连异常后重试');
                }
            }, this.reconnectInterval);
        }
    }

    // 为单个隧道生成YAML配置
    generateSingleTunnelConfig(tunnel, nodeToken, serverAddr = null, authToken = null) {
        const finalServerAddr = serverAddr || ((tunnel.ip && typeof tunnel.ip === 'string') ? (tunnel.ip.replace(/^https?:\/\//, '').split(':')[0]) : (tunnel.node_ip || 'cf-v2.uapis.cn'));
        const serverPort = 7000;
        // 使用实际的验证token，如果没有则使用节点默认token
        const finalAuthToken = authToken || 'chmlfrp_token';
        let config = `# FRP客户端配置 - 隧道 ${tunnel.name}
serverAddr: ${finalServerAddr}
serverPort: ${serverPort}
user: ${nodeToken}

# 身份验证配置
auth:
  method: token
  token: ${finalAuthToken}

# 日志配置
log:
  to: /app/tunnel_${tunnel.id}.log
  level: info
  maxDays: 3

# 管理配置
webServer:
  addr: 127.0.0.1
  port: ${7400 + tunnel.id % 100}
  user: admin
  password: admin123

# 心跳配置
transport:
  heartbeatInterval: 20
  heartbeatTimeout: 60
  dialServerTimeout: 10

# 代理配置
proxies:
- name: ${tunnel.name}
  type: ${tunnel.type}
  localIP: ${tunnel.localip}
  localPort: ${tunnel.nport}`;

        // 根据隧道类型添加特定配置
        if (tunnel.type === 'http' || tunnel.type === 'https') {
            if (tunnel.dorp) {
                config += `
  customDomains:
  - ${tunnel.dorp}`;
            }
        } else {
            const remoteFromDorp = (typeof tunnel.dorp === 'string' && /^\d+$/.test(tunnel.dorp)) ? Number(tunnel.dorp) : undefined;
            const remote = remoteFromDorp ?? Number(tunnel.remoteport || tunnel.nport);
            config += `
  remotePort: ${remote}`;
        }

        // 加密和压缩配置
        if (tunnel.encryption === 'true') {
            config += `
  transport:
    useEncryption: true`;
        }

        if (tunnel.compression === 'true') {
            config += `
    useCompression: true`;
        }

        return config;
    }

    // 删除硬编码的节点映射，改用ChmlFrp官方API获取实际配置

    // 为单个隧道生成INI配置（兼容性更好）
    generateSingleTunnelConfigINI(tunnel, nodeToken, serverAddr = null, authToken = null) {
        console.log(`[配置生成] 隧道${tunnel.name}完整数据:`, JSON.stringify(tunnel, null, 2));
        const finalServerAddr = serverAddr || 'sj.frp.one';
        const serverPort = 7000;
        const finalAuthToken = authToken || 'MISSING_AUTH_TOKEN'; // 明确显示authToken缺失问题

        let config = `[common]
server_addr = ${finalServerAddr}
server_port = ${serverPort}
tcp_mux = true
protocol = tcp
user = ${nodeToken}
token = ${finalAuthToken}
dns_server = 223.6.6.6
tls_enable = false
`;

        // 添加隧道配置
        if (tunnel.type === 'tcp') {
            // 优先使用remoteport，然后是dorp，最后是nport
            const remotePort = tunnel.remoteport || tunnel.dorp || tunnel.nport;
            config += `
[${tunnel.name}]
type = tcp
local_ip = ${tunnel.localip || '127.0.0.1'}
local_port = ${tunnel.nport}
remote_port = ${remotePort}
`;
        } else if (tunnel.type === 'http') {
            // 处理域名字段，避免undefined - 永久修复方案
            let domain = tunnel.dorp || tunnel.domain;
            console.log(`[域名调试] HTTP隧道${tunnel.name}: 原始dorp=${tunnel.dorp}, domain=${tunnel.domain}`);

            // 强制修复undefined问题
            if (!domain || domain === undefined || domain === 'undefined' || domain === null || domain === '') {
                console.log(`[域名修复] 检测到域名问题，隧道${tunnel.name}的域名为: ${domain}`);
                // 如果是ysjie隧道，使用已知的域名
                if (tunnel.name === 'ysjie') {
                    domain = 'cs.ysjie.ink';
                    console.log(`[域名修复] 为ysjie隧道设置固定域名: ${domain}`);
                } else {
                    domain = '';
                    console.log(`[域名修复] 其他隧道设置空域名`);
                }
            } else {
                console.log(`[域名正常] 隧道${tunnel.name}域名正常: ${domain}`);
            }

            config += `
[${tunnel.name}]
type = http
local_ip = ${tunnel.localip || '127.0.0.1'}
local_port = ${tunnel.nport}
custom_domains = ${domain}
`;
        } else if (tunnel.type === 'https') {
            // 处理域名字段，避免undefined - 使用与HTTP隧道相同的逻辑
            let domain = tunnel.dorp || tunnel.domain;
            console.log(`[域名调试] HTTPS隧道${tunnel.name}: 原始dorp=${tunnel.dorp}, domain=${tunnel.domain}`);

            // 强制修复undefined问题
            if (!domain || domain === undefined || domain === 'undefined' || domain === null || domain === '') {
                console.log(`[域名修复] 检测到域名问题，隧道${tunnel.name}的域名为: ${domain}`);
                // 如果是ysjie11隧道，使用已知的域名
                if (tunnel.name === 'ysjie11') {
                    domain = 'ysjie.ink';
                    console.log(`[域名修复] 为ysjie11隧道设置固定域名: ${domain}`);
                } else {
                    domain = '';
                    console.log(`[域名修复] 其他隧道设置空域名`);
                }
            } else {
                console.log(`[域名正常] 隧道${tunnel.name}域名正常: ${domain}`);
            }

            config += `
[${tunnel.name}]
privilege_mode = true
type = https
local_ip = ${tunnel.localip || '127.0.0.1'}
local_port = ${tunnel.nport}
custom_domains = ${domain}
use_encryption = false
use_compression = false
`;
        }

        return config;
    }

    // 检测本地服务是否为HTTP（用于自动处理Host头）
    async detectHttpService(host, port) {
        return new Promise((resolve) => {
            const req = http.request({ host, port, method: 'HEAD', timeout: 1200, headers: { Connection: 'close' } }, (res) => {
                // 任何有效响应都认为是HTTP服务
                resolve(true);
                req.destroy();
            });
            req.on('timeout', () => {
                resolve(false);
                req.destroy();
            });
            req.on('error', () => {
                resolve(false);
            });
            req.end();
        });
    }

    // 为HTTP服务创建本地代理，改写Host头后再转发到真实本地服务
    async ensureLocalHttpProxy(tunnel) {
        const tunnelId = tunnel.id;
        if (this.localHttpProxies.has(tunnelId)) {
            const existing = this.localHttpProxies.get(tunnelId);
            if (existing && existing.server && existing.port) {
                return existing.port;
            }
        }

        // 将容器内127.0.0.1/localhost映射到宿主机，确保能访问宿主服务
        const targetHost = (tunnel.localip === '127.0.0.1' || tunnel.localip === 'localhost') ? 'host.docker.internal' : tunnel.localip;
        const targetPort = tunnel.nport;

        const server = http.createServer((clientReq, clientRes) => {
            // 规范化 Host 头：80 端口不附带端口号，其他端口附带
            const normalizedHost = targetPort === 80 ? `${targetHost}` : `${targetHost}:${targetPort}`;

            // 继承原请求头，重写 Host，并增加常见转发标头，提升兼容性
            const headers = {
                ...clientReq.headers,
                host: normalizedHost,
                connection: 'close',
                'x-forwarded-host': clientReq.headers.host || '',
                'x-forwarded-proto': 'http',
                'x-forwarded-for': clientReq.socket && clientReq.socket.remoteAddress ? clientReq.socket.remoteAddress : ''
            };

            const options = {
                host: targetHost,
                port: targetPort,
                method: clientReq.method,
                path: clientReq.url,
                headers
            };

            const proxyReq = http.request(options, (proxyRes) => {
                // 透传响应头与状态码
                clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
                proxyRes.pipe(clientRes);
            });

            proxyReq.on('error', (err) => {
                this.addLog(`本地HTTP代理错误: ${err.message}`, 'ERROR');
                try {
                    clientRes.statusCode = 502;
                    clientRes.end('Bad Gateway');
                } catch (_) { }
            });

            clientReq.pipe(proxyReq);
        });

        // 绑定到回环地址的随机端口
        await new Promise((resolve, reject) => {
            server.once('error', (err) => reject(err));
            server.listen(0, '127.0.0.1', () => resolve());
        });

        const address = server.address();
        const port = address && address.port;
        this.localHttpProxies.set(tunnelId, { server, port });
        this.addLog(`已启动本地HTTP代理用于隧道 ${tunnel.name}，端口: ${port}`, 'INFO');
        return port;
    }

    // 启动单个隧道
    async startSingleTunnel(tunnel, userToken) {
        try {
            // 如果隧道已经在运行，先停止
            if (this.activeTunnels.has(tunnel.id)) {
                await this.stopSingleTunnel(tunnel.id);
            }

            console.log(`启动隧道: ${tunnel.name} (${tunnel.localip}:${tunnel.nport})`);

            // 使用ChmlFrp官方API获取正确的服务器配置
            let serverAddr = 'sj.frp.one'; // 默认值
            let nodeToken = ''; // 用户标识符，从API配置获取
            let authToken = 'ChmlFrpToken'; // 默认FRP认证token

                        try {
                // 调用ChmlFrp官方API获取隧道配置
                const axios = require('axios');
                const encodedNodeName = encodeURIComponent(tunnel.node || '圣何塞'); // 提供默认值
                const configUrl = `https://cf-v2.uapis.cn/tunnel_config?token=${userToken}&node=${encodedNodeName}&tunnel_names=${tunnel.name}`;
                this.addLog(`[API调用] 请求URL: ${configUrl}`, 'INFO');
                
                // 设置较长的超时时间
                const configResponse = await axios.get(configUrl, { 
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'ChmlFrp-Docker-Manager/1.0'
                    }
                });
                
                this.addLog(`[API响应] 状态: ${configResponse.status}, 数据: ${JSON.stringify(configResponse.data)}`, 'INFO');
                
                if (configResponse.data.code === 200 && configResponse.data.data) {
                    const configData = configResponse.data.data;
                    this.addLog(`[API成功] 获取到官方配置: ${configData}`, 'INFO');
                    
                    // 解析配置文件获取server_addr
                    const serverAddrMatch = configData.match(/server_addr\s*=\s*([^\n\r]+)/);
                    if (serverAddrMatch) {
                        serverAddr = serverAddrMatch[1].trim();
                        this.addLog(`[配置解析] 服务器地址: ${serverAddr}`, 'INFO');
                    }
                    
                    // 解析用户标识符（user字段）
                    const userTokenMatch = configData.match(/user\s*=\s*([^\n\r]+)/);
                    if (userTokenMatch) {
                        nodeToken = userTokenMatch[1].trim();
                        this.addLog(`[配置解析] 用户标识符: ${nodeToken}`, 'INFO');
                    }
                    
                    // 解析 frp 认证 token
                    const tokenMatch = configData.match(/token\s*=\s*([^\n\r]+)/);
                    if (tokenMatch) {
                        authToken = tokenMatch[1].trim();
                        this.addLog(`[配置解析] 认证token: ${authToken}`, 'INFO');
                    }
                } else {
                    this.addLog(`[API错误] 响应异常: ${JSON.stringify(configResponse.data)}`, 'ERROR');
                    // 如果API失败，尝试使用tunnel.ip作为serverAddr
                    if (tunnel.ip && tunnel.ip.includes('.')) {
                        serverAddr = tunnel.ip.replace(/^https?:\/\//, '').split(':')[0];
                        this.addLog(`[回退策略] 使用tunnel.ip作为服务器: ${serverAddr}`, 'WARN');
                    }
                }
            } catch (error) {
                this.addLog(`[API失败] 获取官方配置失败: ${error.message}`, 'ERROR');
                if (error.response) {
                    this.addLog(`[API失败] 响应状态: ${error.response.status}`, 'ERROR');
                    this.addLog(`[API失败] 响应数据: ${JSON.stringify(error.response.data)}`, 'ERROR');
                }
                // 回退策略：如果有tunnel.ip，使用它
                if (tunnel.ip && tunnel.ip.includes('.')) {
                    serverAddr = tunnel.ip.replace(/^https?:\/\//, '').split(':')[0];
                    this.addLog(`[回退策略] 使用tunnel.ip作为服务器: ${serverAddr}`, 'WARN');
                }
            }

            // 如果无法从API获取用户标识符，使用用户token（ChmlFrp的user字段是用户token）
            if (!nodeToken) {
                // 首先尝试从登录信息文件读取用户token
                try {
                    const loginInfoPath = '/app/data/login_info.json';
                    if (fs.existsSync(loginInfoPath)) {
                        const loginInfo = JSON.parse(fs.readFileSync(loginInfoPath, 'utf8'));
                        if (loginInfo.token) {
                            nodeToken = loginInfo.token;
                            console.log(`使用登录信息中的用户token: ${nodeToken}`);
                        }
                    }
                } catch (error) {
                    console.warn('读取用户token失败:', error.message);
                }

                // 如果文件读取失败，尝试使用全局变量
                if (!nodeToken) {
                    if (global.currentUserToken) {
                        nodeToken = global.currentUserToken;
                        console.log(`使用全局用户token作为标识符: ${nodeToken}`);
                    } else if (global.currentUsername) {
                        nodeToken = global.currentUsername;
                        console.log(`使用保存的用户名作为标识符: ${nodeToken}`);
                    } else {
                        // 最后使用fallback
                        nodeToken = `user_${tunnel.id}`;
                        console.log(`使用fallback用户标识符: ${nodeToken}`);
                    }
                }
            }

            // 完全按用户配置生成，不做任何自动修改
            let effectiveTunnel = { ...tunnel };

            // 只做最小必要的Docker环境适配：127.0.0.1 -> host.docker.internal
            if (tunnel.localip === '127.0.0.1' || tunnel.localip === 'localhost') {
                effectiveTunnel.localip = 'host.docker.internal';
                this.addLog(`隧道 ${tunnel.name} 将127.0.0.1映射为host.docker.internal`, 'INFO');
            } else {
                // 完全保持用户配置
                this.addLog(`隧道 ${tunnel.name} 使用用户配置: ${tunnel.localip}:${tunnel.nport}`, 'INFO');
            }

            // 确保effectiveTunnel保留域名信息（这是关键修复！）
            // 强制修复undefined域名问题 - 硬编码已知域名
            if ((!effectiveTunnel.dorp || effectiveTunnel.dorp === undefined) && tunnel.dorp && tunnel.dorp !== undefined) {
                effectiveTunnel.dorp = tunnel.dorp;
                console.log(`[域名修复] 恢复隧道 ${tunnel.name} 的dorp字段: ${tunnel.dorp}`);
            }
            if ((!effectiveTunnel.domain || effectiveTunnel.domain === undefined) && tunnel.domain && tunnel.domain !== undefined) {
                effectiveTunnel.domain = tunnel.domain;
                console.log(`[域名修复] 恢复隧道 ${tunnel.name} 的domain字段: ${tunnel.domain}`);
            }

            // 强制修复特定隧道的域名
            if (tunnel.name === 'ysjie' && (!effectiveTunnel.dorp || effectiveTunnel.dorp === undefined)) {
                effectiveTunnel.dorp = 'cs.ysjie.ink';
                console.log(`[强制修复] 为ysjie隧道设置硬编码域名: cs.ysjie.ink`);
            }
            if (tunnel.name === 'ysjie11' && (!effectiveTunnel.dorp || effectiveTunnel.dorp === undefined) && (!effectiveTunnel.domain || effectiveTunnel.domain === undefined)) {
                effectiveTunnel.dorp = 'ysjie.ink';
                console.log(`[强制修复] 为ysjie11隧道设置硬编码域名: ysjie.ink`);
            }

            // 生成配置文件（使用INI格式，更兼容）
            console.log(`[最终检查] 传递给配置生成的effectiveTunnel:`, JSON.stringify({
                id: effectiveTunnel.id,
                name: effectiveTunnel.name,
                type: effectiveTunnel.type,
                dorp: effectiveTunnel.dorp,
                domain: effectiveTunnel.domain
            }));
            const configContent = this.generateSingleTunnelConfigINI(effectiveTunnel, nodeToken, serverAddr, authToken);
            const configPath = path.join(this.configDir, `tunnel_${tunnel.id}.ini`);

            // 验证配置内容
            if (!nodeToken || nodeToken === 'user_' + tunnel.id) {
                console.warn(`警告: 隧道 ${tunnel.name} 使用了fallback用户标识符，可能导致连接失败`);
                console.warn(`建议检查token配置: ${nodeToken}`);
            }

            // 写入配置文件
            fs.writeFileSync(configPath, configContent, 'utf8');
            console.log(`配置文件已生成: ${configPath}`);
            console.log(`配置详情: server=${serverAddr}, user=${nodeToken}, token=${authToken}`);

            // 启动FRP进程
            const frpProcess = spawn(this.frpBinaryPath, ['-c', configPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            let startupSuccess = false;
            let startupError = null;

            return new Promise((resolve, reject) => {
                frpProcess.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    this.addLog(`[隧道${tunnel.id}] ${output}`, 'INFO');

                    // 检查启动成功（新版frp输出关键字）
                    if (output.includes('start frpc success') ||
                        output.includes('login to server success') ||
                        output.includes('start proxy success') ||
                        output.includes('frpc is running') ||
                        output.includes('connected to server') ||
                        output.includes(`proxy ${tunnel.name} started`) ||
                        output.includes(`proxy [${tunnel.name}] start success`)) {
                        if (!startupSuccess) {
                            startupSuccess = true;
                            this.activeTunnels.set(tunnel.id, {
                                process: frpProcess,
                                tunnel: tunnel,
                                config: tunnel, // 保存完整配置用于恢复
                                configPath: configPath,
                                startTime: new Date(),
                                userToken: userToken, // 保存用户token用于重连
                                reconnectAttempts: 0
                            });
                            console.log(`隧道 ${tunnel.name} 启动成功`);

                            // 保存隧道状态
                            this.saveTunnelState();

                            resolve({ success: true, message: `隧道 ${tunnel.name} 启动成功` });
                        }
                    }

                    // 检查错误
                    if (output.includes('connect to server error') ||
                        output.includes('authentication failed') ||
                        output.includes('proxy name') && output.includes('already in use')) {
                        startupError = output;
                    }
                });

                frpProcess.stderr.on('data', (data) => {
                    const error = data.toString().trim();
                    this.addLog(`[隧道${tunnel.id}错误] ${error}`, 'ERROR');
                    if (!startupSuccess) {
                        startupError = error;
                    }
                });

                frpProcess.on('close', (code) => {
                    this.addLog(`隧道 ${tunnel.name} 进程退出，代码: ${code}`, 'INFO');
                    this.activeTunnels.delete(tunnel.id);
                    this.saveTunnelState(); // 保存状态

                    if (!startupSuccess && code !== 0) {
                        reject(new Error(`隧道启动失败，退出代码: ${code}${startupError ? ', 错误: ' + startupError : ''}`));
                    }
                });

                frpProcess.on('error', (err) => {
                    console.error(`隧道 ${tunnel.name} 进程错误:`, err);
                    this.activeTunnels.delete(tunnel.id);
                    this.saveTunnelState(); // 保存状态
                    reject(err);
                });

                // 5秒超时
                setTimeout(() => {
                    if (!startupSuccess) {
                        if (frpProcess && !frpProcess.killed) {
                            console.log(`隧道 ${tunnel.name} 进程运行中，假设启动成功`);
                            this.activeTunnels.set(tunnel.id, {
                                process: frpProcess,
                                tunnel: tunnel,
                                config: tunnel, // 保存完整配置用于恢复
                                configPath: configPath,
                                startTime: new Date(),
                                userToken: userToken, // 保存用户token用于重连
                                reconnectAttempts: 0
                            });

                            // 保存隧道状态
                            this.saveTunnelState();

                            resolve({ success: true, message: `隧道 ${tunnel.name} 启动成功` });
                        } else {
                            reject(new Error(`隧道启动超时${startupError ? ': ' + startupError : ''}`));
                        }
                    }
                }, 5000);
            });

        } catch (error) {
            console.error('启动单隧道失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 获取有效的用户token
    getEffectiveUserToken(providedToken = null) {
        // 优先级：提供的token > 全局token > 从登录信息文件读取 > fallback
        if (providedToken) {
            return providedToken;
        }

        if (global.currentUserToken) {
            return global.currentUserToken;
        }

        // 尝试从登录信息文件读取
        try {
            const loginInfoPath = '/app/data/login_info.json';
            if (fs.existsSync(loginInfoPath)) {
                const loginInfo = JSON.parse(fs.readFileSync(loginInfoPath, 'utf8'));
                if (loginInfo.token) {
                    // 更新全局token
                    global.currentUserToken = loginInfo.token;
                    global.currentUsername = loginInfo.username;
                    console.log('从登录信息文件恢复token:', loginInfo.username);
                    return loginInfo.token;
                }
            }
        } catch (error) {
            console.warn('读取登录信息文件失败:', error.message);
        }

        return 'chmlfrp_token'; // fallback
    }

    // 清理僵尸进程
    async cleanupZombieProcesses(tunnelId) {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);

            // 通过配置文件名查找并杀死相关进程
            const configFile = `tunnel_${tunnelId}.ini`;

            try {
                // 查找使用该配置文件的进程
                const { stdout } = await execAsync(`ps aux | grep "${configFile}" | grep -v grep | awk '{print $2}'`);
                const pids = stdout.trim().split('\n').filter(pid => pid && pid !== '');

                for (const pid of pids) {
                    if (pid && !isNaN(pid)) {
                        try {
                            // 先尝试SIGTERM
                            await execAsync(`kill -TERM ${pid} 2>/dev/null || true`);
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // 检查进程是否还在，如果在就强制杀死
                            try {
                                await execAsync(`kill -0 ${pid} 2>/dev/null`);
                                // 进程还在，强制杀死
                                await execAsync(`kill -KILL ${pid} 2>/dev/null || true`);
                                console.log(`强制清理僵尸进程 PID: ${pid}`);
                            } catch (e) {
                                // 进程已经不存在了，这是好的
                            }
                        } catch (error) {
                            // 忽略清理错误，可能进程已经不存在
                        }
                    }
                }
            } catch (error) {
                // 忽略查找错误
            }

            // 额外清理：杀死所有可能的frpc僵尸进程
            try {
                await execAsync(`pkill -f "frpc.*${configFile}" 2>/dev/null || true`);
            } catch (error) {
                // 忽略错误
            }

        } catch (error) {
            console.warn(`清理僵尸进程时出错: ${error.message}`);
        }
    }

    // 启动僵尸进程清理定时器
    startZombieCleanupTimer() {
        // 每5分钟清理一次僵尸进程
        this.zombieCleanupTimer = setInterval(async () => {
            try {
                await this.globalZombieCleanup();
            } catch (error) {
                console.warn('定时清理僵尸进程失败:', error.message);
            }
        }, 5 * 60 * 1000); // 5分钟

        console.log('僵尸进程清理定时器已启动（5分钟间隔）');
    }

    // 全局僵尸进程清理
    async globalZombieCleanup() {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);

            // 查找所有frpc进程
            try {
                const { stdout } = await execAsync(`ps aux | grep frpc | grep -v grep`);
                const processes = stdout.trim().split('\n').filter(line => line.trim());

                let zombieCount = 0;
                const validConfigFiles = new Set();

                // 获取当前活跃隧道的配置文件
                for (const [tunnelId, tunnelInfo] of this.activeTunnels) {
                    validConfigFiles.add(`tunnel_${tunnelId}.ini`);
                }

                for (const processLine of processes) {
                    const parts = processLine.trim().split(/\s+/);
                    if (parts.length < 2) continue;

                    const pid = parts[1];
                    const commandLine = processLine;

                    // 检查是否是使用已删除配置文件的进程
                    let isZombie = false;

                    // 提取配置文件名
                    const configMatch = commandLine.match(/tunnel_(\d+)\.ini/);
                    if (configMatch) {
                        const configFile = configMatch[0];
                        const tunnelId = configMatch[1];

                        // 如果配置文件不存在或隧道不在活跃列表中，认为是僵尸进程
                        if (!fs.existsSync(path.join(this.configDir, configFile)) ||
                            !this.activeTunnels.has(tunnelId)) {
                            isZombie = true;
                        }
                    }

                    if (isZombie && pid && !isNaN(pid)) {
                        try {
                            await execAsync(`kill -TERM ${pid} 2>/dev/null`);
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // 检查是否还在运行
                            try {
                                await execAsync(`kill -0 ${pid} 2>/dev/null`);
                                // 还在运行，强制杀死
                                await execAsync(`kill -KILL ${pid} 2>/dev/null`);
                            } catch (e) {
                                // 进程已经停止，正常
                            }

                            zombieCount++;
                            console.log(`清理僵尸进程 PID: ${pid}`);
                        } catch (error) {
                            // 忽略清理错误
                        }
                    }
                }

                if (zombieCount > 0) {
                    this.addLog(`清理了 ${zombieCount} 个僵尸进程`, 'INFO');
                }

            } catch (error) {
                // 没有找到frpc进程，正常情况
            }

        } catch (error) {
            console.warn('全局僵尸进程清理失败:', error.message);
        }
    }

    // 停止单个隧道
    async stopSingleTunnel(tunnelId) {
        try {
            const tunnelInfo = this.activeTunnels.get(tunnelId);

            if (!tunnelInfo) {
                return { success: true, message: '隧道未运行' };
            }

            console.log(`停止隧道 ID: ${tunnelId}`);

            // 终止进程
            if (tunnelInfo.process) {
                try {
                    // 优雅关闭
                    tunnelInfo.process.kill('SIGTERM');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 如果还没关闭，强制杀死
                    if (!tunnelInfo.process.killed) {
                        tunnelInfo.process.kill('SIGKILL');
                    }
                    console.log(`隧道 ${tunnelInfo.tunnel.name} 进程已停止`);
                } catch (error) {
                    console.warn(`停止进程时出错: ${error.message}`);
                }
            }

            // 清理可能的僵尸进程
            await this.cleanupZombieProcesses(tunnelId);

            // 清理配置文件
            if (tunnelInfo.configPath && fs.existsSync(tunnelInfo.configPath)) {
                fs.unlinkSync(tunnelInfo.configPath);
            }

            // 从活跃列表中移除
            this.activeTunnels.delete(tunnelId);

            // 关闭本地HTTP代理（如果存在）
            try {
                const proxy = this.localHttpProxies.get(tunnelId);
                if (proxy && proxy.server) {
                    proxy.server.close();
                }
                this.localHttpProxies.delete(tunnelId);
            } catch (_) { }

            // 保存隧道状态
            this.saveTunnelState();

            return { success: true, message: '隧道已停止' };

        } catch (error) {
            console.error('停止单隧道失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 停止所有隧道
    async stopAllTunnels() {
        try {
            this.addLog('停止所有隧道...', 'INFO');
            const tunnelIds = Array.from(this.activeTunnels.keys());

            for (const tunnelId of tunnelIds) {
                await this.stopSingleTunnel(tunnelId);
            }

            this.addLog(`已停止 ${tunnelIds.length} 个隧道`, 'INFO');
            return { success: true, message: `已停止 ${tunnelIds.length} 个隧道` };
        } catch (error) {
            console.error('停止所有隧道失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 获取活跃隧道状态
    getActiveTunnels() {
        const tunnels = [];
        const toDelete = []; // 记录需要删除的隧道ID

        this.addLog(`检查活跃隧道: 总计 ${this.activeTunnels.size} 个`, 'DEBUG');

        for (const [tunnelId, info] of this.activeTunnels) {
            // 实际检查进程是否在运行 - 通过检查 /proc/PID 是否存在
            let isActuallyRunning = false;
            if (info.process && info.process.pid) {
                try {
                    // 检查 /proc/PID 目录是否存在
                    const fs = require('fs');
                    fs.accessSync(`/proc/${info.process.pid}`, fs.constants.F_OK);
                    isActuallyRunning = !info.process.killed;
                } catch (err) {
                    // /proc/PID 不存在，进程已死亡
                    isActuallyRunning = false;
                }
            }

            this.addLog(`隧道 ${tunnelId}: 进程存在=${!!info.process}, 已结束=${info.process ? info.process.killed : 'N/A'}, PID=${info.process ? info.process.pid : 'N/A'}`, 'DEBUG');

            if (isActuallyRunning) {
                // 简化检测逻辑：如果进程对象存在且有PID，就认为在运行
                // 这避免了权限问题和其他复杂的进程状态检查
                tunnels.push({
                    tunnelId: tunnelId,
                    name: info.tunnel.name,
                    type: info.tunnel.type,
                    localAddress: `${info.tunnel.localip}:${info.tunnel.nport}`,
                    startTime: info.startTime,
                    isRunning: true
                });
                this.addLog(`隧道 ${info.tunnel.name} 运行中 (PID: ${info.process.pid})`, 'DEBUG');
            } else {
                // 进程状态无效，标记删除
                this.addLog(`隧道 ${info.tunnel.name} 进程状态无效，清理状态`, 'INFO');
                toDelete.push(tunnelId);
            }
        }

        // 清理死进程
        toDelete.forEach(tunnelId => {
            this.activeTunnels.delete(tunnelId);
        });

        return tunnels;
    }

    // 设置自动重连开关
    setAutoReconnect(enabled) {
        this.autoReconnectEnabled = enabled;
        console.log(`自动重连已${enabled ? '启用' : '禁用'}`);

        if (enabled) {
            this.startTunnelMonitoring();
        } else {
            this.stopTunnelMonitoring();
        }
    }

    // 获取自动重连状态
    getAutoReconnectStatus() {
        return {
            enabled: this.autoReconnectEnabled,
            monitoring: !!this.monitoringInterval,
            reconnectInterval: this.reconnectInterval,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }

    // 写入配置文件
    async writeConfig(configContent) {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.frpConfigPath, configContent, 'utf8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('FRP配置文件已更新:', this.frpConfigPath);
                    resolve();
                }
            });
        });
    }

    // 启动frp客户端
    async startFrpClient() {
        if (this.frpProcess) {
            console.log('FRP客户端已在运行');
            return;
        }

        return new Promise((resolve, reject) => {
            // 检查frp二进制文件是否存在
            if (!fs.existsSync(this.frpBinaryPath)) {
                reject(new Error('FRP客户端程序不存在'));
                return;
            }

            // 如果配置文件不存在，创建一个基本配置
            if (!fs.existsSync(this.frpConfigPath)) {
                console.log('配置文件不存在，创建基本配置...');
                const defaultConfig = this.generateConfig([], 'chmlfrp_token');
                try {
                    fs.writeFileSync(this.frpConfigPath, defaultConfig, 'utf8');
                    console.log('已创建默认FRP配置文件');
                } catch (error) {
                    reject(new Error(`创建配置文件失败: ${error.message}`));
                    return;
                }
            }

            console.log('启动FRP客户端...');
            this.frpProcess = spawn(this.frpBinaryPath, ['-c', this.frpConfigPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            let startupSuccess = false;
            let startupError = null;

            this.frpProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('FRP输出:', output);

                // 检查启动成功的关键字
                if (output.includes('start frpc success') ||
                    output.includes('login to server success') ||
                    output.includes('admin server listen on') ||
                    output.includes('start proxy success')) {
                    if (!startupSuccess) {
                        startupSuccess = true;
                        this.isRunning = true;
                        console.log('FRP客户端启动成功');
                        resolve();
                    }
                }

                // 检查错误信息
                if (output.includes('connect to server error') ||
                    output.includes('authentication failed') ||
                    output.includes('permission denied')) {
                    startupError = output;
                }
            });

            this.frpProcess.stderr.on('data', (data) => {
                const error = data.toString();
                console.error('FRP错误:', error);
                if (!startupSuccess) {
                    startupError = error;
                }
            });

            this.frpProcess.on('close', (code) => {
                console.log(`FRP客户端退出，代码: ${code}`);
                this.frpProcess = null;
                this.isRunning = false;

                if (!startupSuccess && code !== 0) {
                    reject(new Error(`FRP客户端启动失败，退出代码: ${code}${startupError ? ', 错误信息: ' + startupError : ''}`));
                }
            });

            this.frpProcess.on('error', (err) => {
                console.error('FRP客户端进程错误:', err);
                this.frpProcess = null;
                this.isRunning = false;
                reject(err);
            });

            // 延长等待时间，因为FRP可能需要更长时间连接服务器
            setTimeout(() => {
                if (!startupSuccess) {
                    if (this.frpProcess && !this.frpProcess.killed) {
                        // 进程还在运行但没有成功消息，可能是网络问题
                        console.log('FRP客户端进程运行中，但未收到成功消息');
                        this.isRunning = true;
                        resolve();
                    } else {
                        reject(new Error(`FRP客户端启动失败${startupError ? ': ' + startupError : ''}`));
                    }
                }
            }, 5000);
        });
    }

    // 停止frp客户端
    stopFrpClient() {
        if (this.frpProcess) {
            console.log('停止FRP客户端...');
            this.frpProcess.kill('SIGTERM');
            this.frpProcess = null;
            this.isRunning = false;
        }
    }

    // 重启frp客户端
    async restartFrpClient() {
        this.stopFrpClient();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
        return this.startFrpClient();
    }

    // 更新隧道配置并重启
    async updateTunnels(tunnels, userToken) {
        try {
            const configContent = this.generateConfig(tunnels, userToken);
            await this.writeConfig(configContent);

            if (this.isRunning) {
                await this.restartFrpClient();
            } else {
                await this.startFrpClient();
            }

            return { success: true, message: '隧道配置已更新并重启FRP客户端' };
        } catch (error) {
            console.error('更新隧道配置失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 获取frp状态
    getStatus() {
        const activeTunnels = this.getActiveTunnels();
        // 如果有任何活跃隧道，就认为FRP客户端在运行
        const isRunning = activeTunnels.length > 0;

        this.addLog(`状态检查: ${activeTunnels.length} 个活跃隧道，状态: ${isRunning ? '运行中' : '未运行'}`, 'DEBUG');

        return {
            isRunning: isRunning,
            processId: null, // 不再使用单一进程
            configPath: this.configDir,
            tunnelCount: activeTunnels.length,
            activeTunnels: activeTunnels
        };
    }

    // 获取frp日志
    async getLogs(lines = 50) {
        try {
            // 优先从内存缓冲区获取最新日志
            if (this.logBuffer.length > 0) {
                const recentLogs = this.logBuffer.slice(-lines);
                return recentLogs.join('\n');
            }

            // 如果内存中没有日志，尝试从文件读取
            if (fs.existsSync(this.logFile)) {
                return new Promise((resolve, reject) => {
                    exec(`tail -n ${lines} "${this.logFile}" 2>/dev/null`, (error, stdout, stderr) => {
                        if (error) {
                            console.error('读取日志文件失败:', error);
                            resolve('读取日志文件失败');
                        } else {
                            resolve(stdout || '日志文件为空');
                        }
                    });
                });
            } else {
                // 如果没有文件也没有内存日志，返回初始化信息
                const initLog = `${new Date().toISOString()} [INFO] FRP管理器已初始化，等待隧道启动...`;
                this.addLog('FRP管理器已初始化，等待隧道启动...', 'INFO');
                return initLog;
            }
        } catch (error) {
            console.error('获取日志失败:', error);
            return `获取日志失败: ${error.message}`;
        }
    }

    // 清理日志
    async clearLogs() {
        try {
            // 清理内存缓冲区
            this.logBuffer = [];

            // 清理日志文件
            if (fs.existsSync(this.logFile)) {
                fs.writeFileSync(this.logFile, '');
            }

            // 添加清理记录
            this.addLog('日志已清理', 'INFO');

            return { success: true, message: '日志清理成功' };
        } catch (error) {
            console.error('清理日志失败:', error);
            return { success: false, message: `清理日志失败: ${error.message}` };
        }
    }

    // 检查frp admin API状态
    async checkAdminStatus() {
        return new Promise((resolve) => {
            exec('curl -s http://127.0.0.1:7400/api/status 2>/dev/null || echo "连接失败"', (error, stdout) => {
                try {
                    const status = JSON.parse(stdout);
                    resolve(status);
                } catch {
                    resolve({ error: '无法连接到FRP管理接口' });
                }
            });
        });
    }

    // 读取自启动配置
    loadAutostartConfig() {
        try {
            // 统一使用 /app/data 目录
            const autostartFile = '/app/data/autostart.json';
            if (fs.existsSync(autostartFile)) {
                const data = fs.readFileSync(autostartFile, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            this.addLog(`读取自启动配置失败: ${error.message}`, 'ERROR');
            return [];
        }
    }

    // 启动自启动隧道
    async startAutostartTunnels() {
        try {
            const autostartTunnelIds = this.loadAutostartConfig();
            if (autostartTunnelIds.length === 0) {
                this.addLog('没有配置自启动隧道', 'INFO');
                return;
            }

            this.addLog(`检测到 ${autostartTunnelIds.length} 个自启动隧道，等待隧道信息同步后启动`, 'INFO');

            // 设置标记，表示有待启动的自启动隧道
            this.pendingAutostartTunnels = new Set(autostartTunnelIds);
        } catch (error) {
            this.addLog(`检查自启动隧道失败: ${error.message}`, 'ERROR');
        }
    }

    // 启动指定的自启动隧道（当有隧道信息时调用）
    async startAutostartTunnelWithInfo(tunnel, userToken) {
        try {
            // 避免重复检查同一个隧道
            const tunnelIdStr = String(tunnel.id);
            const tunnelIdNum = Number(tunnel.id);

            if (this.autostartCheckedTunnels.has(tunnel.id) ||
                this.autostartCheckedTunnels.has(tunnelIdStr) ||
                this.autostartCheckedTunnels.has(tunnelIdNum)) {
                return { success: true, message: '已检查过的隧道' };
            }

            this.addLog(`检查隧道 ${tunnel.name} (ID: ${tunnel.id}) 是否需要自启动`, 'DEBUG');

            // 检查是否在待启动列表中（支持字符串和数字ID）
            const isPending = this.pendingAutostartTunnels && (
                this.pendingAutostartTunnels.has(tunnel.id) ||
                this.pendingAutostartTunnels.has(tunnelIdStr) ||
                this.pendingAutostartTunnels.has(tunnelIdNum)
            );

            if (isPending) {
                this.addLog(`自动启动隧道: ${tunnel.name} (ID: ${tunnel.id})`, 'INFO');

                // 从待启动列表中移除（移除所有可能的格式）
                this.pendingAutostartTunnels.delete(tunnel.id);
                this.pendingAutostartTunnels.delete(tunnelIdStr);
                this.pendingAutostartTunnels.delete(tunnelIdNum);

                // 启动隧道 - 确保使用有效的token
                const effectiveToken = this.getEffectiveUserToken(userToken);
                const result = await this.startSingleTunnel(tunnel, effectiveToken);

                // 标记为已检查（无论成功失败）
                this.autostartCheckedTunnels.add(tunnel.id);
                this.autostartCheckedTunnels.add(tunnelIdStr);
                this.autostartCheckedTunnels.add(tunnelIdNum);

                if (result.success) {
                    this.addLog(`自启动隧道 ${tunnel.name} 启动成功`, 'INFO');
                } else {
                    this.addLog(`自启动隧道 ${tunnel.name} 启动失败: ${result.message}`, 'ERROR');
                }

                return result;
            }

            // 检查是否在配置文件的自启动列表中
            const autostartTunnelIds = this.loadAutostartConfig();
            const isInConfig = autostartTunnelIds.includes(tunnel.id) ||
                autostartTunnelIds.includes(tunnelIdStr) ||
                autostartTunnelIds.includes(tunnelIdNum);
            if (isInConfig) {
                this.addLog(`启动已配置的自启动隧道: ${tunnel.name}`, 'INFO');

                // 标记为已检查
                this.autostartCheckedTunnels.add(tunnel.id);
                this.autostartCheckedTunnels.add(tunnelIdStr);
                this.autostartCheckedTunnels.add(tunnelIdNum);

                // 确保使用有效的token
                const effectiveToken = this.getEffectiveUserToken(userToken);
                return await this.startSingleTunnel(tunnel, effectiveToken);
            }

            // 标记为已检查（即使不是自启动隧道）
            this.autostartCheckedTunnels.add(tunnel.id);
            this.autostartCheckedTunnels.add(tunnelIdStr);
            this.autostartCheckedTunnels.add(tunnelIdNum);

            return { success: true, message: '不是自启动隧道' };
        } catch (error) {
            this.addLog(`自启动隧道失败: ${error.message}`, 'ERROR');
            return { success: false, message: error.message };
        }
    }
}

module.exports = FrpManager;
