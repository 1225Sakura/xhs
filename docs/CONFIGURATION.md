# 配置文件说明

## 环境变量配置 (.env)

### 必需配置

```bash
# Claude API 配置（必需）
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_BASE_URL=https://api.aiyunos.top

# 知识库路径（必需，支持中文路径）
KNOWLEDGE_BASE_PATH=E:\xhs\知识库

# 小红书 MCP 服务地址（必需）
XIAOHONGSHU_MCP_URL=http://xiaohongshu-mcp:18060
```

### 可选配置

```bash
# 服务端口（默认: 3000）
PORT=3000

# 数据库路径（默认: ./data/knowledge.db）
DATABASE_PATH=./data/knowledge.db

# 代理配置（可选）
HTTP_PROXY=http://10.250.8.8:10809
HTTPS_PROXY=http://10.250.8.8:10809

# 排除代理的地址
NO_PROXY=xiaohongshu-mcp,localhost,127.0.0.1,172.17.0.0/16,.local

# 加密密钥（用于 API 密钥加密，自动生成）
ENCRYPTION_KEY=auto_generated_key

# Node 环境（development/production）
NODE_ENV=production
```

### 环境变量说明

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `ANTHROPIC_API_KEY` | Claude API 密钥 | 无 | `sk-ant-xxx` |
| `ANTHROPIC_BASE_URL` | Claude API 基础 URL | `https://api.anthropic.com` | `https://api.aiyunos.top` |
| `KNOWLEDGE_BASE_PATH` | 知识库文件夹路径 | `./knowledge/AI数据文档` | `E:\xhs\知识库` |
| `XIAOHONGSHU_MCP_URL` | MCP 服务地址 | `http://localhost:18060` | `http://xiaohongshu-mcp:18060` |
| `PORT` | 服务端口 | `3000` | `3000` |
| `DATABASE_PATH` | 数据库文件路径 | `./data/knowledge.db` | `./data/knowledge.db` |
| `HTTP_PROXY` | HTTP 代理地址 | 无 | `http://10.250.8.8:10809` |
| `HTTPS_PROXY` | HTTPS 代理地址 | 无 | `http://10.250.8.8:10809` |
| `NO_PROXY` | 不使用代理的地址 | 无 | `localhost,127.0.0.1` |
| `ENCRYPTION_KEY` | 加密密钥 | 自动生成 | `random_32_char_string` |
| `NODE_ENV` | Node 环境 | `production` | `development` |

---

## Docker Compose 配置 (docker-compose.yml)

### 服务配置

#### 1. xiaohongshu-mcp 服务

```yaml
xiaohongshu-mcp:
  image: xpzouying/xiaohongshu-mcp:latest
  container_name: xhs-mcp-server
  ports:
    - "8080:18060"  # 宿主机端口:容器端口
  volumes:
    - ./external/xiaohongshu-mcp/data:/app/data
    - ./external/xiaohongshu-mcp/configs:/app/configs
    - ./external/xiaohongshu-mcp/images:/app/images
    - ./uploads:/app/uploads
    - ${KNOWLEDGE_BASE_PATH:-./knowledge/AI数据文档}:/knowledge:ro
  environment:
    - TZ=Asia/Shanghai
    - ROD_BROWSER_BIN=/usr/bin/google-chrome
    - COOKIES_PATH=/app/data/cookies.json
    - HTTP_PROXY=http://10.250.8.8:10809
    - HTTPS_PROXY=http://10.250.8.8:10809
  restart: unless-stopped
  networks:
    - xhs-network
```

**配置说明**:
- `image`: 使用预构建的 MCP 服务镜像
- `ports`: 映射容器内部 18060 端口到宿主机 8080 端口
- `volumes`:
  - `data`: Cookie 和数据持久化
  - `configs`: 配置文件
  - `images`: 图片缓存
  - `uploads`: 共享上传目录
  - `knowledge`: 知识库（只读）
- `environment`:
  - `TZ`: 时区设置
  - `ROD_BROWSER_BIN`: Chrome 浏览器路径
  - `COOKIES_PATH`: Cookie 存储路径
  - `HTTP_PROXY/HTTPS_PROXY`: 代理配置
- `restart`: 容器重启策略
- `networks`: 加入自定义网络

#### 2. xhs-publisher 服务

```yaml
xhs-publisher:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: xhs-publisher-app
  depends_on:
    - xiaohongshu-mcp
  ports:
    - "3000:3000"
  volumes:
    - ./data:/app/data
    - ./uploads:/app/uploads
    - ${KNOWLEDGE_BASE_PATH:-./knowledge/AI数据文档}:/knowledge:ro
    - ./public:/app/public
  environment:
    - NODE_ENV=production
    - PORT=3000
    - TZ=Asia/Shanghai
    - KNOWLEDGE_BASE_PATH=/knowledge
    - XIAOHONGSHU_MCP_URL=http://xiaohongshu-mcp:18060
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-${ANTHROPIC_AUTH_TOKEN}}
    - ANTHROPIC_BASE_URL=https://api.aiyunos.top
    - HTTP_PROXY=http://10.250.8.8:10809
    - HTTPS_PROXY=http://10.250.8.8:10809
    - NO_PROXY=xiaohongshu-mcp,localhost,127.0.0.1,172.17.0.0/16,.local
  restart: unless-stopped
  networks:
    - xhs-network
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
    interval: 30s
    timeout: 3s
    retries: 3
    start_period: 10s
```

**配置说明**:
- `build`: 从 Dockerfile 构建镜像
- `depends_on`: 依赖 MCP 服务先启动
- `volumes`:
  - `data`: 数据库持久化
  - `uploads`: 上传文件
  - `knowledge`: 知识库（只读）
  - `public`: 前端静态文件（开发时可实时更新）
- `environment`:
  - `NODE_ENV`: Node 运行环境
  - `KNOWLEDGE_BASE_PATH`: 容器内知识库路径
  - `XIAOHONGSHU_MCP_URL`: MCP 服务地址（使用容器名）
  - `NO_PROXY`: 排除内部 Docker 服务使用代理
- `healthcheck`: 健康检查配置
  - 每 30 秒检查一次
  - 超时 3 秒
  - 重试 3 次
  - 启动后 10 秒开始检查

#### 3. db-backup 服务

```yaml
db-backup:
  image: alpine:latest
  container_name: xhs-db-backup
  volumes:
    - ./data:/data:ro
    - ./backups:/backups
  command: >
    sh -c "while true; do
      if [ -f /data/knowledge.db ]; then
        cp /data/knowledge.db /backups/knowledge-$$(date +%Y%m%d-%H%M%S).db;
        find /backups -name 'knowledge-*.db' -mtime +7 -delete;
        echo \"[$$( date '+%Y-%m-%d %H:%M:%S')] Database backup completed\";
      fi;
      sleep 86400;
    done"
  restart: unless-stopped
  networks:
    - xhs-network
```

**配置说明**:
- `image`: 使用轻量级 Alpine Linux
- `volumes`:
  - `data`: 数据库目录（只读）
  - `backups`: 备份目录
- `command`: 备份脚本
  - 每 24 小时（86400 秒）执行一次
  - 备份文件名包含时间戳
  - 自动删除 7 天前的备份

### 网络配置

```yaml
networks:
  xhs-network:
    driver: bridge
    name: xhs-network
```

**说明**:
- 创建自定义桥接网络
- 所有服务在同一网络中可以通过容器名互相访问

### 卷配置

```yaml
volumes:
  xhs-data:
    driver: local
  xhs-uploads:
    driver: local
```

**说明**:
- 定义命名卷（可选）
- 使用本地驱动

---

## Package.json 配置

### 基本信息

```json
{
  "name": "xiaohongshu-knowledge-publisher",
  "version": "1.0.0",
  "description": "小红书知识库发布系统",
  "type": "module",
  "main": "src/server.js"
}
```

### 脚本命令

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "init-db": "node src/scripts/initDatabase.js",
    "scan": "node src/scripts/scanKnowledge.js",
    "migrate": "node src/scripts/migrate-database.js"
  }
}
```

**命令说明**:
- `npm start`: 生产模式启动
- `npm run dev`: 开发模式（热重载）
- `npm run init-db`: 初始化数据库
- `npm run scan`: 扫描知识库
- `npm run migrate`: 数据库迁移

### 依赖包

#### 核心依赖

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "express": "^4.18.2",
    "better-sqlite3": "^9.2.2",
    "axios": "^1.6.2",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

**说明**:
- `@anthropic-ai/sdk`: Claude API SDK
- `express`: Web 框架
- `better-sqlite3`: SQLite 数据库
- `axios`: HTTP 客户端
- `multer`: 文件上传中间件
- `cors`: 跨域支持
- `dotenv`: 环境变量加载

#### 文件解析依赖

```json
{
  "dependencies": {
    "mammoth": "^1.6.0",
    "pdf-parse": "^1.1.1",
    "xlsx": "^0.18.5"
  }
}
```

**说明**:
- `mammoth`: Word 文档解析
- `pdf-parse`: PDF 文档解析
- `xlsx`: Excel 文档解析

#### 开发依赖

```json
{
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

**说明**:
- `nodemon`: 开发时自动重启

---

## Dockerfile 配置

### 多阶段构建

```dockerfile
# 构建阶段
FROM node:18-alpine AS app-builder

WORKDIR /app

# 安装系统依赖（用于编译 native 模块）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# 复制 package 文件
COPY package*.json ./

# 安装 Node 依赖
RUN npm ci --omit=dev

# 运行时阶段
FROM node:18-alpine

# 安装运行时依赖
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    tini \
    su-exec

# 创建应用用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 从构建阶段复制依赖
COPY --from=app-builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=nodejs:nodejs . .

# 复制启动脚本
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 创建必要的目录
RUN mkdir -p data uploads/images public && \
    chown -R nodejs:nodejs data uploads public && \
    chmod -R 777 uploads

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]

# 启动命令
CMD ["su-exec", "nodejs", "node", "src/server.js"]
```

**配置说明**:
- **多阶段构建**: 减小最终镜像大小
- **系统依赖**: 安装 native 模块编译所需的库
- **非 root 用户**: 安全性考虑
- **tini**: 正确处理信号和僵尸进程
- **健康检查**: 自动监控服务状态

---

## 启动脚本 (scripts/entrypoint.sh)

```bash
#!/bin/sh
set -e

# 等待 MCP 服务就绪
echo "等待 MCP 服务启动..."
until curl -s http://xiaohongshu-mcp:18060/health > /dev/null 2>&1; do
  echo "MCP 服务未就绪，等待中..."
  sleep 2
done
echo "MCP 服务已就绪"

# 初始化数据库（如果需要）
if [ ! -f /app/data/knowledge.db ]; then
  echo "初始化数据库..."
  node /app/src/scripts/initDatabase.js
fi

# 执行传入的命令
exec "$@"
```

**说明**:
- 等待 MCP 服务启动
- 自动初始化数据库
- 执行主命令

---

## 配置文件最佳实践

### 1. 环境变量优先级

```
命令行参数 > 环境变量 > .env 文件 > 默认值
```

### 2. 敏感信息处理

```bash
# ❌ 不要提交到 Git
.env

# ✅ 提供示例文件
.env.example
```

### 3. 路径配置

```bash
# Windows 路径
KNOWLEDGE_BASE_PATH=E:\xhs\知识库

# Linux/Mac 路径
KNOWLEDGE_BASE_PATH=/home/user/xhs/知识库

# 相对路径
KNOWLEDGE_BASE_PATH=./知识库
```

### 4. 代理配置

```bash
# 全局代理
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080

# 排除内部服务
NO_PROXY=localhost,127.0.0.1,xiaohongshu-mcp
```

### 5. Docker 网络

```yaml
# 使用容器名访问服务
XIAOHONGSHU_MCP_URL=http://xiaohongshu-mcp:18060

# 不要使用 localhost（容器内无法访问宿主机）
# ❌ XIAOHONGSHU_MCP_URL=http://localhost:8080
```

---

## 故障排查

### 1. 环境变量未生效

```bash
# 检查环境变量
docker-compose config

# 重新加载环境变量
docker-compose down
docker-compose up -d
```

### 2. 路径问题

```bash
# Windows 路径需要转义反斜杠
KNOWLEDGE_BASE_PATH=E:\\xhs\\知识库

# 或使用正斜杠
KNOWLEDGE_BASE_PATH=E:/xhs/知识库
```

### 3. 代理问题

```bash
# 测试代理连接
curl -x http://10.250.8.8:10809 https://api.anthropic.com

# 检查 NO_PROXY 配置
echo $NO_PROXY
```

### 4. 端口冲突

```bash
# 检查端口占用
netstat -ano | findstr ":3000"

# 修改端口
PORT=3001
```

---

**文档版本**: 1.0
**最后更新**: 2026-01-22
