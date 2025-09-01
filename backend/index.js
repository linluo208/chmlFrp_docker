/**
 * ChmlFrp Docker Management Panel - Backend Server
 * 
 * @author linluo
 * @copyright linluo@2025
 * @license MIT
 * @version 1.0.0
 * 
 * 功能特性：
 * - ChmlFrp API代理服务
 * - FRP客户端管理
 * - 断线自动重连
 * - DNS自动配置
 * - Token安全管理
 * 
 * 防盗标识: linluo
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const FrpManager = require('./frp-manager');
const FrpServer = require('./frp-server');

const app = express();
const PORT = process.env.PORT || 3001;

// 记录程序启动时间
const SERVER_START_TIME = new Date();

// 系统验证 - 重要：不要修改此代码块
const _0x1234 = ['6c696e6c756f', '76312e302e30', '32303235']; // hex encoded
const _verify = () => {
  const _a = Buffer.from(_0x1234[0], 'hex').toString();
  const _v = _0x1234[1];
  const _y = _0x1234[2];
  return { author: _a, version: _v, year: _y };
};

// 初始化FRP管理器
const frpManager = new FrpManager();
const frpServer = new FrpServer();

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ChmlFrp API基础URL（可以通过环境变量配置）
const CHMLFRP_API_BASE = process.env.CHMLFRP_API_BASE || 'http://cf-v2.uapis.cn';

// 通用API代理函数
async function proxyToChmlFrp(req, res, endpoint, method = 'GET', retryCount = 0) {
    const maxRetries = endpoint === '/update_tunnel' || endpoint === '/create_tunnel' ? 2 : 0;
    
    try {
        console.log(`[${new Date().toISOString()}] ${method} ${endpoint} - 代理到: ${CHMLFRP_API_BASE}${endpoint} (尝试 ${retryCount + 1})`);
        const config = {
            method: method,
            url: `${CHMLFRP_API_BASE}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ChmlFrp-Docker-Dashboard/1.0'
            },
            timeout: 45000 // 45秒超时，给服务器更多时间
        };

        // 添加请求参数
        if (method === 'GET') {
            config.params = req.query;
        } else {
            config.data = req.body;
        }

        // 如果有token，添加到请求参数中（ChmlFrp使用query参数传token）
        if (req.headers.authorization) {
            const token = req.headers.authorization.replace('Bearer ', '');
            if (method === 'GET') {
                config.params = { ...config.params, token: token };
            } else {
                config.data = { ...config.data, token: token };
            }
        }

        // 记录发送的请求数据
        if (endpoint === '/update_tunnel' || endpoint === '/create_tunnel') {
            console.log(`[${new Date().toISOString()}] 发送数据:`, JSON.stringify(config.data, null, 2));
            
            // 对于隧道相关API，确保数据类型正确
            if (config.data) {
                // 确保数字字段是数字类型
                if (config.data.tunnelid && typeof config.data.tunnelid === 'string') {
                    config.data.tunnelid = parseInt(config.data.tunnelid);
                }
                if (config.data.localport && typeof config.data.localport === 'string') {
                    config.data.localport = parseInt(config.data.localport);
                }
                if (config.data.remoteport && typeof config.data.remoteport === 'string') {
                    config.data.remoteport = parseInt(config.data.remoteport);
                }
                
                // 确保布尔字段是布尔类型
                if (config.data.encryption !== undefined) {
                    config.data.encryption = Boolean(config.data.encryption);
                }
                if (config.data.compression !== undefined) {
                    config.data.compression = Boolean(config.data.compression);
                }
                
                console.log(`[${new Date().toISOString()}] 类型转换后的数据:`, JSON.stringify(config.data, null, 2));
            }
        }

        const response = await axios(config);
        console.log(`[${new Date().toISOString()}] 响应状态: ${response.status}, 数据: ${JSON.stringify(response.data).substring(0, 100)}...`);
        res.json(response.data);
    } catch (error) {
        console.error('API代理错误:', error.message);
        
        // 记录更详细的错误信息
        if (error.response) {
            console.error('错误响应状态:', error.response.status);
            console.error('错误响应数据:', error.response.data);
        }
        
        // 对于超时或服务器错误，尝试重试
        if (retryCount < maxRetries && (
            error.code === 'ECONNABORTED' || // 超时
            error.response?.status >= 500 || // 服务器错误
            error.response?.status === 504    // 网关超时
        )) {
            console.log(`[${new Date().toISOString()}] 重试请求 ${endpoint} (${retryCount + 1}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // 递增延迟
            return proxyToChmlFrp(req, res, endpoint, method, retryCount + 1);
        }
        
        // 根据错误类型返回更友好的错误信息
        let errorMsg = '服务器错误';
        if (error.code === 'ECONNABORTED') {
            errorMsg = 'ChmlFrp服务器响应超时，请稍后重试';
        } else if (error.response?.status === 504) {
            errorMsg = 'ChmlFrp服务器网关超时，请稍后重试';
        } else if (error.response?.status >= 500) {
            errorMsg = 'ChmlFrp服务器内部错误，请稍后重试';
        } else if (error.response?.data?.msg) {
            errorMsg = error.response.data.msg;
        }
        
        res.status(error.response?.status || 500).json({
            code: -1,
            state: 'error',
            msg: errorMsg,
            data: null
        });
    }
}

// API路由定义

// 1. 用户认证相关
app.get('/api/login', (req, res) => proxyToChmlFrp(req, res, '/login'));
app.get('/api/register', (req, res) => proxyToChmlFrp(req, res, '/register')); // 修复：与官方API一致使用GET
app.post('/api/sendmailcode', (req, res) => proxyToChmlFrp(req, res, '/sendmailcode', 'POST')); // 修复：与官方API一致使用POST
app.get('/api/userinfo', (req, res) => proxyToChmlFrp(req, res, '/userinfo'));
app.get('/api/retoken', (req, res) => proxyToChmlFrp(req, res, '/retoken'));
app.post('/api/qiandao', (req, res) => proxyToChmlFrp(req, res, '/qiandao', 'POST'));
app.get('/api/reset_password', (req, res) => proxyToChmlFrp(req, res, '/reset_password')); // 修复：与官方API一致使用GET

// 2. 用户信息更新 - 修复：与官方API一致使用GET
app.get('/api/update_username', (req, res) => proxyToChmlFrp(req, res, '/update_username'));
app.get('/api/update_qq', (req, res) => proxyToChmlFrp(req, res, '/update_qq'));
app.get('/api/update_userimg', (req, res) => proxyToChmlFrp(req, res, '/update_userimg'));

// 3. 消息相关
app.get('/api/messages', (req, res) => proxyToChmlFrp(req, res, '/messages'));

// 新增：用户账户管理API
app.get('/api/reset_email', (req, res) => proxyToChmlFrp(req, res, '/reset_email'));
app.get('/api/delete_account', (req, res) => proxyToChmlFrp(req, res, '/delete_account'));
app.post('/api/email_reset_password', (req, res) => proxyToChmlFrp(req, res, '/email_reset_password', 'POST'));

// 4. 隧道管理
app.get('/api/tunnel', (req, res) => proxyToChmlFrp(req, res, '/tunnel'));
app.post('/api/create_tunnel', (req, res) => proxyToChmlFrp(req, res, '/create_tunnel', 'POST'));
// 删除隧道需要特殊处理：POST请求但参数通过查询参数传递
app.post('/api/delete_tunnel', async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] POST /delete_tunnel - 特殊处理查询参数`);
        
        const config = {
            method: 'POST',
            url: `${CHMLFRP_API_BASE}/delete_tunnel`,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ChmlFrp-Docker-Dashboard/1.0'
            },
            params: req.query // 使用查询参数而不是请求体
        };

        // 如果有token，添加到查询参数中
        if (req.headers.authorization) {
            const token = req.headers.authorization.replace('Bearer ', '');
            config.params = { ...config.params, token: token };
        }

        console.log('发送到ChmlFrp的请求配置:', JSON.stringify(config, null, 2));
        
        const response = await axios(config);
        res.json(response.data);
    } catch (error) {
        console.error('删除隧道代理失败:', error.response?.data || error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({
                code: -1,
                state: 'error',
                msg: '服务器错误'
            });
        }
    }
});
// 专门处理隧道更新的函数
app.post('/api/update_tunnel', async (req, res) => {
    try {
        // 将我们的字段格式转换为cf-v1 API需要的格式
        const { tunnelid, tunnelname, node, localip, porttype, localport, remoteport, banddomain, encryption, compression } = req.body;
        
        // 从Authorization header获取token
        const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
        
        console.log(`[${new Date().toISOString()}] 接收到的token:`, token);
        console.log(`[${new Date().toISOString()}] 请求体:`, JSON.stringify(req.body, null, 2));
        console.log(`[${new Date().toISOString()}] Authorization header:`, req.headers.authorization);
        
        if (!token) {
            return res.status(400).json({
                code: 400,
                state: 'error',
                msg: '缺少认证token',
                data: null
            });
        }
        
        // 首先获取用户信息来得到userid
        let userid = 35803; // 默认值
        try {
            const userInfoResponse = await axios.get(`${CHMLFRP_API_BASE}/userinfo`, {
                params: { token: token },
                timeout: 10000
            });
            if (userInfoResponse.data.code === 200) {
                userid = userInfoResponse.data.data.id;
            }
        } catch (error) {
            console.log('获取用户信息失败，使用默认userid');
        }
        
        const v1Data = {
            usertoken: token,
            userid: userid,
            tunnelid: tunnelid,
            name: tunnelname,
            node: node,
            localip: localip,
            type: porttype,
            nport: localport,
            encryption: String(encryption), // v1 API需要字符串
            compression: String(compression), // v1 API需要字符串
            ap: "", // 空字符串
        };
        
        // 根据类型添加对应字段
        if (porttype === 'tcp' || porttype === 'udp') {
            v1Data.dorp = remoteport;
        } else if (porttype === 'http' || porttype === 'https') {
            v1Data.dorp = banddomain;
        }
        
        console.log(`[${new Date().toISOString()}] POST /api/cztunnel.php - 转换后的数据:`, JSON.stringify(v1Data, null, 2));
        
        // 尝试使用正确的API格式
        // 同时在URL上附带 usertoken 与 userid，避免服务端无法读取表单体导致的缺参
        // 将关键参数也拼到URL，避免服务端读取不到表单体
        const urlWithQuery =
            `http://cf-v1.uapis.cn/api/cztunnel.php` +
            `?usertoken=${encodeURIComponent(token)}` +
            `&userid=${encodeURIComponent(String(userid))}` +
            `&tunnelid=${encodeURIComponent(String(v1Data.tunnelid))}` +
            `&name=${encodeURIComponent(String(v1Data.name))}` +
            `&node=${encodeURIComponent(String(v1Data.node))}` +
            `&localip=${encodeURIComponent(String(v1Data.localip))}` +
            `&type=${encodeURIComponent(String(v1Data.type))}` +
            `&nport=${encodeURIComponent(String(v1Data.nport))}` +
            (v1Data.dorp !== undefined ? `&dorp=${encodeURIComponent(String(v1Data.dorp))}` : '') +
            `&encryption=${encodeURIComponent(String(v1Data.encryption))}` +
            `&compression=${encodeURIComponent(String(v1Data.compression))}` +
            `&ap=${encodeURIComponent(String(v1Data.ap))}`;

        const response = await axios({
            method: 'POST',
            url: urlWithQuery,
            data: v1Data,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'ChmlFrp-Docker-Dashboard/1.0'
            },
            transformRequest: [function (data) {
                // 将对象转换为form-data格式
                const params = new URLSearchParams();
                for (const key in data) {
                    params.append(key, data[key]);
                }
                return params.toString();
            }],
            timeout: 45000
        });
        
        console.log(`[${new Date().toISOString()}] 响应:`, response.data);
        
        // 将v1 API响应转换为我们的格式
        if (response.data.code === 200) {
            res.json({
                code: 200,
                state: 'success',
                msg: response.data.error || '更新成功',
                data: null
            });
        } else {
            res.status(400).json({
                code: response.data.code,
                state: 'error',
                msg: response.data.error || '更新失败',
                data: null
            });
        }
    } catch (error) {
        console.error('隧道更新错误:', error.message);
        if (error.response) {
            console.error('错误响应:', error.response.data);
        }
        
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: error.response?.data?.error || '服务器错误',
            data: null
        });
    }
});
app.get('/api/tunnel_config', (req, res) => proxyToChmlFrp(req, res, '/tunnel_config'));

// 新增：隧道流量统计API
app.get('/api/tunnel/last7days', (req, res) => proxyToChmlFrp(req, res, '/tunnel/last7days'));

// 5. 节点信息
app.get('/api/node', (req, res) => proxyToChmlFrp(req, res, '/node'));
app.get('/api/nodeinfo', (req, res) => proxyToChmlFrp(req, res, '/nodeinfo'));
app.get('/api/node_stats', (req, res) => proxyToChmlFrp(req, res, '/node_stats'));
app.get('/api/node_uptime', (req, res) => proxyToChmlFrp(req, res, '/node_uptime'));
app.get('/api/node_status_info', (req, res) => proxyToChmlFrp(req, res, '/node_status_info'));

// 6. 面板信息
app.get('/api/panelinfo', (req, res) => proxyToChmlFrp(req, res, '/panelinfo'));
app.get('/api/server-status', (req, res) => proxyToChmlFrp(req, res, '/api/server-status'));

// 7. 域名相关
app.get('/api/list_available_domains', (req, res) => proxyToChmlFrp(req, res, '/list_available_domains'));
app.post('/api/create_free_subdomain', (req, res) => proxyToChmlFrp(req, res, '/create_free_subdomain', 'POST'));
app.post('/api/delete_free_subdomain', (req, res) => proxyToChmlFrp(req, res, '/delete_free_subdomain', 'POST'));
app.post('/api/update_free_subdomain', (req, res) => proxyToChmlFrp(req, res, '/update_free_subdomain', 'POST'));
app.get('/api/get_user_free_subdomains', (req, res) => proxyToChmlFrp(req, res, '/get_user_free_subdomains'));

// 8. 应用版本
app.get('/api/app_version', (req, res) => proxyToChmlFrp(req, res, '/app_version'));

// ========== FRP 本地管理接口 ==========

// 获取FRP客户端状态
app.get('/api/frp/status', async (req, res) => {
    try {
        const status = frpManager.getStatus();
        const adminStatus = await frpManager.checkAdminStatus();
        res.json({
            code: 200,
            state: 'success',
            msg: '获取FRP状态成功',
            data: {
                ...status,
                adminStatus
            }
        });
    } catch (error) {
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: '获取FRP状态失败',
            data: null
        });
    }
});

// 启动FRP客户端 (已弃用，现在使用单隧道管理)
app.post('/api/frp/start', async (req, res) => {
    res.json({
        code: -1,
        state: 'error',
        msg: '此接口已弃用，请使用隧道管理页面启用具体隧道',
        data: null
    });
});

// 停止FRP客户端 (已弃用，现在使用单隧道管理)
app.post('/api/frp/stop', (req, res) => {
    res.json({
        code: -1,
        state: 'error',
        msg: '此接口已弃用，请使用隧道管理页面停用具体隧道',
        data: null
    });
});

// 重启FRP客户端 (已弃用，现在使用单隧道管理)
app.post('/api/frp/restart', (req, res) => {
    res.json({
        code: -1,
        state: 'error',
        msg: '此接口已弃用，请使用隧道管理页面重新启用隧道',
        data: null
    });
});

// 更新隧道配置
app.post('/api/frp/update-tunnels', async (req, res) => {
    try {
        const { tunnels, userToken } = req.body;
        const result = await frpManager.updateTunnels(tunnels, userToken);
        
        if (result.success) {
            res.json({
                code: 200,
                state: 'success',
                msg: result.message,
                data: null
            });
        } else {
            res.status(500).json({
                code: -1,
                state: 'error',
                msg: result.message,
                data: null
            });
        }
    } catch (error) {
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `更新隧道配置失败: ${error.message}`,
            data: null
        });
    }
});

// 获取FRP日志
app.get('/api/frp/logs', async (req, res) => {
    try {
        const lines = req.query.lines || 50;
        const logs = await frpManager.getLogs(lines);
        res.json({
            code: 200,
            state: 'success',
            msg: '获取日志成功',
            data: { logs }
        });
    } catch (error) {
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `获取日志失败: ${error.message}`,
            data: null
        });
    }
});

// 自动重连控制接口
app.post('/api/frp/auto-reconnect', (req, res) => {
    try {
        const { enabled } = req.body;
        frpManager.setAutoReconnect(enabled);
        res.json({
            code: 200,
            state: 'success',
            msg: `自动重连已${enabled ? '启用' : '禁用'}`,
            data: frpManager.getAutoReconnectStatus()
        });
    } catch (error) {
        console.error('设置自动重连失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: '设置自动重连失败',
            data: null
        });
    }
});

// 获取自动重连状态
app.get('/api/frp/auto-reconnect', (req, res) => {
    try {
        res.json({
            code: 200,
            state: 'success',
            msg: '获取自动重连状态成功',
            data: frpManager.getAutoReconnectStatus()
        });
    } catch (error) {
        console.error('获取自动重连状态失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: '获取自动重连状态失败',
            data: null
        });
    }
});

// 手动恢复隧道状态
app.post('/api/frp/recover-tunnels', async (req, res) => {
    try {
        console.log('手动触发隧道恢复');
        await frpManager.loadTunnelState();
        
        res.json({
            code: 200,
            state: 'success',
            msg: '隧道恢复任务已启动',
            data: {
                message: '正在后台恢复隧道，请稍后查看状态'
            }
        });
    } catch (error) {
        console.error('手动恢复隧道失败:', error);
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `恢复隧道失败: ${error.message}`,
            data: null
        });
    }
});

// 清理隧道状态
app.post('/api/frp/clear-state', (req, res) => {
    try {
        frpManager.clearTunnelState();
        
        res.json({
            code: 200,
            state: 'success',
            msg: '隧道状态已清理',
            data: null
        });
    } catch (error) {
        console.error('清理隧道状态失败:', error);
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `清理隧道状态失败: ${error.message}`,
            data: null
        });
    }
});

// 获取隧道恢复状态
app.get('/api/frp/recovery-status', (req, res) => {
    try {
        const fs = require('fs');
        const stateFile = '/app/tunnel-state.json';
        
        let recoveryInfo = {
            hasState: false,
            tunnelCount: 0,
            lastSaved: null
        };
        
        if (fs.existsSync(stateFile)) {
            const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            recoveryInfo = {
                hasState: true,
                tunnelCount: stateData.tunnels?.length || 0,
                lastSaved: stateData.timestamp
            };
        }
        
        res.json({
            code: 200,
            state: 'success',
            msg: '获取恢复状态成功',
            data: recoveryInfo
        });
    } catch (error) {
        console.error('获取恢复状态失败:', error);
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `获取恢复状态失败: ${error.message}`,
            data: null
        });
    }
});

// ========== 简化的隧道级FRP管理 ==========

// 启动单个隧道的内网穿透
app.post('/api/frp/start-tunnel', async (req, res) => {
    try {
        const { tunnel } = req.body;
        
        if (!tunnel) {
            return res.status(400).json({
                code: -1,
                state: 'error',
                msg: '隧道信息不能为空',
                data: null
            });
        }
        
        console.log(`启动隧道: ${tunnel.name} (${tunnel.localip}:${tunnel.nport})`);
        
        // 使用用户token
        const userToken = req.headers.authorization?.replace('Bearer ', '') || 'chmlfrp_token';
        
        // 为单个隧道启动FRP客户端
        const result = await frpManager.startSingleTunnel(tunnel, userToken);
        
        if (result.success) {
            res.json({
                code: 200,
                state: 'success',
                msg: `隧道 ${tunnel.name} 启动成功`,
                data: {
                    tunnelName: tunnel.name,
                    localAddress: `${tunnel.localip}:${tunnel.nport}`,
                    type: tunnel.type,
                    isRunning: true
                }
            });
        } else {
            res.status(500).json({
                code: -1,
                state: 'error',
                msg: result.message,
                data: null
            });
        }
    } catch (error) {
        console.error('启动隧道失败:', error);
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `启动隧道失败: ${error.message}`,
            data: null
        });
    }
});

// 停止单个隧道的内网穿透
app.post('/api/frp/stop-tunnel', async (req, res) => {
    try {
        const { tunnelId } = req.body;
        
        if (!tunnelId) {
            return res.status(400).json({
                code: -1,
                state: 'error',
                msg: '隧道ID不能为空',
                data: null
            });
        }
        
        console.log(`停止隧道: ${tunnelId}`);
        
        const result = await frpManager.stopSingleTunnel(tunnelId);
        
        if (result.success) {
            res.json({
                code: 200,
                state: 'success',
                msg: '隧道已停止',
                data: {
                    tunnelId: tunnelId,
                    isRunning: false
                }
            });
        } else {
            res.status(500).json({
                code: -1,
                state: 'error',
                msg: result.message,
                data: null
            });
        }
    } catch (error) {
        console.error('停止隧道失败:', error);
        res.status(500).json({
            code: -1,
            state: 'error',
            msg: `停止隧道失败: ${error.message}`,
            data: null
        });
    }
});

// 引入DNS提供商模块
const { createDNSProvider } = require('./dns-providers-simple');

// DNS域名获取API
app.post('/api/dns/domains', async (req, res) => {
    try {
        const { dnsConfig } = req.body;
        
        if (!dnsConfig || !dnsConfig.provider) {
            return res.status(400).json({
                code: 400,
                state: 'error',
                msg: 'DNS配置信息不完整',
                data: null
            });
        }

        console.log(`正在获取 ${dnsConfig.provider} DNS配置 "${dnsConfig.name}" 的域名列表...`);

        // 创建对应的DNS提供商实例
        const provider = createDNSProvider(dnsConfig.provider, dnsConfig);
        
        // 获取域名列表
        const domains = await provider.getDomains();
        
        console.log(`成功获取 ${domains.length} 个域名`);

        res.json({
            code: 200,
            state: 'success',
            msg: `成功获取 ${domains.length} 个域名`,
            data: domains
        });
    } catch (error) {
        console.error('获取DNS域名列表失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: error.message || '获取域名列表失败',
            data: null
        });
    }
});

// DNS解析记录获取API
app.post('/api/dns/records', async (req, res) => {
    try {
        const { dnsConfig, domainName } = req.body;
        
        if (!dnsConfig || !dnsConfig.provider || !domainName) {
            return res.status(400).json({
                code: 400,
                state: 'error',
                msg: 'DNS配置信息或域名不完整',
                data: null
            });
        }

        console.log(`正在获取域名 ${domainName} 的解析记录...`);

        // 创建对应的DNS提供商实例
        const provider = createDNSProvider(dnsConfig.provider, dnsConfig);
        
        // 检查是否支持获取解析记录
        if (!provider.getRecords) {
            return res.status(501).json({
                code: 501,
                state: 'error',
                msg: `${dnsConfig.provider} DNS提供商暂不支持获取解析记录`,
                data: null
            });
        }

        // 获取解析记录
        const records = await provider.getRecords(domainName);
        
        console.log(`成功获取 ${records.length} 条解析记录`);

        res.json({
            code: 200,
            state: 'success',
            msg: `成功获取 ${records.length} 条解析记录`,
            data: records
        });
    } catch (error) {
        console.error('获取DNS解析记录失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: error.message || '获取解析记录失败',
            data: null
        });
    }
});

// DNS解析记录创建API
app.post('/api/dns/records/create', async (req, res) => {
    try {
        const { dnsConfig, domainName, recordData } = req.body;
        
        if (!dnsConfig || !dnsConfig.provider || !domainName || !recordData) {
            return res.status(400).json({
                code: 400,
                state: 'error',
                msg: '请求参数不完整',
                data: null
            });
        }

        console.log(`正在为域名 ${domainName} 创建解析记录...`);

        // 创建对应的DNS提供商实例
        const provider = createDNSProvider(dnsConfig.provider, dnsConfig);
        
        // 检查是否支持创建解析记录
        if (!provider.createRecord) {
            return res.status(501).json({
                code: 501,
                state: 'error',
                msg: `${dnsConfig.provider} DNS提供商暂不支持创建解析记录`,
                data: null
            });
        }

        // 创建解析记录
        const result = await provider.createRecord(domainName, recordData);
        
        console.log(`解析记录创建成功，记录ID: ${result.id}`);

        res.json({
            code: 200,
            state: 'success',
            msg: result.message || '解析记录创建成功',
            data: result
        });
    } catch (error) {
        console.error('创建DNS解析记录失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: error.message || '创建解析记录失败',
            data: null
        });
    }
});

// DNS解析记录更新API
app.put('/api/dns/records/update', async (req, res) => {
    try {
        const { dnsConfig, domainName, recordId, recordData } = req.body;
        
        if (!dnsConfig || !dnsConfig.provider || !domainName || !recordId || !recordData) {
            return res.status(400).json({
                code: 400,
                state: 'error',
                msg: '请求参数不完整',
                data: null
            });
        }

        console.log(`正在更新域名 ${domainName} 的解析记录 ${recordId}...`);

        // 创建对应的DNS提供商实例
        const provider = createDNSProvider(dnsConfig.provider, dnsConfig);
        
        // 检查是否支持更新解析记录
        if (!provider.updateRecord) {
            return res.status(501).json({
                code: 501,
                state: 'error',
                msg: `${dnsConfig.provider} DNS提供商暂不支持更新解析记录`,
                data: null
            });
        }

        // 更新解析记录
        const result = await provider.updateRecord(domainName, recordId, recordData);
        
        console.log(`解析记录更新成功`);

        res.json({
            code: 200,
            state: 'success',
            msg: result.message || '解析记录更新成功',
            data: result
        });
    } catch (error) {
        console.error('更新DNS解析记录失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: error.message || '更新解析记录失败',
            data: null
        });
    }
});

// DNS解析记录删除API
app.delete('/api/dns/records/delete', async (req, res) => {
    try {
        const { dnsConfig, domainName, recordId } = req.body;
        
        if (!dnsConfig || !dnsConfig.provider || !domainName || !recordId) {
            return res.status(400).json({
                code: 400,
                state: 'error',
                msg: '请求参数不完整',
                data: null
            });
        }

        console.log(`正在删除域名 ${domainName} 的解析记录 ${recordId}...`);

        // 创建对应的DNS提供商实例
        const provider = createDNSProvider(dnsConfig.provider, dnsConfig);
        
        // 检查是否支持删除解析记录
        if (!provider.deleteRecord) {
            return res.status(501).json({
                code: 501,
                state: 'error',
                msg: `${dnsConfig.provider} DNS提供商暂不支持删除解析记录`,
                data: null
            });
        }

        // 删除解析记录
        const result = await provider.deleteRecord(domainName, recordId);
        
        console.log(`解析记录删除成功`);

        res.json({
            code: 200,
            state: 'success',
            msg: result.message || '解析记录删除成功',
            data: result
        });
    } catch (error) {
        console.error('删除DNS解析记录失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: error.message || '删除解析记录失败',
            data: null
        });
    }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        code: 200,
        state: 'success',
        msg: 'ChmlFrp Docker Dashboard API运行正常',
        data: {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime()
        }
    });
});

// 系统信息端点
app.get('/api/system', (req, res) => {
    const now = new Date();
    const uptimeSeconds = Math.floor((now - SERVER_START_TIME) / 1000);
    
    // 格式化在线时间
    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (days > 0) {
            return `${days}天 ${hours}小时 ${minutes}分钟`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟`;
        } else {
            return `${secs}秒`;
        }
    };

    res.json({
        code: 200,
        state: 'success',
        msg: '系统信息获取成功',
        data: {
            startTime: SERVER_START_TIME.toISOString(),
            currentTime: now.toISOString(),
            uptimeSeconds: uptimeSeconds,
            uptimeFormatted: formatUptime(uptimeSeconds),
            version: 'v1.0.0 Docker',
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        }
    });
});

// 重置Token端点
app.post('/api/reset_token', async (req, res) => {
    try {
        // 从Authorization header获取当前token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                code: 401,
                state: 'error',
                msg: '未提供有效的认证token',
                data: null
            });
        }

        const currentToken = authHeader.replace('Bearer ', '');
        
        // 调用ChmlFrp的用户信息接口验证token并获取用户信息
        const userInfoResponse = await axios.get(`${CHMLFRP_API_BASE}/userinfo`, {
            params: { token: currentToken },
            timeout: 30000
        });

        if (userInfoResponse.data.code !== 200) {
            return res.status(401).json({
                code: 401,
                state: 'error',
                msg: 'Token无效或已过期',
                data: null
            });
        }

        // 调用ChmlFrp的重置token接口
        console.log('Token重置请求 - 用户ID:', userInfoResponse.data.data.id);
        
        try {
            const resetResponse = await axios.get('https://cf-v2.uapis.cn/retoken', {
                params: { token: currentToken },
                timeout: 30000
            });

            if (resetResponse.data.code === 200) {
                // 重置成功，获取新的token
                const newToken = resetResponse.data.data?.new_token || resetResponse.data.data?.usertoken;
                
                if (newToken) {
                    res.json({
                        code: 200,
                        state: 'success',
                        msg: 'Token重置成功',
                        data: {
                            new_token: newToken
                        }
                    });
                } else {
                    // 如果响应中没有新token，尝试重新获取用户信息
                    try {
                        const newUserInfoResponse = await axios.get(`${CHMLFRP_API_BASE}/userinfo`, {
                            params: { token: currentToken },
                            timeout: 30000
                        });
                        
                        if (newUserInfoResponse.data.code === 200) {
                            const userToken = newUserInfoResponse.data.data.usertoken;
                            res.json({
                                code: 200,
                                state: 'success',
                                msg: 'Token重置成功',
                                data: {
                                    new_token: userToken
                                }
                            });
                        } else {
                            throw new Error('获取新token失败');
                        }
                    } catch (fetchError) {
                        console.error('获取新token失败:', fetchError);
                        res.json({
                            code: 200,
                            state: 'success',
                            msg: 'Token重置成功，请重新登录',
                            data: {
                                new_token: null,
                                need_relogin: true
                            }
                        });
                    }
                }
            } else {
                res.json({
                    code: resetResponse.data.code || 500,
                    state: 'error',
                    msg: resetResponse.data.msg || 'Token重置失败',
                    data: null
                });
            }
        } catch (resetError) {
            console.error('调用重置Token接口失败:', resetError);
            
            // 如果是网络错误或接口错误，返回相应的错误信息
            if (resetError.response?.data) {
                res.json({
                    code: resetError.response.data.code || 500,
                    state: 'error',
                    msg: resetError.response.data.msg || 'Token重置失败',
                    data: null
                });
            } else {
                res.status(500).json({
                    code: 500,
                    state: 'error',
                    msg: '重置Token接口调用失败',
                    data: null
                });
            }
        }
    } catch (error) {
        console.error('重置Token失败:', error);
        res.status(500).json({
            code: 500,
            state: 'error',
            msg: 'Token重置失败',
            data: null
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        code: -1,
        state: 'error',
        msg: '内部服务器错误',
        data: null
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        code: -1,
        state: 'error',
        msg: '接口不存在',
        data: null
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 ChmlFrp Docker管理面板后端服务启动成功！`);
    console.log(`📍 API服务地址: http://localhost:${PORT}`);
    console.log(`🔗 ChmlFrp API代理: ${CHMLFRP_API_BASE}`);
    console.log(`👨‍💻 开发者: linluo`);
    console.log(`🔒 防盗标识: linluo`);
    console.log(`⏰ 启动时间: ${SERVER_START_TIME.toLocaleString()}`);
    console.log(`\n✨ 功能特性:`);
    console.log(`   - ✅ 隧道管理`);
    console.log(`   - ✅ 断线重连`);
    console.log(`   - ✅ DNS配置`);
    console.log(`   - ✅ 实时监控`);
    console.log(`\n========================\n`);
});
