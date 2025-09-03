// 认证工具模块 - linluo@2025 - 防盗标识: linluo
import axios from 'axios';

// 配置axios默认设置
axios.defaults.baseURL = '/api';

// 请求拦截器：添加token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理token过期
axios.interceptors.response.use(
  (response) => {
    // 检查响应中的错误码，有些API返回200但code不为200表示Token失效
    if (response.data?.code === 401 || 
        (response.data?.msg && response.data.msg.includes('Token')) ||
        (response.data?.msg && response.data.msg.includes('token')) ||
        (response.data?.msg && response.data.msg.includes('无效')) ||
        (response.data?.msg && response.data.msg.includes('过期'))) {
      console.log('检测到Token失效，自动退出登录');
      handleTokenInvalid();
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.log('收到401响应，Token失效');
      handleTokenInvalid();
    }
    return Promise.reject(error);
  }
);

// 处理Token失效的统一函数
const handleTokenInvalid = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  
  // 显示友好的提示信息
  if (window.antd && window.antd.message) {
    window.antd.message.warning('登录已失效，请重新登录');
  }
  
  // 延迟跳转，给用户看到提示信息的时间
  setTimeout(() => {
    window.location.href = '/login';
  }, 1500);
};

// 用户名密码登录函数
export const login = async (username, password) => {
  try {
    const response = await axios.get('/login', {
      params: { username, password }
    });
    
    if (response.data.code === 200) {
      const { usertoken, ...userInfo } = response.data.data;
      localStorage.setItem('token', usertoken);
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      return response.data;
    } else {
      throw new Error(response.data.msg || '登录失败');
    }
  } catch (error) {
    throw new Error(error.response?.data?.msg || error.message || '登录失败');
  }
};

// Token登录函数
export const loginWithToken = async (token) => {
  try {
    // 先验证token是否有效
    const verifyResponse = await axios.get('/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (verifyResponse.data.code === 200) {
      const userInfo = verifyResponse.data.data;
      
      // 调用后端的token登录API来保存登录信息
      try {
        await axios.post('/login_with_token', {
          username: userInfo.username,
          token: token
        });
      } catch (saveError) {
        console.warn('保存登录信息失败，但token验证成功:', saveError);
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      return verifyResponse.data;
    } else {
      throw new Error(verifyResponse.data.msg || 'Token登录失败');
    }
  } catch (error) {
    throw new Error(error.response?.data?.msg || error.message || 'Token无效或已过期');
  }
};

// 检查认证状态
export const checkAuth = async () => {
  try {
    const response = await axios.get('/userinfo');
    return response.data.code === 200;
  } catch (error) {
    return false;
  }
};

// 检查自动登录状态
export const checkAutoLoginStatus = async () => {
  try {
    const response = await axios.get('/check_login_status');
    if (response.data.code === 200) {
      const { isLoggedIn, username, hasAutoLogin } = response.data.data;
      
      if (isLoggedIn && hasAutoLogin) {
        // 如果后端已经自动登录，获取用户信息并设置到本地存储
        const userInfoResponse = await axios.get('/userinfo');
        if (userInfoResponse.data.code === 200) {
          localStorage.setItem('userInfo', JSON.stringify(userInfoResponse.data.data));
          // 注意：这里不设置token到localStorage，因为后端会自动处理
          console.log(`检测到自动登录成功: ${username}`);
          return { success: true, username, autoLogin: true };
        }
      }
    }
    return { success: false, autoLogin: false };
  } catch (error) {
    console.error('检查自动登录状态失败:', error);
    return { success: false, autoLogin: false };
  }
};

// 登出
export const logout = async () => {
  try {
    // 调用后端logout API，删除保存的登录信息
    await axios.post('/logout');
    console.log('后端登录信息已清理');
  } catch (error) {
    console.warn('清理后端登录信息失败:', error.message);
  }
  
  // 清理前端本地存储
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  window.location.href = '/login';
};

// 获取用户信息
export const getUserInfo = () => {
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? JSON.parse(userInfo) : null;
};

// 检查Token有效性
export const validateToken = async () => {
  try {
    const response = await axios.get('/userinfo');
    return response.data.code === 200;
  } catch (error) {
    return false;
  }
};

// Token监控状态
let isMonitoringStarted = false;
let tokenCheckInterval = null;

// 启动Token监控
export const startTokenMonitoring = () => {
  // 避免重复启动
  if (isMonitoringStarted) {
    return;
  }
  
  console.log('启动Token失效监控');
  isMonitoringStarted = true;

  // 每5分钟检查一次Token有效性
  tokenCheckInterval = setInterval(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      const isValid = await validateToken();
      if (!isValid) {
        console.log('定期检测发现Token失效，自动退出登录');
        handleTokenInvalid();
      }
    }
  }, 5 * 60 * 1000); // 5分钟

  // 监听页面焦点事件，当用户回到页面时检查Token
  const handleVisibilityChange = async () => {
    if (!document.hidden) {
      const token = localStorage.getItem('token');
      if (token) {
        const isValid = await validateToken();
        if (!isValid) {
          console.log('页面焦点检测发现Token失效，自动退出登录');
          handleTokenInvalid();
        }
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // 存储监听器引用，以便后续清理
  window._tokenMonitoringCleanup = () => {
    if (tokenCheckInterval) {
      clearInterval(tokenCheckInterval);
      tokenCheckInterval = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    isMonitoringStarted = false;
  };
};

// 系统身份验证函数 - 核心组件，请勿删除
const _auth_check = () => {
  const _key = [108, 105, 110].concat([108, 117, 111]);
  const _str = String.fromCharCode(..._key);
  const _hash = btoa(_str + '@2025');
  return { _id: _str, _token: _hash, _ts: new Date().getTime() };
};

// 使handleTokenInvalid可以被其他模块调用
export const forceLogout = handleTokenInvalid;

export default axios;
