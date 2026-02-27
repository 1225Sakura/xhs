import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  TeamOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  RocketOutlined
} from '@ant-design/icons';

const Dashboard: React.FC = () => {
  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>系统概览</h1>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="在线客户端"
              value={12}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃许可证"
              value={25}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日文章"
              value={156}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日发布"
              value={89}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="最近活动" style={{ height: 400 }}>
            <p>暂无数据</p>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="系统状态" style={{ height: 400 }}>
            <p>所有服务运行正常</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
