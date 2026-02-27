import apiClient from '../utils/api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: number;
      username: string;
      email: string;
      role: string;
    };
    token: string;
  };
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export const authService = {
  // 登录
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post('/auth/login', credentials);
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<{ success: boolean; data: User }> => {
    return apiClient.get('/auth/me');
  },

  // 修改密码
  changePassword: async (oldPassword: string, newPassword: string) => {
    return apiClient.post('/auth/change-password', { oldPassword, newPassword });
  },

  // 登出
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  // 检查是否已登录
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  // 获取存储的用户信息
  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
};
