import express from 'express';
import userController from '../controllers/userController.js';
import clientController from '../controllers/clientController.js';
import licenseController from '../controllers/licenseController.js';
import configController from '../controllers/configController.js';
import syncController from '../controllers/syncController.js';
import metricsController from '../controllers/metricsController.js';
import { authenticate, requireRole, authenticateClient } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// 公开路由（无需认证）
// ============================================

// 用户认证
router.post('/auth/login', userController.login.bind(userController));
router.post('/auth/register', userController.register.bind(userController));

// 许可证验证
router.post('/license/verify', licenseController.verify.bind(licenseController));
router.get('/license/public-key', licenseController.getPublicKeyEndpoint.bind(licenseController));

// Prometheus指标导出（无需认证，供Prometheus抓取）
router.get('/metrics', metricsController.exportMetrics.bind(metricsController));

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '云端API服务运行正常',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['auth', 'clients', 'licenses', 'config', 'sync', 'metrics']
  });
});

// ============================================
// 客户端路由（需要客户端认证）
// ============================================

// 客户端注册
router.post('/clients/register', (req, res) => {
  clientController.register(req, res);
});

// 客户端心跳
router.post('/clients/heartbeat', authenticateClient, (req, res) => {
  clientController.heartbeat(req, res);
});

// 配置同步
router.get('/config/:clientId', authenticateClient, (req, res) => {
  configController.getConfig(req, res);
});

// 数据同步
router.post('/sync/upload', authenticateClient, (req, res) => {
  syncController.upload(req, res);
});

router.get('/sync/download/:clientId', authenticateClient, (req, res) => {
  syncController.download(req, res);
});

// 指标上传
router.post('/metrics/upload', authenticateClient, (req, res) => {
  syncController.uploadMetrics(req, res);
});

// ============================================
// 用户路由（需要用户认证）
// ============================================

// 获取当前用户信息
router.get('/auth/me', authenticate, (req, res) => {
  userController.getCurrentUser(req, res);
});

// 修改密码
router.post('/auth/change-password', authenticate, (req, res) => {
  userController.changePassword(req, res);
});

// ============================================
// 管理员路由（需要管理员权限）
// ============================================

// 客户端管理
router.get('/clients', authenticate, requireRole('admin'), (req, res) => {
  clientController.list(req, res);
});

router.get('/clients/:clientId', authenticate, requireRole('admin'), (req, res) => {
  clientController.getById(req, res);
});

router.delete('/clients/:clientId', authenticate, requireRole('admin'), (req, res) => {
  clientController.delete(req, res);
});

// 用户管理
router.get('/users', authenticate, requireRole('admin'), (req, res) => {
  userController.list(req, res);
});

router.put('/users/:userId', authenticate, requireRole('admin'), (req, res) => {
  userController.update(req, res);
});

router.delete('/users/:userId', authenticate, requireRole('admin'), (req, res) => {
  userController.delete(req, res);
});

router.get('/audit-logs', authenticate, requireRole('admin'), (req, res) => {
  userController.getAuditLogs(req, res);
});

// 许可证管理
router.post('/license', authenticate, requireRole('admin'), (req, res) => {
  licenseController.create(req, res);
});

router.get('/license/:licenseKey', authenticate, requireRole('admin'), (req, res) => {
  licenseController.get(req, res);
});

router.put('/license/:licenseKey', authenticate, requireRole('admin'), (req, res) => {
  licenseController.update(req, res);
});

// 配置管理
router.put('/config/:clientId', authenticate, requireRole('admin'), (req, res) => {
  configController.updateConfig(req, res);
});

// 指标查询
router.get('/metrics/client/:clientId', authenticate, requireRole('admin'), (req, res) => {
  syncController.getMetrics(req, res);
});

router.get('/metrics/summary', authenticate, requireRole('admin'), (req, res) => {
  metricsController.getMetricsSummary(req, res);
});

export default router;
