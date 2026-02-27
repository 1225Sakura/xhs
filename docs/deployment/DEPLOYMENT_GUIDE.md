# 云端部署完整指南

## 📋 目录

1. [部署前准备](#部署前准备)
2. [服务器环境配置](#服务器环境配置)
3. [Docker部署步骤](#docker部署步骤)
4. [SSL证书配置](#ssl证书配置)
5. [初始化系统](#初始化系统)
6. [验证部署](#验证部署)
7. [运维管理](#运维管理)
8. [故障排查](#故障排查)

---

## 部署前准备

### 1. 服务器要求

- **操作系统**: Linux (推荐Ubuntu 20.04+或CentOS 7+)
- **配置**: 最低2核4G内存，推荐4核8G
- **磁盘**: 至少50GB可用空间
- **网络**: 公网IP，开放80和443端口

### 2. 域名和SSL证书

- 域名: `yijingcv.cn`
- SSL证书文件:
  - `yijingcv.cn.crt` (证书文件)
  - `yijingcv.cn.key` (私钥文件)

### 3. 必需软件

- Docker (20.10+)
- Docker Compose (2.0+)
- Git

---

## 服务器环境配置

### 1. 安装Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
```

### 2. 安装Docker Compose

```bash
# 下载Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

### 3. 配置防火墙

```bash
# Ubuntu (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 4. 配置域名DNS

在域名服务商处添加A记录:
```
类型: A
主机记录: @
记录值: [你的服务器IP]
TTL: 600
```

---

## Docker部署步骤

### 1. 克隆代码到服务器

```bash
# 创建项目目录
mkdir -p /opt/xhspro
cd /opt/xhspro

# 克隆代码（或上传代码）
git clone <your-repo-url> .

# 或使用scp上传
# scp -r /local/path/xhspro root@server:/opt/
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量
nano .env.production
```

**必须修改的配置项**:

```bash
# 数据库密码（强密码）
MYSQL_ROOT_PASSWORD=your_strong_root_password_here
MYSQL_PASSWORD=your_strong_mysql_password_here

# JWT密钥（至少32位随机字符串）
JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long_here

# 加密密钥（16字节十六进制）
ENCRYPTION_KEY=your_encryption_key_16_bytes_hex_here

# Claude API密钥
CLAUDE_API_KEY=your_claude_api_key_here
```

**生成随机密钥**:

```bash
# 生成JWT密钥
openssl rand -base64 32

# 生成加密密钥
openssl rand -hex 16
```

### 3. 上传SSL证书

```bash
# 创建SSL目录
mkdir -p ssl

# 上传证书文件
# 方式1: 使用scp
scp yijingcv.cn.crt root@server:/opt/xhspro/ssl/
scp yijingcv.cn.key root@server:/opt/xhspro/ssl/

# 方式2: 直接创建文件
nano ssl/yijingcv.cn.crt  # 粘贴证书内容
nano ssl/yijingcv.cn.key  # 粘贴私钥内容

# 设置权限
chmod 600 ssl/yijingcv.cn.key
chmod 644 ssl/yijingcv.cn.crt
```

### 4. 创建必要的目录

```bash
# 创建数据目录
mkdir -p uploads knowledge logs data

# 创建占位文件
touch uploads/.gitkeep
touch knowledge/.gitkeep
touch logs/.gitkeep
```

### 5. 构建和启动容器

```bash
# 进入docker目录
cd /opt/xhspro

# 构建镜像
docker-compose -f docker/docker-compose.yml build

# 启动服务
docker-compose -f docker/docker-compose.yml up -d

# 查看容器状态
docker-compose -f docker/docker-compose.yml ps

# 查看日志
docker-compose -f docker/docker-compose.yml logs -f
```

### 6. 等待服务启动

```bash
# 检查MySQL是否就绪
docker exec xhspro-mysql mysqladmin ping -h localhost -u root -p[密码]

# 检查应用是否就绪
curl http://localhost:3000/api/health

# 检查Nginx是否就绪
curl http://localhost/health
```

---

## SSL证书配置

### 方式1: 使用已有证书（推荐）

已在上面的步骤3中完成。

### 方式2: 使用Let's Encrypt免费证书

```bash
# 安装certbot
sudo apt install certbot

# 停止Nginx容器
docker-compose -f docker/docker-compose.yml stop nginx

# 获取证书
sudo certbot certonly --standalone -d yijingcv.cn -d www.yijingcv.cn

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/yijingcv.cn/fullchain.pem ssl/yijingcv.cn.crt
sudo cp /etc/letsencrypt/live/yijingcv.cn/privkey.pem ssl/yijingcv.cn.key

# 设置权限
sudo chown $USER:$USER ssl/*
chmod 600 ssl/yijingcv.cn.key

# 重启Nginx
docker-compose -f docker/docker-compose.yml start nginx
```

### 证书自动续期

```bash
# 添加定时任务
sudo crontab -e

# 添加以下行（每月1号凌晨2点续期）
0 2 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/yijingcv.cn/fullchain.pem /opt/xhspro/ssl/yijingcv.cn.crt && cp /etc/letsencrypt/live/yijingcv.cn/privkey.pem /opt/xhspro/ssl/yijingcv.cn.key && docker-compose -f /opt/xhspro/docker/docker-compose.yml restart nginx
```

---

## 初始化系统

### 1. 验证数据库初始化

```bash
# 进入MySQL容器
docker exec -it xhspro-mysql mysql -u root -p

# 输入密码后执行
USE xhspro;
SHOW TABLES;
SELECT * FROM users;

# 应该看到超级管理员账户
# 退出
exit
```

### 2. 修改默认管理员密码

**重要**: 首次部署后必须修改默认密码！

```bash
# 方式1: 通过API修改
curl -X POST https://yijingcv.cn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# 获取token后修改密码
curl -X POST https://yijingcv.cn/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your-token]" \
  -d '{"oldPassword":"Admin@123456","newPassword":"YourNewPassword@123"}'
```

```bash
# 方式2: 直接在数据库修改
docker exec -it xhspro-mysql mysql -u root -p

USE xhspro;

# 生成新密码哈希（在本地Node.js环境）
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourNewPassword@123', 10, (err, hash) => console.log(hash));"

# 更新密码
UPDATE users SET password_hash = '[生成的哈希]' WHERE username = 'admin';
exit
```

### 3. 创建第一个普通用户

访问 `https://yijingcv.cn` 进行注册，或通过API创建:

```bash
curl -X POST https://yijingcv.cn/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test@123456"
  }'
```

---

## 验证部署

### 1. 检查服务状态

```bash
# 检查所有容器
docker-compose -f docker/docker-compose.yml ps

# 应该看到3个容器都是Up状态:
# - xhspro-mysql
# - xhspro-app
# - xhspro-nginx
```

### 2. 测试HTTP到HTTPS重定向

```bash
curl -I http://yijingcv.cn

# 应该返回301重定向到https://yijingcv.cn
```

### 3. 测试HTTPS访问

```bash
curl -I https://yijingcv.cn

# 应该返回200 OK
```

### 4. 测试API端点

```bash
# 健康检查
curl https://yijingcv.cn/api/health

# 用户注册
curl -X POST https://yijingcv.cn/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test@123456"}'

# 用户登录
curl -X POST https://yijingcv.cn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test@123456"}'
```

### 5. 浏览器访问

打开浏览器访问: `https://yijingcv.cn`

- 检查SSL证书是否有效（绿色锁图标）
- 测试用户注册和登录功能
- 测试文案生成功能
- 检查余额扣费是否正常

---

## 运维管理

### 1. 日常运维命令

```bash
# 查看容器状态
docker-compose -f docker/docker-compose.yml ps

# 查看日志
docker-compose -f docker/docker-compose.yml logs -f app
docker-compose -f docker/docker-compose.yml logs -f mysql
docker-compose -f docker/docker-compose.yml logs -f nginx

# 重启服务
docker-compose -f docker/docker-compose.yml restart

# 停止服务
docker-compose -f docker/docker-compose.yml stop

# 启动服务
docker-compose -f docker/docker-compose.yml start

# 完全停止并删除容器
docker-compose -f docker/docker-compose.yml down
```

### 2. 数据备份

```bash
# 创建备份脚本
cat > /opt/xhspro/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/xhspro/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec xhspro-mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD xhspro > $BACKUP_DIR/db_$DATE.sql

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# 备份知识库
tar -czf $BACKUP_DIR/knowledge_$DATE.tar.gz knowledge/

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
EOF

# 添加执行权限
chmod +x /opt/xhspro/backup.sh

# 添加定时任务（每天凌晨3点备份）
crontab -e
# 添加: 0 3 * * * /opt/xhspro/backup.sh >> /opt/xhspro/logs/backup.log 2>&1
```

### 3. 更新部署

```bash
# 拉取最新代码
cd /opt/xhspro
git pull origin main

# 重新构建镜像
docker-compose -f docker/docker-compose.yml build

# 重启服务
docker-compose -f docker/docker-compose.yml up -d

# 查看日志确认启动成功
docker-compose -f docker/docker-compose.yml logs -f app
```

### 4. 数据库管理

```bash
# 进入MySQL容器
docker exec -it xhspro-mysql mysql -u root -p

# 常用SQL命令
USE xhspro;

# 查看所有用户
SELECT id, username, email, role, balance, status FROM users;

# 查看用户余额记录
SELECT * FROM balance_records WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;

# 查看发布历史
SELECT * FROM publish_history ORDER BY created_at DESC LIMIT 10;

# 查看系统配置
SELECT * FROM system_config;
```

### 5. 监控和告警

```bash
# 创建监控脚本
cat > /opt/xhspro/monitor.sh << 'EOF'
#!/bin/bash

# 检查容器状态
if ! docker ps | grep -q xhspro-app; then
  echo "警告: 应用容器未运行"
  docker-compose -f /opt/xhspro/docker/docker-compose.yml restart app
fi

# 检查磁盘使用率
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "警告: 磁盘使用率超过80%: $DISK_USAGE%"
fi

# 检查内存使用率
MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $MEM_USAGE -gt 90 ]; then
  echo "警告: 内存使用率超过90%: $MEM_USAGE%"
fi
EOF

chmod +x /opt/xhspro/monitor.sh

# 添加定时任务（每5分钟检查一次）
crontab -e
# 添加: */5 * * * * /opt/xhspro/monitor.sh >> /opt/xhspro/logs/monitor.log 2>&1
```

---

## 故障排查

### 1. 容器无法启动

```bash
# 查看容器日志
docker-compose -f docker/docker-compose.yml logs app

# 常见问题:
# - 端口被占用: 修改docker-compose.yml中的端口映射
# - 环境变量错误: 检查.env.production文件
# - 数据库连接失败: 检查MySQL容器是否正常运行
```

### 2. 数据库连接失败

```bash
# 检查MySQL容器状态
docker-compose -f docker/docker-compose.yml ps mysql

# 检查MySQL日志
docker-compose -f docker/docker-compose.yml logs mysql

# 测试数据库连接
docker exec xhspro-mysql mysqladmin ping -h localhost -u root -p

# 检查网络连接
docker network inspect xhspro-network
```

### 3. SSL证书问题

```bash
# 检查证书文件
ls -la ssl/

# 验证证书
openssl x509 -in ssl/yijingcv.cn.crt -text -noout

# 检查Nginx配置
docker exec xhspro-nginx nginx -t

# 重启Nginx
docker-compose -f docker/docker-compose.yml restart nginx
```

### 4. 应用响应慢

```bash
# 查看容器资源使用
docker stats

# 查看应用日志
docker-compose -f docker/docker-compose.yml logs -f app

# 检查数据库慢查询
docker exec -it xhspro-mysql mysql -u root -p
SHOW VARIABLES LIKE 'slow_query_log';
SELECT * FROM mysql.slow_log LIMIT 10;
```

### 5. 余额扣费失败

```bash
# 检查存储过程
docker exec -it xhspro-mysql mysql -u root -p
USE xhspro;
SHOW PROCEDURE STATUS WHERE Db = 'xhspro';

# 手动测试扣费
CALL sp_deduct_balance(1, 0.10, '测试扣费', @success, @message);
SELECT @success, @message;
```

---

## 安全建议

### 1. 定期更新

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 更新Docker镜像
docker-compose -f docker/docker-compose.yml pull
docker-compose -f docker/docker-compose.yml up -d
```

### 2. 密码策略

- 定期修改管理员密码
- 强制用户使用强密码
- 启用登录失败锁定机制

### 3. 访问控制

- 限制SSH访问（使用密钥认证）
- 配置防火墙规则
- 使用VPN访问管理后台

### 4. 日志审计

```bash
# 定期检查访问日志
tail -f /opt/xhspro/logs/app.log

# 检查Nginx访问日志
docker exec xhspro-nginx tail -f /var/log/nginx/xhspro_access.log

# 检查异常登录
docker exec -it xhspro-mysql mysql -u root -p
USE xhspro;
SELECT username, last_login_at, last_login_ip FROM users ORDER BY last_login_at DESC LIMIT 20;
```

---

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_publish_history_user_status ON publish_history(user_id, status);
CREATE INDEX idx_balance_records_user_created ON balance_records(user_id, created_at);

-- 定期优化表
OPTIMIZE TABLE users;
OPTIMIZE TABLE balance_records;
OPTIMIZE TABLE publish_history;
```

### 2. 应用优化

- 启用Redis缓存（可选）
- 使用CDN加速静态资源
- 启用Gzip压缩（已在Nginx配置中）

### 3. 服务器优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65535" >> /etc/security/limits.conf
echo "* hard nofile 65535" >> /etc/security/limits.conf

# 优化TCP参数
cat >> /etc/sysctl.conf << EOF
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.core.somaxconn = 1024
EOF

sysctl -p
```

---

## 联系支持

如遇到问题，请检查:
1. 容器日志
2. 应用日志
3. 数据库日志
4. Nginx日志

或联系技术支持。

---

**部署完成！** 🎉

现在你可以通过 `https://yijingcv.cn` 访问系统了。
