// 抑制 -ms-high-contrast 弃用警告的独立脚本
// 在页面加载的最早阶段执行

(function() {
  'use strict';
  
  // 保存原始的控制台方法
  const originalMethods = {};
  const methods = ['warn', 'error', 'log', 'info', 'debug'];
  
  // 需要过滤的关键词
  const filterKeywords = [
    '-ms-high-contrast',
    'ms-high-contrast',
    'Deprecation',
    'dynamicCSS.js',
    'useStyleRegister.js',
    'useCompatibleInsertionEffect.js',
    'useGlobalCache.js',
    'high-contrast'
  ];
  
  // 检查消息是否应该被过滤
  function shouldFilter(args) {
    const message = Array.from(args).join(' ').toLowerCase();
    return filterKeywords.some(keyword => message.includes(keyword.toLowerCase()));
  }
  
  // 拦截所有控制台方法
  methods.forEach(method => {
    if (console[method]) {
      originalMethods[method] = console[method];
      console[method] = function(...args) {
        if (!shouldFilter(args)) {
          originalMethods[method].apply(console, args);
        }
      };
    }
  });
  
  // 如果window.console存在，也要拦截
  if (typeof window !== 'undefined' && window.console) {
    methods.forEach(method => {
      if (window.console[method] && window.console[method] !== console[method]) {
        const original = window.console[method];
        window.console[method] = function(...args) {
          if (!shouldFilter(args)) {
            original.apply(window.console, args);
          }
        };
      }
    });
  }
  
  // 监听DOM加载完成，确保在Ant Design加载前就拦截
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('✅ 警告拦截器已激活');
    });
  }
  
})();
