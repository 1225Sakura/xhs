# 小红书发布系统 - 管理仪表盘

基于React 18 + TypeScript + Ant Design 5的现代化管理后台。

## 功能特性

- 🔐 **用户认证**: JWT token认证，自动刷新
- 📊 **概览仪表盘**: 系统关键指标一览
- 👥 **客户端管理**: 查看、监控、管理所有客户端
- 🔑 **许可证管理**: 创建、查看、更新许可证
- 👤 **用户管理**: 用户CRUD操作，角色管理
- 📈 **指标监控**: 集成Prometheus和Grafana

## 技术栈

- **React 18**: 最新的React版本
- **TypeScript**: 类型安全
- **Vite**: 快速的构建工具
- **Ant Design 5**: 企业级UI组件库
- **React Router 6**: 路由管理
- **TanStack Query**: 数据获取和缓存
- **Axios**: HTTP客户端
- **Day.js**: 日期处理

## 快速开始

### 安装依赖

```bash
# 在项目根目录
npm install

# 或者只安装dashboard的依赖
cd packages/dashboard
npm install
```

### 开发模式

```bash
# 在项目根目录
npm run dev:dashboard

# 或者在dashboard目录
cd packages/dashboard
npm run dev
```

访问 http://localhost:3002

### 生产构建

```bash
# 在dashboard目录
npm run build

# 预览构建结果
npm run preview
```

## 默认账号

首次使用需要先创建管理员账号。可以通过以下方式：

1. 使用API直接创建：
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "admin123456",
    "role": "admin"
  }'
```

2. 或者在数据库中直接插入（密码需要bcrypt加密）

## 项目结构

```
src/
├── layouts/          # 布局组件
│   └── MainLayout.tsx
├── pages/            # 页面组件
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Clients.tsx
│   ├── Licenses.tsx
│   ├── Users.tsx
│   └── Metrics.tsx
├── services/         # API服务
│   ├── auth.ts
│   ├── client.ts
│   ├── license.ts
│   └── user.ts
├── utils/            # 工具函数
│   └── api.ts
├── App.tsx           # 主应用
└── main.tsx          # 入口文件
```

## API配置

默认API地址为 `http://localhost:3000/api/v1`，可以在 `vite.config.ts` 中修改代理配置：

```typescript
server: {
  port: 3002,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

## 功能说明

### 概览页面
- 显示系统关键指标
- 在线客户端数量
- 活跃许可证数量
- 今日文章和发布统计

### 客户端管理
- 查看所有客户端列表
- 实时状态监控（在线/离线）
- 客户端详情查看
- 删除客户端

### 许可证管理
- 创建新许可证
- 查看许可证详情
- 更新许可证状态
- 支持多种计划类型（试用版、基础版、专业版、企业版）
- 功能特性控制（AI生成、文章发布、定时发布）

### 用户管理
- 创建新用户
- 编辑用户信息
- 删除用户
- 角色管理（管理员/普通用户）

### 指标监控
- 快速链接到Prometheus
- 快速链接到Grafana
- 快速链接到AlertManager
- 快速链接到EMQX Dashboard

## 开发指南

### 添加新页面

1. 在 `src/pages/` 创建新组件
2. 在 `src/App.tsx` 添加路由
3. 在 `src/layouts/MainLayout.tsx` 添加菜单项

### 添加新API

1. 在 `src/services/` 创建新服务文件
2. 定义接口类型
3. 实现API调用方法

### 状态管理

使用TanStack Query进行数据管理：

```typescript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['clients', page],
  queryFn: () => clientService.getClients(page)
});
```

## 环境变量

创建 `.env` 文件：

```
VITE_API_URL=http://localhost:3000
```

## 常见问题

### 1. 登录后立即退出

检查后端JWT_SECRET配置是否正确，确保前后端使用相同的密钥。

### 2. API请求失败

检查后端服务是否启动，端口是否正确（默认3000）。

### 3. 页面空白

检查浏览器控制台错误信息，可能是依赖未安装或路由配置错误。

## 部署

### 使用Nginx

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    root /var/www/dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 使用Docker

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 许可证

MIT
