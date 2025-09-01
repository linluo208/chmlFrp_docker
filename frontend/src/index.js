import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
