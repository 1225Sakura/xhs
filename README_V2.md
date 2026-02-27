# 小红书发布系统 v2.0 - 商业化版本

## 项目结构

本项目采用Monorepo架构，支持本地部署+云端监控的商业化模式。

```
xhspro/
├── packages/
│   ├── client/          # Electron桌面客户端
│   │   ├── src/
│   │   │   ├── main/    # 主进程
│   │   │   ├── renderer/ # 渲染进程
│   │   │   └── preload/ # 预加载脚本
│   │   └── package.json
│   │
│   ├── server/          # 云端后端服务
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   └── server.js
│   │   └── package.json
│   │
│   ├── dashboard/       # 管理仪表盘（React）
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── shared/          # 共享代码
│       ├── src/
│       │   ├── types/   # TypeScript类型定义
│       │   ├── utils/   # 工具函数
│       │   └── constants/ # 常量
│       └── package.json
│
├── scripts/             # 工具脚本
├── docs/               # 文档
├── docker/             # Docker配置
└── package.json        # 根package.json（workspace配置）
```

## 技术栈

### 客户端（Electron）
- Electron 28+
- Node.js 20+
- SQLite（本地数据库）
- MQTT.js（实时通信）
- Prometheus Client（指标采集）

### 云端后端
- Node.js 20+ + Express
- PostgreSQL 15+（主数据库）
- Redis 7+（缓存）
- EMQX（MQTT Broker）
- JWT（认证）

### 监控系统
- Prometheus（指标采集）
- Grafana（可视化）
- Loki（日志聚合）

### 管理仪表盘
- React 18 + TypeScript
- Ant Design
- React Query
- Recharts

## 开发指南

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动客户端
npm run dev:client

# 启动服务端
npm run dev:server

# 启动仪表盘
npm run dev:dashboard
```

### 构建

```bash
# 构建所有包
npm run build:all

# 单独构建
npm run build:client
npm run build:server
npm run build:dashboard
```

## 部署

### 客户端部署
客户端打包为Windows/Mac安装包，分发给客户安装。

### 服务端部署
使用Docker Compose部署到云服务器。

详见：[部署文档](./docs/deployment/DEPLOYMENT_GUIDE.md)

## 商业化功能

- ✅ 许可证管理
- ✅ 订阅计费
- ✅ 使用量统计
- ✅ 多租户管理
- ✅ 实时监控
- ✅ 远程控制
- ✅ 数据同步

## 开发进度

查看：[PROGRESS.md](./PROGRESS.md)

## 规则文档

查看：[RULES.md](./RULES.md)

## License

商业软件 - 保留所有权利
