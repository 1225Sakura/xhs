// 系统功能测试脚本
import fetch from 'node-fetch';

async function testSystem() {
  console.log('🧪 开始系统功能测试...\n');

  // 1. 测试健康检查
  console.log('1️⃣ 测试健康检查端点...');
  try {
    const healthRes = await fetch('http://localhost:3000/api/health');
    const healthData = await healthRes.json();
    console.log('✅ 健康检查:', healthData.message);
  } catch (error) {
    console.log('❌ 健康检查失败:', error.message);
    return;
  }

  // 2. 测试 v2.2 生成（Phase 1）
  console.log('\n2️⃣ 测试 v2.2 笔记生成（Phase 1 - 反AIGC）...');
  try {
    const generateRes = await fetch('http://localhost:3000/api/posts/generate', {
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
      console.log('✅ 生成成功!');
      console.log('   标题:', generateData.data.title);
      console.log('   内容长度:', generateData.data.content.length, '字');
      console.log('   AIGC评分:', generateData.metadata.aigc_score, '/10');
      console.log('   敏感词数量:', generateData.metadata.sensitive_words_found.length);
      console.log('   生成阶段:', generateData.metadata.generation_stage);
    } else {
      console.log('❌ 生成失败:', generateData.error);
    }
  } catch (error) {
    console.log('❌ 生成测试失败:', error.message);
  }

  console.log('\n✅ 系统测试完成!');
}

testSystem();
