-- 账户管理表
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL UNIQUE,  -- 账户名称（用户自定义）
  phone TEXT,  -- 手机号（可选）
  cookies TEXT,  -- 登录 cookies（JSON 格式）
  is_active INTEGER DEFAULT 0,  -- 是否为当前活跃账户（0=否，1=是）
  is_logged_in INTEGER DEFAULT 0,  -- 是否已登录（0=否，1=是）
  last_login_at DATETIME,  -- 最后登录时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 确保只有一个活跃账户
CREATE TRIGGER IF NOT EXISTS ensure_single_active_account
AFTER UPDATE OF is_active ON accounts
WHEN NEW.is_active = 1
BEGIN
  UPDATE accounts SET is_active = 0 WHERE id != NEW.id;
END;

-- 更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_accounts_timestamp
AFTER UPDATE ON accounts
BEGIN
  UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
