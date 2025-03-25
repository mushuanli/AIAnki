// main.js

// @ts-check
"use strict";

import eventBus from './core/event-bus.js';
import storageManager from './core/storage-manager.js';
import sessionManager from './app/session-manager.js';
import clozeEditor from './editors/cloze-editor.js';
import ankiEditor from './editors/anki-editor.js';
import aiChat from './editors/ai-chat.js';
import aiConfigDialog from './editors/ai-config-dialog.js';

class App {
    #elements = {
        // 导航按钮
        btnCloze: /** @type {HTMLButtonElement} */ (document.getElementById('btnCloze')),
        btnAnki: /** @type {HTMLButtonElement} */ (document.getElementById('btnAnki')),
        btnAI: /** @type {HTMLButtonElement} */ (document.getElementById('btnAI')),
        
        // 编辑器容器
        clozeContainer: /** @type {HTMLDivElement} */ (document.getElementById('cloze-editor-container')),
        ankiContainer: /** @type {HTMLDivElement} */ (document.getElementById('anki-editor-container')),
        aiContainer: /** @type {HTMLDivElement} */ (document.getElementById('ai-editor-container')),
        
        // Deck信息区域
        deckInfos: /** @type {NodeListOf<HTMLDivElement>} */ (document.querySelectorAll('.deck-info')),
        aiInfo: /** @type {HTMLDivElement | null} */ (document.querySelector('.ai-info'))
    };
    
    #activeEditor = 'cloze-editor-container';

    constructor() {
        this.#bindEvents();
        
        // 初始化完成后设置加载状态
        window.addEventListener('load', () => {
            console.log('App initialized');
        });
    }

    #bindEvents() {
        // 导航按钮切换
        this.#elements.btnCloze.addEventListener('click', () => {
            this.#switchEditor('cloze-editor-container');
        });
        
        this.#elements.btnAnki.addEventListener('click', () => {
            this.#switchEditor('anki-editor-container');
        });
        
        this.#elements.btnAI.addEventListener('click', () => {
            this.#switchEditor('ai-editor-container');
        });
        
        // 处理键盘快捷键
        document.addEventListener('keydown', (e) => {
            // 按下Ctrl+S保存当前编辑器内容
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.#saveCurrentEditor();
            }
        });
    }

    #switchEditor(editorId) {
        if (this.#activeEditor === editorId) return;
        
        // 更新导航按钮样式
        this.#elements.btnCloze.classList.toggle('active', editorId === 'cloze-editor-container');
        this.#elements.btnAnki.classList.toggle('active', editorId === 'anki-editor-container');
        this.#elements.btnAI.classList.toggle('active', editorId === 'ai-editor-container');
        
        // 更新编辑器容器显示状态
        this.#elements.clozeContainer.classList.toggle('active', editorId === 'cloze-editor-container');
        this.#elements.ankiContainer.classList.toggle('active', editorId === 'anki-editor-container');
        this.#elements.aiContainer.classList.toggle('active', editorId === 'ai-editor-container');
        
        // 更新顶部信息区域显示
        this.#elements.deckInfos.forEach(el => {
            el.classList.toggle('active', el.dataset.editor === editorId);
        });
        // @ts-ignore
        this.#elements.aiInfo.classList.toggle('active', editorId === 'ai-editor-container');
        
        // 更新活动编辑器
        this.#activeEditor = editorId;
        
        // 触发编辑器变更事件
        eventBus.emit('editor-changed', editorId);
    }

    #saveCurrentEditor() {
        switch (this.#activeEditor) {
            case 'cloze-editor-container':
                document.getElementById('cloze-save-btn')?.click();
                break;
            case 'anki-editor-container':
                document.getElementById('anki-save-btn')?.click();
                break;
            case 'ai-editor-container':
                document.getElementById('ai-save-convo-btn')?.click();
                break;
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    // @ts-ignore
    window.app = new App();
});
