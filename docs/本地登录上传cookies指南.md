# 方案A：本地电脑登录并上传Cookies

## 第一步：在本地电脑下载登录工具

### Windows系统

1. **下载登录工具**
   - 打开浏览器，访问：https://github.com/xpzouying/xiaohongshu-mcp/releases/latest
   - 找到并下载：`xiaohongshu-login-windows-amd64.exe`
   - 保存到桌面或下载文件夹

2. **允许运行**
   - Windows可能会提示"不受信任的应用"
   - 点击"更多信息" → "仍要运行"

### macOS系统

**Apple Silicon (M1/M2/M3)芯片：**
```bash
# 打开终端（Applications > Utilities > Terminal）
cd ~/Downloads
curl -L https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-darwin-arm64 -o xiaohongshu-login
chmod +x xiaohongshu-login
```

**Intel芯片：**
```bash
cd ~/Downloads
curl -L https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-darwin-amd64 -o xiaohongshu-login
chmod +x xiaohongshu-login
```

**允许运行：**
- 首次运行时，macOS会提示无法验证开发者
- 打开"系统偏好设置" → "安全性与隐私"
- 点击"仍要打开"

### Linux桌面系统

```bash
cd ~/Downloads

# Intel/AMD 64位
curl -L https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-linux-amd64 -o xiaohongshu-login

# ARM 64位
# curl -L https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-linux-arm64 -o xiaohongshu-login

chmod +x xiaohongshu-login
```

---

## 第二步：运行登录工具

### Windows

1. 双击 `xiaohongshu-login-windows-amd64.exe`
2. 如果命令行窗口一闪而过，右键点击文件 → "以管理员身份运行"
3. 或者打开命令提示符：
   ```cmd
   cd %USERPROFILE%\Downloads
   xiaohongshu-login-windows-amd64.exe
   ```

### macOS / Linux

```bash
cd ~/Downloads
./xiaohongshu-login
```

---

## 第三步：扫码登录

### 登录流程

1. **浏览器自动打开**
   - 运行登录工具后，默认浏览器会自动打开
   - 显示一个**二维码**

2. **用手机扫码**
   - 📱 打开小红书App
   - 点击"我"
   - 点击右上角的扫一扫图标（📷）
   - 扫描电脑屏幕上的二维码

3. **确认登录**
   - 手机会显示"网页版登录确认"
   - 点击"确认"或"允许"

4. **登录成功**
   - 手机显示"登录成功"
   - 电脑的命令行窗口会显示"登录成功！"
   - **重要**：不要关闭窗口，等待cookies保存完成

---

## 第四步：找到Cookies文件

### Windows

Cookies文件保存在你运行程序的目录：
```
C:\Users\你的用户名\Downloads\cookies.json
```

**查找方法：**
1. 打开文件资源管理器
2. 进入"下载"文件夹
3. 找到 `cookies.json` 文件

### macOS / Linux

```bash
# Cookies文件在运行目录
cd ~/Downloads
ls -lh cookies.json
```

**验证文件内容：**
```bash
# 查看文件大小（应该大于100字节）
ls -lh cookies.json

# 查看前几行内容
head -5 cookies.json
```

---

## 第五步：上传到服务器

### 方法1：使用SCP命令（推荐）

**在本地电脑上运行：**

```bash
# Windows用户在PowerShell中运行
# macOS/Linux用户在终端中运行

scp cookies.json user@120.232.235.142:/home/user/xhs/cookies.json
```

**说明：**
- 替换 `user` 为你的服务器用户名
- 替换 `120.232.235.142` 为你的服务器IP地址
- 会提示输入服务器密码

### 方法2：使用SFTP工具（图形界面）

**推荐工具：**
- Windows: WinSCP, FileZilla
- macOS: Cyberduck, FileZilla
- Linux: FileZilla

**操作步骤：**
1. 打开SFTP客户端
2. 连接到服务器：
   - 主机：`120.232.235.142`（替换为你的IP）
   - 端口：`22`
   - 用户名：你的服务器用户名
   - 密码：你的服务器密码
3. 找到 `cookies.json` 文件
4. 拖拽到服务器的 `/home/user/xhs/` 目录

### 方法3：复制粘贴内容（备用）

如果无法直接上传文件：

**1. 在本地电脑复制cookies内容：**

Windows:
```cmd
type cookies.json
```

macOS/Linux:
```bash
cat cookies.json
```

**2. 在服务器上创建文件：**

```bash
# SSH连接到服务器后
cd /home/user/xhs
nano cookies.json
# 粘贴复制的内容
# 按 Ctrl+X，然后 Y，然后回车保存
```

---

## 第六步：配置并重启服务

**在服务器上运行：**

```bash
# 1. 确保cookies.json在正确位置
cd /home/user/xhs

# 2. 创建目标目录
mkdir -p external/xiaohongshu-mcp/data

# 3. 复制cookies到Docker数据目录
cp cookies.json external/xiaohongshu-mcp/data/

# 4. 检查文件是否成功复制
ls -lh external/xiaohongshu-mcp/data/cookies.json

# 5. 重启MCP服务
docker compose restart xiaohongshu-mcp

# 6. 等待服务启动（10秒）
sleep 10

# 7. 验证服务状态
docker compose ps
```

---

## 第七步：验证登录成功

### 方法1：检查文件

```bash
# 查看cookies文件
cat external/xiaohongshu-mcp/data/cookies.json | jq . | head -20

# 或者简单查看文件大小
ls -lh external/xiaohongshu-mcp/data/cookies.json
```

**成功的标志：**
- 文件存在
- 文件大小大于100字节
- 内容是JSON格式，包含cookies数组

### 方法2：测试健康检查

```bash
curl http://localhost:8080/health
```

**期望结果：**
```json
{
  "success": true,
  "data": {
    "account": "你的账号名",
    "service": "xiaohongshu-mcp",
    "status": "healthy"
  }
}
```

### 方法3：在网页界面测试

1. 打开浏览器访问：http://120.232.235.142:3000
2. 进入"生成文案"页面
3. 选择一个产品
4. 点击"生成文案"
5. 生成后点击"发布到小红书"
6. **应该不再出现登录错误**

---

## 常见问题

### Q1: 本地运行登录工具时，浏览器没有自动打开

**解决方法：**
1. 手动打开浏览器
2. 查看命令行输出，应该有一个URL链接
3. 复制链接到浏览器打开
4. 或者等待几秒后重试

### Q2: Windows提示"找不到cookies.json"

**原因：** Windows隐藏了文件扩展名

**解决方法：**
1. 打开文件资源管理器
2. 点击"查看" → 勾选"文件扩展名"
3. 确认文件名是 `cookies.json` 而不是 `cookies.json.txt`

### Q3: SCP上传时提示"Permission denied"

**解决方法：**
```bash
# 先上传到你有权限的目录
scp cookies.json user@120.232.235.142:~/

# 然后SSH到服务器
ssh user@120.232.235.142

# 移动到目标位置
mv ~/cookies.json /home/user/xhs/
```

### Q4: 重启服务后还是显示未登录

**检查步骤：**
```bash
# 1. 确认文件确实存在
ls -lh /home/user/xhs/external/xiaohongshu-mcp/data/cookies.json

# 2. 查看MCP服务日志
docker compose logs xiaohongshu-mcp | tail -20

# 3. 如果看到"failed to load cookies"，检查文件权限
chmod 644 /home/user/xhs/external/xiaohongshu-mcp/data/cookies.json

# 4. 再次重启
docker compose restart xiaohongshu-mcp
```

### Q5: Cookies过期了怎么办？

**标志：**
- 之前能发布，现在不行了
- 显示需要重新登录

**解决方法：**
- 重复上述所有步骤
- Cookies通常有效期为7-30天
- 建议定期更新

---

## 快速命令参考

```bash
# 完整的服务器端配置流程
cd /home/user/xhs
mkdir -p external/xiaohongshu-mcp/data
cp cookies.json external/xiaohongshu-mcp/data/
ls -lh external/xiaohongshu-mcp/data/cookies.json
docker compose restart xiaohongshu-mcp
sleep 10
curl http://localhost:8080/health
```

---

## 下载链接汇总

**最新版本：** https://github.com/xpzouying/xiaohongshu-mcp/releases/latest

**直接下载链接：**

| 系统 | 下载链接 |
|------|---------|
| Windows 64位 | https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-windows-amd64.exe |
| macOS ARM64 (M1/M2/M3) | https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-darwin-arm64 |
| macOS Intel | https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-darwin-amd64 |
| Linux x64 | https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-linux-amd64 |
| Linux ARM64 | https://github.com/xpzouying/xiaohongshu-mcp/releases/latest/download/xiaohongshu-login-linux-arm64 |

---

**完成后，你就可以愉快地使用系统发布内容到小红书了！** 🎉
