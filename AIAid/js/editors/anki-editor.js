// editors/anki-editor.js

// @ts-check
"use strict";

import { BaseEditor } from './base-editor.js';
import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';

export class AnkiEditor extends BaseEditor {
    #elements = {
        container: /** @type {HTMLDivElement} */ (document.getElementById('anki-editor-container')),
        editor: /** @type {HTMLTextAreaElement} */ (document.getElementById('anki-editor')),
        preview: /** @type {HTMLDivElement} */ (document.getElementById('anki-preview')),
        deckId: /** @type {HTMLInputElement} */ (document.getElementById('ankiDeckId')),
        deckName: /** @type {HTMLInputElement} */ (document.getElementById('ankiDeckName')),
        saveBtn: /** @type {HTMLButtonElement} */ (document.getElementById('anki-save-btn')),
        openYamlBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ankiOpenYamlFileBtn')),
        addFrontBtn: /** @type {HTMLButtonElement} */ (document.getElementById('anki-tool-1')),
        addBackBtn: /** @type {HTMLButtonElement} */ (document.getElementById('anki-tool-2')),
        addTagBtn: /** @type {HTMLButtonElement} */ (document.getElementById('anki-tool-3'))
    };

    
    #previewDebounceTimer = null;
    #currentView = 'front'; // 'front' or 'back'

    constructor() {
        super('anki');
        this.#bindEditorEvents();
    }

    #bindEditorEvents() {
        // 编辑器内容变化时更新预览
        this.#elements.editor.addEventListener('input', () => {
            this.#updatePreviewDebounced();
        });
        
        // 保存按钮
        this.#elements.saveBtn.addEventListener('click', () => {
            this.#saveCurrentCard();
        });
        
        // 打开YAML按钮
        this.#elements.openYamlBtn.addEventListener('click', () => {
            this.#openYamlFile();
        });
        
        // 工具栏按钮
        this.#elements.addFrontBtn.addEventListener('click', () => {
            this.#setCurrentView('front');
        });
        
        this.#elements.addBackBtn.addEventListener('click', () => {
            this.#setCurrentView('back');
        });
        
        this.#elements.addTagBtn.addEventListener('click', () => {
            this.#addTag();
        });
        
        // Deck信息变化
        this.#elements.deckId.addEventListener('input', () => this.#updateDeckInfo());
        this.#elements.deckName.addEventListener('input', () => this.#updateDeckInfo());
    }

    #updatePreviewDebounced() {
        if( this.#previewDebounceTimer )
            clearTimeout(this.#previewDebounceTimer);
        // @ts-ignore
        this.#previewDebounceTimer = setTimeout(() => {
            this.#updatePreview();
        }, 300);
    }

    #updatePreview() {
        const markdown = this.#elements.editor.value;
        if (!markdown) {
            this.#elements.preview.innerHTML = `<div class="empty-preview">预览区域 (${this.#currentView})</div>`;
            return;
        }
        
        // 将Markdown转换为HTML
        try {
            // @ts-ignore
            const html = marked.parse(markdown);
            // 使用DOMPurify清理HTML
            // @ts-ignore
            const cleanHtml = DOMPurify.sanitize(html);
            this.#elements.preview.innerHTML = cleanHtml;
            
            // 如果存在MathJax，则渲染数学公式
            // @ts-ignore
            if (window.MathJax) {
                // @ts-ignore
                MathJax.typesetPromise([this.#elements.preview]).catch((err) => {
                    console.error('MathJax error:', err);
                });
            }
            
            // 代码高亮
            // @ts-ignore
            if (window.hljs) {
                this.#elements.preview.querySelectorAll('pre code').forEach((block) => {
                    // @ts-ignore
                    hljs.highlightElement(block);
                });
            }
        } catch (error) {
            console.error('Preview rendering error:', error);
            this.#elements.preview.innerHTML = `<div class="preview-error">预览渲染错误: ${error.message}</div>`;
        }
    }

    #saveCurrentCard() {
        if (!this.currentSession) {
            alert('没有活动会话，请先创建一个新会话');
            return;
        }
        
        // 保存当前编辑的内容（前面或背面）
        this.#saveCurrentView();
        
        const { front, back, tags } = this.currentSession;
        const deckId = this.#elements.deckId.value;
        const deckName = this.#elements.deckName.value;
        
        // 确保前面和背面都有内容
        if (!front || !back) {
            alert('卡片的正面和背面都需要填写内容');
            return;
        }
        
        // 从正面提取标题
        // @ts-ignore
        const title = front.split('\n')[0].replace(/^#\s*/, '').trim() || '未命名卡片';
        
        this.saveSession({
            title,
            front,
            back,
            tags: tags || [],
            deckId,
            deckName
        });
        
        alert('保存成功');
    }

    #saveCurrentView() {
        if (!this.currentSession) return;
        
        const content = this.#elements.editor.value;
        // @ts-ignore
        const updatedSession = {...this.currentSession};
        
        // 根据当前视图更新前面或背面
        if (this.#currentView === 'front') {
            updatedSession.front = content;
        } else {
            updatedSession.back = content;
        }
        
        this.saveSession(updatedSession);
    }

    #setCurrentView(view) {
        // 保存当前视图的内容
        this.#saveCurrentView();
        
        // 切换视图
        this.#currentView = view;
        
        // 更新编辑器内容
        if (this.currentSession) {
            this.#elements.editor.value = this.currentSession[view] || '';
        } else {
            this.#elements.editor.value = '';
        }
        
        // 更新UI状态
        this.#elements.addFrontBtn.classList.toggle('active', view === 'front');
        this.#elements.addBackBtn.classList.toggle('active', view === 'back');
        
        // 更新预览
        this.#updatePreview();
    }

    #addTag() {
        if (!this.currentSession) {
            alert('请先创建一个新会话');
            return;
        }
        
        const tag = prompt('请输入标签名称:');
        if (!tag || tag.trim() === '') return;
        
        const cleanTag = tag.trim().replace(/\s+/g, '_');
        
        // 初始化或复制标签数组
        // @ts-ignore
        const tags = this.currentSession.tags ? [...this.currentSession.tags] : [];
        
        // 确保没有重复标签
        if (!tags.includes(cleanTag)) {
            tags.push(cleanTag);
            this.saveSession({ tags });
            alert(`标签 "${cleanTag}" 已添加`);
        } else {
            alert(`标签 "${cleanTag}" 已存在`);
        }
    }

    async #openYamlFile() {
        // 创建文件选择器
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.yaml,.yml';
        
        fileInput.onchange = async (e) => {
            // @ts-ignore
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const content = await this.#readFileContent(file);
                // @ts-ignore
                const yamlData = jsyaml.load(content);
                
                if (!yamlData || typeof yamlData !== 'object') {
                    throw new Error('无效的YAML格式');
                }
                
                this.#processYamlData(yamlData);
                
                // 通知会话管理器更新
                eventBus.emit('session-updated');
            } catch (error) {
                console.error('YAML解析错误:', error);
                alert(`YAML解析失败: ${error.message}`);
            }
        };
        
        fileInput.click();
    }

    #readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            // @ts-ignore
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    #processYamlData(yamlData) {
        // 处理YAML数据，创建多个Anki卡片会话
        if (Array.isArray(yamlData)) {
            // 如果是数组，每项创建一个会话
            yamlData.forEach(item => this.#createAnkiSessionFromYamlItem(item));
        } else if (yamlData.cards && Array.isArray(yamlData.cards)) {
            // 如果有cards数组
            const deckInfo = {
                deckId: yamlData.deckId || '',
                deckName: yamlData.deckName || ''
            };
            
            yamlData.cards.forEach(card => {
                this.#createAnkiSessionFromYamlItem({...card, ...deckInfo});
            });
        } else {
            // 单个条目
            this.#createAnkiSessionFromYamlItem(yamlData);
        }
    }

    #createAnkiSessionFromYamlItem(item) {
        if (!item.front || !item.back) return; // 跳过没有前面或后面的项
        
        const session = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            title: item.title || '导入的卡片',
            front: item.front,
            back: item.back,
            tags: Array.isArray(item.tags) ? item.tags : [],
            deckId: item.deckId || '',
            deckName: item.deckName || '',
            created: new Date().toISOString()
        };
        
        storageManager.addSession('anki', session);
    }

    #updateDeckInfo() {
        if (!this.currentSession) return;
        
        this.saveSession({
            deckId: this.#elements.deckId.value,
            deckName: this.#elements.deckName.value
        });
    }

    // BaseEditor方法实现
    onSessionLoaded(session) {
        // 初始显示前面
        this.#elements.deckId.value = session.deckId || '';
        this.#elements.deckName.value = session.deckName || '';
        
        this.#setCurrentView('front');
    }
}

export default new AnkiEditor();
