const client = require('prom-client');
const logger = require('../utils/logger');

class MetricsService {
  constructor() {
    // 创建默认注册表
    this.register = new client.Registry();

    // 添加默认指标（CPU、内存等）
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'xhs_server_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // 初始化自定义指标
    this.initCustomMetrics();
  }

  // 初始化自定义指标
  initCustomMetrics() {
    // 1. 客户端相关指标
    this.clientsTotal = new client.Gauge({
      name: 'xhs_clients_total',
      help: 'Total number of registered clients',
      labelNames: ['status'],
      registers: [this.register]
    });

    this.clientsOnline = new client.Gauge({
      name: 'xhs_clients_online',
      help: 'Number of online clients',
      registers: [this.register]
    });

    this.clientHeartbeats = new client.Counter({
      name: 'xhs_client_heartbeats_total',
      help: 'Total number of client heartbeats',
      labelNames: ['client_id'],
      registers: [this.register]
    });

    // 2. API请求指标
    this.httpRequestsTotal = new client.Counter({
      name: 'xhs_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'xhs_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    // 3. 数据同步指标
    this.syncOperations = new client.Counter({
      name: 'xhs_sync_operations_total',
      help: 'Total number of sync operations',
      labelNames: ['client_id', 'data_type', 'operation'],
      registers: [this.register]
    });

    this.syncQueueSize = new client.Gauge({
      name: 'xhs_sync_queue_size',
      help: 'Current size of sync queue',
      labelNames: ['client_id'],
      registers: [this.register]
    });

    // 4. 许可证指标
    this.licensesTotal = new client.Gauge({
      name: 'xhs_licenses_total',
      help: 'Total number of licenses',
      labelNames: ['status', 'plan_type'],
      registers: [this.register]
    });

    this.licenseVerifications = new client.Counter({
      name: 'xhs_license_verifications_total',
      help: 'Total number of license verifications',
      labelNames: ['result'],
      registers: [this.register]
    });

    // 5. 数据库指标
    this.dbQueryDuration = new client.Histogram({
      name: 'xhs_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.register]
    });

    this.dbConnectionsActive = new client.Gauge({
      name: 'xhs_db_connections_active',
      help: 'Number of active database connections',
      registers: [this.register]
    });

    // 6. MQTT指标
    this.mqttMessagesPublished = new client.Counter({
      name: 'xhs_mqtt_messages_published_total',
      help: 'Total number of MQTT messages published',
      labelNames: ['topic'],
      registers: [this.register]
    });

    this.mqttMessagesReceived = new client.Counter({
      name: 'xhs_mqtt_messages_received_total',
      help: 'Total number of MQTT messages received',
      labelNames: ['topic'],
      registers: [this.register]
    });

    this.mqttConnectionStatus = new client.Gauge({
      name: 'xhs_mqtt_connection_status',
      help: 'MQTT connection status (1=connected, 0=disconnected)',
      registers: [this.register]
    });

    // 7. 业务指标
    this.aiRequestsTotal = new client.Counter({
      name: 'xhs_ai_requests_total',
      help: 'Total number of AI requests',
      labelNames: ['client_id', 'provider'],
      registers: [this.register]
    });

    this.postsCreated = new client.Counter({
      name: 'xhs_posts_created_total',
      help: 'Total number of posts created',
      labelNames: ['client_id'],
      registers: [this.register]
    });

    this.postsPublished = new client.Counter({
      name: 'xhs_posts_published_total',
      help: 'Total number of posts published',
      labelNames: ['client_id', 'status'],
      registers: [this.register]
    });

    // 8. 错误指标
    this.errorsTotal = new client.Counter({
      name: 'xhs_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
      registers: [this.register]
    });
  }

  // 记录HTTP请求
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  // 记录客户端心跳
  recordClientHeartbeat(clientId) {
    this.clientHeartbeats.inc({ client_id: clientId });
  }

  // 更新客户端统计
  updateClientStats(total, online) {
    this.clientsTotal.set({ status: 'all' }, total);
    this.clientsOnline.set(online);
  }

  // 记录同步操作
  recordSyncOperation(clientId, dataType, operation) {
    this.syncOperations.inc({ client_id: clientId, data_type: dataType, operation });
  }

  // 更新同步队列大小
  updateSyncQueueSize(clientId, size) {
    this.syncQueueSize.set({ client_id: clientId }, size);
  }

  // 记录许可证验证
  recordLicenseVerification(result) {
    this.licenseVerifications.inc({ result });
  }

  // 更新许可证统计
  updateLicenseStats(status, planType, count) {
    this.licensesTotal.set({ status, plan_type: planType }, count);
  }

  // 记录数据库查询
  recordDbQuery(operation, duration) {
    this.dbQueryDuration.observe({ operation }, duration);
  }

  // 更新数据库连接数
  updateDbConnections(count) {
    this.dbConnectionsActive.set(count);
  }

  // 记录MQTT消息
  recordMqttPublish(topic) {
    this.mqttMessagesPublished.inc({ topic });
  }

  recordMqttReceive(topic) {
    this.mqttMessagesReceived.inc({ topic });
  }

  // 更新MQTT连接状态
  updateMqttStatus(connected) {
    this.mqttConnectionStatus.set(connected ? 1 : 0);
  }

  // 记录AI请求
  recordAiRequest(clientId, provider) {
    this.aiRequestsTotal.inc({ client_id: clientId, provider });
  }

  // 记录文章创建
  recordPostCreated(clientId) {
    this.postsCreated.inc({ client_id: clientId });
  }

  // 记录文章发布
  recordPostPublished(clientId, status) {
    this.postsPublished.inc({ client_id: clientId, status });
  }

  // 记录错误
  recordError(type, severity = 'error') {
    this.errorsTotal.inc({ type, severity });
  }

  // 获取所有指标
  async getMetrics() {
    return this.register.metrics();
  }

  // 获取指标的内容类型
  getContentType() {
    return this.register.contentType;
  }

  // 重置所有指标
  resetMetrics() {
    this.register.resetMetrics();
  }
}

module.exports = new MetricsService();
