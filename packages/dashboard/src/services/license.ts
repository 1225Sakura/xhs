import apiClient from '../utils/api';

export interface License {
  id: number;
  license_key: string;
  customer_name: string;
  customer_email: string;
  plan_type: string;
  max_clients: number;
  features: Record<string, boolean>;
  expires_at: string;
  status: string;
  created_at: string;
}

export interface CreateLicenseRequest {
  customerName: string;
  customerEmail: string;
  planType: string;
  maxClients: number;
  features?: Record<string, boolean>;
  expiresAt?: string;
}

export const licenseService = {
  // 创建许可证
  createLicense: async (data: CreateLicenseRequest) => {
    return apiClient.post('/license', data);
  },

  // 获取许可证信息
  getLicense: async (licenseKey: string) => {
    return apiClient.get(`/license/${licenseKey}`);
  },

  // 更新许可证
  updateLicense: async (licenseKey: string, updates: any) => {
    return apiClient.put(`/license/${licenseKey}`, updates);
  },

  // 验证许可证
  verifyLicense: async (licenseKey: string, machineId: string) => {
    return apiClient.post('/license/verify', { licenseKey, machineId });
  },

  // 获取公钥
  getPublicKey: async () => {
    return apiClient.get('/license/public-key');
  }
};
