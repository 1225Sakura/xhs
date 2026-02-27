# 云端API接口设计文档

## 1. 客户端管理API

### 1.1 客户端注册
```
POST /api/v1/clients/register
```

**请求体：**
```json
{
  "clientId": "unique-client-id",
  "machineId": "machine-hardware-id",
  "version": "2.0.0",
  "os": "win32",
  "licenseKey": "license-key-string"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "clientId": "unique-client-id",
    "token": "jwt-token",
    "config": {
      "syncInterval": 30000,
      "features": ["ai", "publish", "schedule"]
    }
  }
}
```

### 1.2 客户端心跳
```
POST /api/v1/clients/heartbeat
```

**请求头：**
```
Authorization: Bearer <jwt-token>
```

**请求体：**
```json
{
  "clientId": "unique-client-id",
  "status": "online",
  "metrics": {
    "cpu": 45.2,
    "memory": 1024,
    "uptime": 3600
  }
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "serverTime": 1234567890,
    "commands": []
  }
}
```

### 1.3 获取客户端列表
```
GET /api/v1/clients
```

**查询参数：**
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `status`: 状态筛选（online/offline/all）

**响应：**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "clientId": "client-1",
        "status": "online",
        "lastSeen": "2024-01-01T00:00:00Z",
        "version": "2.0.0"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

## 2. 配置管理API

### 2.1 获取配置
```
GET /api/v1/config/:clientId
```

**响应：**
```json
{
  "success": true,
  "data": {
    "aiProvider": "deepseek",
    "autoPublish": false,
    "syncInterval": 30000
  }
}
```

### 2.2 更新配置
```
PUT /api/v1/config/:clientId
```

**请求体：**
```json
{
  "aiProvider": "deepseek",
  "autoPublish": true
}
```

## 3. 数据同步API

### 3.1 上报数据
```
POST /api/v1/sync/upload
```

**请求体：**
```json
{
  "clientId": "client-1",
  "dataType": "posts",
  "data": [
    {
      "id": "post-1",
      "title": "标题",
      "content": "内容",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3.2 下载数据
```
GET /api/v1/sync/download/:clientId
```

**查询参数：**
- `since`: 时间戳，获取此时间之后的数据

## 4. 指标上报API

### 4.1 上报Prometheus指标
```
POST /api/v1/metrics
```

**请求体：**
```json
{
  "clientId": "client-1",
  "timestamp": 1234567890,
  "metrics": "# Prometheus格式的指标数据"
}
```

### 4.2 获取指标
```
GET /api/v1/metrics/:clientId
```

## 5. 远程控制API

### 5.1 发送控制命令
```
POST /api/v1/control/:clientId
```

**请求体：**
```json
{
  "command": "restart",
  "params": {}
}
```

支持的命令：
- `restart`: 重启客户端
- `update_config`: 更新配置
- `clear_cache`: 清除缓存
- `sync_now`: 立即同步

## 6. 许可证管理API

### 6.1 验证许可证
```
POST /api/v1/license/verify
```

**请求体：**
```json
{
  "licenseKey": "license-key-string",
  "machineId": "machine-id"
}
```

### 6.2 获取许可证信息
```
GET /api/v1/license/:licenseKey
```

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

## 错误码

- `AUTH_FAILED`: 认证失败
- `INVALID_LICENSE`: 无效许可证
- `CLIENT_NOT_FOUND`: 客户端不存在
- `RATE_LIMIT_EXCEEDED`: 请求频率超限
- `INTERNAL_ERROR`: 服务器内部错误
