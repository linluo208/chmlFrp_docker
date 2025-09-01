/* 登录组件 - Author: linluo - 防盗标识: linluo */
import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Row, Col, Tabs } from 'antd';
import { UserOutlined, LockOutlined, KeyOutlined } from '@ant-design/icons';
import { login, loginWithToken, startTokenMonitoring } from '../utils/auth';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('password');

  // 用户名密码登录
  const onPasswordLogin = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功！');
      // 启动Token监控
      startTokenMonitoring();
      onLogin();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Token登录
  const onTokenLogin = async (values) => {
    setLoading(true);
    try {
      await loginWithToken(values.token);
      message.success('Token登录成功！');
      // 启动Token监控
      startTokenMonitoring();
      onLogin();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Row justify="center" align="middle" style={{ width: '100%' }}>
        <Col xs={22} sm={16} md={12} lg={8} xl={6}>
          <Card
            title={
              <div style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                ChmlFrp 管理面板
              </div>
            }
            style={{ 
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              borderRadius: '10px'
            }}
          >
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              centered
              items={[
                {
                  key: 'password',
                  label: '密码登录',
                  children: (
                    <Form
                      name="passwordLogin"
                      onFinish={onPasswordLogin}
                      size="large"
                    >
                      <Form.Item
                        name="username"
                        rules={[{ required: true, message: '请输入用户名或邮箱!' }]}
                      >
                        <Input
                          prefix={<UserOutlined />}
                          placeholder="用户名或邮箱"
                        />
                      </Form.Item>

                      <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码!' }]}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          placeholder="密码"
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={loading}
                          style={{ 
                            width: '100%',
                            height: '45px',
                            fontSize: '16px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none'
                          }}
                        >
                          登录
                        </Button>
                      </Form.Item>
                    </Form>
                  )
                },
                {
                  key: 'token',
                  label: 'Token登录',
                  children: (
                    <Form
                      name="tokenLogin"
                      onFinish={onTokenLogin}
                      size="large"
                    >
                      <Form.Item
                        name="token"
                        rules={[{ required: true, message: '请输入Token!' }]}
                      >
                        <Input.Password
                          prefix={<KeyOutlined />}
                          placeholder="请输入用户Token"
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={loading}
                          style={{ 
                            width: '100%',
                            height: '45px',
                            fontSize: '16px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none'
                          }}
                        >
                          Token登录
                        </Button>
                      </Form.Item>
                    </Form>
                  )
                }
              ]}
            />
            
            <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
              <p>ChmlFrp 内网穿透管理系统</p>
              <p style={{ fontSize: '12px' }}>Powered by Docker</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Login;
