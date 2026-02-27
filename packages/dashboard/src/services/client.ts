import apiClient from '../utils/api';

export interface Client {
  client_id: string;
  machine_id: string;
  version: string;
  os: string;
  status: string;
  last_seen: string;
  license_key?: string;
  plan_type?: string;
  expires_at?: string;
  heartbeat_count?: number;
}

export interface ClientListResponse {
  success: boolean;
  data: {
    clients: Client[];
    total: number;
    page: number;
    limit: number;
  };
}

export const clientService = {
  // 获取客户端列表
  getClients: async (page = 1, limit = 20, status = 'all'): Promise<ClientListResponse> => {
    return apiClient.get('/clients', { params: { page, limit, status } });
  },

  // 获取客户端详情
  getClientById: async (clientId: string) => {
    return apiClient.get(`/clients/${clientId}`);
  },

  // 删除客户端
  deleteClient: async (clientId: string) => {
    return apiClient.delete(`/clients/${clientId}`);
  },

  // 获取客户端配置
  getClientConfig: async (clientId: string) => {
    return apiClient.get(`/config/${clientId}`);
  },

  // 更新客户端配置
  updateClientConfig: async (clientId: string, config: any) => {
    return apiClient.put(`/config/${clientId}`, config);
  },

  // 获取客户端指标
  getClientMetrics: async (clientId: string, params?: any) => {
    return apiClient.get(`/metrics/client/${clientId}`, { params });
  }
};
