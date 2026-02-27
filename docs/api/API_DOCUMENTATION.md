# API 文档 - 小红书知识库发布系统

## 基础信息

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **响应格式**: 所有接口统一返回JSON格式

### 标准响应格式

```json
{
  "success": true,
  "data": {},
  "error": "错误信息（仅失败时）"
}
```

---

## 1. AI提供商管理 API

### 1.1 获取支持的提供商列表

```http
GET /api/ai/providers/supported
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "provider": "anthropic",
      "name": "Anthropic Claude",
      "default_models": ["claude-sonnet-4-5-20250929"]
    },
    {
      "provider": "openai",
      "name": "OpenAI",
      "default_models": ["gpt-5", "gpt-5.1"]
    }
  ]
}
```

### 1.2 获取所有提供商配置

```http
GET /api/ai/providers
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "provider": "anthropic",
      "provider_name": "Anthropic Claude",
      "api_base_url": "https://api.anthropic.com",
      "is_enabled": 1,
      "priority": 100,
      "timeout": 60000,
      "max_retries": 3,
      "has_api_key": true,
      "api_key_masked": "sk-ant-***xyz",
      "created_at": "2026-01-12 09:06:27",
      "updated_at": "2026-01-12 09:06:27"
    }
  ]
}
```

### 1.3 获取单个提供商配置

```http
GET /api/ai/providers/:provider
```

**参数**:
- `provider` - 提供商标识（anthropic, openai, qwen, kimi, doubao, gemini）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "provider": "anthropic",
    "provider_name": "Anthropic Claude",
    "api_base_url": "https://api.anthropic.com",
    "is_enabled": 1,
    "priority": 100,
    "timeout": 60000,
    "max_retries": 3,
    "has_api_key": true
  }
}
```

### 1.4 更新提供商配置

```http
PUT /api/ai/providers/:provider
```

**请求体**:
```json
{
  "provider_name": "Anthropic Claude",
  "api_key": "sk-ant-xxx",
  "api_base_url": "https://api.anthropic.com",
  "is_enabled": 1,
  "priority": 100,
  "timeout": 60000,
  "max_retries": 3
}
```

### 1.5 启用/禁用提供商

```http
POST /api/ai/providers/:provider/toggle
```

**请求体**:
```json
{
  "enabled": true
}
```

### 1.6 更新提供商优先级

```http
POST /api/ai/providers/:provider/priority
```

**请求体**:
```json
{
  "priority": 100
}
```

### 1.7 测试提供商连接

```http
POST /api/ai/providers/:provider/test
```

**响应示例**:
```json
{
  "success": true,
  "latency": 856,
  "message": "连接测试成功 (856ms)",
  "response": "OK"
}
```

### 1.8 删除提供商

```http
DELETE /api/ai/providers/:provider
```

### 1.9 清除提供商缓存

```http
POST /api/ai/providers/cache/clear
```

### 1.10 获取AI使用统计

```http
GET /api/ai/usage-stats?days=7&provider=anthropic&operation=generate
```

**查询参数**:
- `days` - 统计天数（默认7）
- `provider` - 筛选提供商（可选）
- `operation` - 筛选操作类型（可选）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period_days": 7,
    "total": {
      "total_calls": 150,
      "successful_calls": 145,
      "failed_calls": 5,
      "total_tokens": 125000,
      "total_cost": 12.5,
      "avg_duration_ms": 2500
    },
    "by_provider": [
      {
        "provider": "anthropic",
        "calls": 120,
        "successful": 118,
        "failed": 2,
        "tokens": 100000,
        "cost": 10.0,
        "avg_duration": 2400
      }
    ],
    "by_model": [],
    "by_operation": [],
    "daily_trend": []
  }
}
```

---

## 2. 发布历史管理 API

### 2.1 获取发布历史列表

```http
GET /api/publish-history?page=1&pageSize=20&status=success&post_id=1
```

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）
- `status` - 状态筛选（success/failed）
- `post_id` - 文案ID筛选
- `platform` - 平台筛选
- `startDate` - 开始日期
- `endDate` - 结束日期
- `is_retry` - 是否重试（true/false）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 1,
        "post_id": 1,
        "post_title": "测试文案",
        "platform": "xiaohongshu",
        "status": "success",
        "xiaohongshu_id": "abc123",
        "note_url": "https://xiaohongshu.com/...",
        "retry_count": 0,
        "is_retry": 0,
        "duration_ms": 3500,
        "upload_duration_ms": 2000,
        "publish_duration_ms": 1500,
        "images_count": 3,
        "content_length": 500,
        "created_at": "2026-01-12 10:00:00"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

### 2.2 获取单条发布记录

```http
GET /api/publish-history/:id
```

### 2.3 获取发布统计

```http
GET /api/publish-stats?days=30&post_id=1
```

**查询参数**:
- `days` - 统计天数（默认30）
- `post_id` - 文案ID（可选）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "overall": {
      "total_attempts": 100,
      "successful": 95,
      "failed": 5,
      "retries": 3,
      "avg_duration_ms": 3500,
      "success_rate": "95.00"
    },
    "by_status": [
      {"status": "success", "count": 95, "avg_duration": 3400},
      {"status": "failed", "count": 5, "avg_duration": 4200}
    ],
    "error_analysis": [
      {
        "error_code": "NETWORK_ERROR",
        "error_message": "网络超时",
        "count": 3,
        "last_occurrence": "2026-01-12 10:00:00"
      }
    ],
    "daily_trend": [],
    "by_platform": [],
    "retry_stats": []
  }
}
```

### 2.4 获取每日统计

```http
GET /api/publish-stats/daily?days=7
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "stat_date": "2026-01-12",
      "total_attempts": 10,
      "successful_publishes": 9,
      "failed_publishes": 1,
      "total_retries": 1,
      "avg_duration_ms": 3500
    }
  ]
}
```

### 2.5 导出为CSV

```http
GET /api/publish-history/export?status=success&startDate=2026-01-01&endDate=2026-01-31&limit=10000
```

**响应**: CSV文件下载

### 2.6 清理旧记录

```http
POST /api/publish-history/cleanup
```

**请求体**:
```json
{
  "days": 90
}
```

---

## 3. 定时发布管理 API

### 3.1 创建定时任务

```http
POST /api/schedules
```

**请求体示例（一次性）**:
```json
{
  "post_id": 1,
  "schedule_type": "once",
  "scheduled_time": "2026-01-15 14:00:00",
  "max_retries": 3
}
```

**请求体示例（每日）**:
```json
{
  "post_id": 1,
  "schedule_type": "daily",
  "schedule_config": {
    "time": "09:00"
  },
  "max_retries": 3
}
```

**请求体示例（每周）**:
```json
{
  "post_id": 1,
  "schedule_type": "weekly",
  "schedule_config": {
    "dayOfWeek": 1,
    "time": "09:00"
  },
  "max_retries": 3
}
```

**请求体示例（每月）**:
```json
{
  "post_id": 1,
  "schedule_type": "monthly",
  "schedule_config": {
    "dayOfMonth": 15,
    "time": "09:00"
  },
  "max_retries": 3
}
```

**schedule_type**:
- `once` - 一次性
- `daily` - 每日
- `weekly` - 每周
- `monthly` - 每月

**schedule_config**:
- `time` - 时间（HH:MM格式）
- `dayOfWeek` - 星期几（0-6，0=周日）
- `dayOfMonth` - 每月第几天（1-28）

### 3.2 获取定时任务列表

```http
GET /api/schedules?status=pending&post_id=1&schedule_type=daily
```

**查询参数**:
- `status` - 任务状态（pending/completed/failed/cancelled）
- `post_id` - 文案ID
- `schedule_type` - 调度类型

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "post_id": 1,
      "post_title": "测试文案",
      "post_status": "draft",
      "schedule_type": "daily",
      "scheduled_time": "2026-01-15 09:00:00",
      "next_run_at": "2026-01-15 09:00:00",
      "schedule_config": {"time": "09:00"},
      "status": "pending",
      "retry_count": 0,
      "max_retries": 3,
      "last_error": null,
      "created_at": "2026-01-12 10:00:00"
    }
  ]
}
```

### 3.3 获取任务执行日志

```http
GET /api/schedules/:id/logs
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "scheduled_post_id": 1,
      "execution_time": "2026-01-15 09:00:00",
      "status": "success",
      "duration_ms": 3500,
      "publish_response": "{...}",
      "error_message": null
    }
  ]
}
```

### 3.4 更新定时任务

```http
PUT /api/schedules/:id
```

**请求体**:
```json
{
  "scheduled_time": "2026-01-15 10:00:00",
  "schedule_config": {"time": "10:00"},
  "max_retries": 5
}
```

### 3.5 取消定时任务

```http
POST /api/schedules/:id/cancel
```

### 3.6 手动执行任务（测试用）

```http
POST /api/schedules/:id/execute
```

### 3.7 删除定时任务

```http
DELETE /api/schedules/:id
```

---

## 4. 热点数据管理 API

### 4.1 搜索热点话题

```http
GET /api/trending?keyword=春节&platform=weibo&category=general&limit=50&sortBy=hot_score
```

**查询参数**:
- `keyword` - 关键词搜索
- `platform` - 平台筛选（weibo/baidu/toutiao/bilibili）
- `category` - 分类筛选
- `limit` - 返回数量（默认50）
- `sortBy` - 排序方式（hot_score/rank_position/last_updated_at）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "platform": "weibo",
      "topic_id": "weibo_春节",
      "title": "春节",
      "description": "春节相关话题",
      "url": "https://s.weibo.com/weibo?q=春节",
      "hot_score": 1000000,
      "rank_position": 1,
      "category": "general",
      "image_url": null,
      "view_count": 0,
      "is_active": 1,
      "last_updated_at": "2026-01-12 10:00:00",
      "created_at": "2026-01-12 10:00:00"
    }
  ]
}
```

### 4.2 获取指定平台热点

```http
GET /api/trending/:platform?limit=20
```

**参数**:
- `platform` - 平台标识（weibo/baidu/toutiao/bilibili）
- `limit` - 返回数量（默认20）

### 4.3 刷新热点数据

```http
POST /api/trending/refresh
```

**请求体（可选）**:
```json
{
  "platform": "weibo"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "platform": "weibo",
      "success": true,
      "topics_count": 50,
      "duration_ms": 1200
    }
  ],
  "refreshTime": "2026-01-12 10:00:00"
}
```

### 4.4 获取热点统计

```http
GET /api/trending/stats
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "by_platform": [
      {
        "platform": "weibo",
        "count": 50,
        "avg_score": 50000
      }
    ],
    "total": 200,
    "last_update": "2026-01-12 10:00:00"
  }
}
```

### 4.5 获取抓取日志

```http
GET /api/trending/logs?limit=50
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "platform": "weibo",
      "status": "success",
      "topics_count": 50,
      "duration_ms": 1200,
      "error_message": null,
      "fetch_time": "2026-01-12 10:00:00"
    }
  ]
}
```

### 4.6 关联热点到文案

```http
POST /api/trending/link
```

**请求体**:
```json
{
  "post_id": 1,
  "topic_id": 1
}
```

### 4.7 清理旧热点

```http
POST /api/trending/cleanup
```

**请求体**:
```json
{
  "days": 7
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "已清理 534 个旧热点",
  "count": 534
}
```

**说明**:
- 清理指定天数之前的热点数据
- 默认清理7天前的数据
- 返回清理的记录数量

---

## 5. 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 6. 前端集成建议

### 6.1 AI提供商管理页面

**功能点**:
- 提供商列表展示（卡片/表格）
- 启用/禁用开关
- 优先级拖拽排序
- 配置编辑弹窗（API密钥输入）
- 连接测试按钮
- 使用统计图表（按提供商、按模型、按操作）

### 6.2 发布历史页面

**功能点**:
- 历史记录表格（分页）
- 高级筛选器（状态、日期范围、文案ID）
- 统计Dashboard（成功率、平均耗时、趋势图）
- CSV导出按钮
- 错误分析面板
- 详情弹窗

### 6.3 定时发布页面

**功能点**:
- 任务创建向导（分步表单）
- 任务列表（支持筛选、搜索）
- 日历视图（显示未来任务）
- 任务操作（编辑、取消、删除、手动执行）
- 执行日志查看
- 状态标签（pending/running/completed/failed）

### 6.4 热点数据中心

**功能点**:
- 多平台切换Tab
- 热点列表（卡片/列表视图）
- 关键词搜索
- 刷新按钮（显示刷新时间）
- 热度排名显示
- 关联到文案功能（弹窗选择文案）
- 统计仪表盘

---

## 7. WebSocket 支持（未来扩展）

未来可添加WebSocket支持实时推送：
- 定时任务执行状态更新
- 热点数据自动刷新
- AI使用实时监控

---

## 8. 性能建议

- 使用分页查询避免一次加载大量数据
- 热点数据刷新建议最小间隔5分钟
- 使用缓存减少重复请求
- 统计数据可使用图表库（ECharts/Chart.js）

---

## 附录: 完整的API端点列表

### AI提供商管理 (10个)
```
GET    /api/ai/providers/supported
GET    /api/ai/providers
GET    /api/ai/providers/:provider
PUT    /api/ai/providers/:provider
DELETE /api/ai/providers/:provider
POST   /api/ai/providers/:provider/toggle
POST   /api/ai/providers/:provider/priority
POST   /api/ai/providers/:provider/test
POST   /api/ai/providers/cache/clear
GET    /api/ai/usage-stats
```

### 发布历史管理 (6个)
```
GET    /api/publish-history
GET    /api/publish-history/:id
GET    /api/publish-history/export
POST   /api/publish-history/cleanup
GET    /api/publish-stats
GET    /api/publish-stats/daily
```

### 定时发布管理 (7个)
```
POST   /api/schedules
GET    /api/schedules
GET    /api/schedules/:id/logs
PUT    /api/schedules/:id
POST   /api/schedules/:id/cancel
POST   /api/schedules/:id/execute
DELETE /api/schedules/:id
```

### 热点数据管理 (7个)
```
GET    /api/trending
GET    /api/trending/:platform
POST   /api/trending/refresh
GET    /api/trending/stats
GET    /api/trending/logs
POST   /api/trending/link
POST   /api/trending/cleanup
```

**总计: 30个新增API端点**
