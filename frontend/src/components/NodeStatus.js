import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Statistic, 
  Progress, 
  Typography,
  Button,
  Space,
  message,
  Tag,
  Tooltip
} from 'antd';
import { 
  ClusterOutlined, 
  ReloadOutlined,
  UploadOutlined,
  DownloadOutlined,
  TeamOutlined,
  ApiOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from '../utils/auth';

const { Title, Text } = Typography;

const NodeStatus = () => {
  const [nodes, setNodes] = useState([]);
  const [nodeStats, setNodeStats] = useState([]);
  const [nodeUptime, setNodeUptime] = useState({}); // 存储节点在线率数据
  const [summaryStats, setSummaryStats] = useState({
    totalTunnels: 0,
    totalConnections: 0,
    totalUpload: 0,
    totalDownload: 0,
    uptime: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    // 每30秒刷新一次数据
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nodesRes, statsRes, uptimeRes] = await Promise.all([
        axios.get('/node'),
        axios.get('/node_stats'),
        axios.get('/node_uptime?time=60') // 获取60天的在线率数据
      ]);

      if (nodesRes.data.code === 200) {
        setNodes(nodesRes.data.data || []);
      }
      if (statsRes.data.code === 200) {
        const stats = statsRes.data.data || [];
        setNodeStats(stats);
        
        // 计算汇总统计
        const totalUpload = stats.reduce((sum, node) => sum + (node.total_traffic_out || 0), 0);
        const totalDownload = stats.reduce((sum, node) => sum + (node.total_traffic_in || 0), 0);
        const totalConnections = stats.reduce((sum, node) => sum + (node.cur_counts || 0), 0);
        const totalTunnels = stats.reduce((sum, node) => sum + (node.tunnel_counts || 0), 0);
        const avgUptime = stats.length > 0 ? 
          stats.reduce((sum, node) => sum + (node.bandwidth_usage_percent || 0), 0) / stats.length : 0;
        
        setSummaryStats({
          totalTunnels,
          totalConnections,
          totalUpload,
          totalDownload,
          uptime: Math.round(avgUptime)
        });
      }
      
      // 处理节点在线率数据
      if (uptimeRes.data.code === 200) {
        const uptimeData = uptimeRes.data.data || [];
        const uptimeMap = {};
        
        uptimeData.forEach(nodeData => {
          const nodeName = nodeData.node_name;
          const historyUptime = nodeData.history_uptime || [];
          
          // 计算平均在线率和最新在线率
          if (historyUptime.length > 0) {
            const avgUptime = historyUptime.reduce((sum, record) => sum + (record.uptime || 0), 0) / historyUptime.length;
            const latestUptime = historyUptime[historyUptime.length - 1]?.uptime || 0;
            
            uptimeMap[nodeName] = {
              average: avgUptime,
              latest: latestUptime,
              history: historyUptime
            };
          }
        });
        
        setNodeUptime(uptimeMap);
      }
    } catch (error) {
      console.error('加载节点数据失败:', error);
      message.error('加载节点数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化字节大小
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取节点负载百分比
  const getLoadPercentage = (node) => {
    // 使用带宽使用率作为负载指标
    return node.bandwidth_usage_percent || 0;
  };

  // 获取负载颜色
  const getLoadColor = (percentage) => {
    if (percentage >= 80) return '#ff4d4f';
    if (percentage >= 60) return '#faad14';
    if (percentage >= 30) return '#1890ff';
    return '#52c41a';
  };

  // 获取在线率颜色
  const getUptimeColor = (uptime) => {
    if (uptime >= 99) return '#52c41a';
    if (uptime >= 95) return '#fadb14';
    if (uptime >= 90) return '#faad14';
    return '#ff4d4f';
  };

  // 渲染在线率迷你图表
  const renderUptimeChart = (uptimeData) => {
    if (!uptimeData || !uptimeData.history || uptimeData.history.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#999', fontSize: '10px' }}>
          无数据
        </div>
      );
    }

    const history = uptimeData.history.slice(-30); // 显示最近30天

    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'end', 
        height: '20px', 
        gap: '1px',
        marginTop: '4px',
        width: '100%' // 占满整个容器宽度
      }}>
        {history.map((record, index) => (
          <Tooltip 
            key={index}
            title={`${record.recorded_at}: ${record.uptime.toFixed(2)}%`}
          >
            <div
              style={{
                flex: 1, // 使用flex布局平均分配宽度
                height: `${Math.max(2, (record.uptime / 100) * 20)}px`,
                backgroundColor: getUptimeColor(record.uptime),
                borderRadius: '1px',
                opacity: 0.8,
                minWidth: '2px' // 确保最小宽度
              }}
            />
          </Tooltip>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <ClusterOutlined /> 统计信息
        </Title>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadData}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 汇总统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card style={{ textAlign: 'center', background: '#f0f2f5' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>当前总隧道</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
              <ApiOutlined style={{ marginRight: '8px' }} />
              {summaryStats.totalTunnels.toLocaleString()}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ textAlign: 'center', background: '#f0f2f5' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>当前总连接数</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
              <TeamOutlined style={{ marginRight: '8px' }} />
              {summaryStats.totalConnections.toLocaleString()}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ textAlign: 'center', background: '#f0f2f5' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>今日上传总流量</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
              <UploadOutlined style={{ marginRight: '8px' }} />
              {formatBytes(summaryStats.totalUpload)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ textAlign: 'center', background: '#f0f2f5' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>今日下载总流量</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#13c2c2' }}>
              <DownloadOutlined style={{ marginRight: '8px' }} />
              {formatBytes(summaryStats.totalDownload)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ textAlign: 'center', background: '#f0f2f5' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>平均带宽使用率</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
              {summaryStats.uptime}%
            </div>
          </Card>
        </Col>
      </Row>

      {/* 节点网格 */}
      <Row gutter={[16, 16]}>
        {nodeStats.map((node, index) => {
          const loadPercentage = getLoadPercentage(node);
          const loadColor = getLoadColor(loadPercentage);
          const isVip = node.nodegroup === 'vip';
          const nodeNumber = `#${node.id}`;
          const isOffline = node.state === 'offline';
          const uptimeData = nodeUptime[node.node_name] || null;
          
          return (
            <Col xs={24} sm={12} lg={8} key={node.id || index}>
              <Card 
                size="small"
                style={{ 
                  position: 'relative',
                  background: '#fafafa',
                  border: '1px solid #e8e8e8'
                }}
              >
                {/* VIP标识 */}
                {isVip && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: '#faad14',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    VIP
                  </div>
                )}
                
                {/* 节点名称 */}
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold', 
                  marginBottom: '16px',
                  color: isOffline ? '#999' : '#262626'
                }}>
                  {node.node_name || node.name} {nodeNumber}
                </div>

                <Row gutter={16}>
                  {/* 左侧：圆环进度 */}
                  <Col span={8} style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <Progress
                        type="circle"
                        percent={isOffline ? 0 : loadPercentage}
                        size={80}
                        strokeColor={isOffline ? '#d9d9d9' : loadColor}
                        strokeWidth={8}
                        format={() => (
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: isOffline ? '#999' : loadColor }}>
                            {isOffline ? '离线' : `${loadPercentage}%`}
                          </span>
                        )}
                      />
                    </div>
                  </Col>

                  {/* 右侧：统计信息 */}
                  <Col span={16}>
                    <div style={{ fontSize: '12px', lineHeight: '20px' }}>
                      <div>
                        <Text type="secondary">今日上传: </Text>
                        <Text strong>{formatBytes(node.total_traffic_out || 0)}</Text>
                      </div>
                      <div>
                        <Text type="secondary">今日下载: </Text>
                        <Text strong>{formatBytes(node.total_traffic_in || 0)}</Text>
                      </div>
                      <div>
                        <Text type="secondary">客户端数: </Text>
                        <Text strong>{(node.client_counts || 0).toLocaleString()}</Text>
                      </div>
                      <div>
                        <Text type="secondary">CPU占用: </Text>
                        <Text strong>{(node.cpu_usage || 0).toFixed(2)}%</Text>
                      </div>
                    </div>
                  </Col>
                </Row>

                {/* 在线率部分 */}
                <div style={{ 
                  marginTop: '12px', 
                  padding: '8px', 
                  background: '#fafafa', 
                  borderRadius: '4px',
                  border: '1px solid #f0f0f0'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <LineChartOutlined style={{ fontSize: '12px', color: '#666' }} />
                      <Text style={{ fontSize: '11px', color: '#666' }}>60天在线率</Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isOffline ? (
                        <ExclamationCircleOutlined style={{ fontSize: '12px', color: '#ff4d4f' }} />
                      ) : (
                        <CheckCircleOutlined style={{ fontSize: '12px', color: '#52c41a' }} />
                      )}
                      <Text style={{ 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        color: isOffline ? '#ff4d4f' : getUptimeColor(uptimeData?.average || 0)
                      }}>
                        {isOffline ? '离线' : `${(uptimeData?.average || 0).toFixed(2)}%`}
                      </Text>
                    </div>
                  </div>
                  
                  {/* 在线率图表 */}
                  {renderUptimeChart(uptimeData)}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 如果没有数据显示占位符 */}
      {nodeStats.length === 0 && !loading && (
        <Card style={{ textAlign: 'center', padding: '48px' }}>
          <ClusterOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <div style={{ fontSize: '16px', color: '#999' }}>暂无节点数据</div>
        </Card>
      )}
    </div>
  );
};

export default NodeStatus;
