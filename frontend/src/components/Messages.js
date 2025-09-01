import React, { useState, useEffect } from 'react';
import { 
  List, 
  Card, 
  Typography, 
  Tag, 
  Button, 
  Space, 
  message as antMessage,
  Empty,
  Badge
} from 'antd';
import { 
  MessageOutlined, 
  ReloadOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from '../utils/auth';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/messages');
      if (response.data.code === 200) {
        setMessages(response.data.data || []);
      } else {
        antMessage.error(response.data.msg || '加载消息失败');
      }
    } catch (error) {
      antMessage.error('加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <MessageOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getMessageTag = (type) => {
    const typeMap = {
      info: { color: 'blue', text: '信息' },
      warning: { color: 'orange', text: '警告' },
      success: { color: 'green', text: '成功' },
      error: { color: 'red', text: '错误' },
      system: { color: 'purple', text: '系统' },
      tunnel: { color: 'cyan', text: '隧道' }
    };
    const config = typeMap[type] || { color: 'default', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatTime = (timestamp) => {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  };

  const unreadCount = messages.filter(msg => !msg.read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <MessageOutlined /> 消息中心
          {unreadCount > 0 && (
            <Badge count={unreadCount} style={{ marginLeft: '8px' }} />
          )}
        </Title>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadMessages}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Card>
        {messages.length === 0 ? (
          <Empty 
            description="暂无消息"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={messages}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条消息`
            }}
            renderItem={(item) => (
              <List.Item
                style={{ 
                  backgroundColor: item.read ? 'transparent' : '#f6ffed',
                  padding: '16px',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}
                actions={[
                  <Text type="secondary" key="time">
                    {formatTime(item.timestamp || item.createTime)}
                  </Text>
                ]}
              >
                <List.Item.Meta
                  avatar={getMessageIcon(item.type)}
                  title={
                    <Space>
                      <Text strong={!item.read}>
                        {item.title}
                      </Text>
                      {getMessageTag(item.type)}
                      {!item.read && <Badge status="processing" />}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph 
                        ellipsis={{ rows: 2, expandable: true }}
                        style={{ margin: 0, color: item.read ? '#666' : '#333' }}
                      >
                        {item.content || item.message}
                      </Paragraph>
                      {item.details && (
                        <div style={{ marginTop: '8px' }}>
                          <Text code>{item.details}</Text>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default Messages;
