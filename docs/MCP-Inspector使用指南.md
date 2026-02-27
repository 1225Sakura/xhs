# MCP Inspector 使用指南（中文详解）

## 第一步：连接到MCP服务

### 界面说明
打开 MCP Inspector 后，你会看到一个网页界面。

### 操作步骤

1. **找到连接框**
   - 在页面顶部，你会看到一个输入框
   - 上面写着 "Server URL" 或 "Connect to server"

2. **输入服务地址**
   ```
   http://localhost:8080/mcp
   ```
   - 完整地址必须包含 `/mcp` 结尾
   - 如果你的服务器IP是其他地址，替换localhost

3. **点击连接按钮**
   - 找到 "Connect" 按钮（通常是蓝色或紫色）
   - 点击它

4. **等待连接**
   - 如果成功，界面会变化，显示更多内容
   - 如果失败，检查MCP服务是否在运行

---

## 第二步：查看可用工具

连接成功后，你会看到几个主要区域：

### 左侧面板（Tools / 工具列表）
这里会显示所有可用的MCP工具，例如：
- `xiaohongshu_check_login` - 检查登录状态
- `xiaohongshu_publish_note` - 发布笔记
- `xiaohongshu_search_notes` - 搜索笔记
- 等等...

### 右侧面板（Call Tool / 调用工具）
这里是执行工具的地方

---

## 第三步：检查登录状态（可选）

如果你想先检查是否已登录：

1. **在左侧工具列表中找到**
   - 工具名称：`xiaohongshu_check_login`
   - 或者包含 "login" 或 "check" 字样的工具

2. **点击这个工具**
   - 右侧会显示这个工具的详情

3. **点击 "Call Tool" 按钮**
   - 通常在右侧面板底部
   - 或者写着 "Execute" / "Run"

4. **查看结果**
   - 如果已登录，会显示账号信息
   - 如果未登录，会提示需要登录

---

## 第四步：获取登录二维码（重点！）

### 方法1：直接查找登录工具

1. **在左侧工具列表找**
   - 工具名称可能是：
     - `xiaohongshu_login`
     - `get_qrcode`
     - 或包含 "login" / "qr" 字样的工具

2. **点击该工具**

3. **点击 "Call Tool" 执行**

4. **等待二维码显示**
   - 结果区域会显示一个二维码图片
   - 或者显示一个二维码的URL链接

### 方法2：如果没有专门的登录工具

如果工具列表中没有明显的登录工具，说明需要先尝试调用其他工具触发登录：

1. **调用任意工具（如发布工具）**
   - 点击 `xiaohongshu_publish_note` 或其他工具
   - 尝试执行（会失败并提示需要登录）

2. **系统会提示登录**
   - 错误信息中可能包含登录URL或二维码

---

## 第五步：扫描二维码登录

### 准备工作
1. 打开你的小红书手机App
2. 进入 "我" 的页面
3. 找到右上角的扫一扫图标（通常是一个相机或二维码图标）

### 扫描步骤
1. **用手机扫描电脑屏幕上的二维码**
   - 对准二维码，等待识别

2. **在手机上确认登录**
   - 手机会显示 "网页版登录确认" 或类似提示
   - 点击 "确认登录" 或 "允许"

3. **等待登录成功**
   - 手机会显示 "登录成功"
   - 电脑上的MCP Inspector也会显示成功消息

---

## 第六步：验证登录

### 在MCP Inspector中验证

1. **再次调用检查登录工具**
   - 点击 `xiaohongshu_check_login`
   - 点击 "Call Tool"

2. **查看结果**
   ```json
   {
     "logged_in": true,
     "account": "你的账号名"
   }
   ```
   - 如果显示 `logged_in: true`，说明登录成功！

### 在终端中验证

```bash
# 检查cookies文件是否存在
ls -lh /home/user/xhs/external/xiaohongshu-mcp/data/cookies.json

# 重启MCP服务
docker compose restart xiaohongshu-mcp

# 测试健康状态
curl http://localhost:8080/health
```

---

## 第七步：开始使用

登录成功后：

1. **关闭MCP Inspector**
   - 不再需要它了
   - 可以直接关闭浏览器标签

2. **刷新你的发布系统页面**
   - 访问 http://localhost:3000
   - 现在可以生成并发布文案到小红书了！

3. **测试发布功能**
   - 生成一个测试文案
   - 点击 "发布到小红书"
   - 应该不再出现登录错误

---

## 常见问题解答

### Q1: 连接时显示 "Failed to connect"
**解决方法：**
```bash
# 检查MCP服务是否运行
docker compose ps

# 如果没有运行，启动它
docker compose up -d xiaohongshu-mcp

# 确认端口正确
# 应该看到：0.0.0.0:8080->18060/tcp
```

### Q2: 工具列表是空的
**原因：** MCP服务还未初始化或需要登录

**解决方法：**
1. 刷新页面重新连接
2. 检查MCP服务日志：`docker compose logs xiaohongshu-mcp`

### Q3: 二维码显示不出来
**可能的原因：**
1. 没有找到正确的登录工具
2. MCP服务版本问题

**解决方法：**
1. 检查左侧工具列表，仔细查找包含 "login" 的工具
2. 如果实在找不到，可能需要直接通过API调用

### Q4: 扫码后手机显示错误
**解决方法：**
1. 确保二维码没有过期（通常2-3分钟）
2. 重新生成二维码再扫
3. 确保手机App是最新版本

### Q5: 登录成功但发布还是失败
**解决方法：**
```bash
# 重启MCP服务加载新的cookies
docker compose restart xiaohongshu-mcp

# 等待10秒让服务完全启动
sleep 10

# 刷新网页
```

---

## 界面元素对照表

| 英文 | 中文 | 说明 |
|------|------|------|
| Server URL | 服务器地址 | 输入MCP服务的地址 |
| Connect | 连接 | 连接到MCP服务 |
| Disconnect | 断开 | 断开连接 |
| Tools | 工具 | 左侧的工具列表 |
| Call Tool | 调用工具 | 执行选中的工具 |
| Execute | 执行 | 运行工具 |
| Arguments | 参数 | 工具需要的输入参数 |
| Result | 结果 | 工具执行后的返回结果 |
| Error | 错误 | 如果执行失败，显示错误信息 |
| Response | 响应 | 服务器的响应内容 |

---

## 快速操作流程

```
1. 打开 MCP Inspector
   ↓
2. 输入地址：http://localhost:8080/mcp
   ↓
3. 点击 "Connect"
   ↓
4. 左侧找到登录相关工具
   ↓
5. 点击工具 → 点击 "Call Tool"
   ↓
6. 看到二维码
   ↓
7. 手机App扫描
   ↓
8. 手机上点"确认"
   ↓
9. 登录成功！
   ↓
10. 重启MCP服务
    ↓
11. 开始发布内容
```

---

## 需要帮助？

如果按照上述步骤还是有问题，可以：

1. **查看MCP服务日志**
   ```bash
   docker compose logs -f xiaohongshu-mcp
   ```

2. **检查cookies文件**
   ```bash
   cat /home/user/xhs/external/xiaohongshu-mcp/data/cookies.json
   ```

3. **重新启动所有服务**
   ```bash
   docker compose restart
   ```

---

**祝你使用顺利！** 🎉
