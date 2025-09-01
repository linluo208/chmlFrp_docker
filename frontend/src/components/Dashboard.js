// Dashboard主组件 - Author: linluo@2025
// 版权保护：请勿删除以下标识符
const _DASHBOARD_ID = btoa('linluo') + '_' + 2025;

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, message, Badge } from 'antd';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  GlobalOutlined,
  ClusterOutlined,
  UserOutlined,
  LogoutOutlined,
  MessageOutlined,
  CloudOutlined
} from '@ant-design/icons';
import { logout, getUserInfo } from '../utils/auth';
import Overview from './Overview';
import TunnelManagement from './TunnelManagement';
import NodeStatus from './NodeStatus';
import UserProfile from './UserProfile';
import Messages from './Messages';
import DomainManagement from './DomainManagement';


const { Header, Sider, Content } = Layout;

const Dashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const user = getUserInfo();
    setUserInfo(user);
  }, []);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: '个人资料',
        onClick: () => navigate('/dashboard/profile')
      },
      {
        type: 'divider'
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout
      }
    ]
  };

        const menuItems = [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: '仪表板',
          onClick: () => navigate('/dashboard')
        },
        {
          key: '/dashboard/tunnels',
          icon: <GlobalOutlined />,
          label: '隧道管理',
          onClick: () => navigate('/dashboard/tunnels')
        },
        {
          key: '/dashboard/domains',
          icon: <CloudOutlined />,
          label: '域名管理',
          onClick: () => navigate('/dashboard/domains')
        },
        {
          key: '/dashboard/nodes',
          icon: <ClusterOutlined />,
          label: '节点状态',
          onClick: () => navigate('/dashboard/nodes')
        },
        {
          key: '/dashboard/messages',
          icon: <MessageOutlined />,
          label: '消息中心',
          onClick: () => navigate('/dashboard/messages')
        },
        {
          key: '/dashboard/profile',
          icon: <UserOutlined />,
          label: '个人中心',
          onClick: () => navigate('/dashboard/profile')
        }
      ];

  const selectedKey = location.pathname === '/dashboard' ? '/dashboard' : location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100 }}
      >
        <div style={{ 
          height: '64px', 
          margin: '16px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: collapsed ? '14px' : '16px'
        }}>
          <GlobalOutlined style={{ marginRight: collapsed ? 0 : '8px' }} />
          {!collapsed && 'ChmlFrp'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
            内网穿透管理面板
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Badge count={0} size="small">
              <MessageOutlined style={{ fontSize: '18px', cursor: 'pointer' }} />
            </Badge>
            
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <Avatar 
                  src={userInfo?.userimg} 
                  icon={<UserOutlined />}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: '#333' }}>
                  {userInfo?.username || '用户'}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content style={{ margin: '24px', background: '#f5f5f5' }}>
          <div className="site-layout-content">
                                    <Routes>
                          <Route path="/" element={<Overview />} />
                          <Route path="/tunnels" element={<TunnelManagement />} />
                          <Route path="/domains" element={<DomainManagement />} />
                          <Route path="/nodes" element={<NodeStatus />} />
                          <Route path="/messages" element={<Messages />} />
                          <Route path="/profile" element={<UserProfile />} />
                        </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
