const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

// DNSPod API实现 - 经过测试，比较稳定
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

    async getRecords(domainName) {
        try {
            const response = await axios.post(`${this.baseUrl}/Record.List`, {
                login_token: `${this.tokenId},${this.token}`,
                format: 'json',
                domain: domainName
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [data => qs.stringify(data)]
            });

            if (response.data.status.code === '1') {
                return response.data.records.map(record => ({
                    id: record.id,
                    name: record.name,
                    type: record.type,
                    value: record.value,
                    ttl: record.ttl,
                    status: record.status === '1' ? 'enabled' : 'disabled',
                    line: record.line,
                    updated_on: record.updated_on
                }));
            } else {
                throw new Error(response.data.status.message);
            }
        } catch (error) {
            throw new Error(`DNSPod 获取解析记录失败: ${error.message}`);
        }
    }

    async createRecord(domainName, recordData) {
        try {
            const response = await axios.post(`${this.baseUrl}/Record.Create`, {
                login_token: `${this.tokenId},${this.token}`,
                format: 'json',
                domain: domainName,
                sub_domain: recordData.name,
                record_type: recordData.type,
                value: recordData.value,
                record_line: recordData.line || '默认',
                ttl: recordData.ttl || 600
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [data => qs.stringify(data)]
            });

            if (response.data.status.code === '1') {
                return {
                    id: response.data.record.id,
                    success: true,
                    message: '解析记录创建成功'
                };
            } else {
                throw new Error(response.data.status.message);
            }
        } catch (error) {
            throw new Error(`DNSPod 创建解析记录失败: ${error.message}`);
        }
    }

    async updateRecord(domainName, recordId, recordData) {
        try {
            const response = await axios.post(`${this.baseUrl}/Record.Modify`, {
                login_token: `${this.tokenId},${this.token}`,
                format: 'json',
                domain: domainName,
                record_id: recordId,
                sub_domain: recordData.name,
                record_type: recordData.type,
                value: recordData.value,
                record_line: recordData.line || '默认',
                ttl: recordData.ttl || 600
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [data => qs.stringify(data)]
            });

            if (response.data.status.code === '1') {
                return {
                    success: true,
                    message: '解析记录更新成功'
                };
            } else {
                throw new Error(response.data.status.message);
            }
        } catch (error) {
            throw new Error(`DNSPod 更新解析记录失败: ${error.message}`);
        }
    }

    async deleteRecord(domainName, recordId) {
        try {
            const response = await axios.post(`${this.baseUrl}/Record.Remove`, {
                login_token: `${this.tokenId},${this.token}`,
                format: 'json',
                domain: domainName,
                record_id: recordId
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [data => qs.stringify(data)]
            });

            if (response.data.status.code === '1') {
                return {
                    success: true,
                    message: '解析记录删除成功'
                };
            } else {
                throw new Error(response.data.status.message);
            }
        } catch (error) {
            throw new Error(`DNSPod 删除解析记录失败: ${error.message}`);
        }
    }
}

// CloudFlare API实现 - 国际标准，比较稳定
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
                },
                timeout: 10000
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

    async getRecords(domainName) {
        try {
            // 首先根据域名获取zone ID
            const zonesResponse = await axios.get('https://api.cloudflare.com/client/v4/zones', {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    name: domainName
                }
            });

            if (!zonesResponse.data.success || zonesResponse.data.result.length === 0) {
                throw new Error(`找不到域名 ${domainName}`);
            }

            const zoneId = zonesResponse.data.result[0].id;

            // 获取DNS记录
            const recordsResponse = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    per_page: 100
                }
            });

            if (recordsResponse.data.success) {
                return recordsResponse.data.result.map(record => ({
                    id: record.id,
                    name: record.name,
                    type: record.type,
                    value: record.content,
                    ttl: record.ttl,
                    status: record.proxied ? 'proxied' : 'enabled',
                    line: 'Automatic',
                    updated_on: record.modified_on
                }));
            } else {
                throw new Error(recordsResponse.data.errors?.[0]?.message || 'CloudFlare获取解析记录失败');
            }
        } catch (error) {
            throw new Error(`CloudFlare 获取解析记录失败: ${error.message}`);
        }
    }

    async createRecord(domainName, recordData) {
        try {
            // 首先根据域名获取zone ID
            const zonesResponse = await axios.get('https://api.cloudflare.com/client/v4/zones', {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    name: domainName
                }
            });

            if (!zonesResponse.data.success || zonesResponse.data.result.length === 0) {
                throw new Error(`找不到域名 ${domainName}`);
            }

            const zoneId = zonesResponse.data.result[0].id;

            // 创建DNS记录
            const response = await axios.post(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                type: recordData.type,
                name: recordData.name === '@' ? domainName : `${recordData.name}.${domainName}`,
                content: recordData.value,
                ttl: recordData.ttl || 1 // CloudFlare默认为1表示automatic
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                return {
                    id: response.data.result.id,
                    success: true,
                    message: '解析记录创建成功'
                };
            } else {
                throw new Error(response.data.errors?.[0]?.message || 'CloudFlare创建解析记录失败');
            }
        } catch (error) {
            throw new Error(`CloudFlare 创建解析记录失败: ${error.message}`);
        }
    }

    async updateRecord(domainName, recordId, recordData) {
        try {
            // 首先根据域名获取zone ID
            const zonesResponse = await axios.get('https://api.cloudflare.com/client/v4/zones', {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    name: domainName
                }
            });

            if (!zonesResponse.data.success || zonesResponse.data.result.length === 0) {
                throw new Error(`找不到域名 ${domainName}`);
            }

            const zoneId = zonesResponse.data.result[0].id;

            // 更新DNS记录
            const response = await axios.put(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
                type: recordData.type,
                name: recordData.name === '@' ? domainName : `${recordData.name}.${domainName}`,
                content: recordData.value,
                ttl: recordData.ttl || 1
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                return {
                    success: true,
                    message: '解析记录更新成功'
                };
            } else {
                throw new Error(response.data.errors?.[0]?.message || 'CloudFlare更新解析记录失败');
            }
        } catch (error) {
            throw new Error(`CloudFlare 更新解析记录失败: ${error.message}`);
        }
    }

    async deleteRecord(domainName, recordId) {
        try {
            // 首先根据域名获取zone ID
            const zonesResponse = await axios.get('https://api.cloudflare.com/client/v4/zones', {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    name: domainName
                }
            });

            if (!zonesResponse.data.success || zonesResponse.data.result.length === 0) {
                throw new Error(`找不到域名 ${domainName}`);
            }

            const zoneId = zonesResponse.data.result[0].id;

            // 删除DNS记录
            const response = await axios.delete(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                return {
                    success: true,
                    message: '解析记录删除成功'
                };
            } else {
                throw new Error(response.data.errors?.[0]?.message || 'CloudFlare删除解析记录失败');
            }
        } catch (error) {
            throw new Error(`CloudFlare 删除解析记录失败: ${error.message}`);
        }
    }
}

// 阿里云DNS简化实现 - 使用HTTP API而不是SDK
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

    async getRecords(domainName) {
        try {
            const timestamp = new Date().toISOString();
            const nonce = Math.random().toString(36).substring(2);

            const params = {
                Action: 'DescribeDomainRecords',
                Version: '2015-01-09',
                AccessKeyId: this.accessKeyId,
                SignatureMethod: 'HMAC-SHA1',
                Timestamp: timestamp,
                SignatureVersion: '1.0',
                SignatureNonce: nonce,
                Format: 'JSON',
                DomainName: domainName,
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

            if (response.data && response.data.DomainRecords && response.data.DomainRecords.Record) {
                return response.data.DomainRecords.Record.map(record => ({
                    id: record.RecordId,
                    name: record.RR,
                    type: record.Type,
                    value: record.Value,
                    ttl: record.TTL,
                    status: record.Status === 'ENABLE' ? 'enabled' : 'disabled',
                    line: record.Line || '默认',
                    updated_on: record.UpdateTimestamp ? new Date(record.UpdateTimestamp * 1000).toISOString() : new Date().toISOString()
                }));
            } else {
                console.log('阿里云DNS解析记录返回数据:', response.data);
                return [];
            }
        } catch (error) {
            console.error('阿里云DNS获取解析记录错误详情:', error.response?.data || error.message);
            throw new Error(`阿里云DNS获取解析记录失败: ${error.message}`);
        }
    }

    async createRecord(domainName, recordData) {
        try {
            const timestamp = new Date().toISOString();
            const nonce = Math.random().toString(36).substring(2);

            const params = {
                Action: 'AddDomainRecord',
                Version: '2015-01-09',
                AccessKeyId: this.accessKeyId,
                SignatureMethod: 'HMAC-SHA1',
                Timestamp: timestamp,
                SignatureVersion: '1.0',
                SignatureNonce: nonce,
                Format: 'JSON',
                DomainName: domainName,
                RR: recordData.name,
                Type: recordData.type,
                Value: recordData.value,
                TTL: recordData.ttl || 600
            };
            
            // 只有在明确指定线路时才添加Line参数
            if (recordData.line) {
                params.Line = recordData.line;
            }

            const signature = this.generateSignature(params);
            params.Signature = signature;

            const queryString = Object.keys(params)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');

            const response = await axios.get(`https://alidns.${this.region}.aliyuncs.com/?${queryString}`, {
                timeout: 10000
            });

            if (response.data && response.data.RecordId) {
                return {
                    id: response.data.RecordId,
                    success: true,
                    message: '解析记录创建成功'
                };
            } else if (response.data && response.data.Code) {
                throw new Error(response.data.Message || `阿里云DNS错误: ${response.data.Code}`);
            } else {
                console.log('阿里云DNS创建记录返回数据:', response.data);
                throw new Error('创建解析记录失败');
            }
        } catch (error) {
            console.error('阿里云DNS创建解析记录错误详情:', error.response?.data || error.message);
            
            // 只有在params定义的情况下才输出
            if (typeof params !== 'undefined') {
                console.error('请求参数:', params);
            }
            
            // 如果是400错误，可能是参数问题
            if (error.response?.status === 400) {
                console.error('400错误 - 请求参数可能有误:', error.response.data);
                throw new Error(`阿里云DNS参数错误: ${JSON.stringify(error.response.data)}`);
            }
            
            throw new Error(`阿里云DNS创建解析记录失败: ${error.message}`);
        }
    }

    async updateRecord(domainName, recordId, recordData) {
        try {
            const timestamp = new Date().toISOString();
            const nonce = Math.random().toString(36).substring(2);

            const params = {
                Action: 'UpdateDomainRecord',
                Version: '2015-01-09',
                AccessKeyId: this.accessKeyId,
                SignatureMethod: 'HMAC-SHA1',
                Timestamp: timestamp,
                SignatureVersion: '1.0',
                SignatureNonce: nonce,
                Format: 'JSON',
                RecordId: recordId,
                RR: recordData.name,
                Type: recordData.type,
                Value: recordData.value,
                TTL: recordData.ttl || 600
            };
            
            // 只有在明确指定线路时才添加Line参数
            if (recordData.line) {
                params.Line = recordData.line;
            }

            const signature = this.generateSignature(params);
            params.Signature = signature;

            const queryString = Object.keys(params)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');

            const response = await axios.get(`https://alidns.${this.region}.aliyuncs.com/?${queryString}`, {
                timeout: 10000
            });

            if (response.data && response.data.RecordId) {
                return {
                    success: true,
                    message: '解析记录更新成功'
                };
            } else if (response.data && response.data.Code) {
                throw new Error(response.data.Message || `阿里云DNS错误: ${response.data.Code}`);
            } else {
                console.log('阿里云DNS更新记录返回数据:', response.data);
                throw new Error('更新解析记录失败');
            }
        } catch (error) {
            console.error('阿里云DNS更新解析记录错误详情:', error.response?.data || error.message);
            throw new Error(`阿里云DNS更新解析记录失败: ${error.message}`);
        }
    }

    async deleteRecord(domainName, recordId) {
        try {
            const timestamp = new Date().toISOString();
            const nonce = Math.random().toString(36).substring(2);

            const params = {
                Action: 'DeleteDomainRecord',
                Version: '2015-01-09',
                AccessKeyId: this.accessKeyId,
                SignatureMethod: 'HMAC-SHA1',
                Timestamp: timestamp,
                SignatureVersion: '1.0',
                SignatureNonce: nonce,
                Format: 'JSON',
                RecordId: recordId
            };

            const signature = this.generateSignature(params);
            params.Signature = signature;

            const queryString = Object.keys(params)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');

            const response = await axios.get(`https://alidns.${this.region}.aliyuncs.com/?${queryString}`, {
                timeout: 10000
            });

            if (response.data && response.data.RecordId) {
                return {
                    success: true,
                    message: '解析记录删除成功'
                };
            } else if (response.data && response.data.Code) {
                throw new Error(response.data.Message || `阿里云DNS错误: ${response.data.Code}`);
            } else {
                console.log('阿里云DNS删除记录返回数据:', response.data);
                throw new Error('删除解析记录失败');
            }
        } catch (error) {
            console.error('阿里云DNS删除解析记录错误详情:', error.response?.data || error.message);
            throw new Error(`阿里云DNS删除解析记录失败: ${error.message}`);
        }
    }
}

// 腾讯云DNS简化实现 - 临时不可用，建议使用DNSPod
class TencentDNSProvider {
    constructor(config) {
        this.secretId = config.secretId;
        this.secretKey = config.secretKey;
        this.region = config.region || 'ap-beijing';
    }

    async getDomains() {
        throw new Error('腾讯云DNS API实现较复杂，建议使用DNSPod（腾讯云旗下）或其他DNS服务商');
    }
}

// 华为云DNS - 临时不可用
class HuaweiDNSProvider {
    constructor(config) {
        this.accessKey = config.accessKey;
        this.secretKey = config.secretKey;
        this.region = config.region || 'cn-north-1';
    }

    async getDomains() {
        throw new Error('华为云DNS API需要复杂的签名认证，建议使用DNSPod、阿里云或CloudFlare');
    }
}

// 西部数码 - 临时不可用
class WestProvider {
    constructor(config) {
        this.username = config.username;
        this.password = config.password;
        this.apiKey = config.apiKey;
    }

    async getDomains() {
        throw new Error('西部数码API需要具体的API文档和接口地址，建议使用DNSPod、阿里云或CloudFlare');
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

module.exports = {
    createDNSProvider,
    DNSPodProvider,
    AliyunDNSProvider,
    TencentDNSProvider,
    HuaweiDNSProvider,
    CloudFlareProvider,
    WestProvider
};
