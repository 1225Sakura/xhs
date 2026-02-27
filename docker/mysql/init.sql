-- 小红书发布系统 - MySQL数据库初始化脚本
-- 版本: 3.0 (云端多用户版本)

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 用户系统表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  role ENUM('super_admin', 'admin', 'user', 'guest') DEFAULT 'user' COMMENT '角色',
  balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '余额',
  status ENUM('active', 'disabled', 'suspended') DEFAULT 'active' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
  last_login_ip VARCHAR(45) NULL COMMENT '最后登录IP',
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 余额记录表
CREATE TABLE IF NOT EXISTS balance_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '金额（正数为增加，负数为减少）',
  type ENUM('recharge', 'consume', 'refund', 'adjust') NOT NULL COMMENT '类型',
  description VARCHAR(255) COMMENT '描述',
  balance_before DECIMAL(10,2) NOT NULL COMMENT '操作前余额',
  balance_after DECIMAL(10,2) NOT NULL COMMENT '操作后余额',
  operator_id INT NULL COMMENT '操作员ID（管理员充值时记录）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='余额记录表';

-- ============================================
-- 2. 业务数据表（添加用户隔离）
-- ============================================

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  title TEXT NOT NULL COMMENT '标题',
  content TEXT NOT NULL COMMENT '内容',
  category TEXT COMMENT '分类',
  tags TEXT COMMENT '标签（JSON数组）',
  source_file TEXT COMMENT '源文件路径',
  file_type TEXT COMMENT '文件类型',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_category (category(100)),
  INDEX idx_created_at (created_at),
  FULLTEXT idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库表';

-- 产品表
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
