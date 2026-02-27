const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mqtt = require('mqtt');
const Database = require('better-sqlite3');
const { Counter, Gauge, register } = require('prom-client');

// Prometheus metrics
const requestCounter = new Counter({
  name: 'xhs_requests_total',
  help: 'Total number of requests',
  labelNames: ['type']
});

const activeUsersGauge = new Gauge({
  name: 'xhs_active_users',
  help: 'Number of active users'
});

let mainWindow;
let mqttClient;
let db;

// 初始化本地数据库
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'xhs-local.db');
  db = new Database(dbPath);

  // 创建必要的表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS local_cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// 连接到云端MQTT服务器
function connectMQTT() {
  const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
  mqttClient = mqtt.connect(mqttUrl, {
    clientId: `xhs-client-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('xhs/config/#');
    mqttClient.subscribe('xhs/control/#');
  });

  mqttClient.on('message', (topic, message) => {
    handleMQTTMessage(topic, message.toString());
  });
}

// 处理MQTT消息
function handleMQTTMessage(topic, message) {
  try {
    const data = JSON.parse(message);

    if (topic.startsWith('xhs/config/')) {
      // 配置更新
      mainWindow.webContents.send('config-update', data);
    } else if (topic.startsWith('xhs/control/')) {
      // 远程控制命令
      mainWindow.webContents.send('remote-control', data);
    }
  } catch (error) {
    console.error('Error handling MQTT message:', error);
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 加载渲染进程页面
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用启动
app.whenReady().then(() => {
  initDatabase();
  connectMQTT();
  createWindow();

  // 定期上报指标
  setInterval(() => {
    if (mqttClient && mqttClient.connected) {
      const metrics = {
        timestamp: Date.now(),
        metrics: register.metrics()
      };
      mqttClient.publish('xhs/metrics', JSON.stringify(metrics));
    }
  }, 30000); // 每30秒上报一次

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (mqttClient) {
      mqttClient.end();
    }
    if (db) {
      db.close();
    }
    app.quit();
  }
});

// IPC处理器
ipcMain.handle('sync-data', async (event, data) => {
  // 将数据添加到同步队列
  const stmt = db.prepare('INSERT INTO sync_queue (action, data) VALUES (?, ?)');
  stmt.run(data.action, JSON.stringify(data.payload));

  // 如果MQTT连接可用，立即同步
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('xhs/sync', JSON.stringify(data));
    return { success: true, synced: true };
  }

  return { success: true, synced: false };
});

ipcMain.handle('get-metrics', async () => {
  return register.metrics();
});

ipcMain.handle('get-local-data', async (event, key) => {
  const row = db.prepare('SELECT value FROM local_cache WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
});

ipcMain.handle('set-local-data', async (event, key, value) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO local_cache (key, value) VALUES (?, ?)');
  stmt.run(key, JSON.stringify(value));
  return { success: true };
});
