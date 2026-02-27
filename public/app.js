const API_BASE = '/api';
let currentPostId = null;
let batchMode = false;
let selectedPostIds = [];
let xhsSessionId = null; // 小红书登录会话ID
let loginPollingInterval = null; // 登录状态轮询定时器

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDocs();
  loadKnowledgeConfig();
  loadProducts();
  loadPosts();
  loadProductsForGenerate();
  loadDocsForGenerate();
  loadModels(); // 加载AI模型列表
  loadPrimaryAccountInfo(); // 加载主账号信息
  initStyleSelector(); // 初始化风格选择器
  checkXhsLoginStatus(); // 检查小红书登录状态
  startLoginStatusMonitor(); // 启动登录状态监控
  initWordCountSlider(); // 初始化字数滑块
});

// 导航切换
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageName = item.dataset.page;
      switchPage(pageName);
    });
  });
}

function switchPage(pageName) {
  // 隐藏所有页面
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // 显示选中的页面
  const pageElement = document.getElementById(pageName);
  if (pageElement) {
    pageElement.classList.add('active');
  }
  const navItem = document.querySelector(`[data-page="${pageName}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }

  // 加载对应页面的数据
  loadPageData(pageName);
}

// 根据页面加载相应数据

// 初始化字数滑块
function initWordCountSlider() {
  const slider = document.getElementById('wordCountSlider');
  const valueDisplay = document.getElementById('wordCountValue');

  if (slider && valueDisplay) {
    // 更新显示值
    slider.addEventListener('input', (e) => {
      valueDisplay.textContent = `${e.target.value}字`;
    });
  }
}

// 根据页面加载相应数据
function loadPageData(pageName) {
  switch(pageName) {
    case 'ai-providers':
      if (typeof refreshProviders === 'function') refreshProviders();
      break;
    case 'schedules':
      if (typeof loadSchedules === 'function') loadSchedules();
      break;
    case 'history':
      if (typeof loadPublishHistory === 'function') {
        loadPublishHistory();
        loadPublishStats();
      }
      break;
    case 'trending':
      if (typeof loadTrending === 'function') loadTrending();
      break;
    case 'accounts':
      if (typeof loadAccounts === 'function') loadAccounts();
      break;
  }
}

// 向后兼容：保留旧的switchTab函数
function switchTab(tabName) {
  switchPage(tabName);
}

// 通知
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// 模态框
function showModal(content) {
  document.getElementById('modalBody').innerHTML = content;
  document.getElementById('modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  // 移除modal-edit类
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) {
    modalContent.classList.remove('modal-edit');
  }
}

// 知识库管理
async function loadDocs() {
  const category = document.getElementById('filterCategory')?.value || '';
  const search = document.getElementById('searchDocs')?.value || '';

  try {
    const response = await fetch(`${API_BASE}/knowledge?category=${category}&search=${search}`);
    const result = await response.json();

    if (result.success) {
      displayDocs(result.data);
      // 更新分类下拉列表
      updateCategoryFilter(result.data);
    }
  } catch (error) {
    console.error('加载文档失败:', error);
    document.getElementById('docsList').innerHTML = '<p class="loading">加载失败</p>';
  }
}

function updateCategoryFilter(docs) {
  const categories = [...new Set(docs.map(doc => doc.category).filter(c => c))];
  const select = document.getElementById('filterCategory');
  const currentValue = select.value;

  select.innerHTML = '<option value="">全部分类</option>' +
    categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

  if (currentValue) {
    select.value = currentValue;
  }
}

function displayDocs(docs) {
  const container = document.getElementById('docsList');

  if (docs.length === 0) {
    container.innerHTML = '<p class="loading">暂无文档</p>';
    return;
  }

  container.innerHTML = docs.map(doc => `
    <div class="card">
      <h3>${doc.title}</h3>
      <div class="meta">
        <span>类型: ${doc.file_type}</span> |
        <span>分类: ${doc.category || '未分类'}</span> |
        <span>创建时间: ${new Date(doc.created_at).toLocaleString()}</span>
      </div>
      <div class="content">
        ${doc.content ? doc.content.substring(0, 200) + '...' : '无内容'}
      </div>
      <div class="actions">
        <button onclick="viewDoc(${doc.id})" class="btn btn-secondary">查看</button>
        <button onclick="deleteDoc(${doc.id})" class="btn btn-secondary">删除</button>
      </div>
    </div>
  `).join('');
}

function searchDocs() {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(loadDocs, 500);
}

async function scanKnowledge() {
  if (!confirm('确定要扫描知识库吗？这可能需要一些时间。')) {
    return;
  }

  showNotification('开始扫描知识库...', 'success');

  try {
    const response = await fetch(`${API_BASE}/knowledge/scan`, {
      method: 'POST',
    });
    const result = await response.json();

    if (result.success) {
      showNotification(`扫描完成！成功: ${result.data.success}, 失败: ${result.data.failed}`, 'success');
      loadDocs();
      loadDocsForGenerate(); // 重新加载生成页面的文档列表
    } else {
      showNotification('扫描失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('扫描失败:', error);
    showNotification('扫描失败', 'error');
  }
}

// 清理不属于当前知识库的旧文档
async function cleanupOldDocs() {
  if (!confirm('确定要清理不属于当前知识库的旧文档吗？\n\n此操作将删除数据库中所有不在当前知识库路径下的文档记录。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/knowledge/cleanup`, {
      method: 'POST',
    });
    const result = await response.json();

    if (result.success) {
      showNotification(result.data.message, 'success');
      loadDocs(); // 重新加载文档列表
      loadDocsForGenerate(); // 重新加载生成页面的文档列表
    } else {
      showNotification('清理失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('清理失败:', error);
    showNotification('清理失败', 'error');
  }
}

// 清空并重新扫描知识库（组合操作）
async function cleanupAndRescan() {
  if (!confirm('⚠️ 此操作将：\n\n1. 清空当前数据库中的所有文档和产品\n2. 重新扫描当前知识库路径\n\n确定要继续吗？')) {
    return;
  }

  try {
    showNotification('正在清空数据库...', 'info');

    // 1. 清理旧文档
    const cleanupResponse = await fetch(`${API_BASE}/knowledge/cleanup`, {
      method: 'POST',
    });
    const cleanupResult = await cleanupResponse.json();

    if (!cleanupResult.success) {
      showNotification('清理失败: ' + cleanupResult.error, 'error');
      return;
    }

    showNotification(`已清理 ${cleanupResult.data.deleted} 个旧文档，开始扫描...`, 'success');

    // 2. 扫描知识库
    const scanResponse = await fetch(`${API_BASE}/knowledge/scan`, {
      method: 'POST',
    });
    const scanResult = await scanResponse.json();

    if (scanResult.success) {
      showNotification(
        `✅ 完成！成功: ${scanResult.data.success}, 失败: ${scanResult.data.failed}`,
        'success'
      );
      loadDocs(); // 重新加载文档列表
      loadKnowledgeConfig(); // 刷新配置
    } else {
      showNotification('扫描失败: ' + scanResult.error, 'error');
    }
  } catch (error) {
    console.error('操作失败:', error);
    showNotification('操作失败: ' + error.message, 'error');
  }
}


// 加载知识库路径配置
async function loadKnowledgeConfig() {
  try {
    const response = await fetch(`${API_BASE}/knowledge/config`);
    const result = await response.json();

    if (result.success) {
      const pathInput = document.getElementById('knowledgePathInput');
      const currentPathDisplay = document.getElementById('currentKnowledgePath');

      // 缓存知识库路径供getImageUrl使用
      if (result.data.path) {
        cachedKnowledgeBasePath = result.data.path;
      }

      if (pathInput) {
        pathInput.value = result.data.path || '';
      }

      if (currentPathDisplay) {
        if (result.data.path) {
          const statusIcon = result.data.exists ? '✅' : '❌';
          const statusText = result.data.exists ? '路径有效' : '路径不存在';
          currentPathDisplay.innerHTML = `${statusIcon} 当前路径: <code>${result.data.path}</code> (${statusText})`;
        } else {
          currentPathDisplay.innerHTML = '⚠️ 未配置知识库路径';
        }
      }
    }
  } catch (error) {
    console.error('加载知识库配置失败:', error);
    const currentPathDisplay = document.getElementById('currentKnowledgePath');
    if (currentPathDisplay) {
      currentPathDisplay.innerHTML = '❌ 加载失败';
    }
  }
}

// 更新知识库路径
async function updateKnowledgePath() {
  const pathInput = document.getElementById('knowledgePathInput');
  const newPath = pathInput.value.trim();

  if (!newPath) {
    showNotification('请输入知识库路径', 'error');
    return;
  }

  if (!confirm(`⚠️ 更改知识库路径将：\n\n1. 自动清理所有旧数据（文档、产品、文案）\n2. 更新为新路径: ${newPath}\n3. 需要手动点击"扫描知识库"加载新数据\n\n确定要继续吗？`)) {
    return;
  }

  try {
    showNotification('正在更新路径并清理旧数据...', 'info');

    const response = await fetch(`${API_BASE}/knowledge/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: newPath }),
    });
    const result = await response.json();

    if (result.success) {
      // 清除缓存的知识库路径
      cachedKnowledgeBasePath = newPath;

      // 显示清理统计
      const cleanup = result.data.cleanup || {};
      const message = `✅ 路径已更新！\n已清理: ${cleanup.docs || 0} 个文档, ${cleanup.products || 0} 个产品\n\n请点击"扫描知识库"加载新数据`;

      showNotification(message, 'success');
      loadKnowledgeConfig();
      loadDocs(); // 重新加载文档列表（应该为空）
      loadProducts(); // 重新加载产品列表（应该为空）
      loadDocsForGenerate(); // 重新加载生成页面的文档列表
      loadProductsForGenerate(); // 重新加载生成页面的产品列表
    } else {
      showNotification('更新失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('更新知识库路径失败:', error);
    showNotification('更新失败: ' + error.message, 'error');
  }
}

// 目录浏览器相关变量
let currentBrowsePath = '';
let parentBrowsePath = null;
let currentKnowledgeBasePath = null;

// 显示目录浏览器
async function showDirectoryBrowser() {
  const modal = document.getElementById('directoryBrowserModal');
  modal.style.display = 'block';

  // 从当前知识库路径附近开始浏览
  await browseDirectory('');
}

// 关闭目录浏览器
function closeDirectoryBrowser() {
  const modal = document.getElementById('directoryBrowserModal');
  modal.style.display = 'none';
}

// 浏览指定目录
async function browseDirectory(dirPath) {
  try {
    const url = dirPath
      ? `${API_BASE}/knowledge/browse?path=${encodeURIComponent(dirPath)}`
      : `${API_BASE}/knowledge/browse`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      currentBrowsePath = result.data.current;
      parentBrowsePath = result.data.parent;
      currentKnowledgeBasePath = result.data.currentKnowledgeBase;

      // 更新当前路径显示
      const currentDirPathEl = document.getElementById('currentDirPath');
      if (currentBrowsePath) {
        currentDirPathEl.innerHTML = `<code style="font-size: 12px;">${currentBrowsePath}</code>`;
      } else {
        currentDirPathEl.textContent = '选择驱动器';
      }

      // 更新上级目录按钮状态
      const parentBtn = document.getElementById('parentDirBtn');
      // 当 parentBrowsePath 不为 null 时启用按钮（包括空字符串 ''）
      parentBtn.disabled = parentBrowsePath === null;

      // 渲染目录列表
      renderDirectoryList(result.data.items);
    } else {
      showNotification('浏览目录失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('浏览目录失败:', error);
    showNotification('浏览目录失败', 'error');
  }
}

// 渲染目录列表
function renderDirectoryList(items) {
  const listEl = document.getElementById('directoryList');

  if (items.length === 0) {
    listEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">此目录下没有子文件夹</p>';
    return;
  }

  listEl.innerHTML = items.map(item => {
    const isCurrent = item.isCurrent || (currentKnowledgeBasePath && item.path === currentKnowledgeBasePath);
    const bgColor = isCurrent ? '#e3f2fd' : 'white';
    const borderColor = isCurrent ? '#2196F3' : '#e0e0e0';
    const badge = isCurrent ? '<span style="background: #2196F3; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 10px;">当前知识库</span>' : '';

    return `
      <div class="directory-item" onclick="browseDirectory('${item.path.replace(/\\/g, '\\\\')}')"
           style="padding: 10px; margin: 5px 0; border: 2px solid ${borderColor}; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s; background: ${bgColor};"
           onmouseover="if(!${isCurrent}) this.style.background='#f5f5f5'"
           onmouseout="if(!${isCurrent}) this.style.background='white'">
        <span style="font-size: 20px;">${item.isRoot ? '💾' : '📁'}</span>
        <span style="flex: 1; font-family: monospace; font-weight: ${isCurrent ? 'bold' : 'normal'};">${item.name}</span>
        ${badge}
        <span style="color: #999; font-size: 12px;">➡️</span>
      </div>
    `;
  }).join('');
}

// 导航到上级目录
function navigateToParent() {
  if (parentBrowsePath !== null) {
    // 如果 parentBrowsePath 是空字符串，表示返回驱动器选择
    if (parentBrowsePath === '') {
      browseDirectory('');
    } else {
      browseDirectory(parentBrowsePath);
    }
  }
}

// 选择当前目录
function selectCurrentDirectory() {
  if (!currentBrowsePath) {
    showNotification('请选择一个具体的文件夹', 'error');
    return;
  }

  const pathInput = document.getElementById('knowledgePathInput');
  pathInput.value = currentBrowsePath;

  closeDirectoryBrowser();
  showNotification('已选择目录: ' + currentBrowsePath, 'success');
}

async function viewDoc(id) {
  try {
    const response = await fetch(`${API_BASE}/knowledge/${id}`);
    const result = await response.json();

    if (result.success) {
      const doc = result.data;
      showModal(`
        <h2>${doc.title}</h2>
        <p><strong>文件类型:</strong> ${doc.file_type}</p>
        <p><strong>分类:</strong> ${doc.category || '未分类'}</p>
        <p><strong>文件路径:</strong> ${doc.file_path}</p>
        <hr>
        <div style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">
          ${doc.content || '无内容'}
        </div>
      `);
    }
  } catch (error) {
    console.error('查看文档失败:', error);
  }
}

async function deleteDoc(id) {
  if (!confirm('确定要删除这个文档吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/knowledge/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (result.success) {
      showNotification('删除成功', 'success');
      loadDocs();
    } else {
      showNotification('删除失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showNotification('删除失败', 'error');
  }
}

// 分类树显示
async function toggleCategoryTree() {
  const treeDiv = document.getElementById('categoryTree');

  if (treeDiv.style.display === 'none') {
    treeDiv.style.display = 'block';
    await loadCategoryTree();
  } else {
    treeDiv.style.display = 'none';
  }
}

async function loadCategoryTree() {
  const contentDiv = document.getElementById('categoryTreeContent');

  // 显示加载动画
  contentDiv.innerHTML = `
    <div class="loading-tree">
      <div class="loading-spinner"></div>
      <p>正在加载分类树...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/knowledge/categories-tree`);
    const result = await response.json();

    if (result.success && result.data) {
      displayCategoryTree(result.data);
    } else {
      contentDiv.innerHTML = '<p class="error">加载失败</p>';
    }
  } catch (error) {
    console.error('加载分类树失败:', error);
    contentDiv.innerHTML = '<p class="error">加载失败: ' + error.message + '</p>';
  }
}

function displayCategoryTree(tree, level = 0) {
  const contentDiv = document.getElementById('categoryTreeContent');

  if (Object.keys(tree).length === 0) {
    contentDiv.innerHTML = '<p class="empty">暂无分类数据，请先扫描知识库</p>';
    return;
  }

  // 只在顶层设置innerHTML
  if (level === 0) {
    contentDiv.innerHTML = buildTreeHTML(tree, 0);
  }
}

function buildTreeHTML(tree, level) {
  let html = '<ul class="tree-list" style="padding-left: ' + (level * 20) + 'px">';

  for (const key in tree) {
    const node = tree[key];
    html += '<li class="tree-item">';
    html += '<span class="tree-icon">📁</span>';
    html += '<span class="tree-name">' + node.name + '</span>';
    html += '<span class="tree-count">(' + node.count + ' 文档)</span>';

    if (node.children && Object.keys(node.children).length > 0) {
      html += buildTreeHTML(node.children, level + 1);
    }

    html += '</li>';
  }

  html += '</ul>';
  return html;
}

// 产品管理
async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    const result = await response.json();

    if (result.success) {
      displayProducts(result.data);
    }
  } catch (error) {
    console.error('加载产品失败:', error);
    document.getElementById('productsList').innerHTML = '<p class="loading">加载失败</p>';
  }
}

function displayProducts(products) {
  const container = document.getElementById('productsList');

  if (products.length === 0) {
    container.innerHTML = '<p class="loading">暂无产品</p>';
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="card">
      <h3>${product.name}</h3>
      <div class="meta">
        <span>分类: ${product.category_name || '未分类'}</span> |
        <span>图片数: ${product.image_count}</span>
      </div>
      <div class="content">
        ${product.description || '无描述'}
      </div>
      <div class="actions">
        <button onclick="viewProduct(${product.id})" class="btn btn-secondary">查看详情</button>
        <button onclick="deleteProduct(${product.id})" class="btn btn-secondary">删除</button>
      </div>
    </div>
  `).join('');
}

async function viewProduct(id) {
  try {
    const response = await fetch(`${API_BASE}/products/${id}`);
    const result = await response.json();

    if (result.success) {
      const product = result.data;

      // 构建图片轮播HTML
      let imageGalleryHtml = '';
      if (product.images && product.images.length > 0) {
        imageGalleryHtml = `
          <div class="image-gallery">
            <div class="image-viewer">
              <button class="gallery-btn prev" onclick="changeProductImage(-1)">‹</button>
              <div class="image-container">
                ${product.images.map((img, index) => `
                  <img
                    src="${img.url || img.file_path}"
                    alt="${img.file_name}"
                    class="product-image ${index === 0 ? 'active' : ''}"
                    data-index="${index}"
                    onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23ddd%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E图片加载失败%3C/text%3E%3C/svg%3E'"
                  >
                `).join('')}
              </div>
              <button class="gallery-btn next" onclick="changeProductImage(1)">›</button>
            </div>
            <div class="image-info">
              <span id="imageCounter">1 / ${product.images.length}</span>
              <span id="imageName">${product.images[0].file_name}</span>
              <span class="image-type-badge">${product.images[0].image_type === 'main' ? '主图' : '详情图'}</span>
            </div>
            <div class="thumbnail-list">
              ${product.images.map((img, index) => `
                <img
                  src="${img.url || img.file_path}"
                  alt="${img.file_name}"
                  class="thumbnail ${index === 0 ? 'active' : ''}"
                  onclick="selectProductImage(${index})"
                  data-index="${index}"
                  onerror="this.style.display='none'"
                >
              `).join('')}
            </div>
          </div>
        `;
      } else {
        imageGalleryHtml = '<p class="no-images">暂无产品图片</p>';
      }

      showModal(`
        <h2>${product.name}</h2>
        <p><strong>分类:</strong> ${product.category_name || '未分类'}</p>
        <p><strong>描述:</strong> ${product.description || '无'}</p>
        <p><strong>特点:</strong> ${product.features || '无'}</p>
        <p><strong>优势:</strong> ${product.benefits || '无'}</p>
        <p><strong>使用方法:</strong> ${product.usage || '无'}</p>
        <hr>
        <h3>产品图片 (${product.images.length})</h3>
        ${imageGalleryHtml}
      `);

      // 存储图片数据供切换使用
      window.currentProductImages = product.images;
      window.currentImageIndex = 0;
    }
  } catch (error) {
    console.error('查看产品失败:', error);
  }
}

// 图片轮播控制函数
function changeProductImage(direction) {
  const images = document.querySelectorAll('.product-image');
  const thumbnails = document.querySelectorAll('.thumbnail');

  if (!images.length) return;

  // 移除当前active
  images[window.currentImageIndex].classList.remove('active');
  thumbnails[window.currentImageIndex].classList.remove('active');

  // 计算新索引
  window.currentImageIndex += direction;
  if (window.currentImageIndex >= images.length) {
    window.currentImageIndex = 0;
  } else if (window.currentImageIndex < 0) {
    window.currentImageIndex = images.length - 1;
  }

  // 添加新active
  images[window.currentImageIndex].classList.add('active');
  thumbnails[window.currentImageIndex].classList.add('active');

  // 更新信息
  updateImageInfo();
}

function selectProductImage(index) {
  const images = document.querySelectorAll('.product-image');
  const thumbnails = document.querySelectorAll('.thumbnail');

  images[window.currentImageIndex].classList.remove('active');
  thumbnails[window.currentImageIndex].classList.remove('active');

  window.currentImageIndex = index;

  images[window.currentImageIndex].classList.add('active');
  thumbnails[window.currentImageIndex].classList.add('active');

  updateImageInfo();
}

function updateImageInfo() {
  const currentImg = window.currentProductImages[window.currentImageIndex];
  document.getElementById('imageCounter').textContent =
    `${window.currentImageIndex + 1} / ${window.currentProductImages.length}`;
  document.getElementById('imageName').textContent = currentImg.file_name;

  const badge = document.querySelector('.image-type-badge');
  if (badge) {
    badge.textContent = currentImg.image_type === 'main' ? '主图' : '详情图';
  }
}

async function deleteProduct(id) {
  if (!confirm('确定要删除这个产品吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (result.success) {
      showNotification('删除成功', 'success');
      loadProducts();
    } else {
      showNotification('删除失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showNotification('删除失败', 'error');
  }
}

// 自动扫描产品
async function autoScanProducts() {
  if (!confirm('确定要自动扫描产品资料文件夹吗？系统将自动创建产品和导入图片。')) {
    return;
  }

  showNotification('正在扫描产品资料...', 'success');

  try {
    const response = await fetch(`${API_BASE}/auto-scan/products`, {
      method: 'POST',
    });
    const result = await response.json();

    if (result.success) {
      const data = result.data;
      showNotification(
        `扫描完成！共扫描 ${data.total} 个产品文件夹，创建 ${data.created} 个新产品，跳过 ${data.skipped} 个已存在产品`,
        'success'
      );

      if (data.products.length > 0) {
        let detailMsg = '创建的产品：\n';
        data.products.forEach(p => {
          detailMsg += `- ${p.name}: ${p.docs}个文档, ${p.images}张图片\n`;
        });
        console.log(detailMsg);
      }

      loadProducts();
      loadProductsForGenerate(); // 刷新生成文案页面的产品列表
    } else {
      showNotification('扫描失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('扫描失败:', error);
    showNotification('扫描失败', 'error');
  }
}

// 清理不属于当前知识库的旧产品
async function cleanupOldProducts() {
  if (!confirm('确定要清理不属于当前知识库的旧产品吗？\n\n此操作将删除数据库中所有不在当前知识库路径下的产品记录。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products/cleanup`, {
      method: 'POST',
    });
    const result = await response.json();

    if (result.success) {
      showNotification(result.data.message, 'success');
      loadProducts(); // 重新加载产品列表
      loadProductsForGenerate(); // 刷新生成文案页面的产品列表
    } else {
      showNotification('清理失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('清理失败:', error);
    showNotification('清理失败', 'error');
  }
}

// 显示添加产品表单
async function showAddProductForm() {
  // 加载分类列表
  let categoriesHtml = '<option value="">未分类</option>';
  try {
    const response = await fetch(`${API_BASE}/categories`);
    const result = await response.json();
    if (result.success) {
      categoriesHtml = result.data.map(cat =>
        `<option value="${cat.id}">${cat.name}</option>`
      ).join('');
    }
  } catch (error) {
    console.error('加载分类失败:', error);
  }

  showModal(`
    <h2>添加产品</h2>
    <form id="addProductForm" onsubmit="submitProductForm(event)">
      <div class="form-group">
        <label>产品名称 *</label>
        <input type="text" name="name" required>
      </div>
      <div class="form-group">
        <label>分类</label>
        <select name="category_id">
          ${categoriesHtml}
        </select>
      </div>
      <div class="form-group">
        <label>描述</label>
        <textarea name="description" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>特点</label>
        <textarea name="features" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>优势</label>
        <textarea name="benefits" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>使用方法</label>
        <textarea name="usage" rows="3"></textarea>
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary">创建产品</button>
        <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
      </div>
    </form>
  `);
}

async function submitProductForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const data = {
    name: formData.get('name'),
    category_id: formData.get('category_id') ? parseInt(formData.get('category_id')) : null,
    description: formData.get('description'),
    features: formData.get('features'),
    benefits: formData.get('benefits'),
    usage: formData.get('usage'),
  };

  try {
    const response = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (result.success) {
      showNotification('产品创建成功', 'success');
      closeModal();
      loadProducts();
      loadProductsForGenerate();
    } else {
      showNotification('创建失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('创建产品失败:', error);
    showNotification('创建失败', 'error');
  }
}

// 文案管理
async function loadPosts() {
  const status = document.getElementById('filterStatus')?.value || '';

  try {
    const response = await fetch(`${API_BASE}/posts?status=${status}`);
    const result = await response.json();

    if (result.success) {
      displayPosts(result.data);
    }
  } catch (error) {
    console.error('加载文案失败:', error);
    document.getElementById('postsList').innerHTML = '<p class="loading">加载失败</p>';
  }
}

function displayPosts(posts) {
  const container = document.getElementById('postsList');

  if (posts.length === 0) {
    container.innerHTML = '<p class="loading">暂无文案</p>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="card">
      ${batchMode ? `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--glass-border);">
          <label class="form-check">
            <input type="checkbox" class="post-checkbox form-checkbox" value="${post.id}" onchange="updateSelectedCount()">
            <span style="font-weight: 500; color: var(--gray-700);">选择</span>
          </label>
        </div>
      ` : ''}
      <h3>${post.title}</h3>
      <div class="meta">
        <span class="status-badge status-${post.status}">${getStatusText(post.status)}</span> |
        <span>产品: ${post.product_name || '未关联'}</span> |
        <span>创建时间: ${new Date(post.created_at).toLocaleString()}</span>
      </div>
      <div class="content">
        ${post.content.substring(0, 200)}...
      </div>
      ${post.images && post.images.length > 0 ? `
        <div class="post-images-preview">
          <span class="image-count-badge">📷 ${post.images.length} 张图片</span>
          <div class="mini-images">
            ${post.images.slice(0, 4).map(img => `
              <img src="${getImageUrl(img)}" alt="图片预览"
                   onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2280%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%2280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3E加载失败%3C/text%3E%3C/svg%3E';"
                   loading="lazy">
            `).join('')}
            ${post.images.length > 4 ? `<span class="more-images">+${post.images.length - 4}</span>` : ''}
          </div>
        </div>
      ` : `
        <div class="no-images-warning">⚠️ 未添加图片</div>
      `}
      ${post.tags.length > 0 ? `
        <div class="tags">
          ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
        </div>
      ` : ''}
      ${!batchMode ? `
        <div class="actions">
          <button onclick="viewPost(${post.id})" class="btn btn-secondary">查看</button>
          <button onclick="editPost(${post.id})" class="btn btn-secondary">编辑</button>
          ${post.status === 'draft' ? `
            <button onclick="publishPost(${post.id})" class="btn btn-primary" ${!post.images || post.images.length === 0 ? 'title="请先添加图片"' : ''}>发布</button>
          ` : ''}
          ${post.status === 'published' || post.status === 'failed' ? `
            <button onclick="republishPost(${post.id})" class="btn btn-primary">重新发布</button>
          ` : ''}
          <button onclick="deletePost(${post.id})" class="btn btn-secondary">删除</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function getStatusText(status) {
  const statusMap = {
    draft: '草稿',
    published: '已发布',
    failed: '发布失败',
  };
  return statusMap[status] || status;
}

async function viewPost(id) {
  try {
    const response = await fetch(`${API_BASE}/posts/${id}`);
    const result = await response.json();

    if (result.success) {
      const post = result.data;
      showModal(`
        <h2>${post.title}</h2>
        <p><strong>状态:</strong> <span class="status-badge status-${post.status}">${getStatusText(post.status)}</span></p>
        <p><strong>产品:</strong> ${post.product_name || '未关联'}</p>
        <p><strong>标签:</strong> ${post.tags.join(', ')}</p>
        <hr>
        <div style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">
          ${post.content}
        </div>
      `);
    }
  } catch (error) {
    console.error('查看文案失败:', error);
  }
}

// 小红书登录相关变量
let xhsLoginWindow = null;
let xhsLoginCheckInterval = null;
let pendingPublishPostId = null;

async function publishPost(id) {
  if (!confirm('确定要发布到小红书吗？')) {
    return;
  }

  // 直接发布（MCP服务已登录）
  showNotification('正在发布到小红书...', 'success');
  await doPublish(id);
}

async function doPublish(id) {
  // 检查是否正在上传
  if (isUploading) {
    showNotification('图片正在上传中，请等待上传完成后再发布', 'error');
    return;
  }

  try {
    // 首先从服务器获取文案信息
    console.log('📋 正在获取文案信息...');
    const postResponse = await fetch(`${API_BASE}/posts/${id}`);
    const postResult = await postResponse.json();

    if (!postResult.success) {
      showNotification('获取文案信息失败', 'error');
      return;
    }

    const post = postResult.data;

    // 如果标签被编辑过，先更新到服务器
    if (currentTags && currentTags.length > 0) {
      console.log('📝 正在更新标签...');
      const updateResponse = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: post.title,
          content: post.content,
          images: post.images,
          tags: currentTags
        }),
      });

      if (updateResponse.ok) {
        console.log('✅ 标签已更新');
        post.tags = currentTags; // 更新本地数据
      } else {
        console.warn('⚠️ 标签更新失败，使用原标签');
      }
    }

    let imagesToPublish = [];

    // 优先使用服务器保存的图片
    if (post.images && post.images.length > 0) {
      imagesToPublish = post.images;
      console.log('✅ 使用文案已保存的图片:', imagesToPublish.length, '张');
    }
    // 如果服务器没有图片，检查当前页面的 uploadedImages
    else if (uploadedImages && uploadedImages.length > 0) {
      imagesToPublish = uploadedImages;
      console.log('✅ 使用当前页面上传的图片:', imagesToPublish.length, '张');
    }
    // 两边都没有图片，提示用户
    else {
      showNotification('请先在编辑页面添加图片，然后保存后再发布', 'error');
      return;
    }

    console.log('准备发布，图片数量:', imagesToPublish.length);
    console.log('图片列表:', imagesToPublish);

  // 显示发布进度模态框
  showPublishProgress();

    // 步骤1: 准备数据
    updatePublishStep(1, 'active', '正在准备发布数据...', 10);
    await sleep(500);

    // 步骤2: 上传图片
    updatePublishStep(1, 'completed', '数据准备完成', 25);
    updatePublishStep(2, 'active', `正在上传 ${imagesToPublish.length} 张图片到小红书...`, 30);

    const response = await fetch(`${API_BASE}/posts/${id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: imagesToPublish,
      }),
    });
    const result = await response.json();

    // 步骤3: 发布内容
    updatePublishStep(2, 'completed', '图片上传完成', 60);
    updatePublishStep(3, 'active', '正在发布笔记内容...', 70);
    await sleep(500);

    if (result.success) {
      // 步骤4: 完成
      updatePublishStep(3, 'completed', '笔记发布完成', 90);
      updatePublishStep(4, 'active', '发布成功！', 100);
      await sleep(500);
      updatePublishStep(4, 'completed', '所有步骤完成', 100);

      // 延迟关闭进度模态框
      setTimeout(() => {
        hidePublishProgress();

        // 显示详细的成功信息
        const data = result.data;
        let successMsg = '✅ 发布成功！';

        if (data.note_id) {
          successMsg += `\n笔记ID: ${data.note_id}`;
        }

        if (data.note_url) {
          successMsg += `\n`;
          // 显示带链接的模态框
          showModal(`
            <h2>🎉 发布成功！</h2>
            <div style="margin: 20px 0;">
              <p style="font-size: 1.1rem; color: #28a745; margin-bottom: 20px;">
                您的内容已成功发布到小红书！
              </p>
              ${data.note_id ? `<p><strong>笔记ID:</strong> ${data.note_id}</p>` : ''}
              ${data.note_url ? `
                <p style="margin-top: 15px;">
                  <a href="${data.note_url}" target="_blank" class="btn btn-primary">
                    📱 在小红书中查看
                  </a>
                </p>
              ` : ''}
              ${data.message ? `
                <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;">
                  <strong>详细信息:</strong>
                  <pre style="margin-top: 10px; white-space: pre-wrap; font-size: 0.9rem;">${data.message}</pre>
                </div>
              ` : ''}
            </div>
          `);
        } else {
          showNotification(successMsg, 'success');
        }

        loadPosts();
      }, 1500);
    } else {
      // 标记当前步骤为错误
      const currentStepElement = document.querySelector('.publish-step.active');
      if (currentStepElement) {
        currentStepElement.classList.remove('active');
        currentStepElement.classList.add('error');
        const statusEl = currentStepElement.querySelector('.step-status');
        if (statusEl) {
          statusEl.textContent = '发布失败！';
        }
      }

      // 延迟关闭进度模态框并显示错误
      setTimeout(() => {
        hidePublishProgress();

        // 显示详细的错误信息
        let errorMsg = '❌ 发布失败\n\n';
        errorMsg += result.error || '未知错误';

        if (result.errorDetails) {
          errorMsg += '\n\n详细信息: ' + JSON.stringify(result.errorDetails, null, 2);
        }

        // 显示错误模态框
        showModal(`
        <h2>❌ 发布失败</h2>
        <div style="margin: 20px 0;">
          <p style="font-size: 1rem; color: #dc3545; margin-bottom: 15px;">
            ${result.error || '发布过程中出现错误'}
          </p>

          ${result.error && result.error.includes('session initialization') ? `
            <div style="padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; margin: 20px 0;">
              <h4 style="margin-bottom: 10px;">💡 MCP服务未登录</h4>
              <p style="margin-bottom: 15px;">MCP服务还没有登录小红书账号。</p>

              <div style="padding: 12px; background: #fff; border-radius: 6px; margin-bottom: 15px;">
                <p style="font-weight: 600; margin-bottom: 8px;">⚠️ 重要提示：</p>
                <p style="font-size: 0.9rem; color: #666;">
                  在浏览器中登录小红书网站<strong>不会</strong>让MCP服务获得登录状态！<br>
                  MCP服务和浏览器的登录状态是<strong>完全独立</strong>的。
                </p>
              </div>

              <p style="margin-bottom: 10px;"><strong>正确的登录方法（使用MCP Inspector）：</strong></p>
              <ol style="margin-left: 20px; margin-top: 10px; line-height: 1.8;">
                <li style="margin-bottom: 8px;">
                  <strong>准备手机App：</strong>打开小红书手机App，准备扫码
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>启动MCP Inspector：</strong>
                  <br>在终端运行：<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">npx @modelcontextprotocol/inspector</code>
                  <br><small style="color: #666;">或运行快捷脚本：<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">./login-guide.sh</code></small>
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>连接到MCP服务：</strong>
                  <br>在浏览器中输入：<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">http://localhost:8080/mcp</code>
                  <br>然后点击 "Connect" 按钮
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>扫描二维码：</strong>会显示登录二维码，用手机App扫描
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>确认登录：</strong>在手机上点击确认
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>重启服务：</strong>
                  <br>登录成功后运行：<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">docker compose restart xiaohongshu-mcp</code>
                </li>
                <li>
                  <strong>重新发布：</strong>刷新本页面，再次尝试发布
                </li>
              </ol>

              <p style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 0.9rem;">
                📖 <a href="https://github.com/your-repo/xhs#小红书mcp登录指南" target="_blank" style="color: #667eea; text-decoration: underline;">查看完整README登录指南</a>
              </p>
            </div>
          ` : ''}

          ${result.errorDetails ? `
            <details style="margin-top: 20px;">
              <summary style="cursor: pointer; color: #667eea;">查看技术详情</summary>
              <pre style="margin-top: 10px; padding: 15px; background: #f0f0f0; border-radius: 8px; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(result.errorDetails, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      `);
      }, 1500);
    }
  } catch (error) {
    console.error('发布失败:', error);

    // 标记错误
    const currentStepElement = document.querySelector('.publish-step.active');
    if (currentStepElement) {
      currentStepElement.classList.remove('active');
      currentStepElement.classList.add('error');
      const statusEl = currentStepElement.querySelector('.step-status');
      if (statusEl) {
        statusEl.textContent = '网络错误！';
      }
    }

    // 延迟关闭进度模态框并显示错误
    setTimeout(() => {
      hidePublishProgress();

      showModal(`
        <h2>❌ 网络错误</h2>
        <div style="margin: 20px 0;">
          <p style="color: #dc3545;">无法连接到服务器或发生网络错误。</p>
          <p style="margin-top: 10px; font-size: 0.9rem;">错误信息: ${error.message}</p>
        </div>
      `);
    }, 1500);
  }
}

// 辅助函数：sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 显示发布进度模态框
function showPublishProgress() {
  const modal = document.getElementById('publishProgressModal');
  modal.style.display = 'block';

  // 重置所有步骤
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`publishStep${i}`);
    step.className = 'publish-step';
    const statusEl = step.querySelector('.step-status');
    statusEl.textContent = i === 1 ? '准备中...' : '等待中...';
  }

  // 重置进度条
  document.getElementById('publishProgressFill').style.width = '0%';
  document.getElementById('publishProgressText').textContent = '0%';
}

// 隐藏发布进度模态框
function hidePublishProgress() {
  const modal = document.getElementById('publishProgressModal');
  modal.style.display = 'none';
}

// 更新发布步骤
function updatePublishStep(stepNumber, status, message, progress) {
  const step = document.getElementById(`publishStep${stepNumber}`);
  const statusEl = step.querySelector('.step-status');

  // 移除所有状态类
  step.classList.remove('active', 'completed', 'error');

  // 添加新状态
  if (status) {
    step.classList.add(status);
  }

  // 更新状态文本
  if (message) {
    statusEl.textContent = message;
  }

  // 更新进度条
  if (progress !== undefined) {
    document.getElementById('publishProgressFill').style.width = `${progress}%`;
    document.getElementById('publishProgressText').textContent = `${progress}%`;
  }
}

// 重新发布文案
async function republishPost(id) {
  try {
    // 获取文案详情
    const response = await fetch(`${API_BASE}/posts/${id}`);
    const result = await response.json();

    if (!result.success) {
      showNotification('获取文案失败', 'error');
      return;
    }

    const post = result.data;

    // 切换到生成文案标签页
    switchTab('generate');

    // 填充表单
    currentPostId = id;
    const titleInput = document.getElementById('generatedTitle');
    const textArea = document.getElementById('generatedText');

    titleInput.value = post.title;
    textArea.value = post.content;

    // 移除readonly属性，使字段可编辑
    titleInput.removeAttribute('readonly');
    textArea.removeAttribute('readonly');

    // 显示标签
    const tagsContainer = document.getElementById('generatedTags');
    tagsContainer.innerHTML = post.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');

    // 清空之前上传的图片，加载文案已有的图片
    uploadedImages = [...post.images]; // 复制文案的图片列表
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = post.images.map(img => `
      <div class="image-preview-item" data-path="${img}">
        <img src="${getImageUrl(img)}" alt="预览"
             onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22120%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22150%22 height=%22120%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3E图片加载失败%3C/text%3E%3C/svg%3E';"
             loading="lazy">
        <button class="remove-image" onclick="removeImage('${img}')" title="删除">×</button>
      </div>
    `).join('');

    // 如果文案关联了产品，设置产品选择并加载产品图片
    if (post.product_id) {
      const productSelect = document.getElementById('selectProduct');
      productSelect.value = post.product_id;
      // 加载产品图片
      await loadProductImages();
    }

    // 显示生成内容区域
    document.getElementById('generatedContent').style.display = 'block';

    // 添加保存草稿按钮（如果还没有的话）
    addSaveDraftButton();

    // 滚动到内容区域
    setTimeout(() => {
      document.getElementById('generatedContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);

    showNotification('内容已加载，可以编辑后保存或直接发布', 'success');
  } catch (error) {
    console.error('加载文案失败:', error);
    showNotification('加载文案失败', 'error');
  }
}

// 添加保存草稿按钮
function addSaveDraftButton() {
  const actionsDiv = document.querySelector('#generatedContent .actions');
  if (!actionsDiv) return;

  // 检查是否已经有保存草稿按钮
  if (document.getElementById('saveDraftBtn')) {
    return;
  }

  // 创建保存草稿按钮
  const saveDraftBtn = document.createElement('button');
  saveDraftBtn.id = 'saveDraftBtn';
  saveDraftBtn.className = 'btn btn-secondary';
  saveDraftBtn.textContent = '保存草稿';
  saveDraftBtn.onclick = saveDraftChanges;

  // 插入到第一个按钮之前
  actionsDiv.insertBefore(saveDraftBtn, actionsDiv.firstChild);
}

// 保存草稿修改
async function saveDraftChanges() {
  if (!currentPostId) {
    showNotification('没有可保存的文案', 'error');
    return;
  }

  const title = document.getElementById('generatedTitle').value;
  const content = document.getElementById('generatedText').value;

  if (!title || !content) {
    showNotification('标题和内容不能为空', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/posts/${currentPostId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        content: content,
        images: uploadedImages,
        tags: [], // 保持现有标签
      }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification('草稿保存成功！', 'success');
      loadPosts(); // 刷新文案列表
    } else {
      showNotification('保存失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('保存草稿失败:', error);
    showNotification('保存失败: ' + error.message, 'error');
  }
}

function showXhsLoginModal() {
  document.getElementById('xhsLoginModal').style.display = 'block';
  document.getElementById('loginStatus').style.display = 'block';

  // 开始轮询检查登录状态
  startLoginCheck();
}


function openXhsLogin() {
  // 打开小红书登录页面
  const loginUrl = 'https://www.xiaohongshu.com/explore';
  xhsLoginWindow = window.open(loginUrl, 'xhsLogin', 'width=800,height=600');

  // 显示检查状态
  document.getElementById('loginStatus').innerHTML = `
    <div class="checking-login">
      <div class="spinner-small"></div>
      <span>正在检测登录状态...</span>
      <p style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">请在新窗口中完成登录</p>
    </div>
  `;
}

function startLoginCheck() {
  // 每3秒检查一次登录状态
  xhsLoginCheckInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/xhs/check-login`);
      const result = await response.json();

      if (result.success && result.data && result.data.logged_in) {
        // 登录成功
        stopLoginCheck();

        document.getElementById('loginStatus').innerHTML = `
          <div class="login-success">
            <span style="font-size: 2rem;">✅</span>
            <p>登录成功！正在发布...</p>
          </div>
        `;

        // 关闭登录窗口
        if (xhsLoginWindow && !xhsLoginWindow.closed) {
          xhsLoginWindow.close();
        }

        // 延迟1秒后发布
        setTimeout(async () => {
          closeXhsLoginModal();

          if (pendingPublishPostId) {
            await doPublish(pendingPublishPostId);
            pendingPublishPostId = null;
          }
        }, 1000);
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  }, 3000);
}

function stopLoginCheck() {
  if (xhsLoginCheckInterval) {
    clearInterval(xhsLoginCheckInterval);
    xhsLoginCheckInterval = null;
  }
}

async function deletePost(id) {
  if (!confirm('确定要删除这个文案吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/posts/${id}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (result.success) {
      showNotification('删除成功', 'success');
      loadPosts();
    } else {
      showNotification('删除失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showNotification('删除失败', 'error');
  }
}

// =============================================================================
// 批量操作功能
// =============================================================================

// 进入批量操作模式
function enterBatchMode() {
  batchMode = true;
  selectedPostIds = [];

  // 显示批量操作栏
  document.getElementById('batchActionsBar').style.display = 'flex';
  document.getElementById('normalActionsBar').style.display = 'none';

  // 重新加载文案列表以显示复选框
  loadPosts();

  showNotification('已进入批量操作模式', 'info');
}

// 取消批量操作模式
function cancelBatchMode() {
  batchMode = false;
  selectedPostIds = [];

  // 隐藏批量操作栏
  document.getElementById('batchActionsBar').style.display = 'none';
  document.getElementById('normalActionsBar').style.display = 'flex';

  // 重置全选复选框
  const selectAllCheckbox = document.getElementById('selectAllPosts');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
  }

  // 重新加载文案列表以隐藏复选框
  loadPosts();

  showNotification('已退出批量操作模式', 'info');
}

// 全选/取消全选
function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('selectAllPosts');
  const checkboxes = document.querySelectorAll('.post-checkbox');

  checkboxes.forEach(cb => {
    cb.checked = selectAllCheckbox.checked;
  });

  updateSelectedCount();
}

// 更新已选择数量显示
function updateSelectedCount() {
  selectedPostIds = Array.from(document.querySelectorAll('.post-checkbox:checked'))
    .map(cb => parseInt(cb.value));

  const countElement = document.getElementById('selectedCount');
  if (countElement) {
    countElement.textContent = `已选择 ${selectedPostIds.length} 项`;
  }

  // 同步全选复选框状态
  const selectAllCheckbox = document.getElementById('selectAllPosts');
  const allCheckboxes = document.querySelectorAll('.post-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
  }
}

// 批量删除
async function batchDelete() {
  if (selectedPostIds.length === 0) {
    showNotification('请至少选择一项', 'error');
    return;
  }

  if (!confirm(`确定要删除选中的 ${selectedPostIds.length} 项吗？此操作不可恢复！`)) {
    return;
  }

  let successCount = 0;
  let failCount = 0;

  showNotification(`正在删除 ${selectedPostIds.length} 项...`, 'info');

  // 依次删除每个文案
  for (const postId of selectedPostIds) {
    try {
      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`删除文案 ${postId} 失败:`, result.error);
      }
    } catch (error) {
      failCount++;
      console.error(`删除文案 ${postId} 失败:`, error);
    }
  }

  // 显示结果
  if (successCount > 0) {
    showNotification(`✅ 成功删除 ${successCount} 项${failCount > 0 ? `，失败 ${failCount} 项` : ''}`, 'success');
  } else {
    showNotification(`❌ 删除失败`, 'error');
  }

  // 退出批量模式并刷新列表
  cancelBatchMode();
}

// 生成文案
async function loadProductsForGenerate() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    const result = await response.json();

    if (result.success) {
      const select = document.getElementById('selectProduct');
      select.innerHTML = '<option value="">请选择产品...</option>' +
        result.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  } catch (error) {
    console.error('加载产品列表失败:', error);
  }
}

async function loadDocsForGenerate() {
  try {
    const response = await fetch(`${API_BASE}/knowledge`);
    const result = await response.json();

    if (result.success) {
      const container = document.getElementById('knowledgeSelector');

      if (!container) {
        console.error('knowledgeSelector element not found');
        return;
      }

      if (result.data.length === 0) {
        container.innerHTML = '<p class="empty" style="color: #999; padding: 10px;">暂无知识库文档，请先在"知识库管理"中扫描或添加文档</p>';
        return;
      }

      container.innerHTML = result.data.map(doc => `
        <div class="checkbox-item">
          <input type="checkbox" id="doc-${doc.id}" value="${doc.id}">
          <label for="doc-${doc.id}">${doc.title} (${doc.category || '未分类'})</label>
        </div>
      `).join('');

      console.log(`✅ 已加载 ${result.data.length} 个知识库文档`);
    } else {
      console.error('加载知识库失败:', result.error || result.message);
      const container = document.getElementById('knowledgeSelector');
      if (container) {
        container.innerHTML = `<p class="empty" style="color: #f44336; padding: 10px;">加载失败: ${result.error || result.message || '未知错误'}</p>`;
      }
    }
  } catch (error) {
    console.error('加载知识库失败:', error);
    const container = document.getElementById('knowledgeSelector');
    if (container) {
      container.innerHTML = '<p class="empty" style="color: #f44336; padding: 10px;">加载失败，请检查网络连接</p>';
    }
  }
}

// 加载产品图片（优化版）
async function loadProductImages() {
  const productId = document.getElementById('selectProduct').value;
  const section = document.getElementById('productImagesSection');
  const container = document.getElementById('productImagesSelector');

  if (!productId) {
    section.style.display = 'none';
    return;
  }

  try {
    // 显示加载状态
    container.innerHTML = '<div class="loading"><div class="spinner"></div>加载图片中...</div>';
    section.style.display = 'block';

    const response = await fetch(`${API_BASE}/products/${productId}`);
    const result = await response.json();

    if (result.success && result.data.images && result.data.images.length > 0) {
      // 使用 DocumentFragment 优化 DOM 操作
      const fragment = document.createDocumentFragment();

      result.data.images.forEach(img => {
        const div = document.createElement('div');
        div.className = 'product-image-item';
        div.dataset.filePath = img.file_path;
        div.dataset.url = img.url;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `product-img-${img.id}`;

        const imgEl = document.createElement('img');
        imgEl.src = img.url;
        imgEl.alt = img.file_name;
        imgEl.loading = 'lazy';
        imgEl.onerror = function() {
          this.onerror = null;
          this.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3E图片加载失败%3C/text%3E%3C/svg%3E';
        };

        const badge = document.createElement('span');
        badge.className = 'image-type-badge';
        badge.textContent = img.image_type === 'main' ? '主图' : '详情图';

        div.appendChild(checkbox);
        div.appendChild(imgEl);
        div.appendChild(badge);
        fragment.appendChild(div);
      });

      container.innerHTML = '';
      container.appendChild(fragment);

      // 使用事件委托，只在容器上添加一个事件监听器
      if (!container.dataset.listenerAdded) {
        container.addEventListener('click', debounce(handleProductImageClick, 100));
        container.dataset.listenerAdded = 'true';
      }

      console.log('已加载产品图片:', result.data.images.length, '张');
    } else {
      section.style.display = 'none';
      console.log('该产品没有图片');
    }
  } catch (error) {
    console.error('加载产品图片失败:', error);
    container.innerHTML = '<div class="loading" style="color: var(--error);">加载失败，请重试</div>';
  }
}

// 处理产品图片点击（使用事件委托）
function handleProductImageClick(e) {
  const item = e.target.closest('.product-image-item');
  if (!item) return;

  const checkbox = item.querySelector('input[type="checkbox"]');
  if (!checkbox) return;

  // 如果点击的是 checkbox 本身，让它自然切换
  if (e.target === checkbox) {
    // checkbox 会自动切换，我们只需要处理后续逻辑
  } else {
    // 如果点击的是其他区域，手动切换 checkbox
    checkbox.checked = !checkbox.checked;
  }

  const filePath = item.dataset.filePath;
  const url = item.dataset.url;

  if (checkbox.checked) {
    item.classList.add('selected');
    if (!uploadedImages.includes(filePath)) {
      uploadedImages.push(filePath);
      const imageUrl = url || `/${filePath}`;
      addImageToPreview(filePath, imageUrl);
    }
  } else {
    item.classList.remove('selected');
    const index = uploadedImages.indexOf(filePath);
    if (index > -1) {
      uploadedImages.splice(index, 1);
      removeImageFromPreview(filePath);
    }
  }
}

// 旧的 toggleProductImage 函数已被 handleProductImageClick 替代（使用事件委托优化性能）

// 添加图片到预览区域（优化版）
function addImageToPreview(path, url) {
  const preview = document.getElementById('imagePreview');

  // 检查是否已存在
  const existing = preview.querySelector(`[data-path="${path}"]`);
  if (existing) return;

  const previewItem = document.createElement('div');
  previewItem.className = 'image-preview-item';
  previewItem.dataset.path = path;

  const img = document.createElement('img');
  img.src = url;
  img.alt = '预览';
  img.loading = 'lazy';

  const button = document.createElement('button');
  button.className = 'remove-image';
  button.title = '删除';
  button.textContent = '×';
  button.onclick = () => removeImage(path);

  previewItem.appendChild(img);
  previewItem.appendChild(button);
  preview.appendChild(previewItem);
}

// 从预览区域移除图片（优化版）
function removeImageFromPreview(path) {
  const preview = document.getElementById('imagePreview');
  const item = preview.querySelector(`[data-path="${path}"]`);
  if (item) {
    item.remove();
  }
}

async function generateContent() {
  const productId = document.getElementById('selectProduct').value;

  if (!productId) {
    showNotification('请选择产品', 'error');
    return;
  }

  const style = document.getElementById('contentStyle').value;
  const targetAudience = document.getElementById('targetAudience').value;
  const wordCount = parseInt(document.getElementById('wordCountSlider').value);

  const selectedDocs = Array.from(document.querySelectorAll('#knowledgeSelector input:checked'))
    .map(input => parseInt(input.value));

  const selectedModel = document.getElementById('aiModel').value;

  // 获取v2.2和v2.3参数
  const useV2 = document.getElementById('useV2').checked;
  const learnFromHot = document.getElementById('learnFromHot').checked;
  const hotKeywords = document.getElementById('hotKeywords').value.trim();

  // 显示进度条
  const progressDiv = document.getElementById('generatingProgress');
  const generateBtn = document.getElementById('generateBtn');
  const generatedContent = document.getElementById('generatedContent');

  generateBtn.disabled = true;
  generatedContent.style.display = 'none';
  progressDiv.style.display = 'block';

  // 启动进度条动画
  const progressBar = progressDiv.querySelector('.progress-bar-fill');
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90; // 最多到90%，等实际完成
    progressBar.style.width = progress + '%';
  }, 500);

  try {
    const requestBody = {
      product_id: parseInt(productId),
      style: style,
      target_audience: targetAudience,
      knowledge_docs: selectedDocs,
      model: selectedModel,
      images: uploadedImages,
      use_v2: useV2, // v2.2 反AIGC优化
      word_count: wordCount, // 目标字数
    };

    // 如果启用了热门笔记学习，添加相关参数
    if (learnFromHot) {
      requestBody.learn_from_hot = true;
      if (hotKeywords) {
        requestBody.hot_keywords = hotKeywords;
      }
    }

    const response = await fetch(`${API_BASE}/posts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    // 清除进度条
    clearInterval(progressInterval);
    progressBar.style.width = '100%';

    setTimeout(() => {
      progressDiv.style.display = 'none';
      generateBtn.disabled = false;

      if (result.success) {
        currentPostId = result.data.id;
        const titleInput = document.getElementById('generatedTitle');
        const textArea = document.getElementById('generatedText');

        titleInput.value = result.data.title;
        textArea.value = result.data.content;

        // 确保字段为readonly（生成新内容时不应编辑）
        titleInput.setAttribute('readonly', 'readonly');
        textArea.setAttribute('readonly', 'readonly');

        // 显示可编辑的标签
        displayEditableTags(result.data.tags);

        // 显示AIGC元数据
        displayAigcMetadata(result.metadata);

        // 移除保存草稿按钮（如果存在）
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        if (saveDraftBtn) {
          saveDraftBtn.remove();
        }

        // 保持已选择的图片，不要清空
        // 注意：不清空 uploadedImages，保留用户选择的产品图片
        console.log('文案生成成功，保留已选择的图片:', uploadedImages.length, '张');

        // 显示内容分析
        displayContentAnalysis(result.data.title, result.data.content, result.data.tags);

        generatedContent.style.display = 'block';
        showNotification('文案生成成功！请上传图片后发布', 'success');

        // 滚动到生成的内容
        generatedContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        showNotification('生成失败: ' + result.error, 'error');
      }
    }, 300);

  } catch (error) {
    console.error('生成文案失败:', error);
    clearInterval(progressInterval);
    progressDiv.style.display = 'none';
    generateBtn.disabled = false;
    showNotification('生成失败: ' + error.message, 'error');
  }
}

async function editPost(id) {
  try {
    const response = await fetch(`${API_BASE}/posts/${id}`);
    const result = await response.json();

    if (!result.success) {
      showNotification('获取文案失败', 'error');
      return;
    }

    const post = result.data;

    // Store current post being edited
    window.editingPostId = id;
    window.editingPostImages = [...post.images]; // Copy images array

    // 获取产品图片（如果有关联产品）
    let productImagesHtml = '';
    if (post.product_id) {
      try {
        const productResponse = await fetch(`${API_BASE}/products/${post.product_id}`);
        const productResult = await productResponse.json();

        if (productResult.success && productResult.data.images && productResult.data.images.length > 0) {
          const productImages = productResult.data.images;
          productImagesHtml = `
            <div class="form-group">
              <label>从产品图片中选择添加</label>
              <div class="edit-product-images-selector">
                ${productImages.map(img => `
                  <div class="product-image-item" onclick="addProductImageToEdit('${img.file_path}', '${img.url}', this)">
                    <img src="${img.url}" alt="${img.file_name}"
               onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3E图片加载失败%3C/text%3E%3C/svg%3E';"
               loading="lazy">
                    <span class="image-type-badge">${img.image_type === 'main' ? '主图' : '详情图'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
      } catch (error) {
        console.error('加载产品图片失败:', error);
      }
    }

    // 添加modal-edit类以应用更大的宽度
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.add('modal-edit');
    }

    showModal(`
      <h2 style="font-size: 1.75rem; color: var(--primary-700); margin-bottom: var(--spacing-lg);">📝 编辑文案</h2>
      <form id="editPostForm" onsubmit="submitEditPost(event, ${id})">
        <div class="form-group" style="margin-bottom: var(--spacing-lg);">
          <label style="font-size: 1rem; font-weight: 600; color: var(--gray-800); margin-bottom: var(--spacing-sm); display: block;">✏️ 标题</label>
          <input type="text" id="editTitle" value="${post.title.replace(/"/g, '&quot;')}" required
                 oninput="updateCharCount('title')"
                 style="width: 100%; font-size: 1.125rem; padding: 14px 18px;">
          <div class="char-count" id="titleCharCount">
            <span class="char-count-item">
              <span class="char-count-label">字数:</span>
              <span class="char-count-value" id="titleCount">0</span>
            </span>
            <span style="color: var(--gray-500); font-size: 0.8125rem;">建议: 10-30字</span>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: var(--spacing-lg);">
          <label style="font-size: 1rem; font-weight: 600; color: var(--gray-800); margin-bottom: var(--spacing-sm); display: block;">📄 正文内容</label>
          <textarea id="editContent" rows="18" required
                    oninput="updateCharCount('content')"
                    placeholder="输入文案正文内容...">${post.content}</textarea>
          <div class="char-count" id="contentCharCount">
            <span class="char-count-item">
              <span class="char-count-label">字数:</span>
              <span class="char-count-value" id="contentCount">0</span>
            </span>
            <span class="char-count-item">
              <span class="char-count-label">行数:</span>
              <span class="char-count-value" id="lineCount">0</span>
            </span>
            <span style="color: var(--gray-500); font-size: 0.8125rem;">建议: 200-1000字</span>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: var(--spacing-lg);">
          <label style="font-size: 1rem; font-weight: 600; color: var(--gray-800); margin-bottom: var(--spacing-sm); display: block;">🖼️ 已添加的图片 (${post.images.length}张)</label>
          <div class="edit-images-preview" id="editImagesPreview">
            ${post.images.map((img, index) => `
              <div class="edit-image-item" data-path="${img}">
                <img src="${getImageUrl(img)}" alt="图片${index + 1}"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22120%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22150%22 height=%22120%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3E图片加载失败%3C/text%3E%3C/svg%3E';"
                     loading="lazy">
                <button type="button" class="remove-edit-image" onclick="removeEditImage(this, ${index})" title="删除">×</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group" style="margin-bottom: var(--spacing-lg);">
          <label style="font-size: 1rem; font-weight: 600; color: var(--gray-800); margin-bottom: var(--spacing-sm); display: block;">📤 上传新图片</label>
          <input type="file" id="editImageUpload" accept="image/*" multiple
                 onchange="handleEditImageUpload(event)"
                 style="width: 100%; padding: 12px; border: 2px dashed var(--glass-border); border-radius: var(--radius-md); cursor: pointer;">
          <div style="font-size: 0.875rem; color: var(--gray-600); margin-top: var(--spacing-xs);">
            支持 JPG、PNG、GIF 格式，可多选
          </div>
        </div>
        ${productImagesHtml}
        <div class="actions" style="display: flex; gap: var(--spacing-md); justify-content: flex-end; margin-top: var(--spacing-xl); padding-top: var(--spacing-lg); border-top: 1px solid var(--glass-border);">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">取消</button>
          <button type="submit" class="btn btn-primary">💾 保存修改</button>
        </div>
      </form>
    `);

    // 初始化字数统计
    setTimeout(() => {
      updateCharCount('title');
      updateCharCount('content');
    }, 100);
  } catch (error) {
    console.error('加载文案失败:', error);
    showNotification('加载文案失败', 'error');
  }
}

function removeEditImage(btn, index) {
  // Remove from the images array
  window.editingPostImages.splice(index, 1);

  // Remove the DOM element
  btn.parentElement.remove();

  // Update the count
  const label = document.querySelector('#editPostForm .form-group label');
  if (label && label.textContent.includes('已添加的图片')) {
    label.textContent = `已添加的图片 (${window.editingPostImages.length}张)`;
  }

  showNotification('图片已删除', 'success');
}

// 添加产品图片到编辑中
function addProductImageToEdit(filePath, url, element) {
  // 检查图片是否已存在
  if (window.editingPostImages.includes(filePath)) {
    showNotification('该图片已添加', 'error');
    return;
  }

  // 添加到图片数组
  window.editingPostImages.push(filePath);

  // 添加到预览区域
  const preview = document.getElementById('editImagesPreview');
  const index = window.editingPostImages.length - 1;
  const imageUrl = url || getImageUrl(filePath);

  const previewItem = document.createElement('div');
  previewItem.className = 'edit-image-item';
  previewItem.dataset.path = filePath;
  previewItem.innerHTML = `
    <img src="${imageUrl}" alt="图片${index + 1}"
         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22120%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22150%22 height=%22120%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3E图片加载失败%3C/text%3E%3C/svg%3E';"
         loading="lazy">
    <button type="button" class="remove-edit-image" onclick="removeEditImage(this, ${index})" title="删除">×</button>
  `;
  preview.appendChild(previewItem);

  // 更新图片数量
  const label = document.querySelector('#editPostForm .form-group label');
  if (label && label.textContent.includes('已添加的图片')) {
    label.textContent = `已添加的图片 (${window.editingPostImages.length}张)`;
  }

  // 视觉反馈
  element.style.opacity = '0.5';
  setTimeout(() => {
    element.style.opacity = '1';
  }, 300);

  showNotification('图片已添加', 'success');
}

// 处理编辑模式下的图片上传
async function handleEditImageUpload(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  const formData = new FormData();
  files.forEach(file => formData.append('images', file));

  try {
    showNotification(`正在上传 ${files.length} 张图片...`, 'info');

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      // 添加上传成功的图片到编辑数组
      result.data.forEach(img => {
        if (!window.editingPostImages.includes(img.path)) {
          window.editingPostImages.push(img.path);

          // 添加到预览区域
          const preview = document.getElementById('editImagesPreview');
          const index = window.editingPostImages.length - 1;

          const previewItem = document.createElement('div');
          previewItem.className = 'edit-image-item';
          previewItem.dataset.path = img.path;
          previewItem.innerHTML = `
            <img src="${getImageUrl(img.path)}" alt="图片${index + 1}"
                 onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22120%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22150%22 height=%22120%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3E图片加载失败%3C/text%3E%3C/svg%3E';"
                 loading="lazy">
            <button type="button" class="remove-edit-image" onclick="removeEditImage(this, ${index})" title="删除">×</button>
          `;
          preview.appendChild(previewItem);
        }
      });

      // 更新图片数量
      const label = document.querySelector('#editPostForm .form-group label');
      if (label && label.textContent.includes('已添加的图片')) {
        label.textContent = `已添加的图片 (${window.editingPostImages.length}张)`;
      }

      showNotification(`✅ 成功上传 ${result.data.length} 张图片`, 'success');

      // 清空文件输入
      event.target.value = '';
    } else {
      showNotification('上传失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('上传图片失败:', error);
    showNotification('上传失败: ' + error.message, 'error');
  }
}

async function submitEditPost(event, id) {
  event.preventDefault();

  const title = document.getElementById('editTitle').value;
  const content = document.getElementById('editContent').value;

  try {
    const response = await fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        content: content,
        images: window.editingPostImages,
        tags: [], // Keep existing tags for now
      }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification('文案更新成功', 'success');
      closeModal();
      loadPosts(); // Reload the posts list

      // Clean up
      delete window.editingPostId;
      delete window.editingPostImages;
    } else {
      showNotification('更新失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('更新文案失败:', error);
    showNotification('更新失败', 'error');
  }
}

// 字数统计函数
function updateCharCount(type) {
  if (type === 'title') {
    const titleInput = document.getElementById('editTitle');
    const titleCount = document.getElementById('titleCount');
    if (titleInput && titleCount) {
      const count = titleInput.value.length;
      titleCount.textContent = count;

      // 根据字数添加样式
      if (count < 10) {
        titleCount.className = 'char-count-value char-count-warning';
      } else if (count > 30) {
        titleCount.className = 'char-count-value char-count-error';
      } else {
        titleCount.className = 'char-count-value';
      }
    }
  } else if (type === 'content') {
    const contentInput = document.getElementById('editContent');
    const contentCount = document.getElementById('contentCount');
    const lineCount = document.getElementById('lineCount');

    if (contentInput && contentCount && lineCount) {
      const count = contentInput.value.length;
      const lines = contentInput.value.split('\n').length;

      contentCount.textContent = count;
      lineCount.textContent = lines;

      // 根据字数添加样式
      if (count < 200) {
        contentCount.className = 'char-count-value char-count-warning';
      } else if (count > 1000) {
        contentCount.className = 'char-count-value char-count-error';
      } else {
        contentCount.className = 'char-count-value';
      }
    }
  }
}

// =========================
// AI模型管理
// =========================

let availableModels = [];

// 加载可用模型列表
async function loadModels() {
  try {
    const response = await fetch(`${API_BASE}/ai/models`);
    const result = await response.json();

    if (result.success) {
      availableModels = result.data;
      const modelSelect = document.getElementById('aiModel');
      modelSelect.innerHTML = '';

      result.data.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;

        // 默认选择 DeepSeek Chat
        if (model.id === 'deepseek-chat') {
          option.selected = true;
        }

        modelSelect.appendChild(option);
      });

      // 更新模型信息显示
      updateModelInfo();
    }
  } catch (error) {
    console.error('加载模型列表失败:', error);
    showNotification('加载模型列表失败', 'error');
  }
}

// 更新模型信息显示（已移除价格显示功能）
function updateModelInfo() {
  // 价格显示已移除，此函数保留以避免错误
}

// =========================
// 图片上传和管理
// =========================

let uploadedImages = []; // 存储已上传的图片路径
let isUploading = false; // 上传状态标记

// 监听图片文件选择
document.addEventListener('DOMContentLoaded', () => {
  const imageInput = document.getElementById('postImages');
  if (imageInput) {
    imageInput.addEventListener('change', handleImageSelect);
  }
});

// 处理图片选择
async function handleImageSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // 设置上传状态
  isUploading = true;
  disablePublishButton();

  const preview = document.getElementById('imagePreview');
  let successCount = 0;
  let failCount = 0;
  const totalFiles = files.length;

  // 显示进度条
  showUploadProgress(0, totalFiles);

  // 上传每个文件
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const currentIndex = i + 1;

    // 更新进度条文本
    updateUploadProgress(currentIndex, totalFiles, `正在上传 ${file.name.substring(0, 20)}...`);

    // 检查文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
      showNotification(`图片 ${file.name} 超过10MB，已跳过`, 'error');
      failCount++;
      updateUploadProgress(currentIndex, totalFiles, `已跳过 ${file.name} (文件过大)`);
      continue;
    }

    // 上传图片
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_BASE}/upload/image`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        uploadedImages.push(result.data.path);
        successCount++;
        console.log('图片上传成功:', result.data.path);
        console.log('当前图片列表:', uploadedImages);

        // 更新进度条
        updateUploadProgress(currentIndex, totalFiles, `✓ ${file.name} 上传成功`);

        // 添加预览
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item';
        previewItem.dataset.path = result.data.path; // 设置 data-path 属性
        previewItem.innerHTML = `
          <img src="${result.data.url}" alt="预览">
          <button class="remove-image" onclick="removeImage('${result.data.path}')" title="删除">×</button>
        `;
        preview.appendChild(previewItem);
      } else {
        failCount++;
        updateUploadProgress(currentIndex, totalFiles, `✗ ${file.name} 上传失败`);
        showNotification(`上传失败: ${result.error}`, 'error');
      }
    } catch (error) {
      failCount++;
      updateUploadProgress(currentIndex, totalFiles, `✗ ${file.name} 上传失败`);
      showNotification(`上传失败: ${error.message}`, 'error');
    }
  }

  // 清空文件选择
  event.target.value = '';

  // 隐藏进度条
  setTimeout(() => {
    hideUploadProgress();
  }, 2000);

  // 恢复上传状态
  isUploading = false;
  enablePublishButton();

  // 显示上传结果
  if (successCount > 0) {
    showNotification(`✅ 成功上传 ${successCount} 张图片！当前共 ${uploadedImages.length} 张`, 'success');
  }
  if (failCount > 0) {
    showNotification(`⚠️ ${failCount} 张图片上传失败`, 'error');
  }

  console.log('上传完成，当前图片总数:', uploadedImages.length);
}

// 显示上传进度条
function showUploadProgress(current, total) {
  const progressContainer = document.getElementById('uploadProgress');
  progressContainer.style.display = 'block';
  updateUploadProgress(current, total, '准备上传...');
}

// 更新上传进度
function updateUploadProgress(current, total, text) {
  const progressText = document.getElementById('uploadProgressText');
  const progressCount = document.getElementById('uploadProgressCount');
  const progressFill = document.getElementById('uploadProgressFill');

  const percentage = (current / total) * 100;

  progressText.textContent = text || '正在上传...';
  progressCount.textContent = `${current}/${total}`;
  progressFill.style.width = `${percentage}%`;
}

// 隐藏上传进度条
function hideUploadProgress() {
  const progressContainer = document.getElementById('uploadProgress');
  progressContainer.style.display = 'none';
}

// 禁用发布按钮
function disablePublishButton() {
  const publishButtons = document.querySelectorAll('button[onclick^="publishPost"]');
  publishButtons.forEach(btn => {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '图片上传中...';
  });
}

// 启用发布按钮
function enablePublishButton() {
  const publishButtons = document.querySelectorAll('button[onclick^="publishPost"]');
  publishButtons.forEach(btn => {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
    }
  });
}

// 删除图片
function removeImage(path) {
  uploadedImages = uploadedImages.filter(p => p !== path);

  // 重新渲染预览
  const preview = document.getElementById('imagePreview');
  const items = preview.querySelectorAll('.image-preview-item');
  items.forEach(item => {
    if (item.dataset.path === path) {
      item.remove();
    }
  });

  // 同步更新产品图片选择器的状态
  const productImagesSelector = document.getElementById('productImagesSelector');
  if (productImagesSelector) {
    const productImageItems = productImagesSelector.querySelectorAll('.product-image-item');
    productImageItems.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox) {
        const itemPath = checkbox.parentElement.onclick.toString().match(/'([^']+)'/)?.[1];
        if (itemPath === path) {
          checkbox.checked = false;
          item.classList.remove('selected');
        }
      }
    });
  }

  showNotification('图片已删除', 'success');
}

// =============================================================================
// AI提供商管理
// =============================================================================

// 加载AI提供商列表
async function refreshProviders() {
  try {
    const response = await fetch(`${API_BASE}/ai/providers`);
    const result = await response.json();

    if (result.success) {
      displayProviders(result.data);
      showNotification('提供商列表已刷新', 'success');
    } else {
      showNotification('刷新失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('刷新提供商失败:', error);
    showNotification('刷新失败', 'error');
  }
}

// 显示提供商列表
function displayProviders(providers) {
  const container = document.getElementById('providersList');

  if (!providers || providers.length === 0) {
    container.innerHTML = '<p class="loading">暂无提供商</p>';
    return;
  }

  container.innerHTML = providers.map(provider => `
    <div class="provider-card" data-provider="${provider.provider}">
      <div class="provider-header">
        <h3>${provider.provider_name}</h3>
        <span class="status-badge ${provider.is_enabled ? 'enabled' : 'disabled'}">
          ${provider.is_enabled ? '已启用' : '已禁用'}
        </span>
      </div>

      <div class="provider-info">
        <div class="info-item">
          <label>优先级:</label>
          <span>${provider.priority}</span>
        </div>
        <div class="info-item">
          <label>API密钥:</label>
          <span>${provider.has_api_key ? '已配置 ••••••' : '未配置'}</span>
        </div>
        <div class="info-item">
          <label>超时时间:</label>
          <span>${provider.timeout}ms</span>
        </div>
      </div>

      <div class="provider-actions">
        <button class="btn btn-secondary btn-sm" onclick="showEditProviderModal('${provider.provider}')">
          配置
        </button>
        <button class="btn btn-secondary btn-sm" onclick="testProviderConnection('${provider.provider}')">
          测试连接
        </button>
      </div>
    </div>
  `).join('');
}

// 显示编辑提供商模态框
async function showEditProviderModal(providerName) {
  try {
    const response = await fetch(`${API_BASE}/ai/providers`);
    const result = await response.json();

    if (result.success) {
      const provider = result.data.find(p => p.provider === providerName);
      if (provider) {
        document.getElementById('providerName').value = provider.provider;
        document.getElementById('providerDisplayName').value = provider.provider_name;
        document.getElementById('providerApiKey').value = '';
        document.getElementById('providerPriority').value = provider.priority;
        document.getElementById('providerEnabled').checked = provider.is_enabled === 1;

        document.getElementById('providerModal').style.display = 'block';
      }
    }
  } catch (error) {
    console.error('加载提供商信息失败:', error);
    showNotification('加载失败', 'error');
  }
}

// 关闭提供商模态框
function closeProviderModal() {
  document.getElementById('providerModal').style.display = 'none';
}

// 保存提供商配置
async function saveProvider(event) {
  event.preventDefault();

  const providerName = document.getElementById('providerName').value;
  const apiKey = document.getElementById('providerApiKey').value;
  const priority = parseInt(document.getElementById('providerPriority').value);
  const isEnabled = document.getElementById('providerEnabled').checked ? 1 : 0;

  try {
    const body = {
      is_enabled: isEnabled,
      priority: priority
    };

    if (apiKey) {
      body.api_key = apiKey;
    }

    const response = await fetch(`${API_BASE}/ai/providers/${providerName}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.success) {
      showNotification('配置已保存', 'success');
      closeProviderModal();
      refreshProviders();
    } else {
      showNotification('保存失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    showNotification('保存失败', 'error');
  }
}

// 测试提供商连接
async function testProviderConnection(providerName) {
  if (!providerName) {
    providerName = document.getElementById('providerName').value;
  }

  showNotification('正在测试连接...', 'info');

  try {
    const response = await fetch(`${API_BASE}/ai/providers/${providerName}/test`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`连接成功！延迟: ${result.data.latency}ms`, 'success');
    } else {
      showNotification('连接失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('测试连接失败:', error);
    showNotification('测试失败', 'error');
  }
}

// 清除提供商缓存
async function clearProviderCache() {
  try {
    const response = await fetch(`${API_BASE}/ai/providers/cache/clear`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('缓存已清除', 'success');
      refreshProviders();
    } else {
      showNotification('清除失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('清除缓存失败:', error);
    showNotification('清除失败', 'error');
  }
}

// =============================================================================
// 定时发布管理
// =============================================================================

// 显示创建定时任务模态框
async function showCreateScheduleModal() {
  try {
    // 加载可用的文案列表
    const response = await fetch(`${API_BASE}/posts?status=draft`);
    const result = await response.json();

    if (result.success) {
      const select = document.getElementById('schedulePostId');
      select.innerHTML = '<option value="">请选择...</option>' +
        result.data.map(post => `<option value="${post.id}">${post.title || '无标题'}</option>`).join('');

      document.getElementById('scheduleModal').style.display = 'block';
    }
  } catch (error) {
    console.error('加载文案列表失败:', error);
    showNotification('加载失败', 'error');
  }
}

// 关闭定时任务模态框
function closeScheduleModal() {
  document.getElementById('scheduleModal').style.display = 'none';
}

// 更新调度配置显示
function updateScheduleConfig() {
  const scheduleType = document.getElementById('scheduleType').value;

  // 隐藏所有配置
  document.querySelectorAll('.schedule-config').forEach(config => {
    config.style.display = 'none';
  });

  // 显示选中的配置
  const configMap = {
    'once': 'scheduleConfigOnce',
    'daily': 'scheduleConfigDaily',
    'weekly': 'scheduleConfigWeekly',
    'monthly': 'scheduleConfigMonthly'
  };

  const configId = configMap[scheduleType];
  if (configId) {
    document.getElementById(configId).style.display = 'block';
  }
}

// 创建定时任务
async function createSchedule(event) {
  event.preventDefault();

  const postId = parseInt(document.getElementById('schedulePostId').value);
  const scheduleType = document.getElementById('scheduleType').value;

  if (!postId) {
    showNotification('请选择文案', 'error');
    return;
  }

  const body = {
    post_id: postId,
    schedule_type: scheduleType
  };

  // 根据调度类型添加配置
  switch (scheduleType) {
    case 'once':
      const scheduleTime = document.getElementById('scheduleTime').value;
      if (!scheduleTime) {
        showNotification('请选择执行时间', 'error');
        return;
      }
      body.scheduled_time = scheduleTime.replace('T', ' ') + ':00';
      break;

    case 'daily':
      const dailyTime = document.getElementById('scheduleDailyTime').value;
      body.schedule_config = { time: dailyTime };
      break;

    case 'weekly':
      const weekDay = parseInt(document.getElementById('scheduleWeekDay').value);
      const weeklyTime = document.getElementById('scheduleWeeklyTime').value;
      body.schedule_config = { dayOfWeek: weekDay, time: weeklyTime };
      break;

    case 'monthly':
      const monthDay = parseInt(document.getElementById('scheduleMonthDay').value);
      const monthlyTime = document.getElementById('scheduleMonthlyTime').value;
      body.schedule_config = { dayOfMonth: monthDay, time: monthlyTime };
      break;
  }

  try {
    const response = await fetch(`${API_BASE}/schedules`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.success) {
      showNotification('定时任务已创建', 'success');
      closeScheduleModal();
      loadSchedules();
    } else {
      showNotification('创建失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('创建任务失败:', error);
    showNotification('创建失败', 'error');
  }
}

// 加载定时任务列表
async function loadSchedules() {
  try {
    const response = await fetch(`${API_BASE}/schedules`);
    const result = await response.json();

    if (result.success) {
      displaySchedules(result.data);
    }
  } catch (error) {
    console.error('加载任务列表失败:', error);
    document.getElementById('schedulesList').innerHTML = '<p class="loading">加载失败</p>';
  }
}

// 显示定时任务列表
function displaySchedules(schedules) {
  const container = document.getElementById('schedulesList');

  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<p class="loading">暂无定时任务</p>';
    return;
  }

  const scheduleTypeMap = {
    'once': '一次性',
    'daily': '每日',
    'weekly': '每周',
    'monthly': '每月'
  };

  const statusMap = {
    'pending': '待执行',
    'running': '执行中',
    'completed': '已完成',
    'cancelled': '已取消',
    'failed': '失败'
  };

  container.innerHTML = schedules.map(schedule => {
    const config = schedule.schedule_config ? JSON.parse(schedule.schedule_config) : {};
    let configText = '';

    switch (schedule.schedule_type) {
      case 'daily':
        configText = `每天 ${config.time}`;
        break;
      case 'weekly':
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        configText = `每${days[config.dayOfWeek]} ${config.time}`;
        break;
      case 'monthly':
        configText = `每月${config.dayOfMonth}日 ${config.time}`;
        break;
      case 'once':
        configText = new Date(schedule.scheduled_time).toLocaleString('zh-CN');
        break;
    }

    return `
      <div class="schedule-item">
        <div class="schedule-info">
          <h4>${schedule.post_title || '无标题'}</h4>
          <p class="schedule-type">${scheduleTypeMap[schedule.schedule_type]} - ${configText}</p>
          <p class="schedule-next">下次执行: ${new Date(schedule.next_run_at).toLocaleString('zh-CN')}</p>
          ${schedule.last_error ? `<p class="schedule-error">错误: ${schedule.last_error}</p>` : ''}
        </div>
        <div class="schedule-status">
          <span class="status-badge ${schedule.status}">${statusMap[schedule.status]}</span>
          ${schedule.retry_count > 0 ? `<span class="retry-count">重试: ${schedule.retry_count}/${schedule.max_retries}</span>` : ''}
        </div>
        <div class="schedule-actions">
          ${schedule.status === 'pending' ? `
            <button class="btn btn-secondary btn-sm" onclick="executeScheduleNow(${schedule.id})">立即执行</button>
            <button class="btn btn-danger btn-sm" onclick="cancelSchedule(${schedule.id})">取消任务</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 取消定时任务
async function cancelSchedule(scheduleId) {
  if (!confirm('确定要取消这个定时任务吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/schedules/${scheduleId}/cancel`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('任务已取消', 'success');
      loadSchedules();
    } else {
      showNotification('取消失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('取消任务失败:', error);
    showNotification('取消失败', 'error');
  }
}

// 立即执行定时任务
async function executeScheduleNow(scheduleId) {
  if (!confirm('确定要立即执行这个任务吗？')) {
    return;
  }

  showNotification('正在执行任务...', 'info');

  try {
    const response = await fetch(`${API_BASE}/schedules/${scheduleId}/execute`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('任务执行成功', 'success');
      loadSchedules();
    } else {
      showNotification('执行失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('执行任务失败:', error);
    showNotification('执行失败', 'error');
  }
}

// =============================================================================
// 发布历史统计
// =============================================================================

let historyCurrentPage = 1;
const historyPageSize = 20;

// 加载发布历史
async function loadPublishHistory(page = 1) {
  historyCurrentPage = page;

  const status = document.getElementById('historyStatusFilter')?.value || '';
  const startDate = document.getElementById('historyStartDate')?.value || '';
  const endDate = document.getElementById('historyEndDate')?.value || '';

  try {
    const params = new URLSearchParams({
      page: page,
      pageSize: historyPageSize,
      ...(status && { status }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    });

    const response = await fetch(`${API_BASE}/publish-history?${params}`);
    const result = await response.json();

    if (result.success) {
      displayHistory(result.data);
    }
  } catch (error) {
    console.error('加载发布历史失败:', error);
    document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="6" class="loading">加载失败</td></tr>';
  }

  // 同时加载统计数据
  loadPublishStats();
}

// 显示发布历史
function displayHistory(data) {
  const tbody = document.getElementById('historyTableBody');

  if (!data.records || data.records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无记录</td></tr>';
    return;
  }

  tbody.innerHTML = data.records.map(record => {
    const statusClass = record.status === 'success' ? 'success' : 'failed';
    const duration = record.duration_ms ? `${(record.duration_ms / 1000).toFixed(2)}s` : '-';

    return `
      <tr>
        <td>${record.post_title || '无标题'}</td>
        <td>${record.platform}</td>
        <td><span class="status-badge ${statusClass}">${record.status === 'success' ? '成功' : '失败'}</span></td>
        <td>${duration}</td>
        <td>${record.images_count || 0}</td>
        <td>${new Date(record.created_at).toLocaleString('zh-CN')}</td>
      </tr>
    `;
  }).join('');

  // 显示分页
  displayHistoryPagination(data.total, data.totalPages);
}

// 显示分页
function displayHistoryPagination(total, totalPages) {
  const container = document.getElementById('historyPagination');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<span class="pagination-info">共 ${total} 条记录</span>`;

  // 上一页
  if (historyCurrentPage > 1) {
    html += `<button class="btn btn-sm" onclick="loadPublishHistory(${historyCurrentPage - 1})">上一页</button>`;
  }

  // 页码
  const maxPages = 5;
  let startPage = Math.max(1, historyCurrentPage - Math.floor(maxPages / 2));
  let endPage = Math.min(totalPages, startPage + maxPages - 1);

  if (endPage - startPage < maxPages - 1) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === historyCurrentPage ? 'active' : '';
    html += `<button class="btn btn-sm ${activeClass}" onclick="loadPublishHistory(${i})">${i}</button>`;
  }

  // 下一页
  if (historyCurrentPage < totalPages) {
    html += `<button class="btn btn-sm" onclick="loadPublishHistory(${historyCurrentPage + 1})">下一页</button>`;
  }

  container.innerHTML = html;
}

// 加载发布统计
async function loadPublishStats() {
  try {
    const response = await fetch(`${API_BASE}/publish-stats?days=30`);
    const result = await response.json();

    if (result.success) {
      displayStats(result.data.overall);
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

// 显示统计数据
function displayStats(stats) {
  document.getElementById('statTotalAttempts').textContent = stats.total_attempts || 0;
  document.getElementById('statSuccessRate').textContent = (stats.success_rate || 0) + '%';
  document.getElementById('statAvgDuration').textContent = stats.avg_duration_ms
    ? `${(stats.avg_duration_ms / 1000).toFixed(2)}s`
    : '-';
  document.getElementById('statFailedCount').textContent = stats.failed || 0;
}

// 导出CSV
async function exportHistoryCSV() {
  const status = document.getElementById('historyStatusFilter')?.value || '';
  const startDate = document.getElementById('historyStartDate')?.value || '';
  const endDate = document.getElementById('historyEndDate')?.value || '';

  const params = new URLSearchParams({
    ...(status && { status }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate })
  });

  window.location.href = `${API_BASE}/publish-history/export?${params}`;
  showNotification('正在导出CSV...', 'info');
}

// 刷新历史数据
function refreshHistory() {
  loadPublishHistory(1);
  showNotification('数据已刷新', 'success');
}

// =============================================================================
// 热点数据中心
// =============================================================================

let currentPlatform = 'all';

// 切换平台
function switchPlatform(platform) {
  currentPlatform = platform;

  // 更新按钮状态
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.platform === platform) {
      btn.classList.add('active');
    }
  });

  // 加载热点数据
  loadTrending();
}

// 加载热点数据
async function loadTrending() {
  try {
    const params = new URLSearchParams({
      ...(currentPlatform !== 'all' && { platform: currentPlatform }),
      limit: 50
    });

    const response = await fetch(`${API_BASE}/trending?${params}`);
    const result = await response.json();

    if (result.success) {
      displayTrendingList(result.data);
    }
  } catch (error) {
    console.error('加载热点数据失败:', error);
    document.getElementById('trendingList').innerHTML = '<p class="loading">加载失败</p>';
  }
}

// 显示热点列表
function displayTrendingList(topics) {
  const container = document.getElementById('trendingList');

  if (!topics || topics.length === 0) {
    container.innerHTML = '<p class="loading">暂无热点数据，请点击"刷新数据"按钮</p>';
    return;
  }

  const platformMap = {
    'weibo': '微博',
    'baidu': '百度',
    'toutiao': '头条',
    'bilibili': 'B站'
  };

  container.innerHTML = topics.map(topic => `
    <div class="trending-item">
      <div class="trending-rank">${topic.rank_position}</div>
      <div class="trending-content">
        <h4>${topic.title}</h4>
        <div class="trending-meta">
          <span class="trending-platform">${platformMap[topic.platform]}</span>
          <span class="trending-score">🔥 ${formatHotScore(topic.hot_score)}</span>
          <span class="trending-time">${formatTime(topic.last_updated_at)}</span>
        </div>
      </div>
      <div class="trending-actions">
        ${topic.url ? `<a href="${topic.url}" target="_blank" class="btn btn-secondary btn-sm">查看详情</a>` : ''}
        <button class="btn btn-primary btn-sm" onclick="useTrendingTopic(${topic.id}, '${escapeHtml(topic.title)}')">
          使用热点
        </button>
      </div>
    </div>
  `).join('');
}

// 格式化热度分数
function formatHotScore(score) {
  if (!score) return '未知';
  if (score >= 10000000) return `${(score / 10000000).toFixed(1)}千万`;
  if (score >= 10000) return `${(score / 10000).toFixed(1)}万`;
  return score.toLocaleString();
}

// 格式化时间
function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

// 转义HTML
function escapeHtml(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 处理图片URL，将绝对路径转换为相对URL
// 缓存知识库路径
let cachedKnowledgeBasePath = null;

// 获取知识库路径
async function getKnowledgeBasePath() {
  if (cachedKnowledgeBasePath) {
    return cachedKnowledgeBasePath;
  }

  try {
    const response = await fetch(`${API_BASE}/knowledge/config`);
    const result = await response.json();
    if (result.success && result.data.path) {
      cachedKnowledgeBasePath = result.data.path;
      return cachedKnowledgeBasePath;
    }
  } catch (error) {
    console.error('获取知识库路径失败:', error);
  }

  return null;
}

function getImageUrl(imagePath) {
  if (!imagePath) return '';

  // 如果已经是完整的URL，直接返回
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 如果已经是/knowledge/开头的路径，直接返回
  if (imagePath.startsWith('/knowledge/')) {
    return imagePath;
  }

  // 如果是绝对路径（Windows或Linux）
  if (imagePath.match(/^[A-Z]:\\/i) || imagePath.startsWith('/home/') || imagePath.startsWith('/Users/')) {
    // 尝试使用缓存的知识库路径来计算相对路径
    if (cachedKnowledgeBasePath) {
      const normalizedImagePath = imagePath.replace(/\\/g, '/');
      const normalizedBasePath = cachedKnowledgeBasePath.replace(/\\/g, '/');

      if (normalizedImagePath.startsWith(normalizedBasePath)) {
        // 提取相对路径
        let relativePath = normalizedImagePath.substring(normalizedBasePath.length);
        // 移除开头的斜杠
        if (relativePath.startsWith('/')) {
          relativePath = relativePath.substring(1);
        }
        return `/knowledge/${relativePath}`;
      }
    }

    // 如果没有缓存的路径，尝试查找常见的知识库标记
    const knowledgeMarkers = ['知识库', 'knowledge', 'docs', 'documents'];
    const normalizedPath = imagePath.replace(/\\/g, '/');

    for (const marker of knowledgeMarkers) {
      const markerIndex = normalizedPath.indexOf(marker);
      if (markerIndex !== -1) {
        // 找到标记后，需要提取标记目录之后的路径
        // 例如: E:/xhspro/知识库p/产品资料/image.jpg
        // 应该提取: 产品资料/image.jpg (不包含知识库目录本身)

        // 找到标记所在目录的结束位置（下一个/的位置）
        let endIndex = markerIndex;
        while (endIndex < normalizedPath.length && normalizedPath[endIndex] !== '/') {
          endIndex++;
        }

        // 如果找到了目录分隔符，提取之后的路径
        if (endIndex < normalizedPath.length) {
          const relativePath = normalizedPath.substring(endIndex + 1);
          return `/knowledge/${relativePath}`;
        }
      }
    }

    // 如果都找不到，返回默认占位图
    console.warn('无法解析图片路径:', imagePath);
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3E图片路径无效%3C/text%3E%3C/svg%3E';
  }

  // 如果是相对路径，添加/knowledge前缀
  if (!imagePath.startsWith('/')) {
    return `/knowledge/${imagePath.replace(/\\/g, '/')}`;
  }

  return imagePath;
}

// 防抖函数 - 延迟执行，多次调用只执行最后一次
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数 - 限制执行频率
function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 使用热点话题
function useTrendingTopic(topicId, title) {
  // 切换到生成文案页面
  switchTab('generate');

  // 将热点标题填充到目标受众字段（或者可以创建一个新字段）
  const targetAudience = document.getElementById('targetAudience');
  if (targetAudience) {
    targetAudience.value = `关注"${title}"的用户`;
  }

  showNotification(`已应用热点: ${title}`, 'success');
}

// 刷新热点数据
async function refreshTrending() {
  showNotification('正在刷新热点数据，请稍候...', 'info');

  try {
    const body = currentPlatform !== 'all' ? { platform: currentPlatform } : {};

    const response = await fetch(`${API_BASE}/trending/refresh`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.success) {
      const summary = result.data.map(r => `${r.platform}: ${r.topics_count}条`).join(', ');
      showNotification(`刷新成功！${summary}`, 'success');
      loadTrending();
    } else {
      showNotification('刷新失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('刷新热点数据失败:', error);
    showNotification('刷新失败', 'error');
  }
}

// 搜索热点
async function searchTrending() {
  const keyword = document.getElementById('trendingKeyword').value.trim();

  if (!keyword) {
    loadTrending();
    return;
  }

  try {
    const params = new URLSearchParams({
      keyword: keyword,
      ...(currentPlatform !== 'all' && { platform: currentPlatform }),
      limit: 50
    });

    const response = await fetch(`${API_BASE}/trending?${params}`);
    const result = await response.json();

    if (result.success) {
      displayTrendingList(result.data);
      if (result.data.length === 0) {
        showNotification('未找到相关热点', 'info');
      }
    }
  } catch (error) {
    console.error('搜索热点失败:', error);
    showNotification('搜索失败', 'error');
  }
}

// 清理旧数据
async function clearOldTrending() {
  if (!confirm('确定要清理7天前的旧热点数据吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/trending/cleanup`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ days: 7 })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`已清理 ${result.count} 条旧数据`, 'success');
      loadTrending();
    } else {
      showNotification('清理失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('清理数据失败:', error);
    showNotification('清理失败', 'error');
  }
}

// ==================== 账号管理 ====================

// 加载账号列表
async function loadAccounts() {
  try {
    const response = await fetch(`${API_BASE}/accounts`);
    const result = await response.json();

    if (result.success) {
      displayAccounts(result.data);
    } else {
      showNotification('加载账号列表失败', 'error');
    }
  } catch (error) {
    console.error('加载账号列表失败:', error);
    document.getElementById('accountsList').innerHTML = '<p class="loading">加载失败</p>';
  }
}

// 显示账号列表
function displayAccounts(accounts) {
  const container = document.getElementById('accountsList');

  if (!accounts || accounts.length === 0) {
    container.innerHTML = '<p class="loading">暂无账号，请点击"添加账号"按钮</p>';
    return;
  }

  container.innerHTML = accounts.map(account => `
    <div class="card">
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${account.avatar_url ?
            `<img src="${account.avatar_url}" alt="头像" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">` :
            '<div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-400), var(--primary-600)); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">👤</div>'
          }
          <div style="flex: 1;">
            <h3 class="card-title" style="margin: 0;">
              ${escapeHtml(account.account_name)}
              ${account.is_primary ? '<span class="badge badge-primary" style="margin-left: 8px;">主账号</span>' : ''}
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.8;">
              ${account.nickname ? escapeHtml(account.nickname) : '未设置昵称'}
            </p>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="form-group" style="margin-bottom: 12px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge ${account.is_active ? 'badge-success' : 'badge-secondary'}">
              ${account.is_active ? '✓ 激活' : '✗ 停用'}
            </span>
            <span class="badge ${getLoginStatusBadgeClass(account.login_status)}">
              创作者: ${getLoginStatusText(account.login_status)}
            </span>
            <span class="badge ${getLoginStatusBadgeClass(account.main_site_login_status || 'unknown')}">
              主站: ${getLoginStatusText(account.main_site_login_status || 'unknown')}
            </span>
          </div>
        </div>
        ${account.phone ? `<p style="margin: 8px 0; font-size: 14px;"><strong>手机:</strong> ${escapeHtml(account.phone)}</p>` : ''}
        ${account.email ? `<p style="margin: 8px 0; font-size: 14px;"><strong>邮箱:</strong> ${escapeHtml(account.email)}</p>` : ''}
        ${account.xhs_user_id ? `<p style="margin: 8px 0; font-size: 14px;"><strong>小红书ID:</strong> ${escapeHtml(account.xhs_user_id)}</p>` : ''}
        ${account.last_login_at ? `<p style="margin: 8px 0; font-size: 14px;"><strong>创作者登录:</strong> ${formatTime(account.last_login_at)}</p>` : ''}
        ${account.main_site_last_login_at ? `<p style="margin: 8px 0; font-size: 14px;"><strong>主站登录:</strong> ${formatTime(account.main_site_last_login_at)}</p>` : ''}
      </div>
      <div class="card-footer">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${account.login_status === 'logged_in' ? `
            <button onclick="logoutCreatorCenter(${account.id})" class="btn btn-warning btn-sm">
              🚪 退出创作者
            </button>
          ` : `
            <button onclick="loginCreatorCenter(${account.id})" class="btn btn-primary btn-sm">
              🔐 创作者登录
            </button>
          `}
          ${account.main_site_login_status === 'logged_in' ? `
            <button onclick="logoutMainSite(${account.id})" class="btn btn-warning btn-sm">
              🚪 退出主站
            </button>
          ` : `
            <button onclick="loginMainSite(${account.id})" class="btn btn-success btn-sm">
              🌐 主站登录
            </button>
          `}
          ${!account.is_primary ? `
            <button onclick="setPrimaryAccount(${account.id})" class="btn btn-secondary btn-sm">
              ⭐ 设为主账号
            </button>
          ` : ''}
          <button onclick="showEditAccountModal(${account.id})" class="btn btn-secondary btn-sm">
            ✏️ 编辑
          </button>
          <button onclick="toggleAccountStatus(${account.id})" class="btn btn-secondary btn-sm">
            ${account.is_active ? '🔒 停用' : '🔓 激活'}
          </button>
          <button onclick="viewAccountStats(${account.id})" class="btn btn-secondary btn-sm">
            📊 统计
          </button>
          ${!account.is_primary ? `
            <button onclick="deleteAccount(${account.id})" class="btn btn-danger btn-sm">
              🗑️ 删除
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// 获取登录状态徽章样式
function getLoginStatusBadgeClass(status) {
  switch(status) {
    case 'logged_in': return 'badge-success';
    case 'logged_out': return 'badge-secondary';
    case 'expired': return 'badge-warning';
    case 'error': return 'badge-danger';
    default: return 'badge-secondary';
  }
}

// 获取登录状态文本
function getLoginStatusText(status) {
  switch(status) {
    case 'logged_in': return '✓ 已登录';
    case 'logged_out': return '未登录';
    case 'expired': return '⚠ 已过期';
    case 'error': return '✗ 登录异常';
    default: return '未知';
  }
}

// 显示添加账号模态框
// 显示添加账号模态框 - 直接触发登录流程
async function showAddAccountModal() {
  try {
    // 创建一个临时账号
    const timestamp = Date.now();
    const tempAccountName = `新账号_${timestamp}`;

    showNotification('正在创建账号...', 'info');

    const response = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_name: tempAccountName
      })
    });

    const result = await response.json();
    console.log('创建账号响应:', result);

    if (result.success && result.data && result.data.id) {
      const newAccountId = result.data.id;
      showNotification('账号创建成功，开始登录流程...', 'success');

      // 延迟一下，让用户看到提示
      setTimeout(async () => {
        // 先登录创作者中心
        showNotification('第1步：请扫码登录创作者中心', 'info');
        await loginCreatorCenter(newAccountId);

        // 等待5秒后提示登录主站（给用户时间完成第一次登录）
        setTimeout(() => {
          showNotification('第2步：请扫码登录主站', 'info');
          loginMainSite(newAccountId);
        }, 5000);
      }, 500);

      // 刷新账号列表
      loadAccounts();
    } else {
      const errorMsg = result.error || '创建账号失败';
      console.error('创建账号失败:', errorMsg, result);
      showNotification(`创建账号失败: ${errorMsg}`, 'error');
    }
  } catch (error) {
    console.error('添加账号失败:', error);
    showNotification(`添加账号失败: ${error.message}`, 'error');
  }
}

// 显示编辑账号模态框
async function showEditAccountModal(accountId) {
  try {
    const response = await fetch(`${API_BASE}/accounts/${accountId}`);
    const result = await response.json();

    if (result.success) {
      const account = result.data;
      document.getElementById('accountModalTitle').textContent = '编辑账号';
      document.getElementById('accountId').value = account.id;
      document.getElementById('accountName').value = account.account_name || '';
      document.getElementById('accountPhone').value = account.phone || '';
      document.getElementById('accountEmail').value = account.email || '';
      document.getElementById('accountNickname').value = account.nickname || '';
      document.getElementById('accountXhsUserId').value = account.xhs_user_id || '';
      document.getElementById('accountAvatar').value = account.avatar_url || '';
      document.getElementById('accountPrimary').checked = account.is_primary === 1;
      document.getElementById('accountModal').style.display = 'block';
    } else {
      showNotification('加载账号信息失败', 'error');
    }
  } catch (error) {
    console.error('加载账号信息失败:', error);
    showNotification('加载账号信息失败', 'error');
  }
}

// 关闭账号模态框
function closeAccountModal() {
  document.getElementById('accountModal').style.display = 'none';
  document.getElementById('accountForm').reset();
}

// 保存账号
async function saveAccount(event) {
  event.preventDefault();

  const accountId = document.getElementById('accountId').value;
  const accountData = {
    account_name: document.getElementById('accountName').value.trim(),
    phone: document.getElementById('accountPhone').value.trim() || null,
    email: document.getElementById('accountEmail').value.trim() || null,
    nickname: document.getElementById('accountNickname').value.trim() || null,
    xhs_user_id: document.getElementById('accountXhsUserId').value.trim() || null,
    avatar_url: document.getElementById('accountAvatar').value.trim() || null,
    is_primary: document.getElementById('accountPrimary').checked
  };

  if (!accountData.account_name) {
    showNotification('请输入账号名称', 'error');
    return;
  }

  try {
    const url = accountId ? `${API_BASE}/accounts/${accountId}` : `${API_BASE}/accounts`;
    const method = accountId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountData)
    });

    const result = await response.json();

    if (result.success) {
      showNotification(result.message || (accountId ? '账号更新成功' : '账号创建成功'), 'success');
      closeAccountModal();
      loadAccounts();
      loadPrimaryAccountInfo(); // 刷新主账号显示
    } else {
      showNotification(result.error || '操作失败', 'error');
    }
  } catch (error) {
    console.error('保存账号失败:', error);
    showNotification('保存账号失败', 'error');
  }
}

// 设置主账号
async function setPrimaryAccount(accountId) {
  if (!confirm('确定要将此账号设为主账号吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/accounts/${accountId}/set-primary`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('主账号设置成功', 'success');
      loadAccounts();
      loadPrimaryAccountInfo(); // 刷新主账号显示
    } else {
      showNotification(result.error || '设置失败', 'error');
    }
  } catch (error) {
    console.error('设置主账号失败:', error);
    showNotification('设置主账号失败', 'error');
  }
}

// 切换账号状态
async function toggleAccountStatus(accountId) {
  try {
    const response = await fetch(`${API_BASE}/accounts/${accountId}/toggle-status`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showNotification(result.message, 'success');
      loadAccounts();
    } else {
      showNotification(result.error || '操作失败', 'error');
    }
  } catch (error) {
    console.error('切换账号状态失败:', error);
    showNotification('操作失败', 'error');
  }
}

// 删除账号
async function deleteAccount(accountId) {
  if (!confirm('确定要删除此账号吗？此操作不可恢复！')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('账号删除成功', 'success');
      loadAccounts();
      loadPrimaryAccountInfo(); // 刷新主账号显示
    } else {
      showNotification(result.error || '删除失败', 'error');
    }
  } catch (error) {
    console.error('删除账号失败:', error);
    showNotification('删除账号失败', 'error');
  }
}

// 查看账号统计
async function viewAccountStats(accountId) {
  try {
    const response = await fetch(`${API_BASE}/accounts/${accountId}/stats`);
    const result = await response.json();

    if (result.success) {
      const stats = result.data;
      const message = `
统计数据：
- 总操作次数: ${stats.total_actions}
- 成功次数: ${stats.successful_actions}
- 失败次数: ${stats.failed_actions}
- 成功率: ${stats.total_actions > 0 ? ((stats.successful_actions / stats.total_actions) * 100).toFixed(1) : 0}%
      `;
      alert(message);
    } else {
      showNotification('获取统计数据失败', 'error');
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
    showNotification('获取统计数据失败', 'error');
  }
}

// 加载主账号信息（用于显示当前使用的账号）
async function loadPrimaryAccountInfo() {
  try {
    const response = await fetch(`${API_BASE}/accounts/primary`);
    const result = await response.json();

    const accountNameElement = document.getElementById('currentAccountName');
    if (!accountNameElement) return;

    if (result.success && result.data) {
      const account = result.data;
      // 优先显示小红书昵称，如果没有昵称则显示账号名称
      const displayName = account.nickname || account.account_name;
      const userIdInfo = account.xhs_user_id
        ? `<span style="opacity: 0.6; font-size: 12px; display: block; margin-top: 4px;">ID: ${escapeHtml(account.xhs_user_id)}</span>`
        : '';

      accountNameElement.innerHTML = `
        <span style="color: var(--primary-600);">${escapeHtml(displayName)}</span>
        ${userIdInfo}
      `;
    } else {
      accountNameElement.innerHTML = `
        <span style="color: var(--danger-color); font-weight: normal;">未设置主账号</span>
        <span style="opacity: 0.7; font-size: 12px; display: block; margin-top: 4px;">请在账号管理中添加账号</span>
      `;
    }
  } catch (error) {
    console.error('加载主账号信息失败:', error);
    const accountNameElement = document.getElementById('currentAccountName');
    if (accountNameElement) {
      accountNameElement.textContent = '加载失败';
    }
  }
}

// ==================== 风格选择器 ====================

// 初始化风格选择器
function initStyleSelector() {
  // 默认选中第一个风格（种草型）
  const firstOption = document.querySelector('.style-option[data-style="种草型"]');
  if (firstOption) {
    firstOption.classList.add('selected');
  }
}

// 选择风格
function selectStyle(styleName) {
  // 移除所有选中状态
  document.querySelectorAll('.style-option').forEach(option => {
    option.classList.remove('selected');
  });

  // 添加选中状态到当前点击的选项
  const selectedOption = document.querySelector(`.style-option[data-style="${styleName}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
  }

  // 更新隐藏的input值
  const styleInput = document.getElementById('contentStyle');
  if (styleInput) {
    styleInput.value = styleName;
  }

  console.log('已选择风格:', styleName);
}

// ==================== v2.2/v2.3 功能 ====================

// 切换热门关键词输入框显示
function toggleHotKeywords() {
  const learnFromHot = document.getElementById('learnFromHot').checked;
  const hotKeywordsGroup = document.getElementById('hotKeywordsGroup');

  if (learnFromHot) {
    hotKeywordsGroup.style.display = 'block';
  } else {
    hotKeywordsGroup.style.display = 'none';
  }
}

// 显示AIGC元数据
function displayAigcMetadata(metadata) {
  if (!metadata) return;

  const aigcMetadataDiv = document.getElementById('aigcMetadata');
  const aigcScoreSpan = document.getElementById('aigcScore');
  const sensitiveWordsSpan = document.getElementById('sensitiveWords');
  const hotPostsRefDiv = document.getElementById('hotPostsRef');
  const hotPostsCountSpan = document.getElementById('hotPostsCount');

  // 显示AIGC评分
  if (metadata.aigc_score !== undefined) {
    // 后端返回的是0-100分，需要转换为0-10分
    const score = Math.round(metadata.aigc_score / 10);
    let scoreClass = 'score-excellent';
    let scoreEmoji = '⭐';

    if (score >= 9) {
      scoreClass = 'score-excellent';
      scoreEmoji = '⭐⭐⭐⭐⭐';
    } else if (score >= 7) {
      scoreClass = 'score-good';
      scoreEmoji = '⭐⭐⭐⭐';
    } else if (score >= 5) {
      scoreClass = 'score-fair';
      scoreEmoji = '⭐⭐⭐';
    } else {
      scoreClass = 'score-poor';
      scoreEmoji = '⭐⭐';
    }

    aigcScoreSpan.innerHTML = `<span class="${scoreClass}">${score}/10 ${scoreEmoji}</span>`;
  }

  // 显示敏感词信息
  if (metadata.sensitive_words_found) {
    const count = metadata.sensitive_words_found.length;
    if (count > 0) {
      sensitiveWordsSpan.innerHTML = `<span class="sensitive-warning">检测到 ${count} 个，已替换</span>`;
    } else {
      sensitiveWordsSpan.innerHTML = `<span class="sensitive-safe">未检测到敏感词 ✓</span>`;
    }
  }

  // 显示热门笔记参考信息
  if (metadata.hot_posts_used && metadata.hot_posts_used.length > 0) {
    hotPostsRefDiv.style.display = 'block';
    hotPostsCountSpan.innerHTML = `<span class="hot-posts-info">${metadata.hot_posts_used.length} 篇</span>`;
  } else {
    hotPostsRefDiv.style.display = 'none';
  }

  aigcMetadataDiv.style.display = 'block';
}

// ==================== 内容分析工具 ====================

// 分析内容质量
function analyzeContent(title, content, tags) {
  const analysis = {
    wordCount: 0,
    charCount: 0,
    emojiCount: 0,
    tagCount: 0,
    readabilityScore: 0,
    qualityScore: 0,
    suggestions: []
  };

  // 字数统计
  const contentWithoutEmoji = content.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  analysis.charCount = content.length;
  // 只统计中文字符数量（不包括标点、空格、英文等）
  const chineseChars = contentWithoutEmoji.match(/[\u4e00-\u9fa5]/g);
  analysis.wordCount = chineseChars ? chineseChars.length : 0;

  // Emoji统计
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]/gu;
  const emojiMatches = content.match(emojiRegex);
  analysis.emojiCount = emojiMatches ? emojiMatches.length : 0;

  // 标签统计
  analysis.tagCount = Array.isArray(tags) ? tags.length : 0;

  // 可读性评分（简化版）
  const avgWordPerSentence = analysis.wordCount / Math.max(1, (content.match(/[。！？]/g) || []).length);
  if (avgWordPerSentence < 20) {
    analysis.readabilityScore = 95;
  } else if (avgWordPerSentence < 30) {
    analysis.readabilityScore = 85;
  } else if (avgWordPerSentence < 40) {
    analysis.readabilityScore = 75;
  } else {
    analysis.readabilityScore = 65;
  }

  // 质量评分
  let qualityScore = 0;

  // 字数合适性（500-800字最佳）
  if (analysis.wordCount >= 500 && analysis.wordCount <= 800) {
    qualityScore += 25;
  } else if (analysis.wordCount >= 400 && analysis.wordCount < 500) {
    qualityScore += 20;
    analysis.suggestions.push('字数略少，建议补充到500-800字');
  } else if (analysis.wordCount > 800 && analysis.wordCount <= 1000) {
    qualityScore += 20;
    analysis.suggestions.push('字数略多，可以适当精简');
  } else if (analysis.wordCount < 400) {
    qualityScore += 10;
    analysis.suggestions.push('字数过少，建议增加到500字以上');
  } else {
    qualityScore += 10;
    analysis.suggestions.push('字数过多，建议控制在800字以内');
  }

  // Emoji使用情况（5-15个最佳）
  if (analysis.emojiCount >= 5 && analysis.emojiCount <= 15) {
    qualityScore += 25;
  } else if (analysis.emojiCount >= 3 && analysis.emojiCount < 5) {
    qualityScore += 20;
    analysis.suggestions.push('可以增加一些emoji让内容更生动');
  } else if (analysis.emojiCount > 15 && analysis.emojiCount <= 20) {
    qualityScore += 15;
    analysis.suggestions.push('emoji使用略多，建议控制在15个以内');
  } else if (analysis.emojiCount < 3) {
    qualityScore += 10;
    analysis.suggestions.push('建议增加emoji，让内容更有吸引力');
  } else {
    qualityScore += 5;
    analysis.suggestions.push('emoji过多，会影响阅读体验');
  }

  // 标签数量（3-5个最佳）
  if (analysis.tagCount >= 3 && analysis.tagCount <= 5) {
    qualityScore += 25;
  } else if (analysis.tagCount === 2) {
    qualityScore += 15;
    analysis.suggestions.push('建议增加到3-5个标签');
  } else if (analysis.tagCount > 5) {
    qualityScore += 15;
    analysis.suggestions.push('标签略多，建议控制在5个以内');
  } else {
    qualityScore += 5;
    analysis.suggestions.push('标签过少，建议添加3-5个相关标签');
  }

  // 可读性加分
  qualityScore += analysis.readabilityScore / 4;

  analysis.qualityScore = Math.min(100, Math.round(qualityScore));

  return analysis;
}

// 显示内容分析结果
function displayContentAnalysis(title, content, tags) {
  const analysis = analyzeContent(title, content, tags);
  const container = document.getElementById('contentAnalysis');

  if (!container) return;

  // 质量评级
  let qualityGrade = '';
  let qualityClass = '';
  if (analysis.qualityScore >= 90) {
    qualityGrade = '优秀';
    qualityClass = 'excellent';
  } else if (analysis.qualityScore >= 80) {
    qualityGrade = '良好';
    qualityClass = 'good';
  } else if (analysis.qualityScore >= 70) {
    qualityGrade = '及格';
    qualityClass = 'fair';
  } else {
    qualityGrade = '待改进';
    qualityClass = 'poor';
  }

  container.innerHTML = `
    <div class="analysis-item">
      <div class="analysis-label">总体评分</div>
      <div class="analysis-value">${analysis.qualityScore}</div>
      <span class="analysis-score ${qualityClass}">${qualityGrade}</span>
    </div>
    <div class="analysis-item">
      <div class="analysis-label">字数</div>
      <div class="analysis-value">${analysis.wordCount}</div>
      <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 4px;">建议: 500-800字</div>
    </div>
    <div class="analysis-item">
      <div class="analysis-label">Emoji</div>
      <div class="analysis-value">${analysis.emojiCount}</div>
      <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 4px;">建议: 5-15个</div>
    </div>
    <div class="analysis-item">
      <div class="analysis-label">标签</div>
      <div class="analysis-value">${analysis.tagCount}</div>
      <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 4px;">建议: 3-5个</div>
    </div>
    <div class="analysis-item">
      <div class="analysis-label">可读性</div>
      <div class="analysis-value">${analysis.readabilityScore}</div>
      <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 4px;">
        ${analysis.readabilityScore >= 85 ? '易读' : analysis.readabilityScore >= 75 ? '一般' : '略难'}
      </div>
    </div>
  `;

  // 如果有建议，显示在分析区域下方
  if (analysis.suggestions.length > 0) {
    const suggestionsHtml = `
      <div style="grid-column: 1 / -1; margin-top: 12px; padding: 12px; background: var(--glass-bg-hover); border-radius: var(--radius-md); border-left: 3px solid var(--primary-500);">
        <div style="font-weight: 600; margin-bottom: 8px; color: var(--gray-800);">💡 优化建议：</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.875rem; color: var(--gray-700);">
          ${analysis.suggestions.map(s => `<li style="margin: 4px 0;">${s}</li>`).join('')}
        </ul>
      </div>
    `;
    container.innerHTML += suggestionsHtml;
  }
}

// ==================== 封面文字生成 ====================

// 生成封面文字建议
function generateCoverTextSuggestions(title, content) {
  const suggestions = [];

  // 清理标题：移除JSON残留、emoji和特殊字符
  let cleanTitle = title
    .replace(/"(title|content|tags)":\s*/g, '') // 移除JSON字段名
    .replace(/\\n/g, '') // 移除转义换行符
    .replace(/\\"/g, '') // 移除转义引号
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // 移除emoji
    .replace(/^["'\s]+|["'\s]+$/g, '') // 移除首尾引号和空格
    .trim();

  console.log('封面文字建议 - 原始标题:', title);
  console.log('封面文字建议 - 清理后标题:', cleanTitle);

  // 如果清理后标题为空，返回空数组
  if (!cleanTitle || cleanTitle.length === 0) {
    console.warn('封面文字建议 - 标题为空，无法生成建议');
    return [];
  }

  // 选项1: 使用完整标题（如果不太长）
  if (cleanTitle.length <= 12) {
    suggestions.push({
      text: cleanTitle,
      style: '大标题',
      position: '居中',
      color: '深色（黑色/深蓝）',
      font: '粗体',
      size: '特大'
    });
  }

  // 选项2: 提取前半段（5-8字）
  const firstHalf = cleanTitle.substring(0, Math.min(8, Math.floor(cleanTitle.length / 2)));
  if (firstHalf.length >= 4) {
    suggestions.push({
      text: firstHalf,
      style: '主标题',
      position: '上方居中',
      color: '亮色（白色/浅黄）',
      font: '加粗',
      size: '大'
    });
  }

  // 选项3: 提取关键动词或名词（简化版）
  const keywords = extractKeywords(cleanTitle, content);
  if (keywords.length > 0) {
    suggestions.push({
      text: keywords[0],
      style: '突出标题',
      position: '中心偏上',
      color: '对比色（橙色/红色）',
      font: '特粗',
      size: '超大'
    });
  }

  // 选项4: 数字+关键词组合
  const numbers = cleanTitle.match(/\d+/);
  if (numbers && keywords.length > 0) {
    suggestions.push({
      text: `${numbers[0]}${keywords[0]}`,
      style: '数字强调',
      position: '左上角',
      color: '渐变色',
      font: '粗体',
      size: '大'
    });
  }

  // 选项5: 问句形式
  if (cleanTitle.includes('吗') || cleanTitle.includes('？')) {
    const question = cleanTitle.split(/[，。！？]/)[0] + '？';
    if (question.length <= 12) {
      suggestions.push({
        text: question,
        style: '疑问标题',
        position: '居中',
        color: '深色（黑色）',
        font: '常规',
        size: '中大'
      });
    }
  }

  // 如果建议少于3个，添加通用建议
  if (suggestions.length < 3 && cleanTitle.length >= 6) {
    // 截取前6个字
    const short = cleanTitle.substring(0, 6);
    suggestions.push({
      text: short,
      style: '简洁标题',
      position: '下方居中',
      color: '白色带阴影',
      font: '加粗',
      size: '中'
    });
  }

  console.log('封面文字建议 - 生成数量:', suggestions.length);
  return suggestions.slice(0, 5); // 最多返回5个建议
}

// 提取关键词（简化版）
function extractKeywords(title, content) {
  // 常见的高频词和停用词
  const stopWords = ['的', '了', '是', '在', '我', '你', '他', '她', '有', '和', '就', '不', '人', '都', '一', '这', '那', '么', '个', '与', '及'];

  // 清理JSON残留和特殊字符
  let cleanText = (title + ' ' + content)
    .replace(/"(title|content|tags)":\s*/g, '') // 移除JSON字段名
    .replace(/\\n/g, ' ') // 移除转义换行符
    .replace(/\\"/g, '') // 移除转义引号
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // 移除emoji
    .replace(/[，。！？；：、""''（）《》【】]/g, ' '); // 移除标点

  // 分词（简化版，按空格和常见分隔符）
  const words = cleanText.split(/\s+/).filter(w => w.length >= 2 && w.length <= 4 && !stopWords.includes(w));

  // 统计词频
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // 按词频排序
  const sorted = Object.entries(wordCount).sort((a, b) => b[1] - a[1]);

  return sorted.slice(0, 3).map(([word]) => word);
}

// 显示封面文字建议
function displayCoverTextSuggestions(title, content) {
  const suggestions = generateCoverTextSuggestions(title, content);
  const container = document.getElementById('coverTextSuggestions');

  if (!container) return;

  if (suggestions.length === 0) {
    container.innerHTML = '<p style="color: var(--gray-600); font-size: 0.875rem;">暂无封面文字建议</p>';
    return;
  }

  container.innerHTML = suggestions.map((suggestion, index) => `
    <div class="cover-text-option" onclick="copyCoverText('${escapeHtml(suggestion.text)}', ${index})">
      <div class="copy-indicator" id="copyIndicator${index}">✓ 已复制</div>
      <div class="cover-text-main">${suggestion.text}</div>
      <div class="cover-text-meta">
        <div class="cover-text-meta-item">
          <span class="cover-text-meta-label">样式:</span>
          <span class="cover-text-meta-value">${suggestion.style}</span>
        </div>
        <div class="cover-text-meta-item">
          <span class="cover-text-meta-label">位置:</span>
          <span class="cover-text-meta-value">${suggestion.position}</span>
        </div>
        <div class="cover-text-meta-item">
          <span class="cover-text-meta-label">颜色:</span>
          <span class="cover-text-meta-value">${suggestion.color}</span>
        </div>
        <div class="cover-text-meta-item">
          <span class="cover-text-meta-label">字体:</span>
          <span class="cover-text-meta-value">${suggestion.font}</span>
        </div>
        <div class="cover-text-meta-item">
          <span class="cover-text-meta-label">大小:</span>
          <span class="cover-text-meta-value">${suggestion.size}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// 复制封面文字到剪贴板
function copyCoverText(text, index) {
  navigator.clipboard.writeText(text).then(() => {
    // 显示复制成功提示
    const indicator = document.getElementById(`copyIndicator${index}`);
    if (indicator) {
      indicator.classList.add('show');
      setTimeout(() => {
        indicator.classList.remove('show');
      }, 2000);
    }
    showNotification('封面文字已复制到剪贴板', 'success');
  }).catch(err => {
    console.error('复制失败:', err);
    showNotification('复制失败，请手动复制', 'error');
  });
}

// ==================== 标签编辑功能 ====================

// 全局变量存储当前标签
let currentTags = [];

// 显示可编辑的标签
function displayEditableTags(tags) {
  currentTags = Array.isArray(tags) ? [...tags] : [];
  renderTags();
}

// 渲染标签列表
function renderTags() {
  const container = document.getElementById('generatedTags');
  if (!container) return;

  container.innerHTML = `
    <div class="tags-editor">
      <div class="tags-list">
        ${currentTags.map((tag, index) => `
          <div class="tag-item-editable">
            <span class="tag-text">#${escapeHtml(tag)}</span>
            <button class="tag-edit-btn" onclick="editTag(${index})" title="编辑">✏️</button>
            <button class="tag-delete-btn" onclick="deleteTag(${index})" title="删除">×</button>
          </div>
        `).join('')}
      </div>
      <button class="tag-add-btn" onclick="addNewTag()">+ 添加标签</button>
    </div>
  `;
}

// 添加新标签
function addNewTag() {
  const tagText = prompt('请输入新标签（不需要输入#号）:');
  if (tagText && tagText.trim()) {
    const cleanTag = tagText.trim().replace(/^#/, '');
    if (cleanTag && !currentTags.includes(cleanTag)) {
      currentTags.push(cleanTag);
      renderTags();
      showNotification('标签已添加', 'success');
    } else if (currentTags.includes(cleanTag)) {
      showNotification('标签已存在', 'warning');
    }
  }
}

// 编辑标签
function editTag(index) {
  const oldTag = currentTags[index];
  const newTag = prompt('编辑标签（不需要输入#号）:', oldTag);
  if (newTag && newTag.trim()) {
    const cleanTag = newTag.trim().replace(/^#/, '');
    if (cleanTag && cleanTag !== oldTag) {
      if (!currentTags.includes(cleanTag)) {
        currentTags[index] = cleanTag;
        renderTags();
        showNotification('标签已更新', 'success');
      } else {
        showNotification('标签已存在', 'warning');
      }
    }
  }
}

// 删除标签
function deleteTag(index) {
  if (confirm(`确定要删除标签 "#${currentTags[index]}" 吗？`)) {
    currentTags.splice(index, 1);
    renderTags();
    showNotification('标签已删除', 'success');
  }
}

// 获取当前标签（供发布时使用）
function getCurrentTags() {
  return currentTags;
}

// ============================================================================
// 小红书登录功能
// ============================================================================

// 显示登录模态框
// 显示登录模态框并获取二维码
async function showLoginModal() {
  const modal = document.getElementById('xhsLoginModal');
  const qrcodeLoading = document.getElementById('qrcodeLoading');
  const qrcodeImage = document.getElementById('qrcodeImage');
  const statusMessage = document.getElementById('loginStatusMessage');

  modal.classList.add('show');

  // 显示加载状态
  qrcodeLoading.style.display = 'block';
  qrcodeImage.style.display = 'none';
  statusMessage.textContent = '';

  try {
    // 获取二维码
    const response = await fetch(`${API_BASE}/xhs/login/qrcode?force_new=true`);
    const data = await response.json();

    if (data.success && data.data.manual_login) {
      // 手动登录模式
      qrcodeLoading.style.display = 'none';
      statusMessage.textContent = '✅ ' + (data.data.message || '请在浏览器中手动完成登录');
      statusMessage.className = 'text-info';

      // 开始轮询检查登录状态
      startLoginPolling();
    } else if (data.success && data.data.qrcode) {
      // 显示二维码
      qrcodeLoading.style.display = 'none';
      qrcodeImage.src = data.data.qrcode;
      qrcodeImage.style.display = 'block';
      statusMessage.textContent = '请使用小红书 APP 扫描二维码';
      statusMessage.className = 'text-info';

      // 开始轮询检查登录状态
      startLoginPolling();
    } else if (data.success && data.data.is_logged_in) {
      // 已经登录
      qrcodeLoading.style.display = 'none';
      statusMessage.textContent = '✅ 您已经登录了';
      statusMessage.className = 'text-success';
      setTimeout(() => {
        closeXhsLoginModal();
        checkXhsLoginStatus();
      }, 1500);
    } else {
      throw new Error(data.error || '获取二维码失败');
    }
  } catch (error) {
    qrcodeLoading.style.display = 'none';
    statusMessage.textContent = `获取二维码失败: ${error.message}`;
    statusMessage.className = 'text-error';
  }
}

// 刷新二维码
async function refreshQRCode() {
  await showLoginModal();
}

// 开始轮询检查登录状态
function startLoginPolling() {
  // 清除之前的轮询
  if (loginPollingInterval) {
    clearInterval(loginPollingInterval);
  }

  loginPollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/xhs/login-status`);
      const data = await response.json();

      if (data.success && data.data.logged_in) {
        clearInterval(loginPollingInterval);
        loginPollingInterval = null;

        const statusMessage = document.getElementById('loginStatusMessage');
        statusMessage.textContent = '✅ 登录成功！';
        statusMessage.className = 'text-success';

        setTimeout(() => {
          closeXhsLoginModal();
          checkXhsLoginStatus();
          showNotification('小红书登录成功', 'success');
        }, 1500);
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  }, 2000); // 每2秒检查一次
}

// 关闭登录模态框
function closeXhsLoginModal() {
  document.getElementById('xhsLoginModal').classList.remove('show');

  // 停止轮询
  if (loginPollingInterval) {
    clearInterval(loginPollingInterval);
    loginPollingInterval = null;
  }

  // 清空二维码
  const qrcodeImage = document.getElementById('qrcodeImage');
  if (qrcodeImage) {
    qrcodeImage.src = '';
    qrcodeImage.style.display = 'none';
  }

  // 清空状态消息
  const statusMessage = document.getElementById('loginStatusMessage');
  if (statusMessage) {
    statusMessage.textContent = '';
  }
}

// 检查小红书登录状态
let lastLoginStatus = false; // 记录上次的登录状态

async function checkXhsLoginStatus() {
  try {
    // 使用 Node.js 服务的 API（通过 Docker Exec 适配器访问 MCP）
    const response = await fetch(`${API_BASE}/xhs/login-status`);
    const data = await response.json();

    const isLoggedIn = data.success && data.data && data.data.logged_in;
    const accountName = (data.data && data.data.account_name) || '小红书用户';
    const accountId = data.data && data.data.account_id;

    // 检测到登录状态变化
    if (isLoggedIn && !lastLoginStatus) {
      // 从未登录变为已登录
      console.log('✅ 检测到登录成功:', accountName);
      updateLoginStatus(true, accountName, accountId);

      // 如果登录模态框是打开的，自动关闭它
      const loginModal = document.getElementById('xhsLoginModal');
      if (loginModal && loginModal.classList.contains('show')) {
        closeXhsLoginModal();
        showNotification('小红书登录成功', 'success');
      }
    } else if (!isLoggedIn && lastLoginStatus) {
      // 从已登录变为未登录
      console.log('⚠️ 检测到已退出登录');
      updateLoginStatus(false);
    } else if (isLoggedIn) {
      // 保持已登录状态
      updateLoginStatus(true, accountName, accountId);
    } else {
      // 保持未登录状态
      updateLoginStatus(false);
    }

    lastLoginStatus = isLoggedIn;
  } catch (error) {
    console.error('检查登录状态失败:', error);
    updateLoginStatus(false);
    lastLoginStatus = false;
  }
}

// 启动登录状态监控（每5秒检查一次）
let loginStatusInterval = null;

function startLoginStatusMonitor() {
  // 清除已存在的定时器
  if (loginStatusInterval) {
    clearInterval(loginStatusInterval);
  }

  // 每5秒检查一次登录状态
  loginStatusInterval = setInterval(() => {
    checkXhsLoginStatus();
  }, 5000);

  console.log('🔄 登录状态监控已启动（每5秒检查一次）');
}

// 停止登录状态监控
function stopLoginStatusMonitor() {
  if (loginStatusInterval) {
    clearInterval(loginStatusInterval);
    loginStatusInterval = null;
    console.log('⏸️ 登录状态监控已停止');
  }
}

// 更新登录状态显示
function updateLoginStatus(isLoggedIn, accountName = '', accountId = null) {
  const statusDisplay = document.getElementById('loginStatusDisplay');
  const statusText = document.getElementById('loginStatusText');
  const loginBtn = document.getElementById('showLoginBtn');
  const accountInfo = document.getElementById('currentAccountInfo');
  const currentAccountName = document.getElementById('currentAccountName');

  if (isLoggedIn) {
    statusDisplay.classList.add('logged-in');
    statusText.textContent = `✅ 已登录`;
    loginBtn.textContent = '退出登录';
    loginBtn.onclick = logoutXhs;

    // 显示当前账户信息
    if (accountInfo && currentAccountName) {
      accountInfo.style.display = 'block';
      currentAccountName.textContent = accountName;
    }
  } else {
    statusDisplay.classList.remove('logged-in');
    statusText.textContent = '未登录';
    loginBtn.textContent = '登录小红书';
    loginBtn.onclick = showLoginModal;

    // 隐藏账户信息
    if (accountInfo) {
      accountInfo.style.display = 'none';
    }
  }
}

// 发送验证码
async function sendVerificationCode() {
  const phone = document.getElementById('xhsPhone').value.trim();
  const countryCode = document.getElementById('xhsCountryCode').value;
  const messageEl = document.getElementById('xhsLoginMessage');
  const sendBtn = document.getElementById('sendCodeBtn');

  if (!phone) {
    messageEl.textContent = '请输入手机号码';
    messageEl.className = 'text-error';
    messageEl.classList.remove('hidden');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = '发送中...';

  try {
    const response = await fetch(`${API_BASE}/xhs/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, country_code: countryCode })
    });

    const data = await response.json();

    if (data.success) {
      xhsSessionId = data.session_id;
      messageEl.textContent = data.message || '验证码已发送，请查收';
      messageEl.className = 'text-success';
      messageEl.classList.remove('hidden');
      document.getElementById('verificationArea').classList.remove('hidden');
      sendBtn.disabled = true;
    } else {
      messageEl.textContent = data.error || '发送失败';
      messageEl.className = 'text-error';
      messageEl.classList.remove('hidden');
      sendBtn.disabled = false;
      sendBtn.textContent = '发送验证码';
    }
  } catch (error) {
    console.error('发送验证码失败:', error);
    messageEl.textContent = '网络错误，请重试';
    messageEl.className = 'text-error';
    messageEl.classList.remove('hidden');
    sendBtn.disabled = false;
    sendBtn.textContent = '发送验证码';
  }
}

// 验证验证码并登录
async function verifyXhsCode() {
  const code = document.getElementById('xhsVerificationCode').value.trim();
  const messageEl = document.getElementById('xhsLoginMessage');
  const verifyBtn = document.getElementById('verifyCodeBtn');

  if (!code) {
    messageEl.textContent = '请输入验证码';
    messageEl.className = 'text-error';
    messageEl.classList.remove('hidden');
    return;
  }

  if (!xhsSessionId) {
    messageEl.textContent = '请先发送验证码';
    messageEl.className = 'text-error';
    messageEl.classList.remove('hidden');
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = '验证中...';

  try {
    const response = await fetch(`${API_BASE}/xhs/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: xhsSessionId, code })
    });

    const data = await response.json();

    if (data.success && data.data.logged_in) {
      messageEl.textContent = '登录成功！';
      messageEl.className = 'text-success';
      messageEl.classList.remove('hidden');

      setTimeout(() => {
        closeXhsLoginModal();
        checkXhsLoginStatus();
        showNotification('小红书登录成功', 'success');
      }, 1500);
    } else {
      messageEl.textContent = data.error || '验证失败';
      messageEl.className = 'text-error';
      messageEl.classList.remove('hidden');
      verifyBtn.disabled = false;
      verifyBtn.textContent = '确认登录';
    }
  } catch (error) {
    console.error('验证失败:', error);
    messageEl.textContent = '网络错误，请重试';
    messageEl.className = 'text-error';
    messageEl.classList.remove('hidden');
    verifyBtn.disabled = false;
    verifyBtn.textContent = '确认登录';
  }
}

// 退出登录
async function logoutXhs() {
  if (!confirm('确定要退出登录吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/xhs/logout`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      updateLoginStatus(false);
      showNotification('已退出登录', 'success');
    } else {
      showNotification('退出失败', 'error');
    }
  } catch (error) {
    console.error('退出登录失败:', error);
    showNotification('退出失败', 'error');
  }
}

// ==================== 账号登录功能 ====================

// 创作者中心登录
async function loginCreatorCenter(accountId) {
  try {
    showNotification('正在打开登录窗口...', 'info');

    const response = await fetch(`${API_BASE}/xhs/qrcode?account_id=${accountId}&force_new=true`);
    const result = await response.json();

    if (result.success) {
      showNotification('请在浏览器窗口中扫码登录', 'success');

      // 开始轮询检查登录状态
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_BASE}/xhs/check-login?account_id=${accountId}`);
          const statusResult = await statusResponse.json();

          if (statusResult.success && statusResult.data && statusResult.data.logged_in) {
            clearInterval(checkInterval);
            showNotification('创作者中心登录成功！', 'success');
            loadAccounts(); // 刷新账号列表
          }
        } catch (error) {
          console.error('检查登录状态失败:', error);
        }
      }, 3000);

      // 30秒后停止检查
      setTimeout(() => clearInterval(checkInterval), 30000);
    } else {
      showNotification('打开登录窗口失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('创作者中心登录失败:', error);
    showNotification('登录失败', 'error');
  }
}

// 主站登录
async function loginMainSite(accountId) {
  try {
    showNotification('正在打开主站登录窗口...', 'info');

    const response = await fetch(`${API_BASE}/accounts/main-site/qrcode?account_id=${accountId}`);
    const result = await response.json();

    if (result.success) {
      showNotification('请在浏览器窗口中扫码登录主站', 'success');

      // 开始轮询检查主站登录状态
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_BASE}/accounts/main-site/status?account_id=${accountId}`);
          const statusResult = await statusResponse.json();

          if (statusResult.success && statusResult.data && statusResult.data.logged_in) {
            clearInterval(checkInterval);
            showNotification('主站登录成功！现在可以使用热门笔记学习功能了', 'success');
            loadAccounts(); // 刷新账号列表
          }
        } catch (error) {
          console.error('检查主站登录状态失败:', error);
        }
      }, 3000);

      // 30秒后停止检查
      setTimeout(() => clearInterval(checkInterval), 30000);
    } else {
      showNotification('打开主站登录窗口失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('主站登录失败:', error);
    showNotification('登录失败', 'error');
  }
}

// 退出创作者中心
async function logoutCreatorCenter(accountId) {
  if (!confirm('确定要退出创作者中心登录吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/xhs/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ account_id: accountId })
    });

    const result = await response.json();
    if (result.success) {
      showNotification('已退出创作者中心登录', 'success');
      loadAccounts(); // 刷新账号列表
    } else {
      showNotification('退出失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('退出登录失败:', error);
    showNotification('退出失败', 'error');
  }
}

// 退出主站
async function logoutMainSite(accountId) {
  if (!confirm('确定要退出主站登录吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/accounts/${accountId}/logout-main-site`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    if (result.success) {
      showNotification('已退出主站登录', 'success');
      loadAccounts(); // 刷新账号列表
    } else {
      showNotification('退出失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('退出主站失败:', error);
    showNotification('退出失败', 'error');
  }
}

// ==================== 语法检查功能 ====================

// 语法检查
async function checkGrammar(mode = 'full') {
  const content = document.getElementById('generatedText').value;
  const title = document.getElementById('generatedTitle').value;

  if (!content || !title) {
    showNotification('请先生成文案内容', 'warning');
    return;
  }

  const text = `标题：${title}\n\n${content}`;
  const resultDiv = document.getElementById('grammarCheckResult');

  // 显示加载状态
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="loading">正在检查语法...</div>';

  try {
    const response = await fetch(`${API_BASE}/grammar/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        mode: mode,
        model: document.getElementById('aiModel').value
      })
    });

    const result = await response.json();

    if (result.success) {
      displayGrammarResult(result);
    } else {
      resultDiv.innerHTML = `<div class="error">检查失败: ${result.error}</div>`;
    }
  } catch (error) {
    console.error('语法检查失败:', error);
    resultDiv.innerHTML = '<div class="error">检查失败，请重试</div>';
  }
}

// 显示语法检查结果
function displayGrammarResult(result) {
  const resultDiv = document.getElementById('grammarCheckResult');
  const { issues, summary } = result;

  if (issues.length === 0) {
    resultDiv.innerHTML = `
      <div class="grammar-success">
        <span class="success-icon">✓</span>
        <span>未发现语法问题，文案质量良好！</span>
      </div>
    `;
    return;
  }

  // 保存issues到全局变量，供替换功能使用
  window.grammarIssues = issues;

  let html = `
    <div class="grammar-summary">
      <span class="summary-item">共发现 <strong>${summary.total}</strong> 个问题</span>
      ${summary.error > 0 ? `<span class="summary-item error">错误: ${summary.error}</span>` : ''}
      ${summary.warning > 0 ? `<span class="summary-item warning">警告: ${summary.warning}</span>` : ''}
      ${summary.info > 0 ? `<span class="summary-item info">提示: ${summary.info}</span>` : ''}
      <button onclick="applyAllGrammarFixes()" class="btn btn-primary" style="margin-left: auto;">一键替换全部</button>
    </div>
    <div class="grammar-issues">
  `;

  issues.forEach((issue, index) => {
    const severityClass = issue.severity || 'info';
    const severityText = {
      'error': '错误',
      'warning': '警告',
      'info': '提示'
    }[issue.severity] || '提示';

    html += `
      <div class="grammar-issue ${severityClass}" data-issue-index="${index}">
        <div class="issue-header">
          <span class="issue-badge ${severityClass}">${severityText}</span>
          <span class="issue-type">${issue.name || issue.type || '语法问题'}</span>
        </div>
        <div class="issue-message">${issue.message}</div>
        ${issue.original ? `<div class="issue-original">原文: ${issue.original}</div>` : ''}
        ${issue.suggestion ? `<div class="issue-suggestion">建议: ${issue.suggestion}</div>` : ''}
        ${issue.original && issue.suggestion ? `
          <button onclick="applySingleGrammarFix(${index})" class="btn btn-secondary btn-sm" style="margin-top: 8px;">
            替换此处
          </button>
        ` : ''}
      </div>
    `;
  });

  html += '</div>';
  resultDiv.innerHTML = html;
}

// 应用单个语法修复
function applySingleGrammarFix(index) {
  const issue = window.grammarIssues[index];
  if (!issue || !issue.original || !issue.suggestion) {
    showNotification('无法应用此修复', 'error');
    return;
  }

  const titleElement = document.getElementById('generatedTitle');
  const contentElement = document.getElementById('generatedText');

  // 在标题和内容中查找并替换
  let replaced = false;

  if (titleElement.value.includes(issue.original)) {
    titleElement.value = titleElement.value.replace(issue.original, issue.suggestion);
    replaced = true;
  }

  if (contentElement.value.includes(issue.original)) {
    contentElement.value = contentElement.value.replace(issue.original, issue.suggestion);
    replaced = true;
  }

  if (replaced) {
    // 移除已应用的问题
    const issueElement = document.querySelector(`[data-issue-index="${index}"]`);
    if (issueElement) {
      issueElement.style.opacity = '0.5';
      issueElement.style.textDecoration = 'line-through';
    }
    showNotification('已应用修复建议', 'success');
  } else {
    showNotification('未找到原文，可能已被修改', 'warning');
  }
}

// 一键应用所有语法修复
function applyAllGrammarFixes() {
  if (!window.grammarIssues || window.grammarIssues.length === 0) {
    showNotification('没有可应用的修复建议', 'warning');
    return;
  }

  const titleElement = document.getElementById('generatedTitle');
  const contentElement = document.getElementById('generatedText');
  let appliedCount = 0;

  window.grammarIssues.forEach((issue, index) => {
    if (issue.original && issue.suggestion) {
      // 在标题中替换
      if (titleElement.value.includes(issue.original)) {
        titleElement.value = titleElement.value.replace(new RegExp(issue.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), issue.suggestion);
        appliedCount++;
      }

      // 在内容中替换
      if (contentElement.value.includes(issue.original)) {
        contentElement.value = contentElement.value.replace(new RegExp(issue.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), issue.suggestion);
        appliedCount++;
      }
    }
  });

  if (appliedCount > 0) {
    showNotification(`已应用 ${appliedCount} 处修复建议`, 'success');
    // 清空语法检查结果
    document.getElementById('grammarCheckResult').innerHTML = `
      <div class="grammar-success">
        <span class="success-icon">✓</span>
        <span>已应用所有修复建议！建议重新检查确认。</span>
      </div>
    `;
  } else {
    showNotification('未找到可应用的修复，可能文本已被修改', 'warning');
  }
}
