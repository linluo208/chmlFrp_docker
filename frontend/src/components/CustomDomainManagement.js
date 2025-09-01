import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Space,
  Card,
  Typography,
  Alert,
  Tooltip,
  Row,
  Col,
  Popconfirm
} from 'antd';
import {
  SettingOutlined,
  ReloadOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  LinkOutlined,
  CloudOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const CustomDomainManagement = () => {
  const [domainList, setDomainList] = useState([]);
  const [dnsConfigs, setDnsConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dnsListModalVisible, setDnsListModalVisible] = useState(false);
  const [dnsFormModalVisible, setDnsFormModalVisible] = useState(false);
  const [editingDnsConfig, setEditingDnsConfig] = useState(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [recordForm] = Form.useForm();
  const [selectedProvider, setSelectedProvider] = useState('');

  // DNS服务商配置模板
  const dnsProviders = {
    dnspod: {
      name: 'DNSPod',
      logo: '🌐',
      fields: [
        { name: 'tokenId', label: 'Token ID', required: true },
        { name: 'token', label: 'Token', required: true, type: 'password' }
      ]
    },
    aliyun: {
      name: '阿里云DNS',
      logo: '☁️',
      fields: [
        { name: 'accessKeyId', label: 'AccessKey ID', required: true },
        { name: 'accessKeySecret', label: 'AccessKey Secret', required: true, type: 'password' },
        { name: 'region', label: '地域', required: true, type: 'select', options: [
          { value: 'cn-hangzhou', label: '华东1(杭州)' },
          { value: 'cn-beijing', label: '华北2(北京)' },
          { value: 'cn-shenzhen', label: '华南1(深圳)' }
        ]}
      ]
    },
    tencent: {
      name: '腾讯云DNS',
      logo: '🐧',
      fields: [
        { name: 'secretId', label: 'SecretId', required: true },
        { name: 'secretKey', label: 'SecretKey', required: true, type: 'password' },
        { name: 'region', label: '地域', required: true, type: 'select', options: [
          { value: 'ap-beijing', label: '北京' },
          { value: 'ap-shanghai', label: '上海' },
          { value: 'ap-guangzhou', label: '广州' }
        ]}
      ]
    },
    cloudflare: {
      name: 'CloudFlare',
      logo: '☁️',
      fields: [
        { name: 'apiToken', label: 'API Token', required: true, type: 'password' },
        { name: 'email', label: '邮箱地址', required: true, type: 'email' }
      ]
    },
    huawei: {
      name: '华为云DNS',
      logo: '🔶',
      fields: [
        { name: 'accessKey', label: 'Access Key', required: true },
        { name: 'secretKey', label: 'Secret Access Key', required: true, type: 'password' },
        { name: 'region', label: '区域', required: true, type: 'select', options: [
          { value: 'cn-north-1', label: '华北-北京一' },
          { value: 'cn-north-4', label: '华北-北京四' },
          { value: 'cn-east-2', label: '华东-上海二' }
        ]}
      ]
    },
    west: {
      name: '西部数码',
      logo: '🌐',
      fields: [
        { name: 'username', label: '用户名', required: true },
        { name: 'password', label: '密码', required: true, type: 'password' }
      ]
    }
  };

  useEffect(() => {
    loadDnsConfigs();
  }, []);

  useEffect(() => {
    if (dnsConfigs.length > 0) {
      refreshDomainLists();
    }
  }, [dnsConfigs]);

  // 加载DNS配置列表
  const loadDnsConfigs = async () => {
    try {
      const stored = localStorage.getItem('dnsConfigs');
      if (stored) {
        const configs = JSON.parse(stored);
        setDnsConfigs(configs);
      }
    } catch (error) {
      console.error('加载DNS配置失败:', error);
    }
  };

  // 从DNS配置中获取域名列表
  const getDomainListFromDns = async (dnsConfig) => {
    try {
      // 调用后端API来获取DNS域名列表
      // 后端会使用dnsConfig中的认证信息调用对应的DNS服务商API
      const response = await fetch('/api/dns/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('usertoken')}`
        },
        body: JSON.stringify({
          dnsConfig: dnsConfig
        })
      });

      if (!response.ok) {
        throw new Error(`获取域名列表失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 200) {
        // 处理返回的域名数据
        return result.data.map((domain, index) => ({
          id: `${dnsConfig.id}-${index}`,
          domain: domain.name || domain.domain,
          dnsConfigId: dnsConfig.id,
          dnsConfigName: dnsConfig.name,
          provider: dnsConfig.provider,
          status: domain.status || 'active',
          records: domain.records || 0,
          lastSync: new Date().toLocaleString()
        }));
      } else {
        throw new Error(result.message || '获取域名列表失败');
      }
    } catch (error) {
      console.error(`获取DNS配置 ${dnsConfig.name} 的域名列表失败:`, error);
      message.error(`获取 ${dnsConfig.name} 域名列表失败: ${error.message}`);
      return [];
    }
  };

  // 刷新所有DNS配置的域名列表
  const refreshDomainLists = async () => {
    setLoading(true);
    try {
      const allDomains = [];
      
      for (const config of dnsConfigs) {
        const domains = await getDomainListFromDns(config);
        allDomains.push(...domains);
      }
      
      setDomainList(allDomains);
      message.success('域名列表刷新完成');
    } catch (error) {
      console.error('刷新域名列表失败:', error);
      message.error('刷新域名列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存DNS配置
  const handleDnsSubmit = async (values) => {
    try {
      const configData = {
        id: editingDnsConfig ? editingDnsConfig.id : Date.now(),
        ...values,
        createTime: editingDnsConfig ? editingDnsConfig.createTime : new Date().toLocaleString(),
        updateTime: new Date().toLocaleString(),
        status: 'active'
      };

      let updatedConfigs;
      if (editingDnsConfig) {
        updatedConfigs = dnsConfigs.map(config => 
          config.id === editingDnsConfig.id ? configData : config
        );
      } else {
        updatedConfigs = [...dnsConfigs, configData];
      }

      setDnsConfigs(updatedConfigs);
      localStorage.setItem('dnsConfigs', JSON.stringify(updatedConfigs));

      message.success(editingDnsConfig ? 'DNS配置更新成功！' : 'DNS配置添加成功！');
      setDnsFormModalVisible(false);
      setEditingDnsConfig(null);
      form.resetFields();
      setSelectedProvider('');
    } catch (error) {
      console.error('保存DNS配置失败:', error);
      message.error('保存失败');
    }
  };

  // 删除DNS配置
  const handleDeleteDnsConfig = async (configId) => {
    try {
      const updatedConfigs = dnsConfigs.filter(config => config.id !== configId);
      setDnsConfigs(updatedConfigs);
      localStorage.setItem('dnsConfigs', JSON.stringify(updatedConfigs));
      message.success('DNS配置删除成功！');
    } catch (error) {
      console.error('删除DNS配置失败:', error);
      message.error('删除失败');
    }
  };

  // 获取域名解析记录
  const loadDnsRecords = async (domain) => {
    setRecordsLoading(true);
    try {
      const dnsConfig = dnsConfigs.find(config => config.id === domain.dnsConfigId);
      if (!dnsConfig) {
        throw new Error('找不到对应的DNS配置');
      }

      const response = await fetch('/api/dns/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('usertoken')}`
        },
        body: JSON.stringify({
          dnsConfig: dnsConfig,
          domainName: domain.domain
        })
      });

      const result = await response.json();
      
      if (result.code === 200) {
        setDnsRecords(result.data);
      } else {
        throw new Error(result.msg || '获取解析记录失败');
      }
    } catch (error) {
      console.error('获取解析记录失败:', error);
      message.error(`获取解析记录失败: ${error.message}`);
      setDnsRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  // 创建解析记录
  const createDnsRecord = async (values) => {
    try {
      const dnsConfig = dnsConfigs.find(config => config.id === selectedDomain.dnsConfigId);
      if (!dnsConfig) {
        throw new Error('找不到对应的DNS配置');
      }

      const response = await fetch('/api/dns/records/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('usertoken')}`
        },
        body: JSON.stringify({
          dnsConfig: dnsConfig,
          domainName: selectedDomain.domain,
          recordData: values
        })
      });

      const result = await response.json();
      
      if (result.code === 200) {
        message.success(result.msg || '解析记录创建成功');
        recordForm.resetFields();
        // 重新加载解析记录
        await loadDnsRecords(selectedDomain);
      } else {
        throw new Error(result.msg || '创建解析记录失败');
      }
    } catch (error) {
      console.error('创建解析记录失败:', error);
      message.error(`创建解析记录失败: ${error.message}`);
    }
  };

  // 更新解析记录
  const updateDnsRecord = async (recordId, values) => {
    try {
      const dnsConfig = dnsConfigs.find(config => config.id === selectedDomain.dnsConfigId);
      if (!dnsConfig) {
        throw new Error('找不到对应的DNS配置');
      }

      const response = await fetch('/api/dns/records/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('usertoken')}`
        },
        body: JSON.stringify({
          dnsConfig: dnsConfig,
          domainName: selectedDomain.domain,
          recordId: recordId,
          recordData: values
        })
      });

      const result = await response.json();
      
      if (result.code === 200) {
        message.success(result.msg || '解析记录更新成功');
        // 重新加载解析记录
        await loadDnsRecords(selectedDomain);
      } else {
        throw new Error(result.msg || '更新解析记录失败');
      }
    } catch (error) {
      console.error('更新解析记录失败:', error);
      message.error(`更新解析记录失败: ${error.message}`);
    }
  };

  // 删除解析记录
  const deleteDnsRecord = async (recordId) => {
    try {
      const dnsConfig = dnsConfigs.find(config => config.id === selectedDomain.dnsConfigId);
      if (!dnsConfig) {
        throw new Error('找不到对应的DNS配置');
      }

      const response = await fetch('/api/dns/records/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('usertoken')}`
        },
        body: JSON.stringify({
          dnsConfig: dnsConfig,
          domainName: selectedDomain.domain,
          recordId: recordId
        })
      });

      const result = await response.json();
      
      if (result.code === 200) {
        message.success(result.msg || '解析记录删除成功');
        // 重新加载解析记录
        await loadDnsRecords(selectedDomain);
      } else {
        throw new Error(result.msg || '删除解析记录失败');
      }
    } catch (error) {
      console.error('删除解析记录失败:', error);
      message.error(`删除解析记录失败: ${error.message}`);
    }
  };

  // 编辑解析记录
  const handleEditRecord = (record) => {
    setEditingRecord(record);
    recordForm.setFieldsValue({
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl
    });
  };

  // 处理记录表单提交
  const handleRecordSubmit = async (values) => {
    if (editingRecord) {
      // 更新记录
      await updateDnsRecord(editingRecord.id, values);
      setEditingRecord(null);
      recordForm.resetFields();
    } else {
      // 创建记录
      await createDnsRecord(values);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingRecord(null);
    recordForm.resetFields();
  };

  // 管理域名解析
  const handleManageDomain = async (domain) => {
    setSelectedDomain(domain);
    setRecordModalVisible(true);
    setDnsRecords([]);
    setEditingRecord(null);
    recordForm.resetFields();
    await loadDnsRecords(domain);
  };

  // 复制配置信息
  const copyConfig = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 表格列配置
  const columns = [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain, record) => (
        <div>
          <Space>
            <Text strong style={{ color: '#1890ff' }}>
              {domain}
            </Text>
            <Tooltip title="复制域名">
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyConfig(domain)}
              />
            </Tooltip>
            <Tooltip title="在新窗口打开">
              <Button 
                type="text" 
                size="small" 
                icon={<LinkOutlined />}
                onClick={() => window.open(`http://${domain}`, '_blank')}
              />
            </Tooltip>
          </Space>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            记录数: {record.records || 0}
          </div>
        </div>
      )
    },
    {
      title: 'DNS配置',
      key: 'dnsConfig',
      render: (_, record) => {
        const providerInfo = dnsProviders[record.provider];
        return (
          <div>
            <div>
              <Text strong>{record.dnsConfigName}</Text>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {providerInfo && (
                <Tag color="blue" size="small">
                  {providerInfo.logo} {providerInfo.name}
                </Tag>
              )}
            </div>
          </div>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          'active': { color: 'success', text: '正常', icon: <CheckCircleOutlined /> },
          'pending': { color: 'processing', text: '同步中', icon: <ExclamationCircleOutlined /> },
          'error': { color: 'error', text: '错误', icon: <ExclamationCircleOutlined /> }
        };
        const config = statusConfig[status] || statusConfig.pending;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '最后同步',
      dataIndex: 'lastSync',
      key: 'lastSync',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleManageDomain(record)}
          >
            解析管理
          </Button>
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <CloudOutlined /> 自定义域名管理
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshDomainLists}
            loading={loading}
            disabled={dnsConfigs.length === 0}
          >
            刷新域名列表
          </Button>
          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={() => setDnsListModalVisible(true)}
          >
            DNS配置
          </Button>
        </Space>
      </div>

      {dnsConfigs.length === 0 && (
        <Alert
          message="请先配置DNS"
          description="需要先配置DNS服务商的API认证信息，配置完成后系统将自动获取该DNS下管理的域名列表。"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
          action={
            <Button
              type="primary"
              size="small"
              onClick={() => setDnsListModalVisible(true)}
            >
              立即配置
            </Button>
          }
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={domainList}
          rowKey="id"
          loading={loading}
          pagination={{
            total: domainList.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个域名`,
          }}
          locale={{
            emptyText: dnsConfigs.length === 0 ? '请先配置DNS' : '暂无域名'
          }}
        />
      </Card>

      {/* DNS配置列表对话框 */}
      <Modal
        title="DNS配置管理"
        open={dnsListModalVisible}
        onCancel={() => setDnsListModalVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: '16px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingDnsConfig(null);
              form.resetFields();
              setSelectedProvider('');
              setDnsFormModalVisible(true);
            }}
          >
            添加DNS配置
          </Button>
        </div>

        <Table
          columns={[
            {
              title: '配置名称',
              dataIndex: 'name',
              key: 'name',
              render: (name, record) => (
                <div>
                  <Text strong>{name}</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {dnsProviders[record.provider]?.logo} {dnsProviders[record.provider]?.name}
                  </div>
                </div>
              )
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (status) => (
                <Tag color={status === 'active' ? 'success' : 'default'}>
                  {status === 'active' ? '正常' : '未启用'}
                </Tag>
              )
            },
            {
              title: '更新时间',
              dataIndex: 'updateTime',
              key: 'updateTime',
            },
            {
              title: '操作',
              key: 'actions',
              render: (_, record) => (
                <Space>
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingDnsConfig(record);
                      form.setFieldsValue(record);
                      setSelectedProvider(record.provider);
                      setDnsFormModalVisible(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定要删除这个DNS配置吗？"
                    onConfirm={() => handleDeleteDnsConfig(record.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
          dataSource={dnsConfigs}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: '暂无DNS配置'
          }}
        />
      </Modal>

      {/* DNS配置表单对话框 */}
      <Modal
        title={editingDnsConfig ? '编辑DNS配置' : '添加DNS配置'}
        open={dnsFormModalVisible}
        onCancel={() => {
          setDnsFormModalVisible(false);
          setEditingDnsConfig(null);
          form.resetFields();
          setSelectedProvider('');
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleDnsSubmit}
        >
          <Form.Item
            label="配置名称"
            name="name"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="给这个DNS配置起个名字，如：我的阿里云DNS" />
          </Form.Item>

          <Form.Item
            label="DNS服务商"
            name="provider"
            rules={[{ required: true, message: '请选择DNS服务商' }]}
          >
            <Select 
              placeholder="选择DNS服务商" 
              onChange={(value) => setSelectedProvider(value)}
            >
              {Object.keys(dnsProviders).map(key => (
                <Option key={key} value={key}>
                  {dnsProviders[key].logo} {dnsProviders[key].name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {(selectedProvider || editingDnsConfig?.provider) && (
            <>
              {dnsProviders[selectedProvider || editingDnsConfig?.provider]?.fields?.map((field) => (
                <Form.Item
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
                >
                  {field.type === 'select' ? (
                    <Select placeholder={`选择${field.label}`}>
                      {field.options?.map(option => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={field.type || 'text'}
                      placeholder={`请输入${field.label}`}
                      autoComplete="off"
                    />
                  )}
                </Form.Item>
              ))}
            </>
          )}

          <Form.Item
            label="备注"
            name="remarks"
          >
            <Input.TextArea placeholder="可选：DNS配置用途说明" rows={2} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setDnsFormModalVisible(false);
                setEditingDnsConfig(null);
                form.resetFields();
                setSelectedProvider('');
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingDnsConfig ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 域名解析管理对话框 */}
      <Modal
        title={`解析管理 - ${selectedDomain?.domain}`}
        open={recordModalVisible}
        onCancel={() => {
          setRecordModalVisible(false);
          setSelectedDomain(null);
          setDnsRecords([]);
          recordForm.resetFields();
        }}
        footer={null}
        width={1000}
      >
        {selectedDomain && (
          <div>
            <Alert
              message="域名解析管理"
              description={`通过 ${dnsProviders[selectedDomain.provider]?.name} 管理 ${selectedDomain.domain} 的DNS解析记录。`}
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            
            <Row gutter={16}>
              <Col span={8}>
                <Card 
                  title={editingRecord ? "编辑解析记录" : "添加解析记录"} 
                  size="small"
                  extra={editingRecord && (
                    <Button size="small" onClick={handleCancelEdit}>
                      取消编辑
                    </Button>
                  )}
                >
                  <Form
                    form={recordForm}
                    layout="vertical"
                    onFinish={handleRecordSubmit}
                  >
                    <Form.Item
                      label="记录类型"
                      name="type"
                      rules={[{ required: true, message: '请选择记录类型' }]}
                    >
                      <Select placeholder="选择记录类型">
                        <Option value="A">A - IPv4地址</Option>
                        <Option value="AAAA">AAAA - IPv6地址</Option>
                        <Option value="CNAME">CNAME - 别名</Option>
                        <Option value="MX">MX - 邮件交换</Option>
                        <Option value="TXT">TXT - 文本记录</Option>
                      </Select>
                    </Form.Item>
                    
                    <Form.Item
                      label="主机记录"
                      name="name"
                      rules={[{ required: true, message: '请输入主机记录' }]}
                    >
                      <Input placeholder="www 或 @ 或 *" />
                    </Form.Item>
                    
                    <Form.Item
                      label="记录值"
                      name="value"
                      rules={[{ required: true, message: '请输入记录值' }]}
                    >
                      <Input placeholder="IP地址或目标域名" />
                    </Form.Item>

                    <Form.Item
                      label="TTL"
                      name="ttl"
                      initialValue={600}
                    >
                      <Select>
                        <Option value={60}>1分钟</Option>
                        <Option value={300}>5分钟</Option>
                        <Option value={600}>10分钟</Option>
                        <Option value={1800}>30分钟</Option>
                        <Option value={3600}>1小时</Option>
                        <Option value={7200}>2小时</Option>
                        <Option value={86400}>1天</Option>
                      </Select>
                    </Form.Item>
                    
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block>
                        {editingRecord ? '更新记录' : '添加记录'}
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
              
              <Col span={16}>
                <Card 
                  title="现有解析记录" 
                  size="small"
                  extra={
                    <Button 
                      icon={<ReloadOutlined />} 
                      onClick={() => loadDnsRecords(selectedDomain)}
                      loading={recordsLoading}
                      size="small"
                    >
                      刷新
                    </Button>
                  }
                >
                  <Table
                    dataSource={dnsRecords}
                    loading={recordsLoading}
                    size="small"
                    pagination={false}
                    scroll={{ y: 300 }}
                    columns={[
                      {
                        title: '记录类型',
                        dataIndex: 'type',
                        key: 'type',
                        width: 80,
                        render: (type) => <Tag color="blue">{type}</Tag>
                      },
                      {
                        title: '主机记录',
                        dataIndex: 'name',
                        key: 'name',
                        width: 120,
                        render: (name) => <Text code>{name}</Text>
                      },
                      {
                        title: '记录值',
                        dataIndex: 'value',
                        key: 'value',
                        ellipsis: true,
                        render: (value) => (
                          <Tooltip title={value}>
                            <Text style={{ fontSize: '12px' }}>{value}</Text>
                          </Tooltip>
                        )
                      },
                      {
                        title: 'TTL',
                        dataIndex: 'ttl',
                        key: 'ttl',
                        width: 60,
                        render: (ttl) => <Text>{ttl}s</Text>
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        width: 80,
                        render: (status) => (
                          <Tag color={status === 'enabled' ? 'green' : status === 'proxied' ? 'orange' : 'red'}>
                            {status === 'enabled' ? '正常' : status === 'proxied' ? '代理' : '禁用'}
                          </Tag>
                        )
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: 120,
                        render: (_, record) => (
                          <Space size="small">
                            <Tooltip title="编辑记录">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                size="small"
                                onClick={() => handleEditRecord(record)}
                              />
                            </Tooltip>
                            <Tooltip title="删除记录">
                              <Popconfirm
                                title="确定要删除这条解析记录吗？"
                                onConfirm={() => deleteDnsRecord(record.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button
                                  type="text"
                                  icon={<DeleteOutlined />}
                                  size="small"
                                  danger
                                />
                              </Popconfirm>
                            </Tooltip>
                          </Space>
                        )
                      }
                    ]}
                    locale={{
                      emptyText: recordsLoading ? '加载中...' : (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: '#999' }}>
                          <GlobalOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
                          <div>暂无解析记录</div>
                          <div style={{ fontSize: '12px' }}>添加第一个解析记录开始使用</div>
                        </div>
                      )
                    }}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomDomainManagement;