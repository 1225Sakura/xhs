# 多账户功能说明

## 概述

本系统现已支持多账户管理，允许您管理多个小红书账户并在它们之间切换发布内容。

## 功能特性

### 1. 账户管理
- ✅ 创建多个账户
- ✅ 为每个账户设置名称和备注
- ✅ 独立管理每个账户的登录状态
- ✅ 切换当前活跃账户
- ✅ 删除不需要的账户

### 2. 独立登录
- ✅ 每个账户独立登录
- ✅ 使用二维码扫码登录
- ✅ Cookie 独立存储
- ✅ 登录状态持久化

### 3. 多账户发布
- ✅ 选择指定账户发布内容
- ✅ 默认使用当前活跃账户
- ✅ 支持账户间快速切换

## 使用指南

### 创建账户

1. 访问账户管理页面：`http://localhost:3000/accounts.html`
2. 在"添加新账户"区域输入账户名称（例如：主账号、小号1）
3. 可选：输入手机号用于标识
4. 点击"添加账户"按钮

### 登录账户

1. 在账户列表中找到要登录的账户
2. 点击"登录"按钮
3. 在弹出的页面中使用小红书 APP 扫描二维码
4. 扫码成功后，Cookie 会自动保存

### 切换账户

1. 在账户列表中找到要切换的账户
2. 点击"切换"按钮
3. 该账户将成为当前活跃账户
4. 后续发布操作将使用该账户

### 发布内容

发布内容时，系统会自动使用当前活跃账户。您也可以在发布时指定特定账户。

## API 接口

### 账户管理

#### 创建账户
```http
POST /api/accounts
Content-Type: application/json

{
  "account_name": "账户名称",
  "phone": "手机号（可选）"
}
```

#### 获取账户列表
```http
GET /api/accounts
```

#### 获取当前账户
```http
GET /api/accounts/current
```

#### 切换账户
```http
POST /api/accounts/:id/switch
```

#### 删除账户
```http
DELETE /api/accounts/:id
```

### 登录相关

#### 获取登录二维码
```http
GET /api/xhs/login/qrcode?account_id=账户ID
```

#### 检查登录状态
```http
GET /api/xhs/login-status?account_id=账户ID
```

#### 退出登录
```http
POST /api/xhs/logout?account_id=账户ID
```

### 发布内容

#### 发布笔记
```http
POST /api/xhs/publish
Content-Type: application/json

{
  "title": "标题",
  "content": "内容",
  "images": ["图片路径"],
  "account_id": "账户ID（可选，默认使用当前活跃账户）"
}
```

## 数据存储

### 数据库表结构

#### accounts 表
- `id`: 账户 ID（主键）
- `account_name`: 账户名称
- `phone`: 手机号（可选）
- `is_active`: 是否为当前活跃账户
- `is_logged_in`: 是否已登录
- `cookies`: Cookie 数据（JSON）
- `last_login_at`: 最后登录时间
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 注意事项

1. **Cookie 安全**：Cookie 数据存储在本地数据库中，请确保数据库文件的安全性
2. **登录有效期**：小红书的登录 Cookie 有有效期，过期后需要重新登录
3. **账户切换**：切换账户后，所有发布操作都会使用新账户
4. **删除限制**：当前活跃账户无法删除，需要先切换到其他账户
5. **并发发布**：暂不支持同时使用多个账户发布，需要切换账户后再发布

## 故障排除

### 登录失败
- 检查网络连接
- 确认小红书 APP 版本是否最新
- 尝试刷新二维码重新扫描

### 发布失败
- 确认账户已登录
- 检查 Cookie 是否过期
- 查看浏览器控制台的错误信息

### 账户切换无效
- 刷新页面重新加载账户信息
- 检查数据库中的账户状态

## 技术架构

### 后端服务
- `accountManagementService.js`: 账户管理核心服务
- `multiAccountXhsLoginService.js`: 多账户登录服务
- `multiAccountPublishService.js`: 多账户发布服务
- `accountRoutes.js`: 账户管理路由

### 前端页面
- `accounts.html`: 账户管理界面
- `login.html`: 登录页面（支持账户参数）
- `index.html`: 主页面（显示当前账户）

### 数据库
- SQLite 数据库
- 表：`accounts`
- 位置：`data/xhs.db`

## 未来计划

- [ ] 支持账户分组
- [ ] 支持批量发布到多个账户
- [ ] 账户数据导入/导出
- [ ] 账户使用统计
- [ ] 定时任务支持多账户
