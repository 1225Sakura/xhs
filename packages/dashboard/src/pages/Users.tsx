import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Button, Modal, Form, Input, Select, Space, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { userService, User } from '../services/user';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

const Users: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, pageSize],
    queryFn: () => userService.getUsers(page, pageSize)
  });

  const handleCreate = async (values: any) => {
    setLoading(true);
    try {
      const response = await userService.createUser(values);
      if (response.success) {
        message.success('用户创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        refetch();
      }
    } catch (error: any) {
      message.error(error?.error?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      email: user.email,
      role: user.role
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values: any) => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const response = await userService.updateUser(selectedUser.id, values);
      if (response.success) {
        message.success('用户更新成功');
        setEditModalVisible(false);
        editForm.resetFields();
        setSelectedUser(null);
        refetch();
      }
    } catch (error: any) {
      message.error(error?.error?.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      const response = await userService.deleteUser(userId);
      if (response.success) {
        message.success('用户删除成功');
        refetch();
      }
    } catch (error: any) {
      message.error(error?.error?.message || '删除失败');
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => {
        const color = role === 'admin' ? 'red' : 'blue';
        const text = role === 'admin' ? '管理员' : '用户';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (createdAt: string) => {
        return new Date(createdAt).toLocaleString('zh-CN');
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="用户管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建用户
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data?.data?.users || []}
          rowKey="id"
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

      {/* 创建用户模态框 */}
      <Modal
        title="创建用户"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8个字符' }
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
            initialValue="user"
          >
            <Select>
              <Option value="user">用户</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户模态框 */}
      <Modal
        title="编辑用户"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedUser(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={loading}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Option value="user">用户</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
