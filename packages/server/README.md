# 小红书发布助手 - 云端服务

基于Node.js + Express的云端后端服务，提供API接口和数据管理。

## 功能特性

- RESTful API接口
- PostgreSQL数据库
- Redis缓存
- MQTT消息推送
- JWT认证
- 许可证管理

## 开发

```bash
# 安装依赖
npm install

# 初始化数据库
npm run migrate

# 启动开发模式
npm run dev

# 生产环境启动
npm start
```

## 项目结构

```
src/
├── controllers/    # 控制器
├── services/       # 业务逻辑
├── models/         # 数据模型
├── routes/         # 路由
├── middleware/     # 中间件
├── utils/          # 工具函数
└── server.js       # 服务入口
```

## 环境变量

复制 `.env.example` 到 `.env` 并配置：

```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/xhs
REDIS_URL=redis://localhost:6379
MQTT_URL=mqtt://localhost:1883
JWT_SECRET=your-secret-key
```

## API文档

启动服务后访问 `http://localhost:3000/api-docs` 查看API文档。
