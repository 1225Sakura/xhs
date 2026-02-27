# 依赖安装说明

## 📦 新增依赖包

云端部署版本新增了以下依赖包：

### 1. bcrypt (^5.1.1)
**用途**: 密码加密
- 使用bcrypt算法加密用户密码
- Salt rounds设置为10
- 提供密码哈希和验证功能

### 2. jsonwebtoken (^9.0.2)
**用途**: JWT认证
- 生成和验证JWT token
- 用于用户身份认证
- Token有效期24小时

### 3. mysql2 (^3.6.5)
**用途**: MySQL数据库驱动
- 支持Promise API
- 连接池管理
- 参数化查询防止SQL注入

---

## 🔧 安装方法

### 方式1: 使用npm安装（推荐）

```bash
cd /path/to/xhspro
npm install
```

这将自动安装package.json中的所有依赖，包括新增的3个包。

### 方式2: 手动安装新增依赖

如果只想安装新增的依赖：

```bash
npm install bcrypt@^5.1.1 jsonwebtoken@^9.0.2 mysql2@^3.6.5
```

### 方式3: Docker构建时自动安装

使用Docker部署时，依赖会在构建镜像时自动安装：

```bash
docker-compose -f docker/docker-compose.yml build
```

---

## ⚠️ 注意事项

### bcrypt安装问题

bcrypt是原生模块，需要编译。如果遇到安装问题：

**Windows**:
```bash
# 安装Windows构建工具
npm install --global windows-build-tools

# 或使用bcryptjs（纯JavaScript实现）
npm install bcryptjs
```

**Linux**:
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# CentOS/RHEL
sudo yum install gcc-c++ make
```

**macOS**:
```bash
# 安装Xcode命令行工具
xcode-select --install
```

### Node.js版本要求

- **最��版本**: Node.js 16.x
- **推荐版本**: Node.js 18.x LTS
- **测试版本**: Node.js 18.19.0

检查Node.js版本：
```bash
node --version
```

升级Node.js（使用nvm）：
```bash
# 安装nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装Node.js 18
nvm install 18
nvm use 18
```

---

## 📋 完整依赖列表

### 生产依赖

```json
{
  "@anthropic-ai/sdk": "^0.30.1",      // Claude AI SDK
  "axios": "^1.6.5",                    // HTTP客户端
  "bcrypt": "^5.1.1",                   // 密码加密 [新增]
  "better-sqlite3": "^9.2.2",           // SQLite数据库（本地版）
  "cors": "^2.8.5",                     // CORS中间件
  "csv-writer": "^1.6.0",               // CSV导出
  "dotenv": "^16.3.1",                  // 环境变量
  "express": "^4.18.2",                 // Web框架
  "https-proxy-agent": "^7.0.6",        // HTTPS代理
  "jsonwebtoken": "^9.0.2",             // JWT认证 [新增]
  "mammoth": "^1.6.0",                  // Word文档解析
  "multer": "^1.4.5-lts.1",             // 文件上传
  "mysql2": "^3.6.5",                   // MySQL驱动 [新增]
  "node-cache": "^5.1.2",               // ��存缓存
  "pdf-parse": "^1.1.1",                // PDF解析
  "playwright": "^1.58.0",              // 浏览器自动化
  "xlsx": "^0.18.5"                     // Excel解析
}
```

### 开发依赖

```json
{
  "nodemon": "^3.0.2"                   // 开发热重载
}
```

---

## 🔍 依赖验证

安装完成后，验证关键依赖：

```bash
# 验证bcrypt
node -e "const bcrypt = require('bcrypt'); console.log('bcrypt OK');"

# 验证jsonwebtoken
node -e "const jwt = require('jsonwebtoken'); console.log('jwt OK');"

# 验证mysql2
node -e "const mysql = require('mysql2'); console.log('mysql2 OK');"
```

如果所有命令都输出"OK"，说明依赖安装成功。

---

## 📊 依赖大小

新增依赖的磁盘占用：

- bcrypt: ~2.5 MB
- jsonwebtoken: ~500 KB
- mysql2: ~1.5 MB

**总计**: ~4.5 MB

---

## 🔄 更新依赖

定期更新依赖以获取安全补丁：

```bash
# 检查过期的依赖
npm outdated

# 更新所有依赖到最新版本
npm update

# 更新特定依赖
npm update bcrypt jsonwebtoken mysql2

# 审计安全漏洞
npm audit

# 自动修复安全漏洞
npm audit fix
```

---

## 🐳 Docker环境

在Docker环境中，依赖安装在镜像构建时自动完成：

```dockerfile
# Dockerfile中的依赖安装
COPY package*.json ./
RUN npm ci --only=production
```

`npm ci` 比 `npm install` 更适合生产环境：
- 更快的安装速度
- 严格遵循package-lock.json
- 自动清理node_modules

---

## ❓ 常见问题

### Q: bcrypt安装失败怎么办？

A: 可以使用bcryptjs替代：
```bash
npm uninstall bcrypt
npm install bcryptjs
```

然后修改代码中的导入：
```javascript
// 从
import bcrypt from 'bcrypt';
// 改为
import bcrypt from 'bcryptjs';
```

### Q: 安装速度慢怎么办？

A: 使用国内镜像：
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 或使用cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### Q: 如何清理node_modules重新安装？

A:
```bash
# 删除node_modules和package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

---

## 📞 技术支持

如果遇到依赖安装问题：

1. 检查Node.js版本是否符合要求
2. 检查npm版本（建议8.x+）
3. 清理npm缓存：`npm cache clean --force`
4. 查看详细错误日志：`npm install --verbose`
5. 搜索错误信息或提issue

---

**依赖安装完成后，即可开始部署！**
