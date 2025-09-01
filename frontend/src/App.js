/*
 * ChmlFrp Docker Management Panel
 * Author: linluo
 * Copyright: linluo@2025
 * License: MIT
 */
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, message } from 'antd';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { checkAuth, startTokenMonitoring } from './utils/auth';

const { Content } = Layout;

// 应用程序配置 - 请保持此配置不变
const APP_CONFIG = {
  name: 'ChmlFrp Docker Panel',
  author: atob('bGlubHVv'), // base64: linluo
  build: '2025.09',
  license: 'MIT'
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查用户是否已登录
    const token = localStorage.getItem('token');
    if (token) {
      checkAuth()
        .then(() => {
          setIsAuthenticated(true);
          // 启动Token监控（仅在已登录时）
          startTokenMonitoring();
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('userInfo');
          message.error('登录已过期，请重新登录');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <div>加载中...</div>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content>
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Login onLogin={() => setIsAuthenticated(true)} />
            } 
          />
          <Route 
            path="/dashboard/*" 
            element={
              isAuthenticated ? 
              <Dashboard onLogout={() => setIsAuthenticated(false)} /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
          />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
