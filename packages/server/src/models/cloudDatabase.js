const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// 创建PostgreSQL连接池
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'xhs_cloud',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
pool.on('connect', () => {
  logger.info('PostgreSQL connected');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL connection error:', err);
});

// 初始化数据库
async function initDatabase() {
  const client = await pool.connect();
  try {
    logger.info('Initializing database schema...');

    // 读取schema.sql文件
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 执行schema
    await client.query(schema);

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行查询
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', { text, error: error.message });
    throw error;
  }
}

// 执行事务
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 关闭连接池
async function close() {
  await pool.end();
  logger.info('PostgreSQL connection pool closed');
}

module.exports = {
  pool,
  query,
  transaction,
  initDatabase,
  close
};
