import accountService from '../services/accountService.js';

/**
 * 账号管理控制器
 */
class AccountController {
  /**
   * 获取所有账号列表
   */
  async getAllAccounts(req, res) {
    try {
      const accounts = accountService.getAllAccounts();
      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      console.error('获取账号列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取单个账号详情
   */
  async getAccountById(req, res) {
    try {
      const { id } = req.params;
      const account = accountService.getAccountById(parseInt(id));

      if (!account) {
        return res.status(404).json({
          success: false,
          error: '账号不存在'
        });
      }

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('获取账号详情失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取当前主账号
   */
  async getPrimaryAccount(req, res) {
    try {
      const account = accountService.getPrimaryAccount();

      res.json({
        success: true,
        data: account || null
      });
    } catch (error) {
      console.error('获取主账号失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 创建新账号
   */
  async createAccount(req, res) {
    try {
      const { account_name, phone, email, nickname, avatar_url, cookies, is_primary } = req.body;

      if (!account_name) {
        return res.status(400).json({
          success: false,
          error: '账号名称是必填项'
        });
      }

      const account = accountService.createAccount({
        account_name,
        phone,
        email,
        nickname,
        avatar_url,
        cookies,
        is_primary: is_primary ? 1 : 0
      });

      res.status(201).json({
        success: true,
        data: account,
        message: '账号创建成功'
      });
    } catch (error) {
      console.error('创建账号失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新账号信息
   */
  async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const account = accountService.updateAccount(parseInt(id), updates);

      res.json({
        success: true,
        data: account,
        message: '账号更新成功'
      });
    } catch (error) {
      console.error('更新账号失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 设置主账号
   */
  async setPrimaryAccount(req, res) {
    try {
      const { id } = req.params;

      const account = accountService.setPrimaryAccount(parseInt(id));

      res.json({
        success: true,
        data: account,
        message: '主账号设置成功'
      });
    } catch (error) {
      console.error('设置主账号失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 切换账号激活状态
   */
  async toggleAccountStatus(req, res) {
    try {
      const { id } = req.params;

      const account = accountService.toggleAccountStatus(parseInt(id));

      res.json({
        success: true,
        data: account,
        message: account.is_active ? '账号已激活' : '账号已停用'
      });
    } catch (error) {
      console.error('切换账号状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 删除账号
   */
  async deleteAccount(req, res) {
    try {
      const { id } = req.params;

      accountService.deleteAccount(parseInt(id));

      res.json({
        success: true,
        message: '账号删除成功'
      });
    } catch (error) {
      console.error('删除账号失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新账号登录状态
   */
  async updateLoginStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, cookies } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: '登录状态是必填项'
        });
      }

      const account = accountService.updateLoginStatus(
        parseInt(id),
        status,
        cookies
      );

      res.json({
        success: true,
        data: account,
        message: '登录状态更新成功'
      });
    } catch (error) {
      console.error('更新登录状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取账号使用统计
   */
  async getAccountStats(req, res) {
    try {
      const { id } = req.params;

      const stats = accountService.getAccountStats(parseInt(id));

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取账号统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取所有账号的使用统计
   */
  async getAllAccountsStats(req, res) {
    try {
      const stats = accountService.getAllAccountsStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取账号统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new AccountController();
