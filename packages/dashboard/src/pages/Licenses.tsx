import React, { useState } from 'react';
import { Card, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Switch, message, Space, Tag, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { licenseService, CreateLicenseRequest, License } from '../services/license';
import dayjs from 'dayjs';

const { Option } = Select;

const Licenses: React.FC = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async (values: any) => {
    setLoading(true);
    try {
      const data: CreateLicenseRequest = {
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        planType: values.planType,
        maxClients: values.maxClients,
        features: {
          ai: values.featureAi ?? true,
          publish: values.featurePublish ?? true,
          schedule: values.featureSchedule ?? true
        },
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined
      };

      const response = await licenseService.createLicense(data);

      if (response.success) {
        message.success('许可证创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        // 显示许可证详情
        setSelectedLicense(response.data);
        setViewModalVisible(true);
      }
    } catch (error: any) {
      message.error(error?.error?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (licenseKey: string) => {
    setLoading(true);
    try {
      const response = await licenseService.getLicense(licenseKey);
      if (response.success) {
        setSelectedLicense(response.data);
        setViewModalVisible(true);
      }
    } catch (error: any) {
      message.error(error?.error?.message || '获取许可证信息失败');
    } finally {
      setLoading(false);
    }
  };

  const getPlanTypeColor = (planType: string) => {
    const colorMap: Record<string, string> = {
      trial: 'default',
      basic: 'blue',
      pro: 'purple',
      enterprise: 'gold'
    };
    return colorMap[planType] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      active: 'green',
      expired: 'red',
      suspended: 'orange'
    };
    return colorMap[status] || 'default';
  };

  return (
    <div>
      <Card
        title="许可证管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建许可证
          </Button>
        }
      >
        <p>许可证列表功能开发中...</p>
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleView('test-license-key')}
          >
            查看示例许可证
          </Button>
        </Space>
      </Card>

      {/* 创建许可证模态框 */}
      <Modal
        title="创建许可证"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="客户名称"
            name="customerName"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>

          <Form.Item
            label="客户邮箱"
            name="customerEmail"
            rules={[
              { required: true, message: '请输入客户邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入客户邮箱" />
          </Form.Item>

          <Form.Item
            label="计划类型"
            name="planType"
            rules={[{ required: true, message: '请选择计划类型' }]}
            initialValue="basic"
          >
            <Select>
              <Option value="trial">试用版 (30天)</Option>
              <Option value="basic">基础版 (1年)</Option>
              <Option value="pro">专业版 (1年)</Option>
              <Option value="enterprise">企业版 (3年)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="最大客户端数"
            name="maxClients"
            rules={[{ required: true, message: '请输入最大客户端数' }]}
            initialValue={1}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="功能特性">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="featureAi" valuePropName="checked" initialValue={true} noStyle>
                <Switch /> AI内容生成
              </Form.Item>
              <Form.Item name="featurePublish" valuePropName="checked" initialValue={true} noStyle>
                <Switch /> 文章发布
              </Form.Item>
              <Form.Item name="featureSchedule" valuePropName="checked" initialValue={true} noStyle>
                <Switch /> 定时发布
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            label="过期时间"
            name="expiresAt"
            tooltip="留空则根据计划类型自动设置"
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看许可证模态框 */}
      <Modal
        title="许可证详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedLicense && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="许可证密钥" span={2}>
              <code style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {selectedLicense.license_key}
              </code>
            </Descriptions.Item>
            <Descriptions.Item label="客户名称">
              {selectedLicense.customer_name}
            </Descriptions.Item>
            <Descriptions.Item label="客户邮箱">
              {selectedLicense.customer_email}
            </Descriptions.Item>
            <Descriptions.Item label="计划类型">
              <Tag color={getPlanTypeColor(selectedLicense.plan_type)}>
                {selectedLicense.plan_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getStatusColor(selectedLicense.status)}>
                {selectedLicense.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最大客户端数">
              {selectedLicense.max_clients}
            </Descriptions.Item>
            <Descriptions.Item label="过期时间">
              {selectedLicense.expires_at
                ? dayjs(selectedLicense.expires_at).format('YYYY-MM-DD HH:mm:ss')
                : '永久'}
            </Descriptions.Item>
            <Descriptions.Item label="功能特性" span={2}>
              <Space>
                {selectedLicense.features?.ai && <Tag color="blue">AI生成</Tag>}
                {selectedLicense.features?.publish && <Tag color="green">文章发布</Tag>}
                {selectedLicense.features?.schedule && <Tag color="purple">定时发布</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {dayjs(selectedLicense.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Licenses;
