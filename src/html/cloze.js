class EditorManager {
  constructor() {
      this.initializeEventListeners();
      this.showDefaultView();
  }

  initializeEventListeners() {
      document.getElementById('btnCloze').addEventListener('click', () => {
          this.switchView('cloze-editor-container', 'deck-info');
      });

      document.getElementById('btnAnki').addEventListener('click', () => {
          this.switchView('anki-editor-container', 'deck-info');
      });

      document.getElementById('btnAI').addEventListener('click', () => {
          this.switchView('ai-editor-container', 'ai-info');
      });
  }

  switchView(containerId, infoClass) {
      this.showContainer(containerId);
      this.showTopInfo(infoClass);
  }

  showContainer(containerId) {
      // 隐藏所有编辑器容器
      document.querySelectorAll('.main-bottom-content > .editor-container').forEach(container => {
          container.classList.remove('active');
      });

      // 显示目标编辑器容器
      document.getElementById(containerId).classList.add('active');
  }

  showTopInfo(infoClass) {
      // 隐藏所有顶部信息栏
      document.querySelectorAll('.main-top-content > div').forEach(info => {
          info.classList.remove('active');
      });

      // 显示目标顶部信息栏
      document.querySelector(`.main-top-content .${infoClass}`).classList.add('active');
  }

  showDefaultView() {
      // 默认显示 Cloze 编辑器和 Deck 信息
      this.switchView('cloze-editor-container', 'deck-info');
  }
}

class SessionManager {
  constructor(clozeEditor) {
      this.sessions = [];
      this.currentSessionId = null;
      this.clozeEditor = clozeEditor;

      // 初始化DOM引用
      this.sessionList = document.getElementById('session-list');
      this.addNewSessionBtn = document.getElementById('addNewSessionBtn');
      this.selectAllBtn = document.getElementById('selectAllBtn');
      this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
      this.saveDeckInfoBtn = document.getElementById('saveDeckInfoBtn');
      this.openYamlFileBtn = document.getElementById('openYamlFileBtn');

      // 绑定事件
      this.addNewSessionBtn.addEventListener('click', () => this.addNewSession());
      this.selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
      this.deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());
      this.sessionList.addEventListener('click', (e) => this.handleSessionListClick(e));
      this.saveDeckInfoBtn.addEventListener('click', () => this.saveYamlFile());
      this.openYamlFileBtn.addEventListener('click', () => this.openYamlFile());

      this.loadSessions();
      if (this.sessions.length === 0) {
          this.addNewSession();
      }
  }

  // 加载 sessions
  loadSessions() {
      document.getElementById('deckId').value = localStorage.getItem('deckId');
      document.getElementById('deckName').value = localStorage.getItem('deckName');
      const savedSessions = localStorage.getItem('sessions');
      if (savedSessions) {
          this.sessions = JSON.parse(savedSessions);
          this.renderSessionList();
          if (this.sessions.length > 0) {
              this.selectSession(this.sessions[0].id);
          }
      }
  }

  // 保存 sessions
  saveSessions() {
      localStorage.setItem('deckId', document.getElementById('deckId').value);
      localStorage.setItem('deckName', document.getElementById('deckName').value);
      localStorage.setItem('sessions', JSON.stringify(this.sessions));
  }

  // 生成唯一 ID
  generateId() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
      });
  }

  // 添加新 session
  addNewSession() {
      const id = this.generateId();
      const timestamp = new Date().toLocaleString();
      this.sessions.push({
          id: id,
          title: `新 Session ${timestamp}`,
          content: '',
      });
      this.renderSessionList();
      this.selectSession(id);
      this.saveSessions();
  }

  // 渲染 session 列表
  renderSessionList() {
      this.sessionList.innerHTML = this.sessions.map(session => `
          <li data-id="${session.id}" ${this.currentSessionId === session.id ? 'class="selected"' : ''}>
              <input type="checkbox" class="session-checkbox">
              <div class="session-content">
                  <span>${session.title}</span>
                  <button class="edit-title-btn" data-id="${session.id}">编辑</button>
              </div>
          </li>
      `).join('');
      this.updateSelectedState();
  }

  // 选择 session
  selectSession(id) {
      this.currentSessionId = id;
      const session = this.sessions.find(s => s.id === id);
      if (session) {
          this.clozeEditor.loadContent(session.content);
      }
      this.renderSessionList();
      this.updateSelectedState();
  }

  // 处理 session 列表点击事件
  handleSessionListClick(event) {
      const sessionContent = event.target.closest('li > .session-content');
      const editButton = event.target.closest('.edit-title-btn');
      const checkbox = event.target.closest('.session-checkbox');

      if (editButton) {
          const id = editButton.dataset.id;
          this.editSessionTitle(id, event);
      } else if (sessionContent) {
          const id = sessionContent.closest('li').dataset.id;
          this.selectSession(id);
      } else if (checkbox) {
          this.updateSelectedState();
      }
  }

  // 编辑 session 标题
  editSessionTitle(id, event) {
      event.stopPropagation();
      const li = event.target.closest('li');
      const session = this.sessions.find(s => s.id === id);
      const input = document.createElement('input');
      input.value = session.title;
      input.style.width = '100px';
      li.textContent = '';
      li.appendChild(input);
      input.focus();

      let self = this;
      const saveTitle = () => {
          session.title = input.value;
          self.saveSessions();
          self.renderSessionList();
      };

      input.addEventListener('blur', saveTitle);
      input.addEventListener('keypress', e => e.key === 'Enter' && saveTitle());
  }

  // 全选/取消全选
  toggleSelectAll() {
      const checkboxes = this.sessionList.querySelectorAll('.session-checkbox');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      checkboxes.forEach(cb => cb.checked = !allChecked);
      this.updateSelectedState();
  }

  // 删除选中的 session
  deleteSelected() {
      const checkboxes = this.sessionList.querySelectorAll('.session-checkbox');
      checkboxes.forEach((cb, index) => {
          if (cb.checked) {
              this.sessions.splice(index, 1);
          }
      });
      this.saveSessions();
      this.renderSessionList();
  }

  // 更新选中状态
  updateSelectedState() {
      const hasSelected = this.sessionList.querySelector('.session-checkbox:checked');
      this.deleteSelectedBtn.style.visibility = hasSelected ? 'visible' : 'hidden';
  }

  // 获取当前 session
  getCurrentSession() {
      return this.sessions.find(s => s.id === this.currentSessionId);
  }

  // 更新当前 session 内容
  updateCurrentSessionContent(content) {
      const session = this.getCurrentSession();
      if (session) {
          session.content = content;
          this.saveSessions();
      }
  }

  // 保存为 YAML 文件
  saveYamlFile() {
      const deckId = document.getElementById('deckId').value;
      const deckName = document.getElementById('deckName').value;
      const data = {
          deckId: deckId,
          deckName: deckName,
          sessions: this.sessions,
      };
      const yamlContent = jsyaml.dump(data); // 假设使用 js-yaml 库
      const blob = new Blob([yamlContent], { type: 'application/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deckName || 'deck'}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
  }

  // 打开 YAML 文件
  openYamlFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml, .yml';

      let self = this;
      input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                  const content = e.target.result;
                  const parsedContent = jsyaml.load(content); // 假设使用 js-yaml 库
                  let data = { sessions: [] };
                  parsedContent.forEach((item) => {
                      if (item.deckId) {
                          data.deckId = item.deckId;
                      } else if (item.deckName) {
                          data.deckName = item.deckName;
                      } else {
                          // 使用 marked 转换 Markdown（包括表格）
                          let htmlContent = item.format === 'html' ? item.content : md2Html(item.content);
                          data.sessions.push({
                              id: self.generateId(),
                              title: item.title,
                              content: htmlContent,
                              rawContent: item.content,
                              format: 'html'  // 添加格式标记
                          });
                      }
                  });
                  self.sessions = data.sessions || [];
                  document.getElementById('deckId').value = data.deckId || '';
                  document.getElementById('deckName').value = data.deckName || '';
                  self.saveSessions();
                  self.renderSessionList();
                  if (self.sessions.length > 0) {
                      self.selectSession(self.sessions[0].id);
                  }
              };
              reader.readAsText(file);
          }
      };
      input.click();
  }
}
  
class ClozeEditor {
  constructor(sessionManager) {
      this.sessionManager = sessionManager;
      this.currentClozeNumber = 1;

      // 初始化DOM元素
      this.editor = document.getElementById('cloze-editor');
      this.preview = document.getElementById('cloze-preview');
      this.wrapClozeBtn = document.getElementById('wrapClozeBtn');
      this.nextClozeBtn = document.getElementById('nextClozeBtn');
      this.formatBoldBtn = document.getElementById('formatBoldBtn');
      this.formatItalicBtn = document.getElementById('formatItalicBtn');
      this.toHtmlBtn = document.getElementById('toHtmlBtn');

      // 绑定事件
      this.editor.addEventListener('input', () => {
          this.renderPreview();
          this.sessionManager.updateCurrentSessionContent(this.editor.value);
      });

      this.wrapClozeBtn.addEventListener('click', () => this.wrapCloze());
      this.nextClozeBtn.addEventListener('click', () => this.nextCloze());
      this.formatBoldBtn.addEventListener('click', () => this.formatText('bold'));
      this.formatItalicBtn.addEventListener('click', () => this.formatText('italic'));
      this.toHtmlBtn.addEventListener('click', () => this.convertToHtml());
      this.editor.addEventListener('scroll', () => this.syncScroll());
  }

  loadContent(content) {
      this.editor.value = content;
      this.renderPreview();
  }

  renderPreview() {
      this.preview.innerHTML = md2Html(this.editor.value);
  }

  wrapCloze() {
      const selection = window.getSelection().toString().trim();
      if (selection) {
          document.execCommand('insertText', false, `{{c${this.currentClozeNumber}::${selection}}}`);
          this.currentClozeNumber++;
      }
  }

  nextCloze() {
      const content = this.editor.value;
      const matches = content.match(/{{c\d+::/g) || [];
      this.currentClozeNumber = matches.length + 1;
  }

  formatText(type) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const text = range.toString();
          const formatted = type === 'bold' ? `**${text}**` : `*${text}*`;
          range.deleteContents();
          range.insertNode(document.createTextNode(formatted));
      }
  }

  convertToHtml() {
      const session = this.sessionManager.getCurrentSession();
      if (session) {
          session.content = md2Html(session.content);
          this.loadContent(session.content);
          this.sessionManager.saveSessions();
      }
  }

  syncScroll() {
      const scrollPercent = this.editor.scrollTop / (this.editor.scrollHeight - this.editor.clientHeight);
      this.preview.scrollTop = scrollPercent * (this.preview.scrollHeight - this.preview.clientHeight);
  }
}


  // 保留原工具函数
  function md2Html(text) {
    htmlContent = marked.parse(text, {
        breaks: true,
        gfm: true  // 启用 GitHub Flavored Markdown，支持表格
    });

    // 处理 Anki cloze 语法
    const clozeRegex = /\{\{c\d+::(.*?)\}\}/g;
    htmlContent = htmlContent.replace(clozeRegex, '{{c1::$1}}');

    // 使用 DOMPurify 清理 HTML，添加表格相关标签
    htmlContent = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: [
            // 基本标签
            'br', 'p', 'div', 'strong', 'em', 'code', 'span',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            // 表格相关标签
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        ALLOWED_ATTR: ['class', 'style']  // 允许 style 属性以支持表格边框等样式
    });

    // 可以添加默认的表格样式
    htmlContent = htmlContent.replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%;">');
    htmlContent = htmlContent.replace(/<t[hd]/g, '<$& style="border: 1px solid #ddd; padding: 8px;">');

    return htmlContent;
}

// 初始化应用
function init() {
  document.addEventListener('DOMContentLoaded', () => {
      const editorManager = new EditorManager();
      const clozeEditor = new ClozeEditor(); // Assuming ClozeEditor is defined
      const sessionManager = new SessionManager(clozeEditor); // Assuming SessionManager is defined
      clozeEditor.sessionManager = sessionManager;
  });
}

// 初始化执行
init();