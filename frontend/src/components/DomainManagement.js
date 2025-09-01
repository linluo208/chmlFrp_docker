import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Popconfirm,
  Tag,
  Space,
  Card,
  Typography,
  Alert,
  Tooltip,
  Row,
  Col,
  Divider,
  Tabs
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  GlobalOutlined,
  ReloadOutlined,
  LinkOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  CloudOutlined,
  SettingOutlined
} from '@ant-design/icons';
import axios from '../utils/auth';
import CustomDomainManagement from './CustomDomainManagement';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const DomainManagement = () => {
  const [domains, setDomains] = useState([]);
  const [userDomains, setUserDomains] = useState([]);
  const [availableDomains, setAvailableDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAvailableDomains(),
        loadUserDomains()
      ]);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取可用域名列表
  const loadAvailableDomains = async () => {
    try {
      const response = await axios.get('/list_available_domains');
      if (response.data.code === 200) {
        setAvailableDomains(response.data.data || []);
      }
    } catch (error) {
      console.error('获取可用域名列表失败:', error);
    }
  };

  // 获取用户的二级域名
  const loadUserDomains = async () => {
    try {
      const response = await axios.get('/get_user_free_subdomains');
      if (response.data.code === 200) {
        setUserDomains(response.data.data || []);
      }
    } catch (error) {
      console.error('获取用户域名失败:', error);
    }
  };

  // 创建二级域名
  const handleSubmit = async (values) => {
    try {
      const response = await axios.post('/create_free_subdomain', {
        ...values,
        token: localStorage.getItem('token')
      });

      if (response.data.code === 200) {
        message.success('域名创建成功！');
        setModalVisible(false);
        form.resetFields();
        loadUserDomains();
      } else {
        message.error(response.data.msg || '创建失败');
      }
    } catch (error) {
      console.error('创建域名失败:', error);
      message.error('创建失败');
    }
  };

  // 更新二级域名
  const handleUpdate = async (values) => {
    try {
      const response = await axios.post('/update_free_subdomain', {
        ...values,
        domain: editingDomain.domain,
        record: editingDomain.record,
        token: localStorage.getItem('token')
      });

      if (response.data.code === 200) {
        message.success('域名更新成功！');
        setModalVisible(false);
        setEditingDomain(null);
        form.resetFields();
        loadUserDomains();
      } else {
        message.error(response.data.msg || '更新失败');
      }
    } catch (error) {
      console.error('更新域名失败:', error);
      message.error('更新失败');
    }
  };

  // 删除二级域名
  const handleDelete = async (domain) => {
    try {
      const response = await axios.post('/delete_free_subdomain', {
        domain: domain.domain,
        record: domain.record,
        token: localStorage.getItem('token')
      });

      if (response.data.code === 200) {
        message.success('域名删除成功！');
        loadUserDomains();
      } else {
        message.error(response.data.msg || '删除失败');
      }
    } catch (error) {
      console.error('删除域名失败:', error);
      message.error('删除失败');
    }
  };

  // 打开编辑对话框
  const handleEdit = (domain) => {
    setEditingDomain(domain);
    form.setFieldsValue({
      target: domain.target,
      ttl: domain.ttl
    });
    setModalVisible(true);
  };

  // 复制域名到剪贴板
  const handleCopy = (fullDomain) => {
    navigator.clipboard.writeText(fullDomain).then(() => {
      message.success('域名已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 获取DNS记录类型颜色
  const getTypeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'A': return 'blue';
      case 'AAAA': return 'purple';
      case 'CNAME': return 'green';
      case 'SRV': return 'orange';
      case 'MX': return 'orange';
      case 'TXT': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: '完整域名',
      key: 'fullDomain',
      render: (_, record) => {
        const fullDomain = `${record.record}.${record.domain}`;
        return (
          <Space>
            <Text strong style={{ color: '#1890ff' }}>
              {fullDomain}
            </Text>
            <Tooltip title="复制域名">
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => handleCopy(fullDomain)}
              />
            </Tooltip>
            <Tooltip title="在新窗口打开">
              <Button 
                type="text" 
                size="small" 
                icon={<LinkOutlined />}
                onClick={() => window.open(`http://${fullDomain}`, '_blank')}
              />
            </Tooltip>
          </Space>
        );
      }
    },
    {
      title: '主域名',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '记录',
      dataIndex: 'record',
      key: 'record',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={getTypeColor(type)}>{type?.toUpperCase()}</Tag>
      )
    },
    {
      title: '目标',
      dataIndex: 'target',
      key: 'target',
      ellipsis: true,
    },
    {
      title: 'TTL',
      dataIndex: 'ttl',
      key: 'ttl',
      render: (ttl) => ttl || '-'
    },
    {
      title: '状态',
      key: 'status',
      render: () => (
        <Tag color="green" icon={<CheckCircleOutlined />}>
          正常
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个域名吗？"
            description="删除后将无法恢复，请确认操作。"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <GlobalOutlined /> 域名管理
        </Title>
      </div>

      <Tabs defaultActiveKey="free" type="card">
        <TabPane
          tab={
            <span>
              <GlobalOutlined />
              免费二级域名
            </span>
          }
          key="free"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <Title level={3} style={{ margin: 0 }}>
              免费二级域名管理
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingDomain(null);
                  form.resetFields();
                  setModalVisible(true);
                }}
              >
                创建域名
              </Button>
            </Space>
          </div>

      {/* 可用域名信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card size="small" title="可用主域名">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableDomains.map((domain) => (
                <Tag 
                  key={domain.id} 
                  color={domain.icpFiling ? 'green' : 'blue'}
                  style={{ margin: '2px' }}
                >
                  {domain.domain}
                  {domain.icpFiling && ' (已备案)'}
                </Tag>
              ))}
            </div>
            {availableDomains.length === 0 && (
              <Text type="secondary">暂无可用域名</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 使用说明 */}
      <Alert
        message="域名使用说明"
        description={
          <div>
            <Paragraph style={{ margin: 0 }}>
              • <strong>A记录</strong>：将域名指向IPv4地址<br/>
              • <strong>AAAA记录</strong>：将域名指向IPv6地址<br/>
              • <strong>CNAME记录</strong>：将域名指向另一个域名<br/>
              • <strong>创建后</strong>：域名解析生效通常需要几分钟到几小时<br/>
              • <strong>注意</strong>：只能修改目标地址和TTL，其他字段创建后不可修改
            </Paragraph>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: '16px' }}
      />

      {/* 域名列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={userDomains}
          rowKey={(record) => `${record.domain}-${record.record}`}
          loading={loading}
          pagination={{
            total: userDomains.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个域名`,
          }}
          locale={{
            emptyText: '暂无域名记录'
          }}
        />
      </Card>

      {/* 创建/编辑对话框 */}
      <Modal
        title={editingDomain ? '编辑域名' : '创建二级域名'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingDomain(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingDomain ? handleUpdate : handleSubmit}
        >
          {!editingDomain && (
            <>
              <Form.Item
                label="主域名"
                name="domain"
                rules={[{ required: true, message: '请选择主域名' }]}
              >
                <Select placeholder="选择主域名" showSearch>
                  {availableDomains.map(domain => (
                    <Option key={domain.id} value={domain.domain}>
                      {domain.domain}
                      {domain.icpFiling && ' (已备案)'}
                      {domain.remarks && ` - ${domain.remarks}`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="记录名"
                name="record"
                rules={[
                  { required: true, message: '请输入记录名' },
                  { pattern: /^[a-zA-Z0-9\-]+$/, message: '只能包含字母、数字和连字符' }
                ]}
              >
                <Input placeholder="例如：www、api、test" />
              </Form.Item>

              <Form.Item
                label="记录类型"
                name="type"
                rules={[{ required: true, message: '请选择记录类型' }]}
              >
                <Select placeholder="选择记录类型">
                  <Option value="A">A - IPv4地址</Option>
                  <Option value="AAAA">AAAA - IPv6地址</Option>
                  <Option value="CNAME">CNAME - 别名记录</Option>
                  <Option value="SRV">SRV - 服务记录</Option>
                </Select>
              </Form.Item>
            </>
          )}

          {editingDomain && (
            <Alert
              message="编辑限制"
              description={`只能修改目标地址和TTL，主域名、记录名和类型不可修改。当前编辑：${editingDomain.record}.${editingDomain.domain}`}
              type="warning"
              style={{ marginBottom: '16px' }}
            />
          )}

          <Form.Item
            label="目标地址"
            name="target"
            rules={[{ required: true, message: '请输入目标地址' }]}
          >
            <Input placeholder="IPv4地址、IPv6地址或域名" />
          </Form.Item>

          <Form.Item
            label="TTL (生存时间)"
            name="ttl"
            rules={[{ required: true, message: '请选择TTL' }]}
            initialValue="1小时"
          >
            <Select>
              <Option value="1分钟">1分钟</Option>
              <Option value="2分钟">2分钟</Option>
              <Option value="5分钟">5分钟</Option>
              <Option value="10分钟">10分钟</Option>
              <Option value="15分钟">15分钟</Option>
              <Option value="30分钟">30分钟</Option>
              <Option value="1小时">1小时</Option>
              <Option value="2小时">2小时</Option>
              <Option value="5小时">5小时</Option>
              <Option value="12小时">12小时</Option>
              <Option value="1天">1天</Option>
            </Select>
          </Form.Item>

          {!editingDomain && (
            <Form.Item
              label="备注说明"
              name="remarks"
              rules={[{ required: true, message: '请输入备注说明' }]}
              initialValue="解析隧道：ChmlFrp-Tunnel"
            >
              <Input.TextArea 
                placeholder="请根据规范提交，如果解析到ChmlFrp的某个隧道，请填写：解析隧道：ChmlFrp-Tunnel" 
                rows={3}
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingDomain(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingDomain ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
                  </Form>
        </Modal>
        </TabPane>

        <TabPane
          tab={
            <span>
              <CloudOutlined />
              自定义域名
            </span>
          }
          key="custom"
        >
          <CustomDomainManagement />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DomainManagement;
