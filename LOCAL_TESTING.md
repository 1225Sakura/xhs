# 本地测试环境部署指南

## 📋 目录
1. [环境要求](#环境要求)
2. [快速开始](#快速开始)
3. [测试前两阶段功能](#测试前两阶段功能)
4. [故障排查](#故障排查)

---

## 环境要求

- Node.js 20+
- npm 10+
- Windows 10/11 或 macOS 或 Linux
- 8GB+ 内存

---

## 快速开始

### 1. 安装依赖

```bash
# 在项目根目录
cd E:\xhspro

# 安装所有依赖
npm install
npm install --workspaces
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
copy .env.example .env

# 编辑 .env 文件
notepad .env
```

**本地测试配置：**
```bash
# 服务器配置
PORT=3000
NODE_ENV=development

# DeepSeek API配置
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 知识库路径
KNOWLEDGE_BASE_PATH=./knowledge/AI数据文档

# 数据库配置
DATABASE_PATH=./data/knowledge.db

# 加密配置
ENCRYPTION_KEY=test-encryption-key-32-chars-long
```

### 3. 初始化数据库

```bash
# 数据库会在首次启动时自动初始化
# 如需手动初始化：
node src/scripts/migrate-database.js
```

### 4. 启动本地服务

```bash
# 启动开发服务器
npm run dev

# 或者直接运行
node src/server.js
```

服务启动后访问: `http://localhost:3000`

---

## 测试前两阶段功能

### 第一阶段：基础架构测试

#### 1. 测试API健康检查

```bash
# 测试健康检查接口
curl http://localhost:3000/api/health
```

**预期输出：**
```json
{
  "status": "ok",
  "timestamp": "2024-02-27T...",
  "database": "connected"
}
```

#### 2. 测试AI提供商配置

```bash
# 查看AI提供商列表
curl http://localhost:3000/api/ai-providers
```

**预期输出：**
```json
{
  "success": true,
  "data": [
    {
      "provider": "deepseek",
      "provider_name": "DeepSeek",
      "is_enabled": true
    }
  ]
}
```

#### 3. 测试文案生成功能

打开浏览器访问: `http://localhost:3000`

1. 点击"生成文案"
2. 填写产品信息
3. 选择文案风格
4. 点击"生成"按钮
5. 验证是否成功生成文案

#### 4. 测试知识库功能

```bash
# 测试知识库文件列表
curl http://localhost:3000/api/knowledge/files
```

#### 5. 测试数据库操作

```bash
# 使用Node.js测试数据库
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/knowledge.db');
console.log('AI Providers:', db.prepare('SELECT * FROM ai_providers').all());
console.log('Posts count:', db.prepare('SELECT COUNT(*) as count FROM posts').get());
db.close();
"
```

### 第二阶段：监控系统测试

#### 1. 测试React管理仪表盘

```bash
# 进入dashboard目录
cd packages/dashboard

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问: `http://localhost:5173`

**测试功能：**
- [ ] 登录功能
- [ ] 客户端列表
- [ ] 许可证管理
- [ ] 用户管理
- [ ] 监控指标

#### 2. 测试云端API（如果已部署）

```bash
# 测试客户端注册
curl -X POST http://localhost:3000/api/cloud/clients/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "test-client-001",
    "machine_id": "test-machine-001",
    "version": "2.0.0",
    "os": "Windows 11"
  }'
```

#### 3. 测试认证系统

```bash
# 创建测试用户
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456",
    "email": "test@example.com"
  }'

# 登录获取token
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456"
  }'
```

#### 4. 测试许可证系统

```bash
# 首先需要生成RSA密钥对
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# 创建许可证（需要admin token）
curl -X POST http://localhost:3000/api/licenses \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "测试客户",
    "customer_email": "test@example.com",
    "plan_type": "pro",
    "max_clients": 5
  }'
```

---

## 功能测试清单

### 第一阶段功能

- [ ] **服务器启动** - 无错误启动
- [ ] **数据库初始化** - DeepSeek提供商已配置
- [ ] **API健康检查** - 返回正常状态
- [ ] **文案生成** - 成功生成小红书文案
- [ ] **知识库读取** - 成功读取知识库文件
- [ ] **图片上传** - 成功上传和处理图片
- [ ] **发布功能** - 成功发布到小红书（需要cookies）
- [ ] **定时发布** - 定时任务正常运行

### 第二阶段功能

- [ ] **用户注册/登录** - JWT认证正常
- [ ] **客户端注册** - 客户端成功注册到云端
- [ ] **许可证生成** - RSA签名许可证生成成功
- [ ] **许可证验证** - 许可证验证通过
- [ ] **配置同步** - 客户端配置同步正常
- [ ] **心跳上报** - 客户端心跳正常
- [ ] **管理仪表盘** - React应用正常运行
- [ ] **用户管理** - CRUD操作正常
- [ ] **权限控制** - 角色权限正常

---

## 自动化测试脚本

创建测试脚本 `test-local.js`:

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 开始本地测试...\n');

  // 测试1: 健康检查
  try {
    const health = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ 健康检查通过:', health.data);
  } catch (error) {
    console.error('❌ 健康检查失败:', error.message);
  }

  // 测试2: AI提供商
  try {
    const providers = await axios.get(`${BASE_URL}/api/ai-providers`);
    console.log('✅ AI提供商:', providers.data.data.length, '个');
  } catch (error) {
    console.error('❌ AI提供商查询失败:', error.message);
  }

  // 测试3: 知识库
  try {
    const files = await axios.get(`${BASE_URL}/api/knowledge/files`);
    console.log('✅ 知识库文件:', files.data.data.length, '个');
  } catch (error) {
    console.error('❌ 知识库查询失败:', error.message);
  }

  console.log('\n✨ 测试完成！');
}

runTests();
```

运行测试：
```bash
node test-local.js
```

---

## 故障排查

### 问题1: 端口被占用

```bash
# Windows查找占用端口的进程
netstat -ano | findstr :3000

# 终止进程
taskkill /F /PID <进程ID>
```

### 问题2: 数据库文件锁定

```bash
# 删除数据库文件重新初始化
del data\knowledge.db
node src/server.js
```

### 问题3: 依赖安装失败

```bash
# 清理缓存重新安装
npm cache clean --force
rmdir /s /q node_modules
del package-lock.json
npm install
```

### 问题4: DeepSeek API调用失败

检查：
1. API密钥是否正确
2. 网络连接是否正常
3. API配额是否充足

### 问题5: 知识库路径错误

```bash
# 检查知识库路径
dir knowledge\AI数据文档

# 如果不存在，创建目录
mkdir knowledge\AI数据文档
```

---

## 开发调试

### 启用调试日志

```bash
# 设置环境变量
set DEBUG=*
node src/server.js
```

### 使用nodemon自动重启

```bash
# 安装nodemon
npm install -g nodemon

# 使用nodemon启动
nodemon src/server.js
```

### VS Code调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "启动服务器",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/server.js",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

---

## 下一步

本地测试通过后：
1. 将代码推送到GitHub
2. 在服务器上部署（参考SERVER_DEPLOYMENT.md）
3. 配置生产环境
4. 进行集成测试

**文档版本**: 1.0
**最后更新**: 2024-02-27
