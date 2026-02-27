import apiClient from '../utils/api';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

export interface UserListResponse {
  success: boolean;
  data: {
    users: User[];
    total: number;
    page: number;
    limit: number;
  };
}

export const userService = {
  // 获取用户列表
  getUsers: async (page = 1, limit = 20): Promise<UserListResponse> => {
    return apiClient.get('/users', { params: { page, limit } });
  },

  // 创建用户
  createUser: async (data: { username: string; email: string; password: string; role?: string }) => {
    return apiClient.post('/auth/register', data);
  },

  // 更新用户
  updateUser: async (userId: number, updates: { email?: string; role?: string }) => {
    return apiClient.put(`/users/${userId}`, updates);
  },

  // 删除用户
  deleteUser: async (userId: number) => {
    return apiClient.delete(`/users/${userId}`);
  },

  // 获取审计日志
  getAuditLogs: async (params?: any) => {
    return apiClient.get('/audit-logs', { params });
  }
};
