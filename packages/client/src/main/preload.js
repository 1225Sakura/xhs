const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 数据同步
  syncData: (data) => ipcRenderer.invoke('sync-data', data),

  // 获取指标
  getMetrics: () => ipcRenderer.invoke('get-metrics'),

  // 本地数据存储
  getLocalData: (key) => ipcRenderer.invoke('get-local-data', key),
  setLocalData: (key, value) => ipcRenderer.invoke('set-local-data', key, value),

  // 监听配置更新
  onConfigUpdate: (callback) => {
    ipcRenderer.on('config-update', (event, data) => callback(data));
  },

  // 监听远程控制
  onRemoteControl: (callback) => {
    ipcRenderer.on('remote-control', (event, data) => callback(data));
  },

  // 移除监听器
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
