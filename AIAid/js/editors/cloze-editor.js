// core/cloze-editor.js


// @ts-check
"use strict";

import { BaseEditor } from './base-editor.js';
import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';

export class ClozeEditor extends BaseEditor {
    #elements = {
        container: /** @type {HTMLDivElement} */ (document.getElementById('cloze-editor-container')),
        editor: /** @type {HTMLTextAreaElement} */ (document.getElementById('cloze-editor')),
        preview: /** @type {HTMLDivElement} */ (document.getElementById('cloze-preview')),
        deckId: /** @type {HTMLInputElement} */ (document.getElementById('deckId')),
        deckName: /** @type {HTMLInputElement} */ (document.getElementById('deckName')),
        saveBtn: /** @type {HTMLButtonElement} */ (document.getElementById('cloze-save-btn')),
        openYamlBtn: /** @type {HTMLButtonElement} */ (document.getElementById('openYamlFileBtn')),
        wrapClozeBtn: /** @type {HTMLButtonElement} */ (document.getElementById('wrapClozeBtn')),
        nextClozeBtn: /** @type {HTMLButtonElement} */ (document.getElementById('nextClozeBtn')),
        formatBoldBtn: /** @type {HTMLButtonElement} */ (document.getElementById('formatBoldBtn')),
        formatItalicBtn: /** @type {HTMLButtonElement} */ (document.getElementById('formatItalicBtn')),
        toHtmlBtn: /** @type {HTMLButtonElement} */ (document.getElementById('toHtmlBtn'))
    };
    
    #clozeCounter = 1;
    #previewDebounceTimer = null;

    constructor() {
        super('cloze');
        this.#bindEditorEvents();
        this.#setupEditorBehavior();
    }

    #bindEditorEvents() {
        // 编辑器内容变化时更新预览
        this.#elements.editor.addEventListener('input', () => {
            this.#updatePreviewDebounced();
        });
        
        // 保存按钮
        this.#elements.saveBtn.addEventListener('click', () => {
            this.#saveCurrentCloze();
        });
        
        // 打开YAML按钮
        this.#elements.openYamlBtn.addEventListener('click', () => {
            this.#openYamlFile();
        });
        
        // 工具栏按钮
        this.#elements.wrapClozeBtn.addEventListener('click', () => this.#wrapCloze());
        this.#elements.nextClozeBtn.addEventListener('click', () => this.#incrementClozeCounter());
        this.#elements.formatBoldBtn.addEventListener('click', () => this.#formatText('**', '**'));
        this.#elements.formatItalicBtn.addEventListener('click', () => this.#formatText('*', '*'));
        this.#elements.toHtmlBtn.addEventListener('click', () => this.#convertToHtml());
        
        // Deck信息变化
        this.#elements.deckId.addEventListener('input', () => this.#updateDeckInfo());
        this.#elements.deckName.addEventListener('input', () => this.#updateDeckInfo());
    }

    #setupEditorBehavior() {
        // 设置Tab键行为
        this.#elements.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                
                // 获取光标位置
                const start = this.#elements.editor.selectionStart;
                const end = this.#elements.editor.selectionEnd;
                
                // 插入制表符
                this.#elements.editor.value = 
                    this.#elements.editor.value.substring(0, start) + 
                    '    ' + 
                    this.#elements.editor.value.substring(end);
                
                // 重新设置光标位置
                this.#elements.editor.selectionStart = 
                this.#elements.editor.selectionEnd = start + 4;
                
                // 触发更新预览
                this.#updatePreviewDebounced();
            }
        });
    }

    #updatePreviewDebounced() {
        if(this.#previewDebounceTimer)
            clearTimeout(this.#previewDebounceTimer);
        // @ts-ignore
        this.#previewDebounceTimer = setTimeout(() => {
            this.#updatePreview();
        }, 300);
    }

    #updatePreview() {
        const markdown = this.#elements.editor.value;
        if (!markdown) {
            this.#elements.preview.innerHTML = '<div class="empty-preview">预览区域</div>';
            return;
        }
        
        // 处理cloze标记 {{c1::text}} 为高亮显示
        let processedMarkdown = markdown.replace(
            /\{\{c(\d+)::(.*?)\}\}/g, 
            '<span class="cloze-highlight cloze-$1">$2</span>'
        );
        
        // 将Markdown转换为HTML
        try {
            // @ts-ignore
            const html = marked.parse(processedMarkdown);
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

    #saveCurrentCloze() {
        if (!this.currentSession) {
            alert('没有活动会话，请先创建一个新会话');
            return;
        }
        
        const content = this.#elements.editor.value;
        const deckId = this.#elements.deckId.value;
        const deckName = this.#elements.deckName.value;
        
        // 从内容中提取标题（第一行）
        const title = content.split('\n')[0].replace(/^#\s*/, '').trim() || '未命名挖空';
        
        this.saveSession({
            content,
            title,
            deckId,
            deckName,
            preview: content.substring(0, 100) // 预览使用前100个字符
        });
        
        alert('保存成功');
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
        // 处理YAML数据，创建多个Cloze会话
        if (Array.isArray(yamlData)) {
            // 如果是数组，每项创建一个会话
            yamlData.forEach(item => this.#createClozeSessionFromYamlItem(item));
        } else if (yamlData.cards && Array.isArray(yamlData.cards)) {
            // 如果有cards数组
            const deckInfo = {
                deckId: yamlData.deckId || '',
                deckName: yamlData.deckName || ''
            };
            
            yamlData.cards.forEach(card => {
                this.#createClozeSessionFromYamlItem({...card, ...deckInfo});
            });
        } else {
            // 单个条目
            this.#createClozeSessionFromYamlItem(yamlData);
        }
    }

    #createClozeSessionFromYamlItem(item) {
        if (!item.content) return; // 跳过没有content的项
        
        const session = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            title: item.title || '导入的挖空',
            content: item.content,
            deckId: item.deckId || '',
            deckName: item.deckName || '',
            created: new Date().toISOString()
        };
        
        storageManager.addSession('cloze', session);
    }

    #wrapCloze() {
        const editor = this.#elements.editor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        if (start === end) return; // 没有选择文本
        
        const selectedText = editor.value.substring(start, end);
        const clozeText = `{{c${this.#clozeCounter}::${selectedText}}}`;
        
        editor.value = 
            editor.value.substring(0, start) + 
            clozeText + 
            editor.value.substring(end);
            
        // 设置光标位置到插入的cloze后面
        editor.selectionStart = editor.selectionEnd = start + clozeText.length;
        
        // 更新预览
        this.#updatePreview();
    }

    #incrementClozeCounter() {
        this.#clozeCounter++;
        alert(`当前挖空计数: ${this.#clozeCounter}`);
    }

    #formatText(prefix, suffix) {
        const editor = this.#elements.editor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        if (start === end) return; // 没有选择文本
        
        const selectedText = editor.value.substring(start, end);
        const formattedText = prefix + selectedText + suffix;
        
        editor.value = 
            editor.value.substring(0, start) + 
            formattedText + 
            editor.value.substring(end);
            
        // 设置光标位置到格式化后的文本后面
        editor.selectionStart = editor.selectionEnd = start + formattedText.length;
        
        // 更新预览
        this.#updatePreview();
    }

    #convertToHtml() {
        const markdown = this.#elements.editor.value;
        if (!markdown) return;
        
        try {
            // @ts-ignore
            const html = marked.parse(markdown);
            // 使用FileSaver保存HTML文件
            const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
            // @ts-ignore
            saveAs(blob, 'converted.html');
        } catch (error) {
            console.error('HTML转换错误:', error);
            alert(`HTML转换失败: ${error.message}`);
        }
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
        // 填充编辑器内容
        this.#elements.editor.value = session.content || '';
        this.#elements.deckId.value = session.deckId || '';
        this.#elements.deckName.value = session.deckName || '';
        
        // 重置挖空计数器（从已有内容中找最大值）
        this.#resetClozeCounter();
        
        // 更新预览
        this.#updatePreview();
    }

    #resetClozeCounter() {
        const content = this.#elements.editor.value;
        if (!content) {
            this.#clozeCounter = 1;
            return;
        }
        
        // 提取所有挖空标记的数字
        const matches = content.match(/\{\{c(\d+)::/g) || [];
        if (matches.length === 0) {
            this.#clozeCounter = 1;
            return;
        }
        
        // 找到最大计数器值
        let maxCounter = 0;
        matches.forEach(match => {
            // @ts-ignore
            const counterStr = match.match(/\d+/)[0];
            const counter = parseInt(counterStr, 10);
            if (counter > maxCounter) {
                maxCounter = counter;
            }
        });
        
        // 设置计数器为最大值+1
        this.#clozeCounter = maxCounter + 1;
    }
}

export default new ClozeEditor();
