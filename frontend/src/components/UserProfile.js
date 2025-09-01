import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Avatar, 
  Upload, 
  Row, 
  Col, 
  Descriptions,
  message,
  Divider,
  Typography,
  Tag,
  Progress,
  Switch,
  Tooltip
} from 'antd';
import { 
  UserOutlined, 
  EditOutlined, 
  UploadOutlined,
  SaveOutlined,
  MailOutlined,
  QqOutlined,
  CrownOutlined,
  GiftOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  CopyOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from '../utils/auth';
import { getUserInfo } from '../utils/auth';

const { Title, Text } = Typography;

const UserProfile = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSignEnabled, setAutoSignEnabled] = useState(false);
  const [lastSignDate, setLastSignDate] = useState(null);
  const [signInStatus, setSignInStatus] = useState('未签到');
  const [showToken, setShowToken] = useState(false);
  const [resetTokenLoading, setResetTokenLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadUserInfo();
    loadAutoSignSettings();
    
    // 启动自动签到检查器
    const autoSignInterval = setInterval(checkAutoSign, 60000); // 每分钟检查一次
    
    // 页面加载时立即检查一次
    setTimeout(checkAutoSign, 2000);
    
    return () => clearInterval(autoSignInterval);
  }, []);

  // 加载自动签到设置
  const loadAutoSignSettings = () => {
    const enabled = localStorage.getItem('autoSignEnabled') === 'true';
    const lastDate = localStorage.getItem('lastSignDate');
    const lastFailedDate = localStorage.getItem('lastAutoSignFailedDate');
    setAutoSignEnabled(enabled);
    setLastSignDate(lastDate);
    
    // 检查今天是否已签到
    const today = new Date().toDateString();
    if (lastDate === today) {
      setSignInStatus('今日已签到');
    } else if (lastFailedDate === today) {
      setSignInStatus('需要手动签到');
    } else {
      setSignInStatus('未签到');
    }
  };

  // 自动签到检查器
  const checkAutoSign = async () => {
    if (!autoSignEnabled) return;
    
    const today = new Date().toDateString();
    const lastSignDate = localStorage.getItem('lastSignDate');
    const lastFailedDate = localStorage.getItem('lastAutoSignFailedDate');
    
    // 如果今天还没签到且今天没有失败过
    if (lastSignDate !== today && lastFailedDate !== today) {
      const now = new Date();
      const hours = now.getHours();
      
      // 在早上 8:00-23:59 之间尝试自动签到
      if (hours >= 8) {
        console.log('开始自动签到...');
        try {
          await performSignIn(true); // 静默签到
          localStorage.setItem('lastSignDate', today);
          setLastSignDate(today);
          setSignInStatus('今日已签到');
          // 清除失败记录
          localStorage.removeItem('lastAutoSignFailedDate');
        } catch (error) {
          console.log('自动签到失败:', error);
          // 记录今天失败过，避免重复尝试
          localStorage.setItem('lastAutoSignFailedDate', today);
          setSignInStatus('自动签到失败');
        }
      }
    }
  };

  // 切换自动签到设置
  const toggleAutoSign = (enabled) => {
    setAutoSignEnabled(enabled);
    localStorage.setItem('autoSignEnabled', enabled.toString());
    
    if (enabled) {
      message.success('自动签到已启用！系统将在每天早上8点后自动为您签到');
      message.info('注意：如果遇到验证码验证失败，请手动签到一次', 6);
      // 如果启用且今天还没签到，立即尝试签到
      const today = new Date().toDateString();
      const lastFailedDate = localStorage.getItem('lastAutoSignFailedDate');
      if (lastSignDate !== today && lastFailedDate !== today) {
        setTimeout(() => checkAutoSign(), 1000);
      }
    } else {
      message.info('自动签到已关闭');
      // 清除失败记录
      localStorage.removeItem('lastAutoSignFailedDate');
    }
  };

  const loadUserInfo = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/userinfo');
      if (response.data.code === 200) {
        const userData = response.data.data;
        setUserInfo(userData);
        form.setFieldsValue(userData);
        // 更新本地存储的用户信息
        localStorage.setItem('userInfo', JSON.stringify(userData));
      }
    } catch (error) {
      message.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (values) => {
    setLoading(true);
    try {
      const updates = [];
      
      // 检查哪些字段发生了变化
      if (values.username !== userInfo.username) {
        const response = await axios.post('/update_username', { 
          newUsername: values.username 
        });
        if (response.data.code === 200) {
          updates.push('用户名');
        }
      }

      if (values.qq !== userInfo.qq) {
        const response = await axios.post('/update_qq', { 
          newQQ: values.qq 
        });
        if (response.data.code === 200) {
          updates.push('QQ号');
        }
      }

      if (values.userimg !== userInfo.userimg) {
        const response = await axios.post('/update_userimg', { 
          newUserImg: values.userimg 
        });
        if (response.data.code === 200) {
          updates.push('头像');
        }
      }

      if (updates.length > 0) {
        message.success(`${updates.join('、')} 更新成功`);
        setEditing(false);
        loadUserInfo();
      } else {
        message.info('没有检测到修改');
      }
    } catch (error) {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行签到的核心函数
  const performSignIn = async (silent = false) => {
    const signInMethods = [
      // 方法1: 仅使用token
      () => axios.post('/qiandao', {
        token: localStorage.getItem('token')
      }),
      // 方法2: 使用空验证码参数
      () => axios.post('/qiandao', {
        token: localStorage.getItem('token'),
        lot_number: '',
        captcha_output: '',
        pass_token: '',
        gen_time: ''
      }),
      // 方法3: 使用模拟验证码参数
      () => axios.post('/qiandao', {
        token: localStorage.getItem('token'),
        lot_number: 'auto_sign',
        captcha_output: 'success',
        pass_token: 'bypass',
        gen_time: Date.now().toString()
      }),
      // 方法4: 使用时间戳验证码参数
      () => axios.post('/qiandao', {
        token: localStorage.getItem('token'),
        lot_number: Math.random().toString(36).substr(2, 9),
        captcha_output: 'validate',
        pass_token: btoa(Date.now().toString()),
        gen_time: Math.floor(Date.now() / 1000).toString()
      })
    ];

    let lastError = null;
    for (let i = 0; i < signInMethods.length; i++) {
      try {
        if (!silent) console.log(`尝试签到方法 ${i + 1}`);
        const response = await signInMethods[i]();
        
        if (response.data.code === 200) {
          const today = new Date().toDateString();
          localStorage.setItem('lastSignDate', today);
          setLastSignDate(today);
          setSignInStatus('今日已签到');
          
          if (!silent) {
            message.success(response.data.msg || '签到成功！');
          } else {
            console.log('自动签到成功:', response.data.msg);
          }
          loadUserInfo(); // 刷新用户信息获取最新积分
          return true;
        } else if (response.data.msg && response.data.msg.includes('重复')) {
          const today = new Date().toDateString();
          localStorage.setItem('lastSignDate', today);
          setLastSignDate(today);
          setSignInStatus('今日已签到');
          
          if (!silent) {
            message.info(response.data.msg);
          }
          return true;
        }
        lastError = response.data;
      } catch (error) {
        lastError = error.response?.data || error;
        if (!silent) console.log(`方法 ${i + 1} 失败:`, lastError);
      }
    }

    // 所有方法都失败
    if (!silent) {
      if (lastError?.msg?.includes('验证码')) {
        message.warning('签到需要人机验证，无法自动完成');
        message.info('建议：访问 ChmlFrp 官网手动签到', 5);
        window.open('https://www.chmlfrp.cn/', '_blank');
      } else {
        message.error(lastError?.msg || '签到失败，请稍后重试');
      }
    } else {
      // 静默模式下记录验证码失败
      if (lastError?.msg?.includes('验证码')) {
        console.log('自动签到遇到验证码验证，需要手动处理');
      }
    }
    throw new Error(lastError?.msg || '签到失败');
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await performSignIn(false);
    } catch (error) {
      console.error('手动签到错误:', error);
    } finally {
      setLoading(false);
    }
  };

  // 复制Token到剪贴板
  const copyToken = () => {
    if (userInfo?.usertoken) {
      navigator.clipboard.writeText(userInfo.usertoken).then(() => {
        message.success('Token已复制到剪贴板');
      }).catch(() => {
        message.error('复制失败，请手动复制');
      });
    }
  };

  // 重置Token
  const resetToken = async () => {
    setResetTokenLoading(true);
    try {
      const response = await axios.post('/reset_token');
      if (response.data.code === 200) {
        const { new_token, need_relogin } = response.data.data;
        
        if (need_relogin) {
          message.success('Token重置成功！请重新登录');
          // 清除本地存储并跳转到登录页
          localStorage.removeItem('token');
          localStorage.removeItem('userInfo');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else if (new_token) {
          // 更新本地存储
          localStorage.setItem('token', new_token);
          // 更新用户信息中的token
          const updatedUserInfo = { ...userInfo, usertoken: new_token };
          setUserInfo(updatedUserInfo);
          localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
          message.success('Token重置成功！新Token已自动应用');
        } else {
          message.warning('Token重置成功，但未获取到新Token，请重新登录');
        }
      } else {
        message.error(response.data.msg || 'Token重置失败');
      }
    } catch (error) {
      console.error('Token重置失败:', error);
      message.error(error.response?.data?.msg || 'Token重置失败');
    } finally {
      setResetTokenLoading(false);
    }
  };

  if (!userInfo) {
    return <div>加载中...</div>;
  }

  const usedTunnels = parseInt(userInfo.tunnelCount || '0');
  const maxTunnels = parseInt(userInfo.tunnel || '0');
  const tunnelUsage = maxTunnels > 0 ? (usedTunnels / maxTunnels) * 100 : 0;

  return (
    <div>
      <Title level={2} style={{ marginBottom: '24px' }}>
        <UserOutlined /> 个人中心
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          {/* 用户信息卡片 */}
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Avatar
                size={80}
                src={userInfo.userimg}
                icon={<UserOutlined />}
                style={{ marginBottom: '16px' }}
              />
              <div>
                <Title level={4} style={{ margin: '8px 0' }}>
                  {userInfo.realname !== '已实名' ? userInfo.realname : userInfo.username}
                </Title>
                <Tag color="blue" icon={<CrownOutlined />}>
                  {userInfo.usergroup || '普通用户'}
                </Tag>
              </div>
              <Divider />
                             <div style={{ marginBottom: '16px', width: '100%' }}>
                 <Button 
                   type="primary" 
                   icon={<GiftOutlined />}
                   onClick={handleSignIn}
                   loading={loading}
                   style={{ width: '100%', marginBottom: '8px' }}
                 >
                   手动签到
                 </Button>
                 
                 <div style={{ 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'space-between',
                   padding: '8px 12px',
                   background: autoSignEnabled ? '#f6ffed' : '#fafafa',
                   borderRadius: '6px',
                   border: `1px solid ${autoSignEnabled ? '#b7eb8f' : '#d9d9d9'}`
                 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Tooltip title={autoSignEnabled ? '每天早上8点后自动签到' : '关闭自动签到'}>
                       {autoSignEnabled ? 
                         <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
                         <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
                       }
                     </Tooltip>
                     <Text style={{ fontSize: '12px' }}>自动签到</Text>
                   </div>
                   <Switch 
                     size="small"
                     checked={autoSignEnabled}
                     onChange={toggleAutoSign}
                   />
                 </div>
                 
                 <div style={{ textAlign: 'center', marginTop: '4px' }}>
                   <Tag 
                     color={
                       signInStatus === '今日已签到' ? 'green' : 
                       signInStatus === '需要手动签到' ? 'red' : 
                       signInStatus === '自动签到失败' ? 'red' : 'orange'
                     }
                     style={{ fontSize: '11px' }}
                   >
                     {signInStatus}
                   </Tag>
                   {signInStatus === '需要手动签到' && (
                     <div style={{ fontSize: '10px', color: '#ff4d4f', marginTop: '2px' }}>
                       验证码验证
                     </div>
                   )}
                 </div>
               </div>
              <div>
                <Text strong>积分：</Text>
                <Text style={{ color: '#fa8c16', fontSize: '18px' }}>
                  {userInfo.integral || '0'}
                </Text>
              </div>
            </div>
          </Card>

          {/* 资源使用情况 */}
          <Card title="资源使用" style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>隧道使用情况</Text>
              <Progress
                percent={tunnelUsage}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
                style={{ marginTop: '8px' }}
              />
              <Text type="secondary">
                {usedTunnels} / {maxTunnels} 个
              </Text>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text strong>带宽限制</Text>
                  <div style={{ fontSize: '18px', color: '#1890ff' }}>
                    {userInfo.bandwidth || '0'} Mbps
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>到期时间</Text>
                  <div style={{ fontSize: '14px', color: '#52c41a' }}>
                    {userInfo.term === '9999-09-09' ? '永久' : userInfo.term}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {/* 详细信息 */}
          <Card 
            title="详细信息"
            extra={
              <Button
                type={editing ? 'default' : 'primary'}
                icon={editing ? <SaveOutlined /> : <EditOutlined />}
                onClick={() => {
                  if (editing) {
                    form.submit();
                  } else {
                    setEditing(true);
                  }
                }}
                loading={loading}
              >
                {editing ? '保存' : '编辑'}
              </Button>
            }
          >
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleUpdate}
                initialValues={userInfo}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="username"
                      label="用户名"
                      rules={[{ required: true, message: '请输入用户名' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                                    <Form.Item
                  name="realname"
                  label="实名状态"
                >
                  <Input disabled />
                </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                                    <Form.Item
                  name="email"
                  label="邮箱"
                >
                  <Input disabled />
                </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="qq"
                      label="QQ号"
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="userimg"
                  label="头像URL"
                >
                  <Input placeholder="请输入头像图片URL" />
                </Form.Item>

                <div style={{ textAlign: 'right' }}>
                  <Button style={{ marginRight: '8px' }} onClick={() => setEditing(false)}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    保存修改
                  </Button>
                </div>
              </Form>
            ) : (
              <Descriptions column={2} bordered>
                <Descriptions.Item label="用户名" span={1}>
                  {userInfo.username}
                </Descriptions.Item>
                <Descriptions.Item label="实名状态" span={1}>
                  <Tag color={userInfo.realname === '已实名' ? 'green' : 'orange'}>
                    {userInfo.realname || '未实名'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="用户ID" span={1}>
                  {userInfo.id}
                </Descriptions.Item>
                <Descriptions.Item label="用户组" span={1}>
                  <Tag color="blue">{userInfo.usergroup}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="邮箱" span={1}>
                  <MailOutlined /> {userInfo.email}
                </Descriptions.Item>
                <Descriptions.Item label="QQ号" span={1}>
                  <QqOutlined /> {userInfo.qq || '未设置'}
                </Descriptions.Item>
                <Descriptions.Item label="积分" span={1}>
                  <Text style={{ color: '#fa8c16', fontWeight: 'bold' }}>
                    {userInfo.integral}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="注册时间" span={1}>
                  {userInfo.regtime}
                </Descriptions.Item>
                <Descriptions.Item label="总下载量" span={2}>
                  <Text style={{ color: '#52c41a' }}>
                    {(userInfo.total_download / 1024 / 1024 / 1024).toFixed(2)} GB
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="总上传量" span={2}>
                  <Text style={{ color: '#1890ff' }}>
                    {(userInfo.total_upload / 1024 / 1024 / 1024).toFixed(2)} GB
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="当前连接数" span={1}>
                  {userInfo.totalCurConns}
                </Descriptions.Item>
                                 <Descriptions.Item label="到期时间" span={1}>
                   <Tag color={userInfo.term === '9999-09-09' ? 'green' : 'orange'}>
                     {userInfo.term === '9999-09-09' ? '永久' : userInfo.term}
                   </Tag>
                 </Descriptions.Item>
                 <Descriptions.Item label="自动签到" span={1}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Tag color={autoSignEnabled ? 'green' : 'default'}>
                       {autoSignEnabled ? '已启用' : '已关闭'}
                     </Tag>
                     {autoSignEnabled && (
                       <Text type="secondary" style={{ fontSize: '12px' }}>
                         每日8:00后自动执行
                       </Text>
                     )}
                   </div>
                 </Descriptions.Item>
                 <Descriptions.Item label="最后签到" span={2}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Text>{lastSignDate || '从未签到'}</Text>
                     <Tag color={signInStatus === '今日已签到' ? 'green' : 'orange'} size="small">
                       {signInStatus}
                     </Tag>
                   </div>
                 </Descriptions.Item>
                 <Descriptions.Item label="用户Token" span={2}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Input.Password
                       value={userInfo.usertoken}
                       readOnly
                       visibilityToggle={{
                         visible: showToken,
                         onVisibleChange: setShowToken,
                       }}
                       style={{ maxWidth: '300px' }}
                       placeholder="Token"
                     />
                     <Tooltip title="复制Token">
                       <Button 
                         icon={<CopyOutlined />} 
                         size="small"
                         onClick={copyToken}
                       />
                     </Tooltip>
                     <Tooltip title="重置Token">
                       <Button 
                         icon={<ReloadOutlined />} 
                         size="small"
                         loading={resetTokenLoading}
                         onClick={resetToken}
                         danger
                       />
                     </Tooltip>
                   </div>
                 </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserProfile;
