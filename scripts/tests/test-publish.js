import directPublishService from './src/services/directPublishService.js';
import path from 'path';

const testTitle = '测试发布 - 请忽略';
const testContent = '这是一条测试笔记，用于验证发布功能是否正常工作。\n\n如果您看到这条笔记，说明发布功能已经恢复正常！';
const testImages = [
  path.join(process.cwd(), '知识库/产品资料/PHYTO NUTRA/1粉3.jpg')
];

console.log('🧪 开始测试发布...');
console.log('标题:', testTitle);
console.log('内容:', testContent);
console.log('图片:', testImages);

directPublishService(testTitle, testContent, testImages)
  .then(result => {
    console.log('\n📊 发布结果:', result);
    if (result.success) {
      console.log('✅ 测试成功！发布功能正常工作');
      process.exit(0);
    } else {
      console.log('❌ 测试失败:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ 测试出错:', error);
    process.exit(1);
  });
