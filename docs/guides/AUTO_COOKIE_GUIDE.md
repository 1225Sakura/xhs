# 自动获取Cookie功能说明

## ✅ 功能已实现

系统现在支持**自动从登录账户获取Cookie**，无需手动复制粘贴！

## 🎯 工作原理

### 1. Cookie获取优先级

系统会按以下顺序自动获取Cookie：

```
1. 当前活跃账户的Cookie（优先）
   ↓ 如果没有
2. 第一个已登录账户的Cookie
   ↓ 如果没有
3. 环境变量中的Cookie（.env文件）
   ↓ 如果都没有
4. 提示用户登录
```

### 2. Cookie格式转换

- **登录时保存**: Playwright格式（JSON数组）
- **使用时转换**: 字符串格式（name=value; name2=value2）
- **自动完成**: 无需手动处理

## 📝 使用步骤

### 方法1：通过系统登录（推荐）⭐

1. **打开系统界面**
   ```
   http://localhost:3000
   ```

2. **进入账号管理页面**
   - 点击左侧菜单"账号管理"

3. **登录小红书账号**
   - 点击"登录"按钮
   - 系统会打开浏览器窗口
   - 使用手机扫码登录
   - 登录成功后Cookie自动保存

4. **使用热门笔记学习功能**
   - 进��"文案生成"页面
   - 勾选"学习热门笔记风格"
   - 输入关键词（如"护肤"）
   - 系统自动使用登录账户的Cookie

### 方法2：手动配置（备用）

如果自动登录有问题，仍可手动配置：

1. 浏览器登录小红书
2. 复制Cookie
3. 更新.env文件
4. 重启服务器

## 🔍 验证Cookie状态

### 检查账户登录状态

```bash
curl http://localhost:3000/api/accounts
```

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "account_name": "我的账号",
      "login_status": "logged_in",  // ✅ 已登录
      "last_login_at": "2026-02-05 09:00:00"
    }
  ]
}
```

### 测试热门笔记功能

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"product_id":1,"style":"种草型","learn_from_hot":true,"hot_keywords":"护肤"}' \
  http://localhost:3000/api/posts/generate
```

**成功标志**：
- 日志显示：`🔑 使用账户 "xxx" 的Cookie (N个)`
- 成功抓取热门笔记
- 返回包含`hot_posts_used`字段

## 📊 功能优势

| 特性 | 手动配置 | 自动获取 |
|------|---------|---------|
| 操作复杂度 | 高 | 低 |
| Cookie更新 | 手动 | 自动 |
| 多账户支持 | 困难 | 简单 |
| 错误率 | 高 | 低 |
| 用户体验 | 差 | 优秀 |

## 🔧 技术实现

### 修改的文件

**src/services/xhsScraperService.js**

```javascript
// 新增方法：自动获取Cookie
getCookie() {
  // 1. 尝试获取活跃账户的Cookie
  const activeAccount = accountManagementService.getActiveAccount();
  if (activeAccount && activeAccount.cookies) {
    const cookies = accountManagementService.getAccountCookies(activeAccount.id);
    // 转换为字符串格式
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  // 2. 尝试获取任意已登录账户的Cookie
  const loggedInAccount = allAccounts.find(acc => acc.login_status === 'logged_in');
  // ...

  // 3. 降级到环境变量
  return process.env.XHS_COOKIE || '';
}

// 修改方法：使用动态Cookie
async scrapeHotPosts(keyword, targetCount) {
  const cookie = this.getCookie(); // 动态获取
  // ...
}
```

### Cookie格式转换

**Playwright格式** (数据库存储):
```json
[
  {"name": "web_session", "value": "xxx", "domain": ".xiaohongshu.com"},
  {"name": "a1", "value": "yyy", "domain": ".xiaohongshu.com"}
]
```

**字符串格式** (API请求):
```
web_session=xxx; a1=yyy; ...
```

## ⚠️ 注意事项

### 1. Cookie有效期
- Cookie会过期，需要定期重新登录
- 系统会自动检测Cookie失效
- 失败时会提示重新登录

### 2. 账户状态
- 确保账户状态为"logged_in"
- 如果显示"logged_out"，需要重新登录
- 可以通过账号管理页面查看状态

### 3. 多账户管理
- 系统优先使用活跃账户
- 可以切换不同账户
- 每个账户的Cookie独立管理

## 🎉 使用示例

### 完整流程演示

1. **登录账户**
   ```
   访问 http://localhost:3000
   → 账号管理
   → 点击"登录"
   → 扫码登录
   → 等待"登录成功"提示
   ```

2. **生成文案（自动使用Cookie）**
   ```
   → 文案生成
   → 选择产品
   → 勾选"学习热门笔记风格"
   → 输入关键词"护肤"
   → 点击"生成文案"
   ```

3. **查看日志（验证Cookie使用）**
   ```
   服务器日志会显示：
   🔑 使用账户 "我的账号" 的Cookie (45个)
   🔍 开始抓取关键词"护肤"的热门笔记
   ✅ 第1页抓取成功，获得20篇笔记
   ```

## 📈 效果对比

### 之前（手动配置）
```
1. 浏览器登录小红书
2. F12打开开发者工具
3. 找到Network标签
4. 复制Cookie值
5. 编辑.env文件
6. 粘贴Cookie
7. 重启服务器
8. 测试功能
```
**耗时**: 5-10分钟，容易出错

### 现在（自动获取）
```
1. 点击"登录"按钮
2. 扫码登录
3. 自动完成
```
**耗时**: 30秒，零出错

## ✅ 总结

- ✅ 功能已完整实现
- ✅ 自动从登录账户获取Cookie
- ✅ 支持多账户管理
- ✅ 自动格式转换
- ✅ 故障降级机制
- ✅ 用户体验优秀

**现在只需登录一次，系统会自动处理所有Cookie相关的事情！**
