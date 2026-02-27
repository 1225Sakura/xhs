# 多阶段构建 - Node.js应用
FROM node:18-alpine AS app-builder

# 设置工作目录
WORKDIR /app

# 安装系统依赖（用于编译native模块）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# 复制package文件
COPY package*.json ./

# 安装Node依赖
RUN npm ci --omit=dev

# 运行时镜像
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

# 设置工作目录
WORKDIR /app

# 从构建阶段复制依赖
COPY --from=app-builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=nodejs:nodejs . .

# 复制启动脚本
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 创建必要的目录（作为root用户，确保权限）
RUN mkdir -p data uploads/images public && \
    chown -R nodejs:nodejs data uploads public && \
    chmod -R 777 uploads

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用tini作为init进程，并运行启动脚本
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]

# 启动命令（会被entrypoint.sh执行）
CMD ["su-exec", "nodejs", "node", "src/server.js"]
