const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class FrpServer {
    constructor() {
        this.frpsProcess = null;
        this.frpsConfigPath = '/app/frps.ini';
        this.frpsBinaryPath = '/app/frps';
        this.isRunning = false;
        this.defaultPort = 7000;
        this.dashboardPort = 7500;
        this.dashboardUser = 'admin';
        this.dashboardPassword = 'admin123';
    }

    // 生成frp服务器配置文件
    generateServerConfig(options = {}) {
        const {
            bindPort = this.defaultPort,
            dashboardPort = this.dashboardPort,
            dashboardUser = this.dashboardUser,
            dashboardPassword = this.dashboardPassword,
            token = 'chmlfrp_local_token',
            allowPorts = '2000-3000,3001,3003,4000-50000'
        } = options;

        const config = [
            '[common]',
            `bind_port = ${bindPort}`,
            `log_level = info`,
            `log_file = /app/frps.log`,
            `log_max_days = 3`,
            '',
            '# Dashboard配置',
            `dashboard_addr = 0.0.0.0`,
            `dashboard_port = ${dashboardPort}`,
            `dashboard_user = ${dashboardUser}`,
            `dashboard_pwd = ${dashboardPassword}`,
            '',
            '# 认证配置',
            `token = ${token}`,
            '',
            '# 允许的端口范围',
            `allow_ports = ${allowPorts}`,
            '',
            '# HTTP配置',
            'vhost_http_port = 8080',
            'vhost_https_port = 8443',
            '',
            '# 子域名配置',
            'subdomain_host = frp.local',
            '',
            '# 其他配置',
            'max_pool_count = 50',
            'max_ports_per_client = 10',
            'authentication_timeout = 900',
            'heartbeat_timeout = 90',
            ''
        ];

        return config.join('\n');
    }

    // 写入配置文件
    async writeServerConfig(configContent) {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.frpsConfigPath, configContent, 'utf8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('FRP服务器配置文件已更新:', this.frpsConfigPath);
                    resolve();
                }
            });
        });
    }

    // 启动frp服务器
    async startFrpServer(options = {}) {
        if (this.frpsProcess) {
            console.log('FRP服务器已在运行');
            return;
        }

        return new Promise(async (resolve, reject) => {
            try {
                // 生成并写入配置文件
                const configContent = this.generateServerConfig(options);
                await this.writeServerConfig(configContent);

                // 检查frp服务器二进制文件是否存在
                if (!fs.existsSync(this.frpsBinaryPath)) {
                    reject(new Error('FRP服务器程序不存在'));
                    return;
                }

                console.log('启动FRP服务器...');
                this.frpsProcess = spawn(this.frpsBinaryPath, ['-c', this.frpsConfigPath], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    detached: false
                });

                this.frpsProcess.stdout.on('data', (data) => {
                    console.log('FRP服务器输出:', data.toString());
                });

                this.frpsProcess.stderr.on('data', (data) => {
                    console.error('FRP服务器错误:', data.toString());
                });

                this.frpsProcess.on('close', (code) => {
                    console.log(`FRP服务器退出，代码: ${code}`);
                    this.frpsProcess = null;
                    this.isRunning = false;
                });

                this.frpsProcess.on('error', (err) => {
                    console.error('FRP服务器错误:', err);
                    this.frpsProcess = null;
                    this.isRunning = false;
                    reject(err);
                });

                // 等待一段时间确保启动成功
                setTimeout(() => {
                    if (this.frpsProcess && !this.frpsProcess.killed) {
                        this.isRunning = true;
                        resolve();
                    } else {
                        reject(new Error('FRP服务器启动失败'));
                    }
                }, 3000);

            } catch (error) {
                reject(error);
            }
        });
    }

    // 停止frp服务器
    stopFrpServer() {
        if (this.frpsProcess) {
            console.log('停止FRP服务器...');
            this.frpsProcess.kill('SIGTERM');
            this.frpsProcess = null;
            this.isRunning = false;
        }
    }

    // 重启frp服务器
    async restartFrpServer(options = {}) {
        this.stopFrpServer();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        return this.startFrpServer(options);
    }

    // 获取frp服务器状态
    getServerStatus() {
        return {
            isRunning: this.isRunning,
            processId: this.frpsProcess ? this.frpsProcess.pid : null,
            configPath: this.frpsConfigPath,
            bindPort: this.defaultPort,
            dashboardPort: this.dashboardPort,
            dashboardUrl: `http://localhost:${this.dashboardPort}`
        };
    }

    // 获取frp服务器日志
    async getServerLogs(lines = 50) {
        return new Promise((resolve, reject) => {
            exec(`tail -n ${lines} /app/frps.log 2>/dev/null || echo "日志文件不存在"`, (error, stdout, stderr) => {
                if (error && !stdout.includes('日志文件不存在')) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    // 检查frp服务器API状态
    async checkServerAPI() {
        return new Promise((resolve) => {
            exec(`curl -s http://127.0.0.1:${this.dashboardPort}/api/serverinfo 2>/dev/null || echo "连接失败"`, (error, stdout) => {
                try {
                    const status = JSON.parse(stdout);
                    resolve(status);
                } catch {
                    resolve({ error: '无法连接到FRP服务器API' });
                }
            });
        });
    }

    // 获取连接的客户端列表
    async getConnectedClients() {
        return new Promise((resolve) => {
            exec(`curl -s http://${this.dashboardUser}:${this.dashboardPassword}@127.0.0.1:${this.dashboardPort}/api/proxy/tcp 2>/dev/null || echo "[]"`, (error, stdout) => {
                try {
                    const proxies = JSON.parse(stdout);
                    resolve(proxies);
                } catch {
                    resolve([]);
                }
            });
        });
    }
}

module.exports = FrpServer;
