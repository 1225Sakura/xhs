const metricsService = require('../services/metricsService');

// HTTP请求监控中间件
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // 转换为秒
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    // 记录HTTP请求指标
    metricsService.recordHttpRequest(method, route, statusCode, duration);
  });

  next();
}

module.exports = metricsMiddleware;
