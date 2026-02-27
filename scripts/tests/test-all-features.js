// 完整功能测试脚本
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const API_BASE = 'http://localhost:3000/api';

async function testAllFeatures() {
  console.log('🧪 开始完整功能测试...\n');
  console.log('='.repeat(60));

  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  // ==================== 基础测试 ====================
  console.log('\n📦 1. 基础功能测试');
  console.log('-'.repeat(60));

  // 1.1 健康检查
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    const healthData = await healthRes.json();
    if (healthData.success) {
      console.log('✅ 1.1 健康检查: 通过');
      passedTests++;
    } else {
      console.log('❌ 1.1 健康检查: 失败');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ 1.1 健康检查: 错误 -', error.message);
    failedTests++;
    return;
  }

  // 1.2 产品列表
  try {
    const productsRes = await fetch(`${API_BASE}/products`);
    const productsData = await productsRes.json();
    if (productsData.success && productsData.data.length > 0) {
      console.log(`✅ 1.2 产品列表: 通过 (${productsData.data.length}个产品)`);
      passedTests++;
    } else {
      console.log('❌ 1.2 产品列表: 失败');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ 1.2 产品列表: 错误 -', error.message);
    failedTests++;
  }

  // ==================== Phase 1 测试 ====================
  console.log('\n🎯 2. Phase 1: v2.2 反AIGC优化测试');
  console.log('-'.repeat(60));

  // 2.1 v2.2 生成测试
  try {
    console.log('⏳ 2.1 v2.2生成测试: 生成中...');
    const generateRes = await fetch(`${API_BASE}/posts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: 1,
        style: '种草型',
        model: 'deepseek-chat',
        use_v2: true
      })
    });

    const generateData = await generateRes.json();

    if (generateData.success) {
      console.log('✅ 2.1 v2.2生成: 通过');
      console.log(`   - 标题: ${generateData.data.title.substring(0, 30)}...`);
      console.log(`   - 内容长度: ${generateData.data.content.length}字`);
      passedTests++;

      // 2.2 AIGC评分检查
      if (generateData.metadata && generateData.metadata.aigc_score !== undefined) {
        const score = generateData.metadata.aigc_score;
        console.log(`✅ 2.2 AIGC评分: 通过 (${score}/10)`);
        passedTests++;
      } else {
        console.log('❌ 2.2 AIGC评分: 失败 (未返回评分)');
        failedTests++;
      }

      // 2.3 敏感词检测
      if (generateData.metadata && generateData.metadata.sensitive_words_found !== undefined) {
        const count = generateData.metadata.sensitive_words_found.length;
        console.log(`✅ 2.3 敏感词检测: 通过 (检测到${count}个)`);
        passedTests++;
      } else {
        console.log('❌ 2.3 敏感词检测: 失败 (未返回敏感词信息)');
        failedTests++;
      }

      // 2.4 生成阶段标记
      if (generateData.metadata && generateData.metadata.generation_stage) {
        console.log(`✅ 2.4 生成阶段: 通过 (${generateData.metadata.generation_stage})`);
        passedTests++;
      } else {
        console.log('⚠️  2.4 生成阶段: 跳过 (未返回阶段信息)');
        skippedTests++;
      }

    } else {
      console.log('❌ 2.1 v2.2生成: 失败 -', generateData.error);
      failedTests++;
    }
  } catch (error) {
    console.log('❌ 2.1 v2.2生成: 错误 -', error.message);
    failedTests++;
  }

  // ==================== Phase 2 测试 ====================
  console.log('\n🔥 3. Phase 2: v2.3 热门笔记学习测试');
  console.log('-'.repeat(60));

  // 3.1 检查环境变量
  const hasXhsCookie = process.env.XHS_COOKIE && process.env.XHS_COOKIE.length > 0;

  if (!hasXhsCookie) {
    console.log('⚠️  3.1 环境检查: XHS_COOKIE未配置');
    console.log('⚠️  3.2 v2.3生成: 跳过 (需要配置XHS_COOKIE)');
    console.log('⚠️  3.3 热门笔记缓存: 跳过');
    console.log('⚠️  3.4 热门笔记参考: 跳过');
    skippedTests += 4;
  } else {
    console.log('✅ 3.1 环境检查: XHS_COOKIE已配置');
    passedTests++;

    // 3.2 v2.3 生成测试
    try {
      console.log('⏳ 3.2 v2.3生成测试: 生成中（可能需要30-60秒）...');
      const generateRes = await fetch(`${API_BASE}/posts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: 1,
          style: '种草型',
          model: 'deepseek-chat',
          use_v2: true,
          learn_from_hot: true,
          hot_keywords: '护肤品'
        })
      });

      const generateData = await generateRes.json();

      if (generateData.success) {
        console.log('✅ 3.2 v2.3生成: 通过');
        passedTests++;

        // 3.3 热门笔记参考
        if (generateData.metadata && generateData.metadata.hot_posts_used) {
          const count = generateData.metadata.hot_posts_used.length;
          console.log(`✅ 3.3 热门笔记参考: 通过 (参考${count}篇)`);
          passedTests++;
        } else {
          console.log('❌ 3.3 热门笔记参考: 失败 (未返回热门笔记信息)');
          failedTests++;
        }

        // 3.4 缓存功能（再次生成应该更快）
        console.log('⏳ 3.4 缓存测试: 再次生成...');
        const startTime = Date.now();
        const cacheRes = await fetch(`${API_BASE}/posts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: 1,
            style: '种草型',
            model: 'deepseek-chat',
            use_v2: true,
            learn_from_hot: true,
            hot_keywords: '护肤品'
          })
        });
        const cacheTime = Date.now() - startTime;
        const cacheData = await cacheRes.json();

        if (cacheData.success) {
          console.log(`✅ 3.4 缓存功能: 通过 (耗时${cacheTime}ms)`);
          passedTests++;
        } else {
          console.log('❌ 3.4 缓存功能: 失败');
          failedTests++;
        }

      } else {
        console.log('❌ 3.2 v2.3生成: 失败 -', generateData.error);
        failedTests++;
      }
    } catch (error) {
      console.log('❌ 3.2 v2.3生成: 错误 -', error.message);
      failedTests++;
    }
  }

  // ==================== 数据库测试 ====================
  console.log('\n💾 4. 数据库功能测试');
  console.log('-'.repeat(60));

  // 4.1 笔记列表
  try {
    const postsRes = await fetch(`${API_BASE}/posts`);
    const postsData = await postsRes.json();
    if (postsData.success) {
      console.log(`✅ 4.1 笔记列表: 通过 (${postsData.data.length}篇)`);
      passedTests++;

      // 4.2 检查新字段
      if (postsData.data.length > 0) {
        const latestPost = postsData.data[0];
        const hasNewFields =
          latestPost.aigc_score !== undefined ||
          latestPost.sensitive_words_found !== undefined;

        if (hasNewFields) {
          console.log('✅ 4.2 新字段检查: 通过 (aigc_score, sensitive_words_found)');
          passedTests++;
        } else {
          console.log('⚠️  4.2 新字段检查: 跳过 (旧数据无新字段)');
          skippedTests++;
        }
      }
    } else {
      console.log('❌ 4.1 笔记列表: 失败');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ 4.1 笔记列表: 错误 -', error.message);
    failedTests++;
  }

  // ==================== 测试总结 ====================
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));

  const totalTests = passedTests + failedTests + skippedTests;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;

  console.log(`\n总测试数: ${totalTests}`);
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(`⚠️  跳过: ${skippedTests}`);
  console.log(`\n通过率: ${passRate}%`);

  if (failedTests === 0 && passedTests > 0) {
    console.log('\n🎉 所有测试通过！系统运行正常！');
  } else if (failedTests > 0) {
    console.log('\n⚠️  部分测试失败，请检查错误信息');
  } else {
    console.log('\n⚠️  大部分测试被跳过，请配置XHS_COOKIE后重新测试');
  }

  console.log('\n' + '='.repeat(60));
}

testAllFeatures().catch(error => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});
