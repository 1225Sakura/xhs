# 云端服务器部署指南

## 📋 目录
1. [系统要求](#系统要求)
2. [前置准备](#前置准备)
3. [快速部署](#快速部署)
4. [详细步骤](#详细步骤)
5. [配置说明](#配置说明)
6. [测试验证](#测试验证)
7. [故障排查](#故障排查)

---

## 系统要求

### 硬件要求
- CPU: 2核心以上
- 内存: 4GB以上（推荐8GB）
- 硬盘: 50GB以上可用空间
- 网络: 公网IP，开放端口80、443、1883、8883

### 软件要求
- 操作系统: Ubuntu 20.04/22.04 LTS
- Docker: 20.10+
- Docker Compose: 2.0+
- Nginx: 已安装（您已有）
- Redis: 已安装（您已有）

---

## 前置准备

### 1. 安装Docker和Docker Compose

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com | sudo sh

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到docker组
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 配置防火墙

```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1883/tcp    # MQTT
sudo ufw allow 8883/tcp    # MQTT/SSL
sudo ufw enable
```

### 3. 配置域名DNS

将您的域名指向服务器IP地址：
```
A记录: your-domain.com -> 服务器IP
```

---

## 快速部署

### 1. 克隆代码到服务器

```bash
# 在服务器上克隆代码
cd /opt
sudo git clone git@github.com:1225Sakura/xhs.git xhs-cloud
cd xhs-cloud

# 设置权限
sudo chown -R $USER:$USER /opt/xhs-cloud
```

### 2. 生成RSA密钥对（许可证签名）

```bash
# 创建密钥目录
mkdir -p keys

# 生成RSA密钥对
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# 设置权限
chmod 600 keys/private.pem
chmod 644 keys/public.pem
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production .env

# 编辑环境变量
nano .env
```

**必须修改的配置：**
```bash
# 域名
DOMAIN=your-domain.com

# 生成强密码
POSTGRES_PASSWORD=$(openssl rand -base64 32)
EMQX_PASSWORD=$(openssl rand -base64 32)
GRAFANA_PASSWORD=$(openssl rand -base64 32)

# 生成JWT密钥
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# 生成加密密钥
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# DeepSeek API密钥
DEEPSEEK_API_KEY=sk-your-deepseek-api-key

# Redis配置（使用宿主机Redis）
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### 4. 启动服务

```bash
# 构建并启动所有服务
docker-compose -f docker-compose.production.yml up -d

# 查看服务状态
docker-compose -f docker-compose.production.yml ps

# 查看日志
docker-compose -f docker-compose.production.yml logs -f
```

### 5. 配置Nginx

```bash
# 复制Nginx配置
sudo cp nginx/xhs-cloud.conf /etc/nginx/sites-available/xhs-cloud

# 修改域名
sudo sed -i 's/your-domain.com/实际域名/g' /etc/nginx/sites-available/xhs-cloud

# 启用站点
sudo ln -s /etc/nginx/sites-available/xhs-cloud /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载Nginx
sudo systemctl reload nginx
```

### 6. 配置SSL证书（Let's Encrypt）

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 详细步骤

### 步骤1: 初始化数据库

数据库会在首次启动时自动初始化（通过schema.sql）。

验证数据库：
```bash
# 进入PostgreSQL容器
docker exec -it xhs-postgres psql -U xhs_admin -d xhs_cloud

# 查看表
\dt

# 退出
\q
```

### 步骤2: 创建管理员账户

```bash
# 使用API创建管理员
curl -X POST https://your-domain.com/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_admin_password",
    "email": "admin@your-domain.com",
    "role": "admin"
  }'
```

### 步骤3: 生成测试许可证

```bash
# 登录获取token
TOKEN=$(curl -X POST https://your-domain.com/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_admin_password"
  }' | jq -r '.data.token')

# 创建许可证
curl -X POST https://your-domain.com/api/licenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "测试客户",
    "customer_email": "test@example.com",
    "plan_type": "pro",
    "max_clients": 5,
    "expires_at": "2025-12-31T23:59:59Z"
  }'
```

### 步骤4: 配置监控

访问Grafana: `https://your-domain.com/grafana`
- 用户名: admin
- 密码: 在.env中配置的GRAFANA_PASSWORD

导入仪表盘：
1. 进入Grafana
2. 点击 "+" -> "Import"
3. 上传 `packages/server/grafana/dashboards/*.json`

---

## 配置说明

### Docker Compose服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| postgres | 5432 | PostgreSQL数据库 |
| emqx | 1883, 8883, 18083 | MQTT消息代理 |
| xhs-server | 3000 | Node.js API服务 |
| prometheus | 9090 | 指标收集 |
| grafana | 3001 | 可视化仪表盘 |
| postgres-exporter | 9187 | PostgreSQL指标导出 |

### 环境变量说明

详见 `.env.production` 文件注释。

### 数据持久化

所有数据存储在Docker volumes中：
```bash
# 查看volumes
docker volume ls | grep xhs

# 备份数据库
docker exec xhs-postgres pg_dump -U xhs_admin xhs_cloud > backup.sql

# 恢复数据库
docker exec -i xhs-postgres psql -U xhs_admin xhs_cloud < backup.sql
```

---

## 测试验证

### 1. 健康检查

```bash
# API健康检查
curl https://your-domain.com/api/health

# 预期输出
{
  "status": "ok",
  "timestamp": "2024-xx-xx...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "mqtt": "connected"
  }
}
```

### 2. 服务状态检查

```bash
# 检查所有容器状态
docker-compose -f docker-compose.production.yml ps

# 所有服务应该显示 "Up" 状态
```

### 3. 日志检查

```bash
# 查看服务日志
docker-compose -f docker-compose.production.yml logs xhs-server

# 查看Nginx日志
sudo tail -f /var/log/nginx/xhs-cloud-access.log
sudo tail -f /var/log/nginx/xhs-cloud-error.log
```

### 4. 端口检查

```bash
# 检查端口监听
sudo netstat -tlnp | grep -E '(80|443|1883|3000|9090)'
```

---

## 故障排查

### 问题1: 容器无法启动

```bash
# 查看容器日志
docker-compose -f docker-compose.production.yml logs [服务名]

# 重启服务
docker-compose -f docker-compose.production.yml restart [服务名]
```

### 问题2: 数据库连接失败

```bash
# 检查PostgreSQL状态
docker exec xhs-postgres pg_isready -U xhs_admin

# 检查连接
docker exec xhs-postgres psql -U xhs_admin -d xhs_cloud -c "SELECT 1"
```

### 问题3: Redis连接失败

```bash
# 测试宿主机Redis
redis-cli -h localhost -p 6379 -a your_password ping

# 检查Docker网络
docker network inspect xhs-cloud_xhs-network
```

### 问题4: MQTT连接失败

```bash
# 检查EMQX状态
docker exec xhs-emqx emqx ping

# 访问EMQX Dashboard
# http://服务器IP:18083
# 用户名: admin
# 密码: .env中的EMQX_PASSWORD
```

### 问题5: Nginx 502错误

```bash
# 检查后端服务
curl http://localhost:3000/api/health

# 检查Nginx配置
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 维护命令

### 启动/停止服务

```bash
# 启动所有服务
docker-compose -f docker-compose.production.yml up -d

# 停止所有服务
docker-compose -f docker-compose.production.yml down

# 重启特定服务
docker-compose -f docker-compose.production.yml restart xhs-server
```

### 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose -f docker-compose.production.yml up -d --build
```

### 查看资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df
```

### 清理

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的volumes
docker volume prune
```

---

## 安全建议

1. **定期更新系统和Docker**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **配置防火墙规则**
   - 只开放必要端口
   - 限制SSH访问IP

3. **定期备份数据**
   - 数据库每日备份
   - 配置文件版本控制

4. **监控告警**
   - 配置Prometheus告警规则
   - 设置邮件/短信通知

5. **日志轮转**
   ```bash
   # 配置Docker日志大小限制
   # 编辑 /etc/docker/daemon.json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   ```

---

## 下一步

部署完成后，您可以：

1. **访问管理仪表盘**: `https://your-domain.com/dashboard`
2. **访问Grafana监控**: `https://your-domain.com/grafana`
3. **访问EMQX Dashboard**: `http://服务器IP:18083`
4. **测试API接口**: 使用Postman或curl测试

---

## 支持

如遇问题，请检查：
1. Docker容器日志
2. Nginx错误日志
3. 系统日志: `journalctl -xe`
4. 防火墙规则: `sudo ufw status`

**文档版本**: 1.0
**最后更新**: 2024-02-27
