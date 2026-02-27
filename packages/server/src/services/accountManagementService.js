/**
 * 账户管理服务
 * 支持多账户切换和管理
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

class AccountManagementService {
  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'knowledge.db');
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  /**
   * 初始化数据库表
   */
  initDatabase() {
    // xhs_accounts表已在主数据库中创建，这里只需确保连接正常
    console.log('✅ 账户管理数据库初始化完成');
  }

  /**
   * 获取所有账户
   */
  getAllAccounts() {
    const stmt = this.db.prepare(`
      SELECT id, account_name, phone, email, nickname, avatar_url, xhs_user_id,
             is_active, is_primary, login_status, last_login_at,
             main_site_login_status, main_site_last_login_at,
             created_at, updated_at
      FROM xhs_accounts
      ORDER BY is_active DESC, last_login_at DESC
    `);
    return stmt.all();
  }

  /**
   * 获取当前活跃账户
   */
  getActiveAccount() {
    const stmt = this.db.prepare(`
      SELECT * FROM xhs_accounts WHERE is_active = 1 LIMIT 1
    `);
    return stmt.get();
  }

  /**
   * 根据 ID 获取账户
   */
  getAccountById(id) {
    const stmt = this.db.prepare(`
      SELECT * FROM xhs_accounts WHERE id = ?
    `);
    return stmt.get(id);
  }

  /**
   * 创建新账户
   */
  createAccount(accountName, phone = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO xhs_accounts (account_name, phone)
        VALUES (?, ?)
      `);
      const result = stmt.run(accountName, phone);

      console.log(`✅ 创建账户成功: ${accountName} (ID: ${result.lastInsertRowid})`);
      return {
        success: true,
        accountId: result.lastInsertRowid
      };
    } catch (error) {
      console.error('❌ 创建账户失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新账号信息（昵称、头像等）
   */
  updateAccountInfo(accountId, info) {
    try {
      const updates = [];
      const values = [];

      if (info.nickname !== undefined) {
        updates.push('nickname = ?');
        values.push(info.nickname);
      }
      if (info.account_name !== undefined) {
        updates.push('account_name = ?');
        values.push(info.account_name);
      }
      if (info.avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        values.push(info.avatar_url);
      }
      if (info.xhs_user_id !== undefined) {
        updates.push('xhs_user_id = ?');
        values.push(info.xhs_user_id);
      }

      if (updates.length === 0) {
        return { success: true, message: '没有需要更新的信息' };
      }

      values.push(accountId);
      const stmt = this.db.prepare(`
        UPDATE xhs_accounts
        SET ${updates.join(', ')}
        WHERE id = ?
      `);
      stmt.run(...values);

      console.log(`✅ 更新账户信息成功: ID=${accountId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ 更新账户信息失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 切换活跃账户
   */
  switchAccount(accountId) {
    try {
      // 检查账户是否存在
      const account = this.getAccountById(accountId);
      if (!account) {
        return {
          success: false,
          error: '账户不存在'
        };
      }

      // 设置为活跃账户（触发器会自动取消其他账户的活跃状态）
      const stmt = this.db.prepare(`
        UPDATE xhs_accounts SET is_active = 1 WHERE id = ?
      `);
      stmt.run(accountId);

      console.log(`✅ 切换到账户: ${account.account_name} (ID: ${accountId})`);
      return {
        success: true,
        account: this.getAccountById(accountId)
      };
    } catch (error) {
      console.error('❌ 切换账户失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新账户登录状态
   */
  updateLoginStatus(accountId, isLoggedIn, cookies = null) {
    try {
      const loginStatus = isLoggedIn ? 'logged_in' : 'logged_out';
      const cookiesJson = cookies ? JSON.stringify(cookies) : null;

      const stmt = this.db.prepare(`
        UPDATE xhs_accounts
        SET login_status = ?,
            cookies = ?,
            last_login_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(loginStatus, cookiesJson, accountId);

      console.log(`✅ 更新账户登录状态: ID=${accountId}, 已登录=${isLoggedIn}`);
      return { success: true };
    } catch (error) {
      console.error('❌ 更新登录状态失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除账户
   */
  deleteAccount(accountId) {
    try {
      // 不允许删除活跃账户
      const account = this.getAccountById(accountId);
      if (account && account.is_active) {
        return {
          success: false,
          error: '不能删除当前活跃账户，请先切换到其他账户'
        };
      }

      const stmt = this.db.prepare(`
        DELETE FROM xhs_accounts WHERE id = ?
      `);
      stmt.run(accountId);

      console.log(`✅ 删除账户成功: ID=${accountId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ 删除账户失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取账户的 cookies
   */
  getAccountCookies(accountId) {
    const account = this.getAccountById(accountId);
    if (!account || !account.cookies) {
      return null;
    }
    try {
      return JSON.parse(account.cookies);
    } catch (error) {
      console.error('❌ 解析 cookies 失败:', error.message);
      return null;
    }
  }

  /**
   * 保存账户的 cookies
   */
  saveAccountCookies(accountId, cookies) {
    try {
      const cookiesJson = JSON.stringify(cookies);
      const stmt = this.db.prepare(`
        UPDATE xhs_accounts
        SET cookies = ?,
            login_status = 'logged_in',
            last_login_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(cookiesJson, accountId);

      console.log(`✅ 保存账户 cookies 成功: ID=${accountId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ 保存 cookies 失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 保存账户的主站 cookies
   */
  saveMainSiteCookies(accountId, cookies) {
    try {
      const cookiesJson = JSON.stringify(cookies);
      const stmt = this.db.prepare(`
        UPDATE xhs_accounts
        SET main_site_cookies = ?,
            main_site_login_status = 'logged_in',
            main_site_last_login_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(cookiesJson, accountId);

      console.log(`✅ 保存账户主站 cookies 成功: ID=${accountId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ 保存主站 cookies 失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取账户的主站 cookies
   */
  getMainSiteCookies(accountId) {
    try {
      const account = this.getAccountById(accountId);
      if (!account || !account.main_site_cookies) {
        return null;
      }
      return JSON.parse(account.main_site_cookies);
    } catch (error) {
      console.error('❌ 解析主站 cookies 失败:', error.message);
      return null;
    }
  }

  /**
   * 清除主站登录信息
   */
  clearMainSiteLogin(accountId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE xhs_accounts
        SET main_site_cookies = NULL,
            main_site_login_status = 'logged_out',
            main_site_last_login_at = NULL
        WHERE id = ?
      `);
      stmt.run(accountId);

      console.log(`✅ 已清除账户 ${accountId} 的主站登录信息`);
      return { success: true };
    } catch (error) {
      console.error('❌ 清除主站登录信息失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new AccountManagementService();
