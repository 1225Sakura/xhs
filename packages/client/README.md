# 小红书发布助手 - 桌面客户端

基于Electron的桌面应用程序，提供本地数据存储和云端同步功能。

## 功能特性

- 本地SQLite数据库存储
- MQTT实时通信
- Prometheus指标收集
- 云端配置同步
- 远程控制支持

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev

# 打包应用
npm run build
```

## 项目结构

```
src/
├── main/           # 主进程
│   ├── main.js     # 主进程入口
│   └── preload.js  # 预加载脚本
└── renderer/       # 渲染进程
    ├── index.html  # 主页面
    ├── app.js      # 应用逻辑
    └── style.css   # 样式文件
```

## 环境变量

在根目录创建 `.env` 文件：

```
MQTT_URL=mqtt://your-mqtt-server:1883
API_URL=https://your-api-server.com
```

## 构建

```bash
# Windows
npm run dist

# macOS
npm run dist

# Linux
npm run dist
```
