/* 概览组件 - linluo@2025 - 防盗标识: linluo */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Progress, List, Typography, Spin, message, Table, Tag, Tooltip, Alert } from 'antd';
import { 
  GlobalOutlined, 
  ServerOutlined, 
  UserOutlined, 
  DashboardOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  MonitorOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import axios from '../utils/auth';

const { Title, Text } = Typography;

const Overview = () => {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [tunnels, setTunnels] = useState([]);
  const [nodeStats, setNodeStats] = useState([]);
  const [panelInfo, setPanelInfo] = useState(null);
  const [trafficStats, setTrafficStats] = useState({
    totalUpload: 0,
    totalDownload: 0,
    totalConnections: 0,
    activeTunnels: 0
  });
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    loadData();
    
    // 每30秒刷新数据（包括系统信息）
    const dataInterval = setInterval(loadData, 30000);
    
    return () => {
      clearInterval(dataInterval);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, tunnelRes, nodeRes, panelRes, systemRes] = await Promise.all([
        axios.get('/userinfo'),
        axios.get('/tunnel'),
        axios.get('/node_stats'),
        axios.get('/panelinfo'),
        axios.get('/system')
      ]);

      if (userRes.data.code === 200) {
        console.log('用户信息:', userRes.data.data);
        setUserInfo(userRes.data.data);
      }
      if (tunnelRes.data.code === 200) {
        const tunnelData = tunnelRes.data.data || [];
        setTunnels(tunnelData);
        
        // 计算流量统计
        const stats = tunnelData.reduce((acc, tunnel) => {
          const upload = parseFloat(tunnel.today_traffic_out || 0);
          const download = parseFloat(tunnel.today_traffic_in || 0);
          const connections = parseInt(tunnel.cur_conns || 0);
          
          acc.totalUpload += upload;
          acc.totalDownload += download;
          acc.totalConnections += connections;
          
          if (tunnel.state === 'true' || tunnel.state === true) {
            acc.activeTunnels += 1;
          }
          
          return acc;
        }, {
          totalUpload: 0,
          totalDownload: 0,
          totalConnections: 0,
          activeTunnels: 0
        });
        
        setTrafficStats(stats);
      }
      if (nodeRes.data.code === 200) setNodeStats(nodeRes.data.data || []);
      if (panelRes.data.code === 200) setPanelInfo(panelRes.data.data);
      if (systemRes.data.code === 200) {
        console.log('系统信息:', systemRes.data.data);
        setSystemInfo(systemRes.data.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const activeTunnels = tunnels.filter(tunnel => tunnel.status === 'online').length;
  const totalTunnels = tunnels.length;
  const usedTunnels = parseInt(userInfo?.tunnelCount || '0');
  const maxTunnels = parseInt(userInfo?.tunnel || '0');

  return (
    <div style={{ padding: '0' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        <DashboardOutlined /> 仪表板
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总隧道数"
              value={totalTunnels}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃隧道"
              value={trafficStats.activeTunnels}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="当前连接"
              value={trafficStats.totalConnections}
              prefix={<MonitorOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="积分"
              value={userInfo?.integral || '0'}
              prefix="💎"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 流量统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日上传"
              value={trafficStats.totalUpload.toFixed(2)}
              suffix="MB"
              prefix={<UploadOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日下载"
              value={trafficStats.totalDownload.toFixed(2)}
              suffix="MB"
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日总流量"
              value={(trafficStats.totalUpload + trafficStats.totalDownload).toFixed(2)}
              suffix="MB"
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="用户组"
              value={userInfo?.usergroup || '普通用户'}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 流量提醒 */}
      {(trafficStats.totalUpload + trafficStats.totalDownload) > 1000 && (
        <Alert
          message="流量使用提醒"
          description={`今日已使用 ${(trafficStats.totalUpload + trafficStats.totalDownload).toFixed(2)} MB 流量，请注意流量使用情况。`}
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* 隧道使用情况 */}
        <Col xs={24} lg={12}>
          <Card title="隧道使用情况" extra={`${usedTunnels}/${maxTunnels}`}>
            <Progress
              percent={(usedTunnels / maxTunnels) * 100}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              status={usedTunnels >= maxTunnels ? 'exception' : 'normal'}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">
                已使用 {usedTunnels} 个隧道，剩余 {maxTunnels - usedTunnels} 个
              </Text>
            </div>
          </Card>
        </Col>

        {/* 带宽信息 */}
        <Col xs={24} lg={12}>
          <Card title="带宽信息">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="国内带宽"
                  value={userInfo?.bandwidth || '0'}
                  suffix="Mbps"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="海外带宽"
                  value={userInfo?.bandwidth ? (userInfo.bandwidth * 4) : '0'}
                  suffix="Mbps"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 最近隧道 */}
        <Col xs={24} lg={12}>
          <Card title="最近隧道" extra="查看全部">
            <List
              dataSource={tunnels.slice(0, 5)}
              renderItem={(tunnel) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      tunnel.status === 'online' ? 
                      <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    }
                    title={tunnel.name}
                    description={`${tunnel.type} - ${tunnel.localPort || tunnel.localIP}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 系统信息 */}
        <Col xs={24} lg={12}>
          <Card title="系统信息">
            <List size="small">
              <List.Item>
                <Text strong>面板版本:</Text>
                <Text style={{ float: 'right' }}>{systemInfo?.version || 'v1.0.0 Docker'}</Text>
              </List.Item>
              <List.Item>
                <Text strong>在线时间:</Text>
                <Text style={{ float: 'right' }}>
                  {systemInfo?.uptimeFormatted || '加载中...'}
                </Text>
              </List.Item>
              <List.Item>
                <Text strong>用户ID:</Text>
                <Text style={{ float: 'right' }}>{userInfo?.id || '未知'}</Text>
              </List.Item>
              <List.Item>
                <Text strong>注册邮箱:</Text>
                <Text style={{ float: 'right' }}>{userInfo?.email || '未设置'}</Text>
              </List.Item>
            </List>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Overview;
