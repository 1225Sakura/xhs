import React from 'react';
import { Card, Row, Col, Statistic, Empty } from 'antd';
import {
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  DashboardOutlined
} from '@ant-design/icons';

const Metrics: React.FC = () => {
  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>指标监控</h1>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="HTTP请求/秒"
              value={125}
              prefix={<LineChartOutlined />}
              suffix="req/s"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={45}
              prefix={<DashboardOutlined />}
              suffix="ms"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="错误率"
              value={0.5}
              prefix={<BarChartOutlined />}
              suffix="%"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="CPU使用率"
              value={35}
              prefix={<PieChartOutlined />}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Prometheus指标" style={{ height: 400 }}>
            <Empty description="请访问 Prometheus 查看详细指标">
              <a
                href="http://localhost:9090"
                target="_blank"
                rel="noopener noreferrer"
              >
                打开 Prometheus
              </a>
            </Empty>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Grafana仪表盘" style={{ height: 400 }}>
            <Empty description="请访问 Grafana 查看可视化仪表盘">
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noopener noreferrer"
              >
                打开 Grafana
              </a>
            </Empty>
          </Card>
        </Col>
      </Row>

      <Card title="快速链接" style={{ marginTop: 24 }}>
        <ul>
          <li>
            <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer">
              Prometheus - 指标查询和告警
            </a>
          </li>
          <li>
            <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer">
              Grafana - 可视化仪表盘
            </a>
          </li>
          <li>
            <a href="http://localhost:9093" target="_blank" rel="noopener noreferrer">
              AlertManager - 告警管理
            </a>
          </li>
          <li>
            <a href="http://localhost:18083" target="_blank" rel="noopener noreferrer">
              EMQX Dashboard - MQTT监控
            </a>
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default Metrics;
