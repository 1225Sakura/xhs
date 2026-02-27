const mqtt = require('mqtt');
const logger = require('../utils/logger');

class MQTTService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscribers = new Map();
  }

  // 连接到MQTT broker
  connect() {
    const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
    const options = {
      clientId: `xhs-server-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000
    };

    this.client = mqtt.connect(mqttUrl, options);

    this.client.on('connect', () => {
      logger.info('MQTT connected');
      this.connected = true;

      // 订阅所有客户端的主题
      this.client.subscribe('xhs/+/sync', (err) => {
        if (err) {
          logger.error('Failed to subscribe to sync topic:', err);
        }
      });

      this.client.subscribe('xhs/+/metrics', (err) => {
        if (err) {
          logger.error('Failed to subscribe to metrics topic:', err);
        }
      });
    });

    this.client.on('error', (err) => {
      logger.error('MQTT error:', err);
      this.connected = false;
    });

    this.client.on('close', () => {
      logger.warn('MQTT connection closed');
      this.connected = false;
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  // 处理接收到的消息
  handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      logger.debug('MQTT message received:', { topic, data });

      // 通知订阅者
      if (this.subscribers.has(topic)) {
        const handlers = this.subscribers.get(topic);
        handlers.forEach(handler => handler(data));
      }

      // 处理特定主题
      if (topic.includes('/sync')) {
        this.handleSyncMessage(topic, data);
      } else if (topic.includes('/metrics')) {
        this.handleMetricsMessage(topic, data);
      }
    } catch (error) {
      logger.error('Failed to handle MQTT message:', error);
    }
  }

  // 处理同步消息
  handleSyncMessage(topic, data) {
    // 这里可以将同步数据保存到数据库
    logger.info('Sync message received:', { topic, clientId: data.clientId });
  }

  // 处理指标消息
  handleMetricsMessage(topic, data) {
    // 这里可以将指标数据保存到数据库或Prometheus
    logger.info('Metrics message received:', { topic, clientId: data.clientId });
  }

  // 发布消息
  publish(topic, message) {
    if (!this.connected) {
      logger.warn('MQTT not connected, message not sent');
      return false;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        logger.error('Failed to publish message:', err);
      }
    });

    return true;
  }

  // 发送配置更新
  sendConfigUpdate(clientId, config) {
    const topic = `xhs/config/${clientId}`;
    return this.publish(topic, config);
  }

  // 发送控制命令
  sendControlCommand(clientId, command) {
    const topic = `xhs/control/${clientId}`;
    return this.publish(topic, command);
  }

  // 订阅主题
  subscribe(topic, handler) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    this.subscribers.get(topic).push(handler);

    if (this.connected) {
      this.client.subscribe(topic);
    }
  }

  // 取消订阅
  unsubscribe(topic, handler) {
    if (this.subscribers.has(topic)) {
      const handlers = this.subscribers.get(topic);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }

      if (handlers.length === 0) {
        this.subscribers.delete(topic);
        if (this.connected) {
          this.client.unsubscribe(topic);
        }
      }
    }
  }

  // 断开连接
  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
      logger.info('MQTT disconnected');
    }
  }
}

module.exports = new MQTTService();
