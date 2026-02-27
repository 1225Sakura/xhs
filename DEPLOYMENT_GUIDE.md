# 服务器部署指南

## 系统要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+)
- **Node.js**: 18.x 或更高版本
- **PostgreSQL**: 15.x 或更高版本
- **Redis**: 6.x 或更高版本
- **EMQX**: 5.x (MQTT Broker)
- **Docker**: 20.x+ (可选，用于容器化部署)
- **内存**: 至少 4GB RAM
- **磁盘**: 至少 20GB 可用空间

## 快速部署（使用Docker Compose）

### 1. 克隆代码

```bash
# 使用SSH方式
git clone git@github.com:1225Sakura/xhs.git
cd xhs

# 或使用HTTPS方式
git clone https://github.com/1225Sakura/xhs.git
cd xhs
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

`.env` 文件内容：

```bash
# 数据库配置
POSTGRES_PASSWORD=your_secure_password_here
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=xhs_cloud
PG_USER=xhs_user

# Redis配置
REDIS_URL=redis://redis:6379

# MQTT配置
MQTT_URL=mqtt://emqx:1883

# JWT密钥（请生成一个随机字符串）
JWT_SECRET=your_jwt_secret_key_here

# 许可证RSA密钥（可选，系统会自动生成）
# LICENSE_PRIVATE_KEY=
# LICENSE_PUBLIC_KEY=

# Grafana配置
GRAFANA_USER=admin
GRAFANA_PASSWORD=your_grafana_password

# 应用端口
PORT=3000
```

### 3. 启动所有服务

```bash
# 启动完整的监控栈
docker-compose -f docker-compose.monitoring.yml up -d

# 查看服务状态
docker-compose -f docker-compose.monitoring.yml ps

# 查看日志
docker-compose -f docker-compose.monitoring.yml logs -f
```

### 4. 初始化数据库

```bash
# 进入服务器容器
docker-compose -f docker-compose.monitoring.yml exec xhs-server sh

# 运行数据库迁移
npm run migrate

# 退出容器
exit
```

### 5. 创建管理员账号

```bash
# 使用API创建管理员
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "Admin123456",
    "role": "admin"
  }'
```

### 6. 访问服务

- **应用服务器**: http://your-server:3000
- **管理仪表盘**: http://your-server:3002 (需要单独部署)
- **Prometheus**: http://your-server:9090
- **Grafana**: http://your-server:3001
- **AlertManager**: http://your-server:9093
- **EMQX Dashboard**: http://your-server:18083

## 手动部署（不使用Docker）

### 1. 安装依赖

#### 安装Node.js 18

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

#### 安装PostgreSQL 15

```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# CentOS/RHEL
sudo yum install -y postgresql15-server postgresql15-contrib
sudo postgresql-15-setup initdb
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15
```

#### 安装Redis

```bash
# Ubuntu/Debian
sudo apt-get install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis

# CentOS/RHEL
sudo yum install -y redis
sudo systemctl start redis
sudo systemctl enable redis
```

#### 安装EMQX

```bash
# 下载EMQX
wget https://www.emqx.com/en/downloads/broker/5.3.0/emqx-5.3.0-ubuntu20.04-amd64.tar.gz
tar -xzf emqx-5.3.0-ubuntu20.04-amd64.tar.gz
cd emqx

# 启动EMQX
./bin/emqx start
```

### 2. 配置数据库

```bash
# 切换到postgres用户
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE xhs_cloud;
CREATE USER xhs_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE xhs_cloud TO xhs_user;
\q
```

### 3. 部署后端服务

```bash
# 克隆代码
git clone git@github.com:1225Sakura/xhs.git
cd xhs

# 安装依赖
npm install

# 配置环境变量
cp packages/server/.env.example packages/server/.env
nano packages/server/.env

# 初始化数据库
cd packages/server
npm run migrate

# 启动服务
npm start

# 或使用PM2管理进程
npm install -g pm2
pm2 start src/server.js --name xhs-server
pm2 save
pm2 startup
```

### 4. 部署管理仪表盘

```bash
# 构建前端
cd packages/dashboard
npm install
npm run build

# 使用Nginx部署
sudo apt-get install -y nginx

# 配置Nginx
sudo nano /etc/nginx/sites-available/xhs-dashboard
```

Nginx配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/xhs/packages/dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/xhs-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 配置防火墙

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 1883/tcp
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=1883/tcp
sudo firewall-cmd --reload
```

## 部署Prometheus和Grafana

### 使用Docker

```bash
# 启动Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/packages/server/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v $(pwd)/packages/server/prometheus/alerts.yml:/etc/prometheus/alerts.yml \
  prom/prometheus

# 启动Grafana
docker run -d \
  --name grafana \
  -p 3001:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana
```

### 手动安装

```bash
# 安装Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar -xzf prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64
./prometheus --config.file=prometheus.yml

# 安装Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

## 配置HTTPS（使用Let's Encrypt）

```bash
# 安装Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 监控和维护

### 查看日志

```bash
# Docker方式
docker-compose -f docker-compose.monitoring.yml logs -f xhs-server

# PM2方式
pm2 logs xhs-server

# 系统日志
sudo journalctl -u xhs-server -f
```

### 备份数据库

```bash
# 备份PostgreSQL
pg_dump -U xhs_user xhs_cloud > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql -U xhs_user xhs_cloud < backup_20240101.sql
```

### 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新安装依赖
npm install

# 重启服务
pm2 restart xhs-server

# 或使用Docker
docker-compose -f docker-compose.monitoring.yml restart xhs-server
```

## 性能优化

### 1. 启用Gzip压缩

在Nginx配置中添加：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### 2. 配置缓存

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_last_seen ON clients(last_seen);
CREATE INDEX idx_heartbeats_created_at ON heartbeats(created_at);

-- 定期清理旧数据
DELETE FROM heartbeats WHERE created_at < NOW() - INTERVAL '30 days';
```

## 故障排查

### 服务无法启动

```bash
# 检查端口占用
sudo netstat -tlnp | grep 3000

# 检查日志
pm2 logs xhs-server --lines 100

# 检查环境变量
env | grep PG_
```

### 数据库连接失败

```bash
# 测试数据库连接
psql -h localhost -U xhs_user -d xhs_cloud

# 检查PostgreSQL状态
sudo systemctl status postgresql
```

### MQTT连接失败

```bash
# 检查EMQX状态
./bin/emqx_ctl status

# 测试MQTT连接
mosquitto_pub -h localhost -t test -m "hello"
```

## 安全建议

1. **修改默认密码**: 所有服务的默认密码都应该修改
2. **启用防火墙**: 只开放必要的端口
3. **使用HTTPS**: 生产环境必须使用SSL证书
4. **定期备份**: 每天自动备份数据库
5. **更新系统**: 定期更新系统和依赖包
6. **监控日志**: 配置日志监控和告警
7. **限制访问**: 使用IP白名单限制管理后台访问

## 联系支持

如有问题，请查看：
- GitHub Issues: https://github.com/1225Sakura/xhs/issues
- 文档: 项目根目录的各个README文件
