// Electron环境配置
const isElectron = typeof window !== 'undefined' && window.electronAPI;

const config = {
  // API基础地址
  apiBase: isElectron
    ? (process.env.API_URL || 'http://localhost:3000/api')
    : '/api',

  // MQTT配置
  mqtt: {
    url: process.env.MQTT_URL || 'mqtt://localhost:1883'
  },

  // 应用信息
  app: {
    name: '小红书发布助手',
    version: '2.0.0'
  }
};

// 如果在Electron环境中，暴露配置到全局
if (isElectron) {
  window.appConfig = config;
}

// 导出配置（用于模块化环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = config;
}
