import express from 'express';

const router = express.Router();

// 临时占位路由 - 云端API功能
// TODO: 完整实现需要转换packages/server中的所有controller和middleware

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '云端API服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

// 公开路由占位
router.post('/auth/login', (req, res) => {
  res.status(501).json({
    success: false,
    error: '云端认证功能正在开发中',
    message: '请使用本地模式或等待云端功能完成',
  });
});

router.post('/auth/register', (req, res) => {
  res.status(501).json({
    success: false,
    error: '云端注册功能正在开发中',
  });
});

// 客户端路由占位
router.post('/clients/register', (req, res) => {
  res.status(501).json({
    success: false,
    error: '客户端注册功能正在开发中',
  });
});

router.post('/clients/heartbeat', (req, res) => {
  res.status(501).json({
    success: false,
    error: '客户端心跳功能正在开发中',
  });
});

// 指标路由占位
router.get('/metrics', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Prometheus指标导出功能正在开发中',
  });
});

export default router;
