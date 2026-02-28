# 监控系统部署指南

## 概述

本系统集成了完整的监控栈，包括：
- **Prometheus**: 指标收集和存储
- **Grafana**: 可视化仪表盘
- **AlertManager**: 告警管理
- **Node Exporter**: 系统指标
- **PostgreSQL Exporter**: 数据库指标
- **Redis Exporter**: 缓存指标

## 快速开始

### 1. 环境准备

创建 `.env` 文件：

```bash
# 数据库密码
POSTGRES_PASSWORD=your_secure_password

# JWT密钥
JWT_SECRET=your_jwt_secret_key

# Grafana管理员账号
GRAFANA_USER=admin
GRAFANA_PASSWORD=your_grafana_password
```

### 2. 启动监控栈

```bash
# 启动所有服务
docker-compose -f docker-compose.monitoring.yml up -d

# 查看服务状态
docker-compose -f docker-compose.monitoring.yml ps

# 查看日志
docker-compose -f docker-compose.monitoring.yml logs -f
```

### 3. 访问服务

- **应用服务器**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (默认账号: admin/admin)
- **AlertManager**: http://localhost:9093
- **EMQX Dashboard**: http://localhost:18083 (默认账号: admin/public)

## 指标说明

### 客户端指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `xhs_clients_total` | Gauge | 客户端总数 |
| `xhs_clients_online` | Gauge | 在线客户端数 |
| `xhs_client_heartbeats_total` | Counter | 心跳总数 |

### HTTP指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `xhs_http_requests_total` | Counter | HTTP请求总数 |
| `xhs_http_request_duration_seconds` | Histogram | HTTP请求延迟 |

### 数据同步指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `xhs_sync_operations_total` | Counter | 同步操作总数 |
| `xhs_sync_queue_size` | Gauge | 同步队列大小 |

### 许可证指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `xhs_licenses_total` | Gauge | 许可证总数 |
| `xhs_license_verifications_total` | Counter | 许可证验证次数 |

### 业务指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `xhs_ai_requests_total` | Counter | AI请求总数 |
| `xhs_posts_created_total` | Counter | 文章创建总数 |
| `xhs_posts_published_total` | Counter | 文章发布总数 |

### MQTT指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `xhs_mqtt_messages_published_total` | Counter | MQTT消息发布数 |
| `xhs_mqtt_messages_received_total` | Counter | MQTT消息接收数 |
| `xhs_mqtt_connection_status` | Gauge | MQTT连接状态 |

## Grafana仪表盘

### 导入仪表盘

1. 登录Grafana (http://localhost:3001)
2. 点击左侧菜单 "+" -> "Import"
3. 导入以下仪表盘配置文件：
   - `packages/server/grafana/dashboards/client-monitoring.json` - 客户端监控
   - `packages/server/grafana/dashboards/business-metrics.json` - 业务指标

### 配置数据源

1. 点击左侧菜单 "Configuration" -> "Data Sources"
2. 添加Prometheus数据源：
   - Name: Prometheus
   - URL: http://prometheus:9090
   - Access: Server (default)
3. 点击 "Save & Test"

## 告警配置

### 告警规则

告警规则定义在 `packages/server/prometheus/alerts.yml`，包括：

**严重告警 (Critical)**:
- MQTT连接断开
- HTTP 5xx错误率过高
- 严重错误发生

**警告告警 (Warning)**:
- 客户端离线
- HTTP延迟过高
- 数据库延迟过高
- 同步队列积压
- 许可证验证失败率高

**信息告警 (Info)**:
- 没有AI请求
- 没有文章发布

### 告警通知

编辑 `packages/server/prometheus/alertmanager.yml` 配置通知方式：

**邮件通知**:
```yaml
smtp_smarthost: 'smtp.example.com:587'
smtp_from: 'alertmanager@example.com'
smtp_auth_username: 'alertmanager@example.com'
smtp_auth_password: 'password'
```

**Webhook通知**:
```yaml
webhook_configs:
  - url: 'http://xhs-server:3000/api/v1/alerts/webhook'
```

**Slack通知** (可选):
```yaml
slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts'
```

## 常用查询

### Prometheus查询示例

```promql
# 在线客户端数
xhs_clients_online

# HTTP请求速率（每秒）
rate(xhs_http_requests_total[5m])

# HTTP P95延迟
histogram_quantile(0.95, rate(xhs_http_request_duration_seconds_bucket[5m]))

# 错误率
rate(xhs_errors_total[5m])

# 同步队列积压
xhs_sync_queue_size > 100

# AI请求Top 10客户端
topk(10, sum by (client_id) (xhs_ai_requests_total))
```

## 性能优化

### Prometheus存储优化

编辑 `prometheus.yml` 添加：

```yaml
global:
  scrape_interval: 30s  # 降低抓取频率

storage:
  tsdb:
    retention.time: 15d  # 保留15天数据
    retention.size: 10GB # 最大存储10GB
```

### 指标采样

对于高基数指标，可以使用采样：

```javascript
// 只记录10%的请求
if (Math.random() < 0.1) {
  metricsService.recordHttpRequest(method, route, statusCode, duration);
}
```

## 故障排查

### 查看Prometheus目标状态

访问 http://localhost:9090/targets 查看所有抓取目标的状态。

### 查看告警状态

访问 http://localhost:9090/alerts 查看所有告警规则的状态。

### 查看日志

```bash
# 查看服务器日志
docker-compose -f docker-compose.monitoring.yml logs xhs-server

# 查看Prometheus日志
docker-compose -f docker-compose.monitoring.yml logs prometheus

# 查看Grafana日志
docker-compose -f docker-compose.monitoring.yml logs grafana
```

### 重启服务

```bash
# 重启单个服务
docker-compose -f docker-compose.monitoring.yml restart xhs-server

# 重启所有服务
docker-compose -f docker-compose.monitoring.yml restart
```

## 生产环境建议

1. **使用外部数据库**: 不要在容器中运行PostgreSQL，使用云数据库服务
2. **配置持久化存储**: 确保所有数据卷都有备份
3. **启用HTTPS**: 使用Nginx反向代理并配置SSL证书
4. **配置防火墙**: 只开放必要的端口
5. **定期备份**: 备份Prometheus数据和Grafana配置
6. **监控监控系统**: 使用外部服务监控Prometheus和Grafana的可用性
7. **配置告警**: 确保告警通知能够及时送达
8. **日志轮转**: 配置日志轮转避免磁盘占满

## 扩展

### 添加自定义指标

在 `packages/server/src/services/metricsService.js` 中添加：

```javascript
this.customMetric = new client.Counter({
  name: 'xhs_custom_metric_total',
  help: 'Custom metric description',
  labelNames: ['label1', 'label2'],
  registers: [this.register]
});
```

### 添加自定义告警

在 `packages/server/prometheus/alerts.yml` 中添加：

```yaml
- alert: CustomAlert
  expr: xhs_custom_metric_total > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Custom alert triggered"
    description: "Custom metric exceeded threshold"
```

## 参考资料

- [Prometheus文档](https://prometheus.io/docs/)
- [Grafana文档](https://grafana.com/docs/)
- [AlertManager文档](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
