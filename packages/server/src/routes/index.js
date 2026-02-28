import express from 'express';
import multer from 'multer';
import path from 'path';
import accountRoutes from './accountRoutes.js';
import cloudRoutes from './cloudRoutes.js';
import {
  getAllDocs,
  getDocById,
  scanKnowledgeBase,
  addDoc,
  deleteDoc,
  getKnowledgeConfig,
  updateKnowledgePath,
  browseDirectories,
  cleanupOldDocs,
} from '../controllers/knowledgeController.js';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  scanProductImages,
  getAllCategories,
  createCategory,
} from '../controllers/productController.js';
import {
  getAllPosts,
  getPostById,
  generatePost,
  optimizePost,
  publishToXhs,
  updatePost,
  deletePost,
  checkGrammar,
} from '../controllers/postController.js';
import {
  autoScanProducts,
  getKnowledgeCategories,
} from '../controllers/autoScanController.js';
import historyController from '../controllers/historyController.js';
import scheduleController from '../controllers/scheduleController.js';
import trendingController from '../controllers/trendingController.js';
import accountController from '../controllers/accountController.js';

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// 配置图片上传
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 知识库路由
router.get('/knowledge/config', getKnowledgeConfig);
router.put('/knowledge/config', updateKnowledgePath);
router.get('/knowledge/browse', browseDirectories);
router.post('/knowledge/cleanup', cleanupOldDocs);
router.get('/knowledge', getAllDocs);
router.get('/knowledge/categories-tree', getKnowledgeCategories);
router.get('/knowledge/:id', getDocById);
router.post('/knowledge/scan', scanKnowledgeBase);
router.post('/knowledge', upload.single('file'), addDoc);
router.delete('/knowledge/:id', deleteDoc);

// 产品路由
router.get('/products', getAllProducts);
router.get('/products/:id', getProductById);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/scan-images', scanProductImages);

// 分类路由
router.get('/categories', getAllCategories);
router.post('/categories', createCategory);

// 文案路由
router.get('/posts', getAllPosts);
router.get('/posts/:id', getPostById);
router.post('/posts/generate', generatePost);
router.post('/posts/:id/optimize', optimizePost);
router.post('/posts/:id/publish', publishToXhs);
router.put('/posts/:id', updatePost);
router.delete('/posts/:id', deletePost);

// 语法检查路由
router.post('/grammar/check', checkGrammar);

// 自动扫描路由
router.post('/auto-scan/products', autoScanProducts);

// 小红书登录服务
import multiAccountXhsLoginService from '../services/multiAccountXhsLoginService.js';

// 使用增强的登录服务
// 小红书登录路由（多账户支持）
router.get('/xhs/login/qrcode', multiAccountXhsLoginService.getQRCode.bind(multiAccountXhsLoginService));
router.get('/xhs/qrcode', multiAccountXhsLoginService.getQRCode.bind(multiAccountXhsLoginService));

// 登录状态检查
router.get('/xhs/login-status', multiAccountXhsLoginService.checkLoginStatus.bind(multiAccountXhsLoginService));
router.get('/xhs/check-login', multiAccountXhsLoginService.checkLoginStatus.bind(multiAccountXhsLoginService));

// 深度验证登录状态（通过实际访问页面）
router.get('/xhs/verify-login', multiAccountXhsLoginService.verifyLoginDeep.bind(multiAccountXhsLoginService));

// 退出登录
router.post('/xhs/logout', multiAccountXhsLoginService.deleteCookies.bind(multiAccountXhsLoginService));
router.delete('/xhs/login/cookies', multiAccountXhsLoginService.deleteCookies.bind(multiAccountXhsLoginService));

// AI模型相关
import { AI_MODELS } from '../services/aiService.js';
import aiProviderController from '../controllers/aiProviderController.js';

// 获取可用模型列表
router.get('/ai/models', (req, res) => {
  const models = Object.entries(AI_MODELS).map(([key, value]) => ({
    id: key,
    name: value.name,
    price: value.price,
    provider: value.provider,
  }));

  res.json({
    success: true,
    data: models,
  });
});

// AI提供商管理路由
router.get('/ai/providers/supported', aiProviderController.getSupportedProviders.bind(aiProviderController));
router.get('/ai/providers', aiProviderController.getAllProviders.bind(aiProviderController));
router.get('/ai/providers/:provider', aiProviderController.getProvider.bind(aiProviderController));
router.put('/ai/providers/:provider', aiProviderController.updateProvider.bind(aiProviderController));
router.delete('/ai/providers/:provider', aiProviderController.deleteProvider.bind(aiProviderController));
router.post('/ai/providers/:provider/toggle', aiProviderController.toggleProvider.bind(aiProviderController));
router.post('/ai/providers/:provider/priority', aiProviderController.updatePriority.bind(aiProviderController));
router.post('/ai/providers/:provider/test', aiProviderController.testProvider.bind(aiProviderController));
router.post('/ai/providers/cache/clear', aiProviderController.clearCache.bind(aiProviderController));

// AI使用统计
router.get('/ai/usage-stats', aiProviderController.getUsageStats.bind(aiProviderController));

// 发布历史管理路由
router.get('/publish-history/export', historyController.exportCSV.bind(historyController));
router.get('/publish-history/:id', historyController.getRecordById.bind(historyController));
router.get('/publish-history', historyController.getHistory.bind(historyController));
router.post('/publish-history/cleanup', historyController.cleanupOldRecords.bind(historyController));

// 发布统计
router.get('/publish-stats/daily', historyController.getDailyStats.bind(historyController));
router.get('/publish-stats', historyController.getStats.bind(historyController));

// 定时发布路由
router.post('/schedules', scheduleController.createSchedule.bind(scheduleController));
router.get('/schedules', scheduleController.getSchedules.bind(scheduleController));
router.get('/schedules/:id/logs', scheduleController.getExecutionLogs.bind(scheduleController));
router.put('/schedules/:id', scheduleController.updateSchedule.bind(scheduleController));
router.post('/schedules/:id/cancel', scheduleController.cancelSchedule.bind(scheduleController));
router.post('/schedules/:id/execute', scheduleController.executeNow.bind(scheduleController));
router.delete('/schedules/:id', scheduleController.deleteSchedule.bind(scheduleController));

// 热点数据路由
router.get('/trending/logs', trendingController.getFetchLogs.bind(trendingController));
router.get('/trending/stats', trendingController.getStats.bind(trendingController));
router.get('/trending/:platform', trendingController.getPlatformTopics.bind(trendingController));
router.get('/trending', trendingController.getAllTopics.bind(trendingController));
router.post('/trending/refresh', trendingController.refreshTopics.bind(trendingController));
router.post('/trending/link', trendingController.linkToPost.bind(trendingController));
router.post('/trending/cleanup', trendingController.cleanupOld.bind(trendingController));

// 账号管理路由
router.get('/accounts/stats', accountController.getAllAccountsStats.bind(accountController));
router.get('/accounts/primary', accountController.getPrimaryAccount.bind(accountController));
router.get('/accounts/:id/stats', accountController.getAccountStats.bind(accountController));
router.get('/accounts/:id', accountController.getAccountById.bind(accountController));
router.get('/accounts', accountController.getAllAccounts.bind(accountController));
router.post('/accounts', accountController.createAccount.bind(accountController));
router.put('/accounts/:id', accountController.updateAccount.bind(accountController));
router.post('/accounts/:id/set-primary', accountController.setPrimaryAccount.bind(accountController));
router.post('/accounts/:id/toggle-status', accountController.toggleAccountStatus.bind(accountController));
router.post('/accounts/:id/login-status', accountController.updateLoginStatus.bind(accountController));
router.delete('/accounts/:id', accountController.deleteAccount.bind(accountController));

// 图片上传路由
router.post('/upload/image', imageUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: '没有上传文件',
    });
  }

  res.json({
    success: true,
    data: {
      path: req.file.path,
      url: `/uploads/images/${req.file.filename}`,
      filename: req.file.filename,
    },
  });
});

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

// 小红书登录相关路由（使用 Playwright 实现）
import xhsLoginController from '../controllers/xhsLoginController.js';

// 获取登录二维码
// 账户管理路由
router.use(accountRoutes);

// 云端API路由
router.use('/cloud', cloudRoutes);

export default router;
