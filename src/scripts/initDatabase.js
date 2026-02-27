import { initDatabase } from '../models/database.js';
import db from '../models/database.js';

console.log('正在初始化数据库...');

// 初始化表结构
initDatabase();

// 插入默认分类
const categories = [
  { name: 'Actifit', description: '活力产品' },
  { name: 'FIBER CLEANSE', description: '纤维清洁产品' },
  { name: 'GRAZYME BIOME', description: '酶类益生菌产品' },
  { name: 'PHYTO BERRYGOOD', description: '植物浆果产品' },
  { name: 'PHYTO NUTRA', description: '植物营养产品' },
  { name: 'POSTATHIONE', description: '谷胱甘肽产品' },
  { name: '基因检测', description: '基因检测服务' },
  { name: '其他', description: '其他产品' },
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO categories (name, description)
  VALUES (?, ?)
`);

categories.forEach(cat => {
  stmt.run(cat.name, cat.description);
});

console.log('数据库初始化完成，已插入默认分类');

process.exit(0);
