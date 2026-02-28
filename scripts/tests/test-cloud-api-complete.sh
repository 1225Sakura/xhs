#!/bin/bash

# 云端API完整测试脚本
# 测试所有云端API功能模块

BASE_URL="http://localhost:3002/api/cloud"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "云端API完整功能测试"
echo "========================================="
echo ""

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_api() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local headers=$5

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "测试 $TOTAL_TESTS: $name ... "

    if [ -z "$data" ]; then
        response=$(curl -s -X $method "$url" $headers)
    else
        response=$(curl -s -X $method "$url" -H "Content-Type: application/json" $headers -d "$data")
    fi

    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        echo -e "${RED}✗ 失败${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "$response"
    fi
    echo ""
}

echo "========================================="
echo "1. 用户认证测试"
echo "========================================="

# 1.1 用户注册
test_api "用户注册" "POST" "$BASE_URL/auth/register" \
    '{"username":"testuser","password":"Test123456","email":"test@xhs.com","role":"user"}'

# 1.2 用户登录
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"Test123456"}')
USER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

test_api "用户登录" "POST" "$BASE_URL/auth/login" \
    '{"username":"testuser","password":"Test123456"}'

# 1.3 获取当前用户信息
test_api "获取当前用户" "GET" "$BASE_URL/auth/me" "" \
    "-H 'Authorization: Bearer $USER_TOKEN'"

echo "========================================="
echo "2. 许可证管理测试"
echo "========================================="

# 2.1 获取公钥
test_api "获取许可证公钥" "GET" "$BASE_URL/license/public-key"

# 2.2 创建许可证（需要管理员权限）
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"YiJing2024"}')
ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.data.token')

LICENSE_RESPONSE=$(curl -s -X POST "$BASE_URL/license" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"clientId":"test-client-002","expiresAt":"2027-12-31","features":["sync","metrics"]}')
LICENSE_KEY=$(echo $LICENSE_RESPONSE | jq -r '.data.licenseKey')

test_api "创建许可证" "POST" "$BASE_URL/license" \
    '{"clientId":"test-client-002","expiresAt":"2027-12-31","features":["sync","metrics"]}' \
    "-H 'Authorization: Bearer $ADMIN_TOKEN'"

# 2.3 验证许可证
test_api "验证许可证" "POST" "$BASE_URL/license/verify" \
    "{\"licenseKey\":\"$LICENSE_KEY\",\"clientId\":\"test-client-002\"}"

echo "========================================="
echo "3. 客户端管理测试"
echo "========================================="

# 3.1 客户端注册
CLIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/clients/register" \
    -H "Content-Type: application/json" \
    -H "X-License-Key: $LICENSE_KEY" \
    -d '{"clientId":"test-client-002","hostname":"test-host-2","name":"测试客户端2","version":"1.0.0","platform":"linux"}')
CLIENT_TOKEN=$(echo $CLIENT_RESPONSE | jq -r '.data.token')

test_api "客户端注册" "POST" "$BASE_URL/clients/register" \
    '{"clientId":"test-client-002","hostname":"test-host-2","name":"测试客户端2","version":"1.0.0","platform":"linux"}' \
    "-H 'X-License-Key: $LICENSE_KEY'"

# 3.2 客户端心跳
test_api "客户端心跳" "POST" "$BASE_URL/clients/heartbeat" \
    '{"clientId":"test-client-002","status":"online","cpuUsage":35.5,"memoryUsage":50.2,"diskUsage":60.0}' \
    "-H 'Authorization: Bearer $CLIENT_TOKEN'"

# 3.3 获取客户端列表（管理员）
test_api "获取客户端列表" "GET" "$BASE_URL/clients" "" \
    "-H 'Authorization: Bearer $ADMIN_TOKEN'"

echo "========================================="
echo "4. 配置同步测试"
echo "========================================="

# 4.1 更新客户端配置（管理员）
test_api "更新客户端配置" "PUT" "$BASE_URL/config/test-client-002" \
    '{"configs":{"syncInterval":600,"metricsEnabled":true,"logLevel":"debug"}}' \
    "-H 'Authorization: Bearer $ADMIN_TOKEN'"

# 4.2 获取客户端配置
test_api "获取客户端配置" "GET" "$BASE_URL/config/test-client-002" "" \
    "-H 'Authorization: Bearer $CLIENT_TOKEN'"

echo "========================================="
echo "5. 数据同步测试"
echo "========================================="

# 5.1 上传数据
test_api "上传数据" "POST" "$BASE_URL/sync/upload" \
    '{"clientId":"test-client-002","dataType":"logs","data":{"log1":"error message","log2":"warning message"},"version":"1.0.1"}' \
    "-H 'Authorization: Bearer $CLIENT_TOKEN'"

# 5.2 下载数据
test_api "下载数据" "GET" "$BASE_URL/sync/download/test-client-002?dataType=logs" "" \
    "-H 'Authorization: Bearer $CLIENT_TOKEN'"

echo "========================================="
echo "6. 指标监控测试"
echo "========================================="

# 6.1 上传指标
test_api "上传指标" "POST" "$BASE_URL/metrics/upload" \
    '{"clientId":"test-client-002","metrics":{"cpu":35.5,"memory":50.2,"disk":60.0,"network_in":2048,"network_out":4096}}' \
    "-H 'Authorization: Bearer $CLIENT_TOKEN'"

# 6.2 获取指标摘要（管理员）
test_api "获取指标摘要" "GET" "$BASE_URL/metrics/summary" "" \
    "-H 'Authorization: Bearer $ADMIN_TOKEN'"

# 6.3 Prometheus指标导出
test_api "Prometheus指标导出" "GET" "$BASE_URL/metrics"

echo "========================================="
echo "7. 用户管理测试（管理员）"
echo "========================================="

# 7.1 获取用户列表
test_api "获取用户列表" "GET" "$BASE_URL/users" "" \
    "-H 'Authorization: Bearer $ADMIN_TOKEN'"

echo ""
echo "========================================="
echo "测试总结"
echo "========================================="
echo -e "总测试数: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}✗ 有测试失败${NC}"
    exit 1
fi
