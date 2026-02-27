# 一键启动脚本使用说明

## 📋 功能概述

`启动.bat` 是一个全功能的一键启动脚本，可以自动完成以下操作：

1. ✅ 检查系统依赖（Node.js、Docker）
2. ✅ 停止现有服务（避免端口冲突）
3. ✅ 重启 Docker 容器（清理僵尸进程）
4. ✅ 启动 Node.js 后端服务
5. ✅ 启动僵尸进程自动清理服务
6. ✅ 验证所有服务状态
7. ✅ 自动打开浏览器

## 🚀 使用方法

### 方法一：双击启动（推荐）

1. 确保 Docker Desktop 正在运行
2. 双击 `启动.bat` 文件
3. 等待所有服务启动完成
4. 浏览器会自动打开系统界面

### 方法二：右键以管理员身份运行

1. 右键点击 `启动.bat`
2. 选择"以管理员身份运行"
3. 等待所有服务启动完成

### 方法三：命令行启动

```bash
cd E:\xhs
启动.bat
```

## 📊 启动流程

### 第一步：检查依赖（5秒）

```
[1/6] 检查系统依赖...

[√] Node.js: v18.x.x
[√] Docker: 已安装
[√] Docker: 正在运行
```

**可能的错误**：
- `[×] 错误: 未找到 Node.js` → 请安装 Node.js
- `[×] 错误: Docker 未运行` → 请启动 Docker Desktop

### 第二步：停止现有服务（2秒）

```
[2/6] 停止现有服务...

[√] Node.js 服务器已停止
[√] pm2 服务已停止
```

**作用**：
- 避免端口 3000 被占用
- 清理旧的 Node.js 进程
- 停止 pm2 管理的服务

### 第三步：重启 Docker 容器（20秒）

```
[3/6] 重启 Docker 容器...

[*] 重启 MCP 容器...
[√] MCP 容器已重启
[*] 等待容器启动（15秒）...
[√] 容器启动完成

[*] 检查僵尸进程...
[i] 当前僵尸进程数: 3
```

**作用**：
- 清理容器内的僵尸进程
- 重置浏览器会话
- 恢复 MCP 服务到最佳状态

**注意**：
- 重启会导致正在进行的发布操作失败
- 登录状态会保留（Cookie 持久化）

### 第四步：启动 Node.js 后端（8秒）

```
[4/6] 启动 Node.js 后端服务...

[*] 启动 Node.js 服务器...
[*] 等待服务器启动（5秒）...
[√] Node.js 服务器已启动 (http://localhost:3000)
```

**作用**：
- 启动 Express 后端服务器
- 监听端口 3000
- 连接数据库和 MCP 服务

**日志位置**：`E:\xhs\logs\server.log`

### 第五步：启动僵尸进程清理服务（3秒）

```
[5/6] 启动僵尸进程自动清理服务...

[*] 启动自动清理服务...
[√] 僵尸进程自动清理服务已启动
```

**作用**：
- 每分钟自动检查僵尸进程
- 超过 10 个自动重启容器
- 防止僵尸进程积累

**日志位置**：`E:\xhs\logs\zombie-cleanup.log`

### 第六步：验证服务状态（2秒）

```
[6/6] 验证服务状态...

[√] MCP 容器: 运行中
[√] Node.js 服务器: 运行中 (端口 3000)
[√] 僵尸清理服务: 运行中
```

**作用**：
- 确认所有服务正常运行
- 显示服务状态摘要

### 完成：打开浏览器

```
========================================
  所有服务启动完成！
========================================

访问地址:
  - 前端界面: http://localhost:3000
  - MCP 服务: http://localhost:8080

日志文件:
  - Node.js 服务器: E:\xhs\logs\server.log
  - 僵尸进程清理: E:\xhs\logs\zombie-cleanup.log

提示:
  - 关闭此窗口不会停止服务
  - 如需停止服务，请运行 停止.bat
  - 如需查看日志，请查看 logs 目录

按任意键打开浏览器访问系统...
```

## 🛑 停止服务

### 使用停止脚本（推荐）

双击 `停止.bat` 文件，会提示：

```
[?] 是否停止 MCP 容器？
    注意：停止容器会导致登录状态失效

    1 = 停止容器
    2 = 保持容器运行（推荐）

请选择 [1/2]:
```

**选择说明**：
- **选择 1**：停止所有服务包括容器（完全关闭）
- **选择 2**：只停止 Node.js 服务，保持容器运行（推荐）

### 手动停止

```bash
# 停止 Node.js 服务
taskkill /F /IM node.exe

# 停止 Docker 容器（可选）
docker stop xhs-mcp-server
```

## ⚙️ 配置说明

### 修改容器名称

如果您的容器名称不是 `xhs-mcp-server`，请修改 `启动.bat` 第 93 行：

```batch
docker ps -a | findstr xhs-mcp-server >nul 2>nul
```

改为您的容器名称：

```batch
docker ps -a | findstr 您的容器名称 >nul 2>nul
```

### 修改端口

如果您的 Node.js 服务器使用其他端口，请修改：

1. `启动.bat` 第 131 行：`findstr ":3000"`
2. `启动.bat` 第 149 行：`findstr ":3000"`
3. `启动.bat` 第 230 行：`start http://localhost:3000`

### 修改等待时间

如果容器启动较慢，可以增加等待时间：

`启动.bat` 第 111 行：

```batch
timeout /t 15 /nobreak >nul
```

改为：

```batch
timeout /t 30 /nobreak >nul
```

## 🐛 故障排除

### 问题1：Docker 未运行

**错误信息**：
```
[×] 错误: Docker 未运行
    请先启动 Docker Desktop，等待其完全启动后再运行此脚本
```

**解决方法**：
1. 启动 Docker Desktop
2. 等待右下角图标变为绿色
3. 重新运行 `启动.bat`

### 问题2：容器不存在

**错误信息**：
```
[×] 错误: 未找到 xhs-mcp-server 容器
    请先创建容器或检查容器名称
```

**解决方法**：
1. 检查容器名称：`docker ps -a`
2. 如果容器名称不同，修改脚本中的容器名称
3. 如果容器不存在，请先创建容器

### 问题3：端口被占用

**错误信息**：
```
[!] 警告: 端口 3000 已被占用
[*] 尝试释放端口...
```

**解决方法**：
- 脚本会自动尝试释放端口
- 如果失败，手动查找占用进程：
  ```bash
  netstat -ano | findstr ":3000"
  taskkill /F /PID <进程ID>
  ```

### 问题4：Node.js 服务器启动失败

**错误信息**：
```
[×] Node.js 服务器启动失败
[i] 请查看日志: E:\xhs\logs\server.log
```

**解决方法**：
1. 查看日志文件：`E:\xhs\logs\server.log`
2. 检查是否缺少依赖：`npm install`
3. 检查数据库是否存在：`E:\xhs\data\knowledge.db`
4. 检查环境变量是否配置：`.env` 文件

### 问题5：僵尸清理服务未启动

**错误信息**：
```
[!] 警告: 未找到自动清理脚本
[i] 跳过僵尸进程清理服务
```

**解决方法**：
- 这不是错误，只是警告
- 如果需要自动清理功能，确保文件存在：
  `E:\xhs\scripts\auto-cleanup-zombies.js`

### 问题6：浏览器未自动打开

**解决方法**：
- 手动访问：http://localhost:3000
- 检查浏览器是否被防火墙阻止

## 📝 日志文件

### Node.js 服务器日志

**位置**：`E:\xhs\logs\server.log`

**内容**：
- 服务器启动信息
- API 请求日志
- 错误信息
- 数据库操作日志

**查看方法**：
```bash
# Windows
type E:\xhs\logs\server.log

# 实时查看（需要 Git Bash 或 WSL）
tail -f E:\xhs\logs\server.log
```

### 僵尸进程清理日志

**位置**：`E:\xhs\logs\zombie-cleanup.log`

**内容**：
- 僵尸进程检查记录
- 容器重启记录
- 清理成功/失败信息

**查看方法**：
```bash
type E:\xhs\logs\zombie-cleanup.log
```

## 🔄 开机自启动

### 方法一：添加到启动文件夹

1. 按 `Win + R`，输入 `shell:startup`
2. 创建 `启动.bat` 的快捷方式
3. 将快捷方式放入启动文件夹

### 方法二：使用任务计划程序

1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器：登录时
4. 操作：启动程序 `E:\xhs\启动.bat`

### 方法三：使用 pm2（推荐）

```bash
# 安装 pm2
npm install -g pm2

# 启动服务
pm2 start E:\xhs\src\server.js --name xhs-server
pm2 start E:\xhs\scripts\auto-cleanup-zombies.js --name zombie-cleanup

# 设置开机自启动
pm2 startup
pm2 save
```

## 💡 最佳实践

1. **每天启动一次**
   - 建议每天运行一次 `启动.bat`
   - 清理僵尸进程，保持系统健康

2. **定期查看日志**
   - 每周检查一次日志文件
   - 及时发现潜在问题

3. **保持 Docker 运行**
   - 不要频繁停止 Docker Desktop
   - 保持容器运行可以保留登录状态

4. **使用停止脚本**
   - 不要直接关闭命令行窗口
   - 使用 `停止.bat` 优雅地停止服务

5. **备份数据**
   - 定期备份 `E:\xhs\data\knowledge.db`
   - 备份 `.env` 配置文件

## 📞 技术支持

如果遇到问题，请检查：

1. **日志文件**
   - `E:\xhs\logs\server.log`
   - `E:\xhs\logs\zombie-cleanup.log`

2. **Docker 状态**
   ```bash
   docker ps
   docker logs xhs-mcp-server
   ```

3. **端口占用**
   ```bash
   netstat -ano | findstr ":3000"
   netstat -ano | findstr ":8080"
   ```

4. **进程状态**
   ```bash
   tasklist | findstr node.exe
   ```

---

**版本**: 1.0.0
**最后更新**: 2026-01-28
**适用系统**: Windows 10/11
