import fetch from 'node-fetch';

async function testAllAPIs() {
  console.log('=== 测试所有 API 功能 ===\n');

  const API_BASE = 'http://localhost:3000/api';

  // 1. 测试健康检查
  console.log('1. 测试健康检查...');
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    console.log('   ✅ 健康检查:', data.success ? '正常' : '异常');
  } catch (error) {
    console.log('   ❌ 健康检查失败:', error.message);
  }

  // 2. 测试登录状态检查
  console.log('\n2. 测试登录状态检查...');
  try {
    const response = await fetch(`${API_BASE}/xhs/check-login`);
    const data = await response.json();
    console.log('   ✅ 登录状态 API:', data.success ? '正常' : '异常');
    console.log('   当前状态:', data.data?.logged_in ? '已登录' : '未登录');
    if (data.data?.account) {
      console.log('   账号:', data.data.account);
    }
  } catch (error) {
    console.log('   ❌ 登录状态检查失败:', error.message);
  }

  // 3. 测试获取二维码 API（两个路径）
  console.log('\n3. 测试获取二维码 API...');
  try {
    const response1 = await fetch(`${API_BASE}/xhs/qrcode`);
    const data1 = await response1.json();
    console.log('   ✅ /xhs/qrcode:', data1.success ? '正常' : '异常');

    const response2 = await fetch(`${API_BASE}/xhs/login/qrcode`);
    const data2 = await response2.json();
    console.log('   ✅ /xhs/login/qrcode:', data2.success ? '正常' : '异常');
  } catch (error) {
    console.log('   ❌ 获取二维码失败:', error.message);
  }

  // 4. 测试退出登录 API
  console.log('\n4. 测试退出登录 API...');
  try {
    const response = await fetch(`${API_BASE}/xhs/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    console.log('   ✅ 退出登录 API:', data.success ? '正常' : '异常');
    console.log('   消息:', data.message || data.error);
  } catch (error) {
    console.log('   ❌ 退出登录失败:', error.message);
  }

  // 5. 测试文案列表 API
  console.log('\n5. 测试文案列表 API...');
  try {
    const response = await fetch(`${API_BASE}/posts`);
    const data = await response.json();
    console.log('   ✅ 文案列表 API:', data.success ? '正常' : '异常');
    console.log('   文案数量:', data.data?.length || 0);
  } catch (error) {
    console.log('   ❌ 文案列表失败:', error.message);
  }

  // 6. 测试账号管理 API
  console.log('\n6. 测试账号管理 API...');
  try {
    const response = await fetch(`${API_BASE}/accounts`);
    const data = await response.json();
    console.log('   ✅ 账号管理 API:', data.success ? '正常' : '异常');
    console.log('   账号数量:', data.data?.length || 0);
    if (data.data && data.data.length > 0) {
      const primary = data.data.find(acc => acc.is_primary);
      if (primary) {
        console.log('   主账号:', primary.account_name);
      }
    }
  } catch (error) {
    console.log('   ❌ 账号管理失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
  console.log('\n📌 下一步操作：');
  console.log('1. 打开浏览器访问: http://localhost:3000');
  console.log('2. 点击"登录小红书"按钮');
  console.log('3. 使用小红书 APP 扫描二维码');
  console.log('4. 登录成功后尝试发布文案');
}

testAllAPIs().catch(console.error);
