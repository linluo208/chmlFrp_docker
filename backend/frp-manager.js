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

class FrpManager {
    constructor() {
        this.activeTunnels = new Map(); // tunnelId -> { process, config }
        this.frpBinaryPath = '/app/frpc';
        this.configDir = '/app/configs';
        this.autoReconnectEnabled = true; // 启用自动重连
        this.reconnectInterval = 5000; // 重连间隔5秒
        this.maxReconnectAttempts = 10; // 最大重连尝试次数
        this._author = String.fromCharCode(0x6c, 0x69, 0x6e, 0x6c, 0x75, 0x6f); // 防盗标识
        this._copyright = this._author + '@2025'; // 版权信息
        this._license_key = Buffer.from('6c696e6c756f2d646f636b6572', 'hex').toString();
        
        // 确保配置目录存在
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
        
        // 启动隧道监控
        this.startTunnelMonitoring();
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
        
        console.log('启动隧道断线监控和自动重连...');
        
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
            console.log('隧道监控已停止');
        }
    }

    // 检查并重连断线的隧道
    async checkAndReconnectTunnels() {
        if (!this.autoReconnectEnabled) {
            return;
        }
        
        console.log('检查隧道状态...');
        const toReconnect = [];
        
        for (const [tunnelId, info] of this.activeTunnels) {
            // 检查进程是否还在运行
            const isProcessAlive = info.process && !info.process.killed && info.process.pid;
            
            if (isProcessAlive) {
                try {
                    // 验证进程是否真的存在
                    process.kill(info.process.pid, 0);
                    
                    // 检查隧道连接状态（通过检查管理端口）
                    const adminPort = 7400 + (tunnelId % 100);
                    const isConnected = await this.checkTunnelConnection(adminPort);
                    
                    if (!isConnected) {
                        console.log(`隧道 ${info.tunnel.name} 连接异常，准备重连`);
                        toReconnect.push({ tunnelId, info, reason: '连接异常' });
                    }
                } catch (error) {
                    console.log(`隧道 ${info.tunnel.name} 进程已死亡，准备重连`);
                    toReconnect.push({ tunnelId, info, reason: '进程死亡' });
                }
            } else {
                console.log(`隧道 ${info.tunnel.name} 进程不存在，准备重连`);
                toReconnect.push({ tunnelId, info, reason: '进程不存在' });
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
        
        if (tunnelInfo.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`隧道 ${tunnelInfo.tunnel.name} 重连次数超限，停止重连`);
            this.activeTunnels.delete(tunnelId);
            return;
        }
        
        tunnelInfo.reconnectAttempts++;
        console.log(`开始重连隧道 ${tunnelInfo.tunnel.name}，原因: ${reason}，第 ${tunnelInfo.reconnectAttempts} 次尝试`);
        
        try {
            // 清理现有进程
            if (tunnelInfo.process && !tunnelInfo.process.killed) {
                tunnelInfo.process.kill('SIGTERM');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 从活跃列表中临时移除
            this.activeTunnels.delete(tunnelId);
            
            // 尝试重新启动隧道
            const userToken = tunnelInfo.userToken || 'chmlfrp_token';
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
    generateSingleTunnelConfig(tunnel, nodeToken, serverAddr = null) {
        const finalServerAddr = serverAddr || ((tunnel.ip && typeof tunnel.ip === 'string') ? (tunnel.ip.replace(/^https?:\/\//, '').split(':')[0]) : (tunnel.node_ip || 'cf-v2.uapis.cn'));
        const serverPort = 7000;
        let config = `[common]
server_addr = ${finalServerAddr}
server_port = ${serverPort}
tls_enable = false
user = ${nodeToken}
token = ChmlFrpToken
log_file = /app/tunnel_${tunnel.id}.log
log_level = info
log_max_days = 3
admin_addr = 127.0.0.1
admin_port = ${7400 + tunnel.id % 100}
admin_user = admin
admin_pwd = admin123

# 心跳和重连配置
heartbeat_interval = 20
heartbeat_timeout = 60
dial_server_timeout = 10
login_fail_exit = false

[${tunnel.name}]
type = ${tunnel.type}
local_ip = ${tunnel.localip}
local_port = ${tunnel.nport}`;

        if (tunnel.type === 'http' || tunnel.type === 'https') {
            if (tunnel.dorp) {
                config += `
custom_domains = ${tunnel.dorp}`;
            }
        } else {
            const remoteFromDorp = (typeof tunnel.dorp === 'string' && /^\d+$/.test(tunnel.dorp)) ? Number(tunnel.dorp) : undefined;
            const remote = remoteFromDorp ?? Number(tunnel.remoteport || tunnel.nport);
            config += `
remote_port = ${remote}`;
        }

        if (tunnel.encryption === 'true') {
            config += `
use_encryption = true`;
        }

        if (tunnel.compression === 'true') {
            config += `
use_compression = true`;
        }

        return config;
    }

    // 启动单个隧道
    async startSingleTunnel(tunnel, userToken) {
        try {
            // 如果隧道已经在运行，先停止
            if (this.activeTunnels.has(tunnel.id)) {
                await this.stopSingleTunnel(tunnel.id);
            }

            console.log(`启动隧道: ${tunnel.name} (${tunnel.localip}:${tunnel.nport})`);

            // 从ChmlFrp API获取正确的配置信息
            let serverAddr = tunnel.ip ? tunnel.ip.replace(/^https?:\/\//, '').split(':')[0] : 'cf-v2.uapis.cn';
            let nodeToken = 'ChmlFrpToken';
            
            try {
                // 获取隧道配置文件来获取正确的服务器地址和token
                const axios = require('axios');
                const encodedNodeName = encodeURIComponent(tunnel.node);
                const configResponse = await axios.get(`http://cf-v2.uapis.cn/tunnel_config?token=${userToken}&node=${encodedNodeName}&tunnel_names=${tunnel.name}`);
                
                if (configResponse.data.code === 200 && configResponse.data.data) {
                    const configData = configResponse.data.data;
                    console.log('获取到ChmlFrp配置:', configData);
                    
                    // 解析配置文件获取server_addr
                    const serverAddrMatch = configData.match(/server_addr\s*=\s*([^\n]+)/);
                    if (serverAddrMatch) {
                        serverAddr = serverAddrMatch[1].trim();
                        console.log(`使用ChmlFrp服务器地址: ${serverAddr}`);
                    }
                    
                    // 解析用户token（使用user字段而不是token字段）
                    const userTokenMatch = configData.match(/user\s*=\s*([^\n]+)/);
                    if (userTokenMatch) {
                        nodeToken = userTokenMatch[1].trim();
                        console.log(`使用ChmlFrp用户token: ${nodeToken}`);
                    } else {
                        // 如果没有user字段，尝试使用token字段
                        const tokenMatch = configData.match(/token\s*=\s*([^\n]+)/);
                        if (tokenMatch) {
                            nodeToken = tokenMatch[1].trim();
                            console.log(`使用ChmlFrp系统token: ${nodeToken}`);
                        }
                    }
                }
            } catch (error) {
                console.warn('获取ChmlFrp配置失败，使用默认配置:', error.message);
            }

            // 生成配置文件
            const configContent = this.generateSingleTunnelConfig(tunnel, nodeToken, serverAddr);
            const configPath = path.join(this.configDir, `tunnel_${tunnel.id}.ini`);

            // 写入配置文件
            fs.writeFileSync(configPath, configContent, 'utf8');
            console.log(`配置文件已生成: ${configPath}`);

            // 启动FRP进程
            const frpProcess = spawn(this.frpBinaryPath, ['-c', configPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            let startupSuccess = false;
            let startupError = null;

            return new Promise((resolve, reject) => {
                frpProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log(`[隧道${tunnel.id}] ${output}`);

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
                                configPath: configPath,
                                startTime: new Date(),
                                userToken: userToken, // 保存用户token用于重连
                                reconnectAttempts: 0
                            });
                            console.log(`隧道 ${tunnel.name} 启动成功`);
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
                    const error = data.toString();
                    console.error(`[隧道${tunnel.id}错误] ${error}`);
                    if (!startupSuccess) {
                        startupError = error;
                    }
                });

                frpProcess.on('close', (code) => {
                    console.log(`隧道 ${tunnel.name} 进程退出，代码: ${code}`);
                    this.activeTunnels.delete(tunnel.id);
                    
                    if (!startupSuccess && code !== 0) {
                        reject(new Error(`隧道启动失败，退出代码: ${code}${startupError ? ', 错误: ' + startupError : ''}`));
                    }
                });

                frpProcess.on('error', (err) => {
                    console.error(`隧道 ${tunnel.name} 进程错误:`, err);
                    this.activeTunnels.delete(tunnel.id);
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
                                configPath: configPath,
                                startTime: new Date(),
                                userToken: userToken, // 保存用户token用于重连
                                reconnectAttempts: 0
                            });
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
                tunnelInfo.process.kill('SIGTERM');
                
                // 等待进程完全结束
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 清理配置文件
            if (tunnelInfo.configPath && fs.existsSync(tunnelInfo.configPath)) {
                fs.unlinkSync(tunnelInfo.configPath);
            }

            // 从活跃列表中移除
            this.activeTunnels.delete(tunnelId);

            return { success: true, message: '隧道已停止' };

        } catch (error) {
            console.error('停止单隧道失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 获取活跃隧道状态
    getActiveTunnels() {
        const tunnels = [];
        const toDelete = []; // 记录需要删除的隧道ID
        
        for (const [tunnelId, info] of this.activeTunnels) {
            // 检查进程是否真的在运行
            const isActuallyRunning = info.process && !info.process.killed && info.process.pid;
            
            if (isActuallyRunning) {
                // 验证进程ID是否存在
                try {
                    process.kill(info.process.pid, 0); // 发送信号0来检查进程是否存在
                    tunnels.push({
                        tunnelId: tunnelId,
                        name: info.tunnel.name,
                        type: info.tunnel.type,
                        localAddress: `${info.tunnel.localip}:${info.tunnel.nport}`,
                        startTime: info.startTime,
                        isRunning: true
                    });
                } catch (error) {
                    // 进程不存在，标记删除
                    console.log(`隧道 ${info.tunnel.name} 进程已死亡，清理状态`);
                    toDelete.push(tunnelId);
                }
            } else {
                // 进程状态无效，标记删除
                console.log(`隧道 ${info.tunnel.name} 进程状态无效，清理状态`);
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
        return {
            isRunning: activeTunnels.length > 0,
            processId: null, // 不再使用单一进程
            configPath: this.configDir,
            tunnelCount: activeTunnels.length,
            activeTunnels: activeTunnels
        };
    }

    // 获取frp日志
    async getLogs(lines = 50) {
        return new Promise((resolve, reject) => {
            exec(`tail -n ${lines} /app/frpc.log 2>/dev/null || echo "日志文件不存在"`, (error, stdout, stderr) => {
                if (error && !stdout.includes('日志文件不存在')) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
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
}

module.exports = FrpManager;
