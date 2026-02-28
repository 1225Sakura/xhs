#!/bin/bash

# 云端API功能测试脚本

BASE_URL="http://localhost:3002/api/cloud"

echo "========================================="
echo "云端API功能测试"
echo "========================================="
echo ""

# 1. 健康检查
echo "1. 测试健康检查..."
curl -s "$BASE_URL/health" | jq .
echo ""

# 2. 用户注册
echo "2. 测试用户注册..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456",
    "email": "test@example.com",
    "role": "user"
  }')
echo "$REGISTER_RESPONSE" | jq .
echo ""

# 3. 用户登录
echo "3. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456"
  }')
echo "$LOGIN_RESPONSE" | jq .

# 提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
echo "Token: $TOKEN"
echo ""

# 4. 获取当前用户信息
echo "4. 测试获取当前用户信息..."
curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 5. 客户端注册
echo "5. 测试客户端注册..."
CLIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/clients/register" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-001",
    "hostname": "test-machine",
    "platform": "linux",
    "version": "1.0.0"
  }')
echo "$CLIENT_RESPONSE" | jq .

# 提取客户端token
CLIENT_TOKEN=$(echo "$CLIENT_RESPONSE" | jq -r '.data.token')
echo "Client Token: $CLIENT_TOKEN"
echo ""

# 6. 客户端心跳
echo "6. 测试客户端心跳..."
curl -s -X POST "$BASE_URL/clients/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -d '{
    "clientId": "test-client-001",
    "status": "online",
    "metrics": {
      "cpu": 45.5,
      "memory": 60.2,
      "disk": 75.8
    }
  }' | jq .
echo ""

# 7. 管理员登录
echo "7. 测试管理员功能（需要先创建管理员账户）..."
echo "注册管理员账户..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin123456",
    "email": "admin@example.com",
    "role": "admin"
  }' | jq .
echo ""

echo "管理员登录..."
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin123456"
  }')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.token')
echo "Admin Token: $ADMIN_TOKEN"
echo ""

# 8. 获取所有客户端
echo "8. 测试获取所有客户端（管理员）..."
curl -s "$BASE_URL/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
echo ""

# 9. 获取所有用户
echo "9. 测试获取所有用户（管理员）..."
curl -s "$BASE_URL/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
echo ""

echo "========================================="
echo "测试完成！"
echo "========================================="
