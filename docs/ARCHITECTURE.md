# 系统架构说明

## 概述

小红书知识库发布系统是一个基于 Node.js 和 Docker 的全栈应用，采用模块化架构设计，实现了知识库管理、AI 文案生成和小红书自动发布的完整流程。

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户界面层                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              前端 SPA (public/)                           │  │
│  │  - index.html (主页面)                                    │  │
│  │  - app.js (业务逻辑)                                      │  │
│  │  - style.css (样式)                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         应用服务层                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Express.js 服务器 (src/)                     │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │           路由层 (routes/)                          │  │  │
│  │  │  - 30+ REST API 端点                                │  │  │
│  │  │  - 请求验证和路由分发                               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                        │                                   │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │         控制器层 (controllers/)                     │  │  │
│  │  │  - knowledgeController (知识库)                     │  │  │
│  │  │  - productController (产品)                         │  │  │
│  │  │  - postController (文案)                            │  │  │
│  │  │  - aiProviderController (AI提供商)                  │  │  │
│  │  │  - accountController (账号)                         │  │  │
│  │  │  - scheduleController (定时任务)                    │  │  │
│  │  │  - trendingController (热点)                        │  │  │
│  │  │  - historyController (历史)                         │  │  │
│  │  │  - autoScanController (自动扫描)                    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                        │                                   │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │          服务层 (services/)                         │  │  │
│  │  │  - aiService (AI文案生成)                           │  │  │
│  │  │  - xhsService (小红书API)                           │  │  │
│  │  │  - schedulerService (任务调度)                      │  │  │
│  │  │  - trendingService (热点抓取)                       │  │  │
│  │  │  - publishHistoryService (发布历史)                 │  │  │
│  │  │  - accountService (账号管理)                        │  │  │
│  │  │  - aiProviderFactory (AI提供商工厂)                 │  │  │
│  │  │  - providerRegistry (提供商注册)                    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                        │                                   │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │          工具层 (utils/)                            │  │  │
│  │  │  - crypto (加密解密)                                │  │  │
│  │  │  - fileParser (文件解析)                            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┬─────────────┐
                ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         数据和外部服务层                          │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ SQLite   │  │ AI APIs  │  │ XHS MCP  │  │ 知识库    │       │
│  │ 数据库    │  │ 多提供商  │  │ 服务     │  │ 文件系统  │       │
│  │          │  │          │  │          │  │          │       │
│  │ 9个数据表 │  │ Claude   │  │ Go服务   │  │ 产品资料  │       │
│  │ 关系模型  │  │ GPT      │  │ 浏览器   │  │ 教育文档  │       │
│  │ 索引优化  │  │ 通义千问  │  │ 自动化   │  │ 图片资源  │       │
│  │          │  │ Kimi     │  │          │  │          │       │
│  │          │  │ 豆包     │  │          │  │          │       │
│  │          │  │ Gemini   │  │          │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │ 小红书平台    │
                            └──────────────┘
```

## 核心模块

### 1. 前端层 (public/)

**技术栈**: 原生 JavaScript + HTML5 + CSS3

**职责**:
- 用户界面渲染
- 用户交互处理
- API 请求封装
- 状态管理

**主要文件**:
- `index.html` - 单页应用主页面
- `app.js` - 前端业务逻辑（约 3000+ 行）
- `style.css` - 样式定义

**特点**:
- 无框架依赖，轻量级
- 响应式设计
- 实时状态更新
- 模块化组件设计

### 2. 路由层 (src/routes/)

**技术栈**: Express.js Router

**职责**:
- API 端点定义
- 请求路由分发
- 中间件配置

**主要文件**:
- `index.js` - 统一路由配置

**API 分组**:
```javascript
// 知识库管理 (6个端点)
router.get('/knowledge', ...)
router.post('/knowledge/scan', ...)

// 产品管理 (8个端点)
router.get('/products', ...)
router.post('/products/scan', ...)

// 文案管理 (7个端点)
router.post('/posts/generate', ...)
router.post('/posts/:id/publish', ...)

// AI 提供商 (9个端点)
router.get('/ai/providers', ...)
router.post('/ai/providers/:provider/test', ...)

// 账号管理 (9个端点)
router.post('/accounts/login', ...)
router.get('/accounts/login-status', ...)

// 定时发布 (6个端点)
router.post('/schedules', ...)
router.post('/schedules/:id/execute', ...)

// 发布历史 (5个端点)
router.get('/publish-history', ...)
router.get('/publish-stats', ...)

// 热点数据 (6个端点)
router.get('/trending', ...)
router.post('/trending/refresh', ...)
```

### 3. 控制器层 (src/controllers/)

**职责**:
- 请求参数验证
- 业务逻辑调用
- 响应格式化
- 错误处理

**设计模式**: MVC 模式中的 Controller

**主要控制器**:

#### knowledgeController.js
- 知识库文档 CRUD
- 文档扫描和解析
- 分类树生成
- 统计信息

#### productController.js
- 产品信息管理
- 产品图片扫描
- 分类管理
- 产品详情查询

#### postController.js
- 文案 CRUD
- AI 文案生成
- 文案优化
- 小红书发布

#### aiProviderController.js
- AI 提供商配置
- 连接测试
- 优先级管理
- 使用统计

#### accountController.js
- 账号管理
- 登录状态
- 主账号设置
- 账号统计

#### scheduleController.js
- 定时任务管理
- 任务执行
- 执行日志
- 任务状态

#### trendingController.js
- 热点数据抓取
- 热点搜索
- 热点关联
- 数据清理

#### historyController.js
- 发布历史查询
- 统计分析
- 数据导出
- 每日汇总

#### autoScanController.js
- 自动扫描配置
- 扫描任务执行
- 扫描日志

### 4. 服务层 (src/services/)

**职责**:
- 核心业务逻辑
- 数据处理
- 外部服务调用
- 复杂算法实现

**设计模式**: Service Layer Pattern

**主要服务**:

#### aiService.js
```javascript
// AI 文案生成核心服务
class AIService {
  // 生成文案
  async generateContent(prompt, context, options)

  // 优化文案
  async optimizeContent(content, requirements)

  // 提供商选择
  async selectProvider()

  // 故障转移
  async fallbackToNextProvider(error)
}
```

#### xhsService.js
```javascript
// 小红书 API 服务
class XHSService {
  // 发布笔记
  async publishNote(title, content, images)

  // 检查登录状态
  async checkLoginStatus()

  // 获取账号信息
  async getAccountInfo()
}
```

#### schedulerService.js
```javascript
// 定时任务调度服务
class SchedulerService {
  // 启动调度器
  start()

  // 检查待执行任务
  async checkPendingTasks()

  // 执行任务
  async executeTask(task)

  // 重试失败任务
  async retryFailedTask(task)
}
```

#### trendingService.js
```javascript
// 热点数据服务
class TrendingService {
  // 抓取热点
  async fetchTrending(platform)

  // 解析热点数据
  parseTrendingData(html)

  // 存储热点
  async saveTrending(data)
}
```

#### aiProviderFactory.js
```javascript
// AI 提供商工厂
class AIProviderFactory {
  // 创建提供商实例
  createProvider(config)

  // 注册提供商
  registerProvider(name, provider)

  // 获取提供商
  getProvider(name)
}
```

### 5. 数据模型层 (src/models/)

**技术栈**: SQLite + better-sqlite3

**职责**:
- 数据库初始化
- 表结构定义
- 数据操作封装

**主要文件**: `database.js`

**数据库表结构**:

```sql
-- 1. 产品分类表
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 产品表
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER,
  description TEXT,
  features TEXT,
  benefits TEXT,
  usage TEXT,
  folder_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 3. 产品图片表
CREATE TABLE product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  image_type TEXT CHECK(image_type IN ('main', 'detail')),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. 知识库文档表
CREATE TABLE knowledge_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  file_path TEXT,
  file_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 文案表
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  product_id INTEGER,
  knowledge_doc_ids TEXT,
  status TEXT DEFAULT 'draft',
  ai_provider TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6. AI 提供商表
CREATE TABLE ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  base_url TEXT,
  model TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 账号表
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  platform TEXT DEFAULT 'xiaohongshu',
  is_primary BOOLEAN DEFAULT 0,
  is_logged_in BOOLEAN DEFAULT 0,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. 定时任务表
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  schedule_type TEXT CHECK(schedule_type IN ('once', 'daily', 'weekly', 'monthly')),
  schedule_time TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  max_retries INTEGER DEFAULT 3,
  retry_count INTEGER DEFAULT 0,
  last_executed_at DATETIME,
  next_execution_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 9. 发布历史表
CREATE TABLE publish_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  account_id INTEGER,
  status TEXT CHECK(status IN ('success', 'failed')),
  error_message TEXT,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  image_count INTEGER,
  content_length INTEGER,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- 10. 热点数据表
CREATE TABLE trending_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  rank INTEGER,
  heat_value TEXT,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6. 工具层 (src/utils/)

**职责**:
- 通用工具函数
- 加密解密
- 文件解析

**主要文件**:

#### crypto.js
```javascript
// AES-256 加密解密
export function encrypt(text, key)
export function decrypt(encryptedText, key)
export function maskApiKey(apiKey)
```

#### fileParser.js
```javascript
// 文件解析工具
export async function parseWordDocument(filePath)
export async function parsePdfDocument(filePath)
export async function parseExcelDocument(filePath)
export async function parseTextFile(filePath)
```

### 7. 外部服务

#### 小红书 MCP 服务 (external/xiaohongshu-mcp/)

**技术栈**: Go + Rod (浏览器自动化)

**职责**:
- 小红书登录
- 笔记发布
- Cookie 管理
- 浏览器自动化

**主要功能**:
```go
// 登录
POST /login

// 发布笔记
POST /publish

// 检查登录状态
GET /login-status

// 健康检查
GET /health
```

**部署方式**: Docker 容器
**端口映射**: 8080:18060

#### AI 提供商

支持的 AI 服务:
1. **Claude** (Anthropic)
   - 模型: claude-sonnet-4-5
   - SDK: @anthropic-ai/sdk

2. **GPT** (OpenAI)
   - 模型: gpt-4o
   - SDK: openai

3. **通义千问** (阿里云)
   - 模型: qwen-max
   - API: HTTP REST

4. **Kimi** (月之暗面)
   - 模型: moonshot-v1
   - API: HTTP REST

5. **豆包** (字节跳动)
   - 模型: doubao-pro
   - API: HTTP REST

6. **Gemini** (Google)
   - 模型: gemini-pro
   - SDK: @google/generative-ai

## 数据流

### 1. 文案生成流程

```
用户输入
  │
  ▼
前端表单
  │
  ▼
POST /api/posts/generate
  │
  ▼
postController.generatePost()
  │
  ▼
aiService.generateContent()
  │
  ├─► 选择 AI 提供商
  │   └─► aiProviderFactory.getProvider()
  │
  ├─► 构建提示词
  │   ├─► 获取产品信息
  │   ├─► 获取知识库内容
  │   └─► 获取热点数据
  │
  ├─► 调用 AI API
  │   └─► 故障转移机制
  │
  ├─► 解析响应
  │
  └─► 保存文案到数据库
      │
      ▼
    返回结果
```

### 2. 小红书发布流程

```
用户点击发布
  │
  ▼
POST /api/posts/:id/publish
  │
  ▼
postController.publishPost()
  │
  ├─► 检查登录状态
  │   └─► xhsService.checkLoginStatus()
  │
  ├─► 获取文案和图片
  │   └─► database.getPost()
  │
  ├─► 调用 MCP 服务
  │   └─► xhsService.publishNote()
  │       │
  │       ▼
  │     POST http://xiaohongshu-mcp:18060/publish
  │       │
  │       ▼
  │     MCP 服务处理
  │       ├─► 浏览器自动化
  │       ├─► 填写表单
  │       ├─► 上传图片
  │       └─► 提交发布
  │
  ├─► 记录发布历史
  │   └─► publishHistoryService.recordPublish()
  │
  └─► 返回结果
```

### 3. 定时发布流程

```
schedulerService.start()
  │
  ▼
每60秒检查一次
  │
  ▼
schedulerService.checkPendingTasks()
  │
  ├─► 查询待执行任务
  │   └─► SELECT * FROM schedules WHERE next_execution_at <= NOW()
  │
  ├─► 遍历任务
  │   │
  │   ▼
  │   schedulerService.executeTask(task)
  │   │
  │   ├─► 获取文案
  │   ├─► 调用发布接口
  │   ├─► 更新任务状态
  │   └─► 计算下次执行时间
  │
  └─► 处理失败任务
      └─► schedulerService.retryFailedTask()
```

## 安全机制

### 1. API 密钥加密

```javascript
// 存储时加密
const encryptedKey = encrypt(apiKey, ENCRYPTION_KEY);

// 使用时解密
const apiKey = decrypt(encryptedKey, ENCRYPTION_KEY);

// 显示时掩码
const maskedKey = maskApiKey(apiKey); // "sk-***...***abc"
```

### 2. 环境变量隔离

```bash
# .env 文件
ANTHROPIC_API_KEY=sk-xxx
ENCRYPTION_KEY=xxx

# Docker 容器环境变量
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### 3. 非 root 用户运行

```dockerfile
# 创建应用用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 切换用户
USER nodejs
```

### 4. CORS 配置

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true
}));
```

## 性能优化

### 1. 数��库索引

```sql
-- 产品查询优化
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- 发布历史查询优化
CREATE INDEX idx_publish_history_post ON publish_history(post_id);
CREATE INDEX idx_publish_history_account ON publish_history(account_id);
CREATE INDEX idx_publish_history_date ON publish_history(published_at);

-- 定时任务查询优化
CREATE INDEX idx_schedules_next_execution ON schedules(next_execution_at);
CREATE INDEX idx_schedules_status ON schedules(status);
```

### 2. 静态文件缓存

```javascript
// 知识库图片静态服务
app.use('/knowledge', express.static(KNOWLEDGE_BASE_PATH, {
  maxAge: '1d',
  etag: true
}));
```

### 3. AI 提供商故障转移

```javascript
// 按优先级尝试多个提供商
const providers = await getActiveProviders(); // 按优先级排序
for (const provider of providers) {
  try {
    return await provider.generate(prompt);
  } catch (error) {
    console.error(`Provider ${provider.name} failed:`, error);
    continue; // 尝试下一个
  }
}
```

### 4. 数据库连接池

```javascript
// better-sqlite3 自动管理连接
const db = new Database(dbPath, {
  readonly: false,
  fileMustExist: false,
  timeout: 5000
});
```

## 可扩展性

### 1. 插件化 AI 提供商

```javascript
// 注册新提供商
providerRegistry.register('new-provider', {
  name: 'New Provider',
  createClient: (config) => new NewProviderClient(config),
  generateContent: async (client, prompt) => {
    // 实现生成逻辑
  }
});
```

### 2. 模块化控制器

```javascript
// 添加新功能模块
// src/controllers/newFeatureController.js
export async function newFeatureAction(req, res) {
  // 实现新功能
}

// src/routes/index.js
import { newFeatureAction } from '../controllers/newFeatureController.js';
router.post('/new-feature', newFeatureAction);
```

### 3. 数据库迁移

```javascript
// src/scripts/migrate-database.js
export function migrateToVersion2(db) {
  db.exec(`
    ALTER TABLE posts ADD COLUMN new_field TEXT;
    CREATE INDEX idx_posts_new_field ON posts(new_field);
  `);
}
```

## 监控和日志

### 1. 健康检查

```javascript
// GET /api/health
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2026-01-22T10:00:00.000Z"
}
```

### 2. 服务日志

```javascript
// 结构化日志
console.log('[AI Service]', {
  action: 'generate',
  provider: 'claude',
  duration: 1234,
  success: true
});
```

### 3. Docker 健康检查

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', ...)"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s
```

## 部署架构

### Docker Compose 服务

```yaml
services:
  # 1. 小红书 MCP 服务
  xiaohongshu-mcp:
    image: xpzouying/xiaohongshu-mcp:latest
    ports:
      - "8080:18060"
    volumes:
      - ./external/xiaohongshu-mcp/data:/app/data
      - ./知识库:/knowledge:ro

  # 2. 主应用服务
  xhs-publisher:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - xiaohongshu-mcp
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./知识库:/knowledge:ro

  # 3. 数据库备份服务
  db-backup:
    image: alpine:latest
    volumes:
      - ./data:/data:ro
      - ./backups:/backups
    command: 每日备份脚本
```

### 网络拓扑

```
Internet
  │
  ├─► Port 3000 ──► xhs-publisher (主应用)
  │                     │
  │                     ├─► SQLite (数据库)
  │                     ├─► 知识库 (文件系统)
  │                     └─► xiaohongshu-mcp (内部网络)
  │
  └─► Port 8080 ──► xiaohongshu-mcp (MCP服务)
                        │
                        └─► 小红书平台
```

## 技术选型理由

### 1. Node.js + Express
- 轻量级，易于部署
- 丰富的生态系统
- 异步 I/O 性能好
- JavaScript 全栈开发

### 2. SQLite
- 无需独立数据库服务器
- 文件级数据库，易于备份
- 性能足够（单机应用）
- 零配置

### 3. 原生 JavaScript 前端
- 无构建步骤
- 快速加载
- 易于调试
- 减少依赖

### 4. Docker
- 环境一致性
- 易于部署
- 资源隔离
- 便于扩展

### 5. Go (MCP 服务)
- 高性能
- 并发支持好
- 适合浏览器自动化
- 编译型语言，部署简单

## 未来优化方向

### 1. 性能优化
- [ ] 引入 Redis 缓存
- [ ] 数据库查询优化
- [ ] 图片 CDN 加速
- [ ] API 响应压缩

### 2. 功能扩展
- [ ] 支持更多平台（抖音、快手等）
- [ ] 批量发布功能
- [ ] 文案模板系统
- [ ] 数据分析看板

### 3. 架构改进
- [ ] 微服务拆分
- [ ] 消息队列（RabbitMQ）
- [ ] 分布式任务调度
- [ ] 容器编排（Kubernetes）

### 4. 安全增强
- [ ] JWT 认证
- [ ] API 限流
- [ ] 审计日志
- [ ] 数据加密存储

---

**文档版本**: 1.0
**最后更新**: 2026-01-22
**维护者**: 项目团队
