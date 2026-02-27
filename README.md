# 小红书知识库发布系统

基于 Docker 的私有知识库管理、AI 文案生成和小红书一键发布系统。

**当前版本**: v3.0 (云端多用户版) | **状态**: ✅ 开发完成 | **最后更新**: 2026-02-25

## 🚀 重大更新：云端部署版本

系统已完成云端多用户SaaS平台改造！现在支持：
- ✅ **多用户系统** - 用户注册、登录、权限管理
- ✅ **余额计费** - 按文案生成次数计费
- ✅ **Docker部署** - 一键部署到云服务器
- ✅ **HTTPS访问** - 通过域名安全访问
- ✅ **数据隔离** - 用户数据完全隔离

**快速开始**: [云端部署快速指南](./docs/deployment/QUICKSTART.md)

---

## 📖 快速导航

### 本地使用
- [项目状态](#项目状态)
- [核心特性](#核心特性)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [配置说明](#配置说明)
- [API 接口](#api-接口)
- [故障排查](#故障排查)

### 云端部署
- [云端部署快速开始](./docs/deployment/QUICKSTART.md) - 5分钟快速部署
- [完整部署指南](./docs/deployment/DEPLOYMENT_GUIDE.md) - 详细部署步骤
- [架构设计文档](./docs/deployment/CLOUD_DEPLOYMENT_ARCHITECTURE.md) - 系统架构说明
- [项目总结](./docs/deployment/PROJECT_SUMMARY.md) - 改造内容总结

---

## 📊 项目状态

### 当前阶段：云端多用户版本
- **版本**: v3.0
- **发布日期**: 2026-02-25
- **运行状态**: ✅ 核心功能完成
- **部署方式**: 本地使用 + 云端部署
- **文档完整度**: ✅ 100%

### v3.0 更新内容
1. ✅ 多用户认证系统（JWT）
2. ✅ 余额管理和计费系统
3. ✅ MySQL数据库支持
4. ✅ Docker容器化部署
5. ✅ Nginx反向代理和SSL
6. ✅ 完整的部署文档

### v2.4 更新内容
1. ✅ 修复知识库文档列表自动刷新
2. ✅ 修复产品图片加载路径问题
3. ✅ 实现知识库完全隔离
4. ✅ 移除余额查询功能
5. ✅ 完成项目文档整理

详细进度查看：[PROGRESS.md](./PROGRESS.md)

---

## 🌟 核心特性

### 知识库管理
- 📚 **智能文档解析** - 支持 Word、PDF、Excel、TXT 等多种格式
- 🗂️ **自动分类扫描** - 自动识别产品资料、观念教育等分类
- 🖼️ **图片资源管理** - 自动索引产品图片（主图、详情图）
- 🔍 **全文搜索** - 快速检索知识库内容
- 🔒 **完全隔离** - 不同知识库数据完全隔离

### AI 文案生成
- 🤖 **多AI提供商** - 支持 Claude、GPT、通义千问、Kimi、豆包、Gemini、Grok
- 🔄 **智能故障转移** - 按优先级自动切换，确保服务高可用
- 🎯 **上下文生成** - 基于知识库内容生成精准文案
- ✨ **文案优化** - AI 辅助优化已生成的文案

### 小红书发布
- 🚀 **一键发布** - 基于 Playwright 浏览器自动化
- 👥 **多账号管理** - 支持多个小红书账号切换和管理
- 🔐 **手动登录** - 浏览器扫码登录，Cookie 自动保存
- 📸 **智能上传** - 5种图片上传方法，多重故障转移
- 📅 **定时发布** - 支持一次性、每日、每周、每月定时任务
- 📊 **发布历史** - 详细的发布记录和统计分析
- 🐛 **调试功能** - 自动截图，详细日志，便于问题排查

### 热点数据
- 🔥 **多平台热搜** - 聚合微博、百度、今日头条、B站热点
- 🔄 **智能故障转移** - 微博API双层备份，确保数据稳定获取
- 🔗 **热点关联** - 将热点话题关联到文案创作
- 🔍 **关键词搜索** - 快速查找相关热点
- 🗑️ **数据清理** - 自动清理过期热点数据

### 系统特性
- 🐳 **Docker 容器化** - 完全隔离的运行环境，开箱即用
- 💾 **自动备份** - 每日自动备份数据库，保留 7 天
- 🔒 **安全可靠** - API密钥加密存储，非 root 用户运行
- 🏥 **健康检查** - 自动监控服务状态，异常自动重启

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端界面 (localhost:3000)                │
│                    原生 JavaScript + HTML/CSS                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   后端 API (Express.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 知识库管理    │  │ AI文案生成   │  │ 定时发布      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 产品管理      │  │ 账号管理     │  │ 热点数据      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ SQLite   │  │ AI APIs  │  │ XHS MCP  │
        │ 数据库    │  │ 多提供商  │  │ 服务     │
        └──────────┘  └──────────┘  └──────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ 小红书平台    │
                                    └──────────────┘
```

### 核心组件

1. **前端界面** (`public/`)
   - 单页应用，原生 JavaScript
   - 响应式设计，支持移动端
   - 实时状态更新

2. **后端服务** (`src/`)
   - Express.js RESTful API
   - 模块化架构（Controller-Service-Model）
   - 30+ API 端点

3. **数据存储** (`data/`)
   - SQLite 数据库
   - 9个核心数据表
   - 自动备份机制

4. **知识库** (`知识库/`)
   - 产品资料（图片 + 文档）
   - 观念教育文档
   - 基因检测数据
   - 创业培训资料

5. **MCP 服务** (`external/xiaohongshu-mcp/`)
   - Go 语言实现
   - 浏览器自动化
   - Cookie 管理

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd xhs
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **访问系统**
- 前端界面: http://localhost:3000
- API 文档: http://localhost:3000/api
- MCP 服务: http://localhost:8080

### 方式二：本地开发

1. **安装依赖**
```bash
npm install
```

2. **初始化数据库**
```bash
npm run init-db
```

3. **扫描知识库**
```bash
npm run scan
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **启动 MCP 服务**（需要单独启动）
```bash
cd external/xiaohongshu-mcp
docker-compose up -d
```

### 首次使用配置

1. **配置 AI 提供商**
   - 访问系统设置页面
   - 添加至少一个 AI 提供商（Claude、GPT 等）
   - 测试连接确保配置正确

2. **登录小红书账号**
   - 访问账号管理页面
   - 点击"登录小红书"
   - 系统会打开浏览器窗口
   - 手动点击切换到二维码登录
   - 使用小红书 APP 扫描二维码完成登录
   - Cookie 会自动保存，下次无需重新登录

3. **扫描知识库**
   - 访问知识库页面
   - 点击"扫描知识库"
   - 等待扫描完成

详细配置指南: [docs/setup/QUICK_START.md](./docs/setup/QUICK_START.md)

---

## 📁 项目结构

```
xhs/
├── src/                      # 后端源代码
│   ├── controllers/          # 控制器层（9个）
│   ├── services/             # 服务层（8个）
│   ├── models/               # 数据模型
│   ├── routes/               # 路由配置
│   ├── utils/                # 工具类
│   ├── scripts/              # 脚本工具
│   └── server.js             # 服务器入口
├── public/                   # 前端静态文件
│   ├── index.html            # 主页面
│   ├── app.js                # 前端逻辑
│   └── style.css             # 样式文件
├── data/                     # 数据存储
│   └── knowledge.db          # SQLite 数据库
├── uploads/                  # 上传文件
│   └── images/               # 上传的图片
├── 知识库/                   # 知识库文档
│   ├── 产品资料/             # 产品图片和文档
│   ├── 观念教育/             # 教育文档
│   ├── 基因检测源文件底层数据/
│   └── 创业/                 # 培训资料
├── external/                 # 外部依赖
│   └── xiaohongshu-mcp/      # 小红书 MCP 服务
├── docs/                     # 项目文档
│   ├── setup/                # 配置指南
│   ├── api/                  # API 文档
│   ├── reports/              # 项目报告
│   ├── guides/               # 开发指南
│   └── status/               # 状态文档
├── docker-compose.yml        # Docker 编排配置
├── Dockerfile                # 应用容器构建
├── package.json              # Node.js 项目配置
├── .env                      # 环境变量配置
└── README.md                 # 本文档
```

### 核心目录说明

- **src/controllers/** - API 请求处理
  - `knowledgeController.js` - 知识库管理
  - `productController.js` - 产品管理
  - `postController.js` - 文案生成与发布
  - `aiProviderController.js` - AI 提供商管理
  - `accountController.js` - 账号管理
  - `scheduleController.js` - 定时发布
  - `trendingController.js` - 热点数据
  - `historyController.js` - 发布历史
  - `autoScanController.js` - 自动扫描

- **src/services/** - 业务逻辑层
  - `aiService.js` - AI 文案生成
  - `xhsService.js` - 小红书 API
  - `multiAccountXhsLoginService.js` - 多账户登录服务
  - `multiAccountPublishService.js` - 多账户发布服务
  - `accountManagementService.js` - 账户管理服务
  - `schedulerService.js` - 定时任务调度
  - `trendingService.js` - 热点数据抓取
  - `publishHistoryService.js` - 发布历史
  - `accountService.js` - 账号服务

- **src/models/** - 数据模型
  - `database.js` - 数据库初始化和操作

- **src/utils/** - 工具类
  - `crypto.js` - 加密解密
  - `fileParser.js` - 文件解析（Word、PDF、Excel、TXT）

---

## ⚙️ 配置说明

### 环境变量 (.env)

```bash
# Claude API 配置
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_BASE_URL=https://api.aiyunos.top

# 知识库路径（支持中文路径）
KNOWLEDGE_BASE_PATH=E:\xhs\知识库

# 小红书 MCP 服务地址
XIAOHONGSHU_MCP_URL=http://xiaohongshu-mcp:18060

# 代理配置（可选）
HTTP_PROXY=http://10.250.8.8:10809
HTTPS_PROXY=http://10.250.8.8:10809

# 服务端口
PORT=3000
```

### Docker Compose 配置

系统包含 3 个服务：

1. **xiaohongshu-mcp** - 小红书 MCP 服务
   - 端口: 8080 → 18060
   - 镜像: xpzouying/xiaohongshu-mcp:latest

2. **xhs-publisher** - 主应用服务
   - 端口: 3000
   - 依赖: xiaohongshu-mcp

3. **db-backup** - 数据库备份服务
   - 每日自动备份
   - 保留 7 天历史

### AI 提供商配置

支持的 AI 提供商：

| 提供商 | 模型 | 配置要求 |
|--------|------|----------|
| DeepSeek | deepseek-chat, deepseek-reasoner | API Key + Base URL |

详细配置: [docs/setup/AI_PROVIDER_SETUP.md](./docs/setup/AI_PROVIDER_SETUP.md)

---

## 📡 API 接口

### 知识库管理 (6个)
- `GET /api/knowledge` - 获取知识库列表
- `POST /api/knowledge` - 添加知识库文档
- `DELETE /api/knowledge/:id` - 删除文档
- `POST /api/knowledge/scan` - 扫描知识库
- `GET /api/knowledge/categories-tree` - 获取分类树
- `GET /api/knowledge/stats` - 获取统计信息

### 产品管理 (8个)
- `GET /api/products` - 获取产品列表
- `GET /api/products/:id` - 获取产品详情
- `POST /api/products` - 创建产品
- `PUT /api/products/:id` - 更新产品
- `DELETE /api/products/:id` - 删除产品
- `GET /api/categories` - 获取分类列表
- `POST /api/categories` - 创建分类
- `POST /api/products/scan` - 扫描产品图片

### 文案管理 (7个)
- `GET /api/posts` - 获取文案列表
- `GET /api/posts/:id` - 获取文案详情
- `POST /api/posts` - 创建文案
- `POST /api/posts/generate` - AI 生成文案
- `POST /api/posts/:id/optimize` - 优化文案
- `POST /api/posts/:id/publish` - 发布到小红书
- `DELETE /api/posts/:id` - 删除文案

### AI 提供商 (9个)
- `GET /api/ai/providers` - 获取提供商列表
- `POST /api/ai/providers` - 添加提供商
- `PUT /api/ai/providers/:provider` - 更新提供商
- `DELETE /api/ai/providers/:provider` - 删除提供商
- `POST /api/ai/providers/:provider/test` - 测试连接
- `POST /api/ai/providers/:provider/set-primary` - 设为主提供商
- `GET /api/ai/models` - 获取可用模型
- `GET /api/ai/usage-stats` - 获取使用统计

### 账号管理 (9个)
- `GET /api/accounts` - 获取账号列表
- `POST /api/accounts` - 添加账号
- `PUT /api/accounts/:id` - 更新账号
- `DELETE /api/accounts/:id` - 删除账号
- `POST /api/accounts/:id/set-primary` - 设为主账号
- `GET /api/accounts/:id/stats` - 获取账号统计
- `GET /xhs/login/qrcode` - 获取登录二维码（手动登录模式）
- `GET /xhs/login-status` - 获取登录状态
- `POST /xhs/logout` - 退出登录

### 定时发布 (6个)
- `GET /api/schedules` - 获取定时任务列表
- `POST /api/schedules` - 创建定时任务
- `PUT /api/schedules/:id` - 更新任务
- `DELETE /api/schedules/:id` - 删除任务
- `POST /api/schedules/:id/execute` - 立即执行
- `GET /api/schedules/:id/logs` - 获取执行日志

### 发布历史 (5个)
- `GET /api/publish-history` - 获取发布历史
- `GET /api/publish-history/:id` - 获取详情
- `GET /api/publish-stats` - 获取统计数据
- `GET /api/publish-stats/daily` - 获取每日统计
- `GET /api/publish-history/export` - 导出 CSV

### 热点数据 (6个)
- `GET /api/trending` - 获取热点列表
- `POST /api/trending/refresh` - 刷新热点
- `GET /api/trending/search` - 搜索热点
- `GET /api/trending/stats` - 获取统计
- `POST /api/trending/:id/associate` - 关联文案
- `DELETE /api/trending/cleanup` - 清理过期数据

### 系统接口 (2个)
- `GET /api/health` - 健康检查
- `GET /api` - API 信息

完整 API 文档: [docs/api/API_DOCUMENTATION.md](./docs/api/API_DOCUMENTATION.md)

---

## 🔧 常用命令

### NPM 脚本

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start

# 初始化数据库
npm run init-db

# 扫描知识库
npm run scan

# 数据库迁移
npm run migrate
```

### Docker 命令

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

### 数据库操作

```bash
# 进入数据库
sqlite3 data/knowledge.db

# 查看表结构
.schema products

# 查询数据
SELECT * FROM products LIMIT 5;

# 退出
.quit
```

---

## 🐛 故障排查

### 常见问题

**1. localhost 拒绝连接**
- 检查服务是否启动: `docker ps` 或 `netstat -ano | findstr ":3000"`
- 查看服务日志: `docker-compose logs -f`
- 重启服务: `docker-compose restart`

**2. 图片无法显示**
- 确认知识库路径配置正确
- 检查图片路径是否包含中文（需要 URL 编码）
- 验证静态文件服务: `curl http://localhost:3000/knowledge/产品资料/Actifit/主图1.jpg`

**3. AI 生成失败**
- 检查 AI 提供商配置
- 测试 API 连接: 访问 `/api/ai/providers/:provider/test`
- 查看错误日志

**4. 小红书发布失败**
- 确认账户已登录: 访问 `/xhs/login-status`
- 检查图片路径是否正确
- 查看调试截图: `data/temp/` 目录
- 查看详细日志: `server.log`
- 如果登录过期，重新登录账户

**5. Docker 构建失败**
- 检查网络连接（Docker Hub）
- 使用预构建镜像: `xpzouying/xiaohongshu-mcp:latest`
- 配置代理: 在 docker-compose.yml 中设置 HTTP_PROXY

### 日志查看

```bash
# 查看主应用日志
docker-compose logs -f xhs-publisher

# 查看 MCP 服务日志
docker-compose logs -f xiaohongshu-mcp

# 查看所有服务日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100
```

### 数据恢复

```bash
# 从备份恢复数据库
cp backups/knowledge-20260122-120000.db data/knowledge.db

# 重启服务
docker-compose restart xhs-publisher
```

---

## 📚 完整文档

所有详细文档已整理到 **[docs/](./docs/)** 目录：

| 分类 | 文档 | 说明 |
|------|------|------|
| **配置指南** | [QUICK_START.md](./docs/setup/QUICK_START.md) | 快速开始指南 |
| | [AI_PROVIDER_SETUP.md](./docs/setup/AI_PROVIDER_SETUP.md) | AI 提供商配置 |
| **API 文档** | [API_DOCUMENTATION.md](./docs/api/API_DOCUMENTATION.md) | 完整 API 文档 |
| **项目报告** | [PROJECT_COMPLETION_REPORT.md](./docs/reports/PROJECT_COMPLETION_REPORT.md) | 项目完成报告 |
| | [IMPLEMENTATION_SUMMARY.md](./docs/reports/IMPLEMENTATION_SUMMARY.md) | 实现总结 |
| | [TEST_REPORT.md](./docs/reports/TEST_REPORT.md) | 测试报告 |
| **开发指南** | [FRONTEND_DEVELOPMENT_GUIDE.md](./docs/guides/FRONTEND_DEVELOPMENT_GUIDE.md) | 前端开发指南 |
| **状态验证** | [FINAL_VERIFICATION.txt](./docs/status/FINAL_VERIFICATION.txt) | 最终验证 |
| | [FRONTEND_COMPLETION.md](./docs/status/FRONTEND_COMPLETION.md) | 前端完成报告 |

---

## 📊 技术栈

### 后端
- **运行时**: Node.js 18
- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **AI SDK**: @anthropic-ai/sdk
- **文件解析**: mammoth, pdf-parse, xlsx
- **加密**: crypto (AES-256)

### 前端
- **框架**: 原生 JavaScript
- **样式**: CSS3
- **UI**: 响应式设计

### 基础设施
- **容器化**: Docker + Docker Compose
- **浏览器自动化**: Playwright
- **多账户管理**: Cookie 持久化
- **代理**: HTTP/HTTPS 代理支持

---

## 📝 开发规范

### 代码风格
- 使用 ES6+ 语法
- 模块化设计（Controller-Service-Model）
- 统一的错误处理
- 详细的注释说明

### API 设计
- RESTful 风格
- 统一的响应格式: `{ success: boolean, data?: any, error?: string }`
- 完整的错误信息
- 请求参数验证

### 数据库设计
- 外键约束
- 索引优化
- 自动时间戳
- 软删除支持

---

## 📚 项目文档

### 核心文档
- **[PROGRESS.md](./PROGRESS.md)** - 项目进度和开发日志
- **[RULES.md](./RULES.md)** - 项目开发规则
- **[docs/README.md](./docs/README.md)** - 完整文档索引

### 快速链接
- **快速开始**: [docs/setup/QUICK_START.md](./docs/setup/QUICK_START.md)
- **AI配置**: [docs/setup/AI_PROVIDER_SETUP.md](./docs/setup/AI_PROVIDER_SETUP.md)
- **API文档**: [docs/api/API_DOCUMENTATION.md](./docs/api/API_DOCUMENTATION.md)
- **系统状态**: [docs/status/SYSTEM_STATUS_2026-02-06.md](./docs/status/SYSTEM_STATUS_2026-02-06.md)

### 使用指南
- **登录指南**: [docs/LOGIN_GUIDE.md](./docs/LOGIN_GUIDE.md)
- **多账号管理**: [docs/MULTI_ACCOUNT.md](./docs/MULTI_ACCOUNT.md)
- **自动Cookie**: [docs/guides/AUTO_COOKIE_GUIDE.md](./docs/guides/AUTO_COOKIE_GUIDE.md)

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范
请遵循 [RULES.md](./RULES.md) 中的项目规则：
- 代码规范和架构要求
- 文档管理规则
- Git提交规范

---

## 📄 许可证

本项目采用 MIT 许可证。

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 项目讨论区

---

## 🙏 致谢

- [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) - 小红书 MCP 服务
- [Anthropic Claude](https://www.anthropic.com/) - AI 文案生成
- 所有贡献者和使用者

---

**当前版本**: v2.4
**最后更新**: 2026-02-06
**维护状态**: ✅ 积极维护中

