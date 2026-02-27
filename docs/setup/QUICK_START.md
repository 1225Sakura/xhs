# 快速开始指南

## 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Docker（可选，用于容器化部署）

## 1. 安装依赖

```bash
npm install
```

## 2. 环境配置

复制环境变量模板并配置：

```bash
cp .env.example .env
```

### 必须配置的环境变量

```env
# 加密密钥（必须）
ENCRYPTION_KEY=你的加密密钥

# Anthropic API密钥（如使用Claude）
ANTHROPIC_API_KEY=你的API密钥

# 知识库路径
KNOWLEDGE_BASE_PATH=/path/to/knowledge

# 小红书MCP服务路径（可选）
XIAOHONGSHU_MCP_PATH=/path/to/mcp
```

### 生成加密密钥

```bash
npm run generate-key
```

复制输出的密钥到 `.env` 文件。

### 可选的AI提供商配置

```env
# OpenAI
OPENAI_API_KEY=your_key

# 通义千问
QWEN_API_KEY=your_key

# Moonshot Kimi
KIMI_API_KEY=your_key

# 字节豆包
DOUBAO_API_KEY=your_key

# Google Gemini
GEMINI_API_KEY=your_key
```

## 3. 初始化数据库

数据库会在首次启动时自动初始化：

```bash
npm start
```

或手动初始化：

```bash
npm run init-db
```

## 4. 启动服务

### 开发模式（支持热重载）

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## 5. 验证安装

### 方法1: 浏览器访问

打开浏览器访问：
- 健康检查: http://localhost:3000/api/health
- API信息: http://localhost:3000/api

### 方法2: 运行测试脚本

```bash
chmod +x test-api.sh
./test-api.sh
```

应该看到所有测试项都显示 ✓ (通过)。

## 6. 配置AI提供商

### 方法1: 通过API配置

```bash
# 更新Anthropic配置
curl -X PUT http://localhost:3000/api/ai/providers/anthropic \
  -H "Content-Type: application/json" \
  -d '{
    "provider_name": "Anthropic Claude",
    "api_key": "你的API密钥",
    "is_enabled": 1,
    "priority": 100
  }'

# 测试连接
curl -X POST http://localhost:3000/api/ai/providers/anthropic/test
```

### 方法2: 通过前端界面

访问前端管理页面，在AI提供商管理模块配置。

## 7. 使用定时发布

### 创建一次性定时任务

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": 1,
    "schedule_type": "once",
    "scheduled_time": "2026-01-15 14:00:00"
  }'
```

### 创建每日定时任务

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": 1,
    "schedule_type": "daily",
    "schedule_config": {
      "time": "09:00"
    }
  }'
```

## 8. 抓取热点数据

### 刷新所有平台

```bash
curl -X POST http://localhost:3000/api/trending/refresh
```

### 刷新单个平台

```bash
curl -X POST http://localhost:3000/api/trending/refresh \
  -H "Content-Type: application/json" \
  -d '{"platform": "weibo"}'
```

### 查看热点

```bash
# 查看微博热搜
curl http://localhost:3000/api/trending/weibo

# 搜索关键词
curl "http://localhost:3000/api/trending?keyword=春节"
```

## 9. 查看发布历史和统计

### 获取发布历史

```bash
curl "http://localhost:3000/api/publish-history?page=1&pageSize=20"
```

### 获取统计数据

```bash
curl "http://localhost:3000/api/publish-stats?days=30"
```

### 导出CSV

```bash
curl "http://localhost:3000/api/publish-history/export" -o history.csv
```

## 10. Docker部署（可选）

如果项目包含Dockerfile：

```bash
# 构建镜像
docker build -t xhs-publisher .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/knowledge:/app/knowledge \
  -e ANTHROPIC_API_KEY=your_key \
  -e ENCRYPTION_KEY=your_key \
  --name xhs-publisher \
  xhs-publisher
```

使用Docker Compose：

```bash
docker-compose up -d
```

## 常见问题

### 1. 数据库权限错误

```
Error: attempt to write a readonly database
```

**解决方案**:
```bash
# 检查data目录权限
chmod 755 data
chmod 644 data/knowledge.db

# 或者删除旧数据库重新初始化
rm data/knowledge.db
npm start
```

### 2. 端口被占用

```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:
```bash
# 方法1: 杀死占用端口的进程
lsof -ti:3000 | xargs kill -9

# 方法2: 使用其他端口
PORT=3001 npm start
```

### 3. 调度器未运行

检查服务器启动日志，应该看到：
```
✅ 调度器已启动 (检查间隔: 60秒)
功能状态:
- 定时发布调度器: ✅ 运行中
```

如果未看到，检查：
- 数据库是否正确初始化
- 是否有启动错误

### 4. AI提供商连接失败

```bash
# 测试连接
curl -X POST http://localhost:3000/api/ai/providers/anthropic/test

# 检查配置
curl http://localhost:3000/api/ai/providers/anthropic

# 确认:
# 1. API密钥���否正确配置
# 2. is_enabled 是否为 1
# 3. 网络连接是否正常
```

### 5. 热点抓取失败

热点抓取可能因为：
- 目标网站反爬限制
- 网络超时
- API格式变化

查看抓取日志：
```bash
curl http://localhost:3000/api/trending/logs
```

## 下一步

1. **配置AI提供商** - 在前端界面或通过API配置所需的AI提供商
2. **创建产品和知识库** - 添加产品信息和知识库文档
3. **生成文案** - 使用AI生成小红书文案
4. **设置定时发布** - 为文案设置定时发布任务
5. **查看统计** - 在发布历史和统计页面查看数据分析

## 相关文档

- [API文档](./API_DOCUMENTATION.md) - 完整的API接口文档
- [实施总结](./IMPLEMENTATION_SUMMARY.md) - 功能实施详细说明
- [测试脚本](./test-api.sh) - 自动化测试脚本

## 技术支持

如遇到问题，请检查：
1. 服务器日志输出
2. 数据库文件权限
3. 环境变量配置
4. 网络连接状态

---

**祝使用愉快！** 🎉
