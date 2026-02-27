import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Space, Button, Card, Statistic, Row, Col, message } from 'antd';
import { ReloadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { clientService, Client } from '../services/client';
import type { ColumnsType } from 'antd/es/table';

const Clients: React.FC = () => {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [statusFilter, setStatusFilter] = React.useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', page, pageSize, statusFilter],
    queryFn: () => clientService.getClients(page, pageSize, statusFilter)
  });

  const handleDelete = async (clientId: string) => {
    try {
      await clientService.deleteClient(clientId);
      message.success('删除成功');
      refetch();
    } catch (error: any) {
      message.error(error?.error?.message || '删除失败');
    }
  };

  const columns: ColumnsType<Client> = [
    {
      title: '客户端ID',
      dataIndex: 'client_id',
      key: 'client_id',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color = status === 'online' ? 'green' : 'red';
        const text = status === 'online' ? '在线' : '离线';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os',
      width: 100
    },
    {
      title: '许可证类型',
      dataIndex: 'plan_type',
      key: 'plan_type',
      width: 120,
      render: (planType: string) => {
        if (!planType) return '-';
        const colorMap: Record<string, string> = {
          trial: 'default',
          basic: 'blue',
          pro: 'purple',
          enterprise: 'gold'
        };
        return <Tag color={colorMap[planType] || 'default'}>{planType}</Tag>;
      }
    },
    {
      title: '最后心跳',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 180,
      render: (lastSeen: string) => {
        return lastSeen ? new Date(lastSeen).toLocaleString('zh-CN') : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Client) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/clients/${record.client_id}`, '_blank')}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.client_id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const onlineCount = data?.data?.clients?.filter((c: Client) => c.status === 'online').length || 0;
  const totalCount = data?.data?.total || 0;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="客户端总数"
              value={totalCount}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="在线客户端"
              value={onlineCount}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="离线客户端"
              value={totalCount - onlineCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="客户端列表"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          >
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data?.data?.clients || []}
          rowKey="client_id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: data?.data?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (newPage, newPageSize) => {
              setPage(newPage);
              setPageSize(newPageSize);
            }
          }}
        />
      </Card>
    </div>
  );
};

export default Clients;
