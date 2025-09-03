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
import { checkAuth, startTokenMonitoring, checkAutoLoginStatus } from './utils/auth';

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
    const initializeAuth = async () => {
      try {
        // 首先检查本地是否有token
        const token = localStorage.getItem('token');
        
        if (token) {
          // 有本地token，验证是否有效
          const isValid = await checkAuth();
          if (isValid) {
            setIsAuthenticated(true);
            startTokenMonitoring();
            setLoading(false);
            return;
          } else {
            // 本地token无效，清理
            localStorage.removeItem('token');
            localStorage.removeItem('userInfo');
          }
        }
        
        // 没有本地token或本地token无效，检查后端是否有自动登录
        console.log('检查后端自动登录状态...');
        const autoLoginResult = await checkAutoLoginStatus();
        
        if (autoLoginResult.success) {
          message.success(`自动登录成功: ${autoLoginResult.username}`);
          setIsAuthenticated(true);
          startTokenMonitoring();
        } else {
          console.log('未检测到自动登录，需要手动登录');
        }
        
      } catch (error) {
        console.error('初始化认证失败:', error);
        message.error('认证初始化失败，请手动登录');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
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
