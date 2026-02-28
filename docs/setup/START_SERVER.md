# 启动服务器

## 方法1：使用批处理文件（推荐用于CMD）
```bash
start.bat
```

## 方法2：使用PowerShell脚本（推荐用于PowerShell）
```powershell
.\start.ps1
```

## 方法3：手动启动
```bash
# 1. 查找占用端口3000的进程
netstat -ano | findstr :3000

# 2. 终止进程（替换<PID>为实际进程ID）
taskkill /F /PID <PID>

# 3. 启动服务器
npm start
```

## 常见问题

### 端口占用错误
如果看到 `EADDRINUSE: address already in use :::3000` 错误：
- 使用 `start.bat` 或 `start.ps1` 自动清理端口
- 或手动终止占用端口的进程

### 编码问题
- `start.bat` 已设置为UTF-8编码（chcp 65001）
- 如果在PowerShell中遇到乱码，请使用 `start.ps1`

## 服务器地址
启动成功后访问：http://localhost:3000
