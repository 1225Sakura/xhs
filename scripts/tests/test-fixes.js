/**
 * 测试脚本 - 验证AI文案生成和余额查询修复
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

console.log('🧪 开始测试修复...\n');

// 测试1: 余额查询
async function testBalanceQuery() {
  console.log('📊 测试1: 余额查询');
  try {
    const response = await axios.get(`${API_BASE}/ai/balance`);
    console.log('✅ 余额查询成功:', response.data);
    return true;
  } catch (error) {
    console.error('❌ 余额查询失败:', error.response?.data || error.message);
    return false;
  }
}

// 测试2: AI提供商列表
async function testProvidersList() {
  console.log('\n📋 测试2: AI提供商列表');
  try {
    const response = await axios.get(`${API_BASE}/ai/providers`);
    console.log('✅ 提供商列表获取成功:');
    response.data.data.forEach(p => {
      console.log(`  - ${p.provider_name} (${p.provider}): ${p.is_enabled ? '已启用' : '已禁用'}`);
      console.log(`    API Base URL: ${p.api_base_url}`);
    });
    return true;
  } catch (error) {
    console.error('❌ 获取提供商列表失败:', error.response?.data || error.message);
    return false;
  }
}

// 测试3: AI文案生成（简单测试）
async function testAIGeneration() {
  console.log('\n🤖 测试3: AI文案生成');
  try {
    const response = await axios.post(`${API_BASE}/posts/generate`, {
      productId: null,
      style: '种草型',
      topic: '测试产品',
      requirements: '这是一个测试，请生成一段简短的文案（不超过50字）',
      model: 'deepseek-chat'
    });
    console.log('✅ AI文案生成成功:');
    console.log('  标题:', response.data.title);
    console.log('  内容预览:', response.data.content.substring(0, 100) + '...');
    console.log('  使用模型:', response.data.ai_model);
    console.log('  提供商:', response.data.ai_provider);
    return true;
  } catch (error) {
    console.error('❌ AI文案生成失败:', error.response?.data || error.message);
    return false;
  }
}

// 运行所有测试
async function runTests() {
  const results = {
    balance: await testBalanceQuery(),
    providers: await testProvidersList(),
    generation: await testAIGeneration()
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总:');
  console.log('='.repeat(50));
  console.log(`余额查询: ${results.balance ? '✅ 通过' : '❌ 失败'}`);
  console.log(`提供商列表: ${results.providers ? '✅ 通过' : '❌ 失败'}`);
  console.log(`AI文案生成: ${results.generation ? '✅ 通过' : '❌ 失败'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '🎉 所有测试通过！' : '⚠️ 部分测试失败，请检查日志'));
}

// 执行测试
runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
