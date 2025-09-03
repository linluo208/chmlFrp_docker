import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

// 立即执行警告拦截，在任何Ant Design代码执行之前
(function() {
  // 拦截所有可能的警告输出
  const methods = ['warn', 'error', 'log', 'info', 'debug'];
  const originalMethods = {};
  
  methods.forEach(method => {
    originalMethods[method] = console[method];
    console[method] = function(...args) {
      const message = args.join(' ');
      // 完全阻止任何包含这些关键词的输出
      if (message.includes('-ms-high-contrast') || 
          message.includes('ms-high-contrast') ||
          message.includes('Deprecation') ||
          message.includes('dynamicCSS.js') ||
          message.includes('useStyleRegister.js') ||
          message.includes('useCompatibleInsertionEffect.js') ||
          message.includes('useGlobalCache.js')) {
        return;
      }
      originalMethods[method].apply(console, args);
    };
  });
  
  // 同时拦截window.console
  if (typeof window !== 'undefined' && window.console) {
    methods.forEach(method => {
      if (window.console[method]) {
        const originalWindowMethod = window.console[method];
        window.console[method] = function(...args) {
          const message = args.join(' ');
          if (message.includes('-ms-high-contrast') || 
              message.includes('ms-high-contrast') ||
              message.includes('Deprecation') ||
              message.includes('dynamicCSS.js') ||
              message.includes('useStyleRegister.js') ||
              message.includes('useCompatibleInsertionEffect.js') ||
              message.includes('useGlobalCache.js')) {
            return;
          }
          originalWindowMethod.apply(window.console, args);
        };
      }
    });
  }
})();



// 设置全局message，供auth.js使用
window.antd = { message };

// 版权保护 - 作者标识
const _COPYRIGHT_INFO = {
  name: 'ChmlFrp Docker管理面板',
  author: String.fromCharCode(...[108, 105, 110, 108, 117, 111]),
  year: parseInt('0x7E9', 16), // 2025
  build: '1.0.0'
};

console.log('%c ' + _COPYRIGHT_INFO.name + ' ', 'background: #1890ff; color: white; padding: 5px 10px; border-radius: 3px;');
console.log('%c Author: ' + _COPYRIGHT_INFO.author + ' ', 'background: #52c41a; color: white; padding: 3px 8px; border-radius: 3px;');
console.log('%c 防盗标识: ' + _COPYRIGHT_INFO.author + ' ', 'background: #f5222d; color: white; padding: 3px 8px; border-radius: 3px;');

// Ant Design 主题配置 - 完全禁用动态样式和高对比度
const antdTheme = {
  token: {
    // 禁用高对比度相关样式
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f5f5',
    colorPrimary: '#1890ff',
    // 强制设置所有颜色值，避免动态计算
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    // 全局组件配置，避免高对比度样式
    Layout: {
      bodyBg: '#f5f5f5',
      headerBg: '#001529',
    },
    Button: {
      colorPrimary: '#1890ff',
    },
    Input: {
      colorBorder: '#d9d9d9',
    },
    Select: {
      colorBorder: '#d9d9d9',
    },
    Table: {
      colorBorderSecondary: '#f0f0f0',
    }
  },
  // 禁用CSS-in-JS的一些特性
  cssVar: false,
  hashed: false,
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider 
      locale={zhCN}
      theme={antdTheme}
      // 禁用波纹效果，减少动态样式生成
      wave={{ disabled: false }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
