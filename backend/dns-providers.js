/**
 * DNS服务商集成模块
 * @author linluo
 * @description 支持多家DNS服务商的自动域名配置
 * @copyright linluo@2025
 * 防盗标识: linluo
 */

const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

// DNSPod API实现
class DNSPodProvider {
    constructor(config) {
        this.tokenId = config.tokenId;
        this.token = config.token;
        this.baseUrl = 'https://dnsapi.cn';
    }

    async getDomains() {
        try {
            const response = await axios.post(`${this.baseUrl}/Domain.List`, {
                login_token: `${this.tokenId},${this.token}`,
                format: 'json'
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [data => qs.stringify(data)]
            });

            if (response.data.status.code === '1') {
                return response.data.domains.map(domain => ({
                    name: domain.name,
                    status: domain.status === 'enable' ? 'active' : 'pending',
                    records: domain.records || 0,
                    id: domain.id
                }));
            } else {
                throw new Error(response.data.status.message);
            }
        } catch (error) {
            throw new Error(`DNSPod API调用失败: ${error.message}`);
        }
    }
}

// 阿里云DNS API实现
class AliyunDNSProvider {
    constructor(config) {
        this.accessKeyId = config.accessKeyId;
        this.accessKeySecret = config.accessKeySecret;
        this.region = config.region || 'cn-hangzhou';
    }

    // 生成阿里云API签名
    generateSignature(params, method = 'GET') {
        const sortedParams = Object.keys(params).sort().reduce((result, key) => {
            result[key] = params[key];
            return result;
        }, {});

        const canonicalizedQueryString = Object.keys(sortedParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`)
            .join('&');

        const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQueryString)}`;
        const signature = crypto.createHmac('sha1', this.accessKeySecret + '&').update(stringToSign).digest('base64');
        
        return signature;
    }

    async getDomains() {
        try {
            const timestamp = new Date().toISOString();
            const nonce = Math.random().toString(36).substring(2);

            const params = {
                Action: 'DescribeDomains',
                Version: '2015-01-09',
                AccessKeyId: this.accessKeyId,
                SignatureMethod: 'HMAC-SHA1',
                Timestamp: timestamp,
                SignatureVersion: '1.0',
                SignatureNonce: nonce,
                Format: 'JSON',
                PageSize: 100
            };

            const signature = this.generateSignature(params);
            params.Signature = signature;

            const queryString = Object.keys(params)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');

            const response = await axios.get(`https://alidns.${this.region}.aliyuncs.com/?${queryString}`, {
                timeout: 10000
            });

            if (response.data && response.data.Domains && response.data.Domains.Domain) {
                return response.data.Domains.Domain.map(domain => ({
                    name: domain.DomainName,
                    status: domain.AliDomain ? 'active' : 'pending',
                    records: domain.RecordCount || 0,
                    id: domain.DomainId
                }));
            } else {
                console.log('阿里云DNS返回数据:', response.data);
                return [];
            }
        } catch (error) {
            console.error('阿里云DNS API错误详情:', error.response?.data || error.message);
            throw new Error(`阿里云DNS API调用失败: ${error.message}`);
        }
    }
}

// 腾讯云DNS API实现
class TencentDNSProvider {
    constructor(config) {
        this.secretId = config.secretId;
        this.secretKey = config.secretKey;
        this.region = config.region || 'ap-beijing';
    }

    async getDomains() {
        try {
            const tencentcloud = require('tencentcloud-sdk-nodejs');
            const DnspodClient = tencentcloud.dnspod.v20210323.Client;

            const clientConfig = {
                credential: {
                    secretId: this.secretId,
                    secretKey: this.secretKey,
                },
                region: this.region,
                profile: {
                    httpProfile: {
                        endpoint: "dnspod.tencentcloudapi.com",
                        timeout: 10
                    },
                },
            };

            const client = new DnspodClient(clientConfig);
            const params = {
                Type: "ALL",
                Offset: 0,
                Limit: 100
            };

            const result = await client.DescribeDomainList(params);
            
            if (result && result.DomainList) {
                return result.DomainList.map(domain => ({
                    name: domain.Name,
                    status: domain.Status === 'ENABLE' ? 'active' : 'pending',
                    records: domain.RecordCount || 0,
                    id: domain.DomainId
                }));
            } else {
                console.log('腾讯云DNS返回数据:', result);
                return [];
            }
        } catch (error) {
            console.error('腾讯云DNS API错误详情:', error);
            throw new Error(`腾讯云DNS API调用失败: ${error.message}`);
        }
    }
}

// 华为云DNS API实现
class HuaweiDNSProvider {
    constructor(config) {
        this.accessKey = config.accessKey;
        this.secretKey = config.secretKey;
        this.region = config.region || 'cn-north-1';
    }

    async getDomains() {
        try {
            // 华为云DNS API调用比较复杂，暂时返回提示信息
            throw new Error('华为云DNS API需要复杂的签名认证，建议使用其他DNS服务商如DNSPod、阿里云或CloudFlare');
        } catch (error) {
            throw new Error(`华为云DNS API调用失败: ${error.message}`);
        }
    }
}

// CloudFlare API实现
class CloudFlareProvider {
    constructor(config) {
        this.apiToken = config.apiToken;
        this.email = config.email;
    }

    async getDomains() {
        try {
            const response = await axios.get('https://api.cloudflare.com/client/v4/zones', {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    per_page: 100
                }
            });

            if (response.data.success) {
                return response.data.result.map(zone => ({
                    name: zone.name,
                    status: zone.status === 'active' ? 'active' : 'pending',
                    records: 0, // CloudFlare不在zones API中返回记录数
                    id: zone.id
                }));
            } else {
                throw new Error(response.data.errors?.[0]?.message || 'CloudFlare API调用失败');
            }
        } catch (error) {
            throw new Error(`CloudFlare API调用失败: ${error.message}`);
        }
    }
}

// 西部数码API实现
class WestProvider {
    constructor(config) {
        this.username = config.username;
        this.password = config.password;
        this.apiKey = config.apiKey;
    }

    async getDomains() {
        try {
            // 西部数码API需要具体的API文档来实现
            throw new Error('西部数码API需要具体的API文档和接口地址，建议使用其他DNS服务商如DNSPod、阿里云或CloudFlare');
        } catch (error) {
            throw new Error(`西部数码API调用失败: ${error.message}`);
        }
    }
}

// DNS提供商工厂函数
function createDNSProvider(provider, config) {
    switch (provider) {
        case 'dnspod':
            return new DNSPodProvider(config);
        case 'aliyun':
            return new AliyunDNSProvider(config);
        case 'tencent':
            return new TencentDNSProvider(config);
        case 'huawei':
            return new HuaweiDNSProvider(config);
        case 'cloudflare':
            return new CloudFlareProvider(config);
        case 'west':
            return new WestProvider(config);
        default:
            throw new Error(`不支持的DNS服务商: ${provider}`);
    }
}

// 模块验证和授权 - 重要：保持此代码完整性
const _MODULE_AUTH = (() => {
    const _k1 = [0x6c, 0x69, 0x6e];
    const _k2 = [0x6c, 0x75, 0x6f];
    const _auth_key = String.fromCharCode(..._k1, ..._k2);
    const _timestamp = Buffer.from('32303235', 'hex').toString();
    return { author: _auth_key, year: _timestamp, module: 'dns-providers' };
})();

module.exports = {
    createDNSProvider,
    DNSPodProvider,
    AliyunDNSProvider,
    TencentDNSProvider,
    HuaweiDNSProvider,
    CloudFlareProvider,
    WestProvider,
    _MODULE_AUTH
};
