import db from '../models/database.js';

/**
 * 账号管理服务
 */
class AccountService {
  /**
   * 获取所有账号列表
   */
  getAllAccounts() {
    return db.prepare(`
      SELECT id, account_name, phone, email, nickname, avatar_url, xhs_user_id,
             is_active, is_primary, login_status, last_login_at,
             main_site_login_status, main_site_last_login_at,
             created_at, updated_at
      FROM xhs_accounts
      ORDER BY is_primary DESC, created_at DESC
    `).all();
  }

  /**
   * 获取单个账号详情
   */
  getAccountById(id) {
    return db.prepare(`
      SELECT id, account_name, phone, email, nickname, avatar_url, xhs_user_id,
             is_active, is_primary, login_status, last_login_at,
             main_site_login_status, main_site_last_login_at,
             created_at, updated_at
      FROM xhs_accounts
      WHERE id = ?
    `).get(id);
  }

  /**
   * 获取当前激活的主账号
   */
  getPrimaryAccount() {
    return db.prepare(`
      SELECT id, account_name, phone, email, nickname, avatar_url, xhs_user_id,
             cookies, is_active, is_primary, login_status, last_login_at,
             created_at, updated_at
      FROM xhs_accounts
      WHERE is_primary = 1 AND is_active = 1
      LIMIT 1
    `).get();
  }

  /**
   * 创建新账号
   */
  createAccount(accountData) {
    const {
      account_name,
      phone = null,
      email = null,
      nickname = null,
      avatar_url = null,
      xhs_user_id = null,
      cookies = null,
      is_primary = 0
    } = accountData;

    // 如果设置为主账号，先取消其他主账号
    if (is_primary) {
      db.prepare(`UPDATE xhs_accounts SET is_primary = 0`).run();
    }

    const result = db.prepare(`
      INSERT INTO xhs_accounts (
        account_name, phone, email, nickname, avatar_url, xhs_user_id,
        cookies, is_primary, is_active, login_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'unknown')
    `).run(account_name, phone, email, nickname, avatar_url, xhs_user_id, cookies, is_primary);

    return this.getAccountById(result.lastInsertRowid);
  }

  /**
   * 更新账号信息
   */
  updateAccount(id, updates) {
    const allowedFields = [
      'account_name', 'phone', 'email', 'nickname',
      'avatar_url', 'xhs_user_id', 'cookies', 'is_active', 'login_status'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('没有有效的更新字段');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE xhs_accounts
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);

    return this.getAccountById(id);
  }

  /**
   * 设置主账号
   */
  setPrimaryAccount(id) {
    // 先取消其他主账号
    db.prepare(`UPDATE xhs_accounts SET is_primary = 0`).run();

    // 设置新主账号
    db.prepare(`
      UPDATE xhs_accounts
      SET is_primary = 1, is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    return this.getAccountById(id);
  }

  /**
   * 切换账号激活状态
   */
  toggleAccountStatus(id) {
    const account = this.getAccountById(id);
    if (!account) {
      throw new Error('账号不存在');
    }

    // 如果是主账号，不能停用
    if (account.is_primary && account.is_active) {
      throw new Error('主账号不能停用，请先切换主账号');
    }

    const newStatus = account.is_active ? 0 : 1;

    db.prepare(`
      UPDATE xhs_accounts
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, id);

    return this.getAccountById(id);
  }

  /**
   * 删除账号
   */
  deleteAccount(id) {
    const account = this.getAccountById(id);
    if (!account) {
      throw new Error('账号不存在');
    }

    // 如果是主账号，不能删除
    if (account.is_primary) {
      throw new Error('主账号不能删除，请先切换主账号');
    }

    db.prepare(`DELETE FROM xhs_accounts WHERE id = ?`).run(id);
    return { success: true };
  }

  /**
   * 更新账号登录状态
   */
  updateLoginStatus(id, status, cookies = null) {
    const updates = {
      login_status: status,
      last_login_at: new Date().toISOString()
    };

    if (cookies) {
      updates.cookies = cookies;
    }

    db.prepare(`
      UPDATE xhs_accounts
      SET login_status = ?,
          last_login_at = ?,
          ${cookies ? 'cookies = ?,' : ''}
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status,
      updates.last_login_at,
      ...(cookies ? [cookies, id] : [id])
    );

    return this.getAccountById(id);
  }

  /**
   * 同步账号信息（如果不存在则创建，存在则更新）
   */
  syncAccount(accountName, accountInfo = {}) {
    // 检查账号是否已存在
    const existing = db.prepare(`
      SELECT id FROM xhs_accounts WHERE account_name = ?
    `).get(accountName);

    if (existing) {
      // 更新现有账号
      const updates = {
        login_status: 'logged_in',
        last_login_at: new Date().toISOString(),
        ...accountInfo
      };

      const fields = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(existing.id);

      db.prepare(`
        UPDATE xhs_accounts
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);

      return this.getAccountById(existing.id);
    } else {
      // 创建新账号
      return this.createAccount({
        account_name: accountName,
        login_status: 'logged_in',
        is_primary: 1, // 第一个登录的账号设为主账号
        ...accountInfo
      });
    }
  }

  /**
   * 记录账号使用日志
   */
  logAccountUsage(accountId, actionType, postId = null, success = true, errorMessage = null) {
    db.prepare(`
      INSERT INTO account_usage_logs (
        account_id, action_type, post_id, success, error_message
      ) VALUES (?, ?, ?, ?, ?)
    `).run(accountId, actionType, postId, success ? 1 : 0, errorMessage);
  }

  /**
   * 获取账号使用统计
   */
  getAccountStats(accountId) {
    // 获取基本统计
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_actions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_actions,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_actions
      FROM account_usage_logs
      WHERE account_id = ?
    `).get(accountId);

    // 获取最近活动
    const recentActivities = db.prepare(`
      SELECT
        action_type,
        post_id,
        success,
        error_message,
        created_at
      FROM account_usage_logs
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(accountId);

    return {
      ...stats,
      recent_activities: recentActivities
    };
  }

  /**
   * 获取所有账号的使用统计
   */
  getAllAccountsStats() {
    return db.prepare(`
      SELECT
        a.id,
        a.account_name,
        a.is_primary,
        a.is_active,
        a.login_status,
        COUNT(l.id) as total_actions,
        SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END) as successful_actions,
        SUM(CASE WHEN l.success = 0 THEN 1 ELSE 0 END) as failed_actions,
        MAX(l.created_at) as last_action_at
      FROM xhs_accounts a
      LEFT JOIN account_usage_logs l ON a.id = l.account_id
      GROUP BY a.id
      ORDER BY a.is_primary DESC, a.created_at DESC
    `).all();
  }
}

export default new AccountService();
