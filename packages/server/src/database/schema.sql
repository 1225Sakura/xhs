-- 云端数据库架构设计
-- PostgreSQL 15+

-- 1. 客户端表
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  machine_id VARCHAR(255) NOT NULL,
  license_key VARCHAR(255),
  version VARCHAR(50),
  os VARCHAR(50),
  status VARCHAR(20) DEFAULT 'offline', -- online, offline, suspended
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_license_key (license_key)
);

-- 2. 许可证表
CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(255) UNIQUE NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  plan_type VARCHAR(50), -- basic, pro, enterprise
  max_clients INTEGER DEFAULT 1,
  features JSONB, -- {"ai": true, "publish": true, "schedule": true}
  expires_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active', -- active, expired, suspended
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_license_key (license_key),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);

-- 3. 客户端配置表
CREATE TABLE client_configs (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  config JSONB NOT NULL, -- 配置JSON
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id)
);

-- 4. 心跳记录表
CREATE TABLE heartbeats (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  status VARCHAR(20),
  metrics JSONB, -- {"cpu": 45.2, "memory": 1024, "uptime": 3600}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id),
  INDEX idx_created_at (created_at)
);

-- 5. 数据同步队列表
CREATE TABLE sync_queue (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  data_type VARCHAR(50), -- posts, products, knowledge
  action VARCHAR(20), -- create, update, delete
  data JSONB NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id),
  INDEX idx_synced (synced),
  INDEX idx_created_at (created_at)
);

-- 6. 指标数据表
CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  metric_name VARCHAR(100),
  metric_value DOUBLE PRECISION,
  labels JSONB,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id),
  INDEX idx_metric_name (metric_name),
  INDEX idx_timestamp (timestamp)
);

-- 7. 控制命令表
CREATE TABLE control_commands (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  command VARCHAR(50) NOT NULL,
  params JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, executed, failed
  result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 8. 用户表（仪表盘用户）
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user', -- admin, user
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email)
);

-- 9. 审计日志表
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  client_id VARCHAR(255),
  action VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_client_id (client_id),
  INDEX idx_created_at (created_at)
);

-- 10. 使用统计表
CREATE TABLE usage_stats (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  stat_date DATE NOT NULL,
  ai_requests INTEGER DEFAULT 0,
  posts_created INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  UNIQUE (client_id, stat_date),
  INDEX idx_client_id (client_id),
  INDEX idx_stat_date (stat_date)
);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_configs_updated_at BEFORE UPDATE ON client_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建视图：客户端状态概览
CREATE VIEW client_status_overview AS
SELECT
  c.client_id,
  c.status,
  c.version,
  c.last_seen,
  l.plan_type,
  l.expires_at,
  COUNT(DISTINCT h.id) as heartbeat_count
FROM clients c
LEFT JOIN licenses l ON c.license_key = l.license_key
LEFT JOIN heartbeats h ON c.client_id = h.client_id
  AND h.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.client_id, c.status, c.version, c.last_seen, l.plan_type, l.expires_at;

-- 创建视图：使用统计汇总
CREATE VIEW usage_summary AS
SELECT
  client_id,
  DATE_TRUNC('month', stat_date) as month,
  SUM(ai_requests) as total_ai_requests,
  SUM(posts_created) as total_posts_created,
  SUM(posts_published) as total_posts_published
FROM usage_stats
GROUP BY client_id, DATE_TRUNC('month', stat_date);
