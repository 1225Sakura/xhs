FROM node:20-alpine

# 安装必要的构建工具
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# 安装依赖
RUN npm install --workspace=packages/server --production

# 复制源代码
COPY packages/server ./packages/server
COPY src ./src

# 创建必要的目录
RUN mkdir -p /app/data /app/logs /app/keys

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动服务
CMD ["node", "src/server.js"]
