# 云端部署快速开始

## 🚀 5分钟快速部署

本指南帮助你快速在服务器上部署小红书发布系统。

---

## 前置条件

✅ Linux服务器（2核4G+）
✅ 域名 `yijingcv.cn` 已解析到服务器IP
✅ SSL证书文件（yijingcv.cn.crt 和 yijingcv.cn.key）
✅ Claude API密钥

---

## 部署步骤

### 1. 安装Docker

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
```

### 2. 克隆代码

```bash
mkdir -p /opt/xhspro && cd /opt/xhspro
# 上传你的代码到这个目录
```

### 3. 配置环境变量

```bash
cp .env.production.example .env.production
nano .env.production
```

修改以下配置:
```bash
MYSQL_ROOT_PASSWORD=your_strong_password
MYSQL_PASSWORD=your_mysql_password
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
CLAUDE_API_KEY=your_claude_api_key
```

### 4. 上传SSL证书

```bash
mkdir -p ssl
# 上传证书文件到 ssl/ 目录
chmod 600 ssl/yijingcv.cn.key
```

### 5. 启动服务

```bash
cd /opt/xhspro
docker-compose -f docker/docker-compose.yml up -d
```

### 6. 验证部署

```bash
# 检查容器状态
docker-compose -f docker/docker-compose.yml ps

# 访问系统
curl https://yijingcv.cn
```

---

## 默认账户

**超级管理员**:
- 用户名: `admin`
- 密码: `Admin@123456`

**⚠️ 重要**: 首次登录后立即修改密码！

---

## 修改管理员密码

```bash
# 1. 登录获取token
curl -X POST https://yijingcv.cn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# 2. 修改密码
curl -X POST https://yijingcv.cn/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your-token]" \
  -d '{"oldPassword":"Admin@123456","newPassword":"YourNewPassword@123"}'
```

---

## 常用命令

```bash
# 查看日志
docker-compose -f docker/docker-compose.yml logs -f

# 重启服务
docker-compose -f docker/docker-compose.yml restart

# 停止服务
docker-compose -f docker/docker-compose.yml stop

# 备份数据库
docker exec xhspro-mysql mysqldump -u root -p xhspro > backup.sql
```

---

## 下一步

- 📖 阅读完整部署指南: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- 🏗️ 了解系统架构: [CLOUD_DEPLOYMENT_ARCHITECTURE.md](./CLOUD_DEPLOYMENT_ARCHITECTURE.md)
- 🔧 配置自动备份和监控

---

## 故障排查

**容器无法启动?**
```bash
docker-compose -f docker/docker-compose.yml logs app
```

**数据库连接失败?**
```bash
docker-compose -f docker/docker-compose.yml logs mysql
```

**SSL证书问题?**
```bash
docker exec xhspro-nginx nginx -t
```

---

**部署完成！** 🎉 访问 https://yijingcv.cn 开始使用。
