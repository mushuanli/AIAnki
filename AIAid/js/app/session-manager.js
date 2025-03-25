// app/session-manager.js

// @ts-check
"use strict";

import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';

export class SessionManager {
    #elements = {
        sessionList: /** @type {HTMLDivElement} */ (document.getElementById('sessionList')),
        addNewSessionBtn: /** @type {HTMLButtonElement} */ (document.getElementById('addNewSessionBtn')),
        selectAllBtn: /** @type {HTMLButtonElement} */ (document.getElementById('selectAllBtn')),
        deleteSelectedBtn: /** @type {HTMLButtonElement} */ (document.getElementById('deleteSelectedBtn'))
    };

    
    #currentType = 'cloze'; // 默认显示cloze会话
    #selectedSessionIds = new Set();
    #isSelectionMode = false;

    constructor() {
        this.#bindUIEvents();
        this.#bindStorageEvents();
        this.loadSessions();
    }

    #bindUIEvents() {
        // 新建会话按钮
        this.#elements.addNewSessionBtn.addEventListener('click', () => {
            this.createNewSession();
        });
        
        // 全选按钮
        this.#elements.selectAllBtn.addEventListener('click', () => {
            this.toggleSelectAll();
        });
        
        // 删除按钮
        this.#elements.deleteSelectedBtn.addEventListener('click', () => {
            this.deleteSelectedSessions();
        });
    }

    #bindStorageEvents() {
        // 监听会话更新事件
        eventBus.on('session-updated', () => {
            this.loadSessions();
        });
        
        // 监听编辑器切换事件
        eventBus.on('editor-changed', (editorType) => {
            this.switchSessionType(this.#mapEditorToSessionType(editorType));
        });
    }

    // 映射编辑器类型到会话类型
    #mapEditorToSessionType(editorType) {
        const map = {
            'cloze-editor-container': 'cloze',
            'anki-editor-container': 'anki',
            'ai-editor-container': 'ai'
        };
        return map[editorType] || 'cloze';
    }

    loadSessions() {
        const sessions = this.#getCurrentSessions();
        this.#renderSessionList(sessions);
    }

    #getCurrentSessions() {
        switch (this.#currentType) {
            case 'cloze': return storageManager.clozesessions;
            case 'anki': return storageManager.ankisessions;
            case 'ai': return storageManager.aisessions;
            default: return [];
        }
    }

    #renderSessionList(sessions) {
        const listElement = this.#elements.sessionList;
        listElement.innerHTML = '';
        
        if (!sessions.length) {
            listElement.innerHTML = '<div class="empty-list">没有会话</div>';
            return;
        }
        
        sessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-item';
            sessionElement.dataset.id = session.id;
            
            if (this.#isSelectionMode) {
                sessionElement.classList.toggle('selected', this.#selectedSessionIds.has(session.id));
            }
            
            // 根据会话类型调整显示内容
            const sessionContent = this.#formatSessionForDisplay(session);
            
            sessionElement.innerHTML = `
                <div class="session-checkbox ${this.#isSelectionMode ? 'visible' : ''}">
                    <input type="checkbox" ${this.#selectedSessionIds.has(session.id) ? 'checked' : ''}>
                </div>
                <div class="session-content">
                    <div class="session-title">${sessionContent.title}</div>
                    <div class="session-preview">${sessionContent.preview}</div>
                </div>
                <div class="session-time">${this.#formatDate(session.created || session.updated)}</div>
            `;
            
            // 绑定会话项点击事件
            sessionElement.addEventListener('click', (e) => {
                if (this.#isSelectionMode) {
                    this.#toggleSessionSelection(session.id);
                } else {
                    this.#loadSession(session);
                }
            });
            
            // 绑定复选框点击事件
            const checkbox = sessionElement.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.#toggleSessionSelection(session.id);
                });
            }
            
            listElement.appendChild(sessionElement);
        });
    }

    #formatSessionForDisplay(session) {
        // 根据不同类型会话格式化显示内容
        switch (this.#currentType) {
            case 'cloze':
                return {
                    title: session.title || '未命名挖空',
                    preview: session.preview || this.#truncateText(session.content, 50)
                };
            case 'anki':
                return {
                    title: session.title || '未命名卡片',
                    preview: session.front ? `正面: ${this.#truncateText(session.front, 40)}` : '空卡片'
                };
            case 'ai':
                return {
                    title: session.title || '未命名对话',
                    preview: session.messages && session.messages.length > 0 
                        ? this.#truncateText(session.messages[session.messages.length - 1].content, 50) 
                        : '空对话'
                };
            default:
                return { title: '未知会话', preview: '' };
        }
    }

    #truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength 
            ? text.substring(0, maxLength) + '...' 
            : text;
    }

    #formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        
        // 同一天显示时间，否则显示日期
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }

    switchSessionType(type) {
        if (type === this.#currentType) return;
        
        this.#currentType = type;
        this.#selectedSessionIds.clear();
        this.#isSelectionMode = false;
        this.loadSessions();
    }

    createNewSession() {
        const newSession = this.#createEmptySession();
        storageManager.addSession(this.#currentType, newSession);
        eventBus.emit(`new-${this.#currentType}-session-created`, newSession);
    }

    #createEmptySession() {
        const baseSession = {
            title: `新建${this.#getSessionTypeText()}`,
            created: new Date().toISOString()
        };
        
        // 根据会话类型添加特定字段
        switch (this.#currentType) {
            case 'cloze':
                return {
                    ...baseSession,
                    content: '',
                    deckId: '',
                    deckName: ''
                };
            case 'anki':
                return {
                    ...baseSession,
                    front: '',
                    back: '',
                    tags: [],
                    deckId: '',
                    deckName: ''
                };
            case 'ai':
                return {
                    ...baseSession,
                    botId: '',
                    messages: []
                };
            default:
                return baseSession;
        }
    }

    #getSessionTypeText() {
        switch (this.#currentType) {
            case 'cloze': return '挖空';
            case 'anki': return '卡片';
            case 'ai': return '对话';
            default: return '会话';
        }
    }

    #loadSession(session) {
        eventBus.emit(`load-${this.#currentType}-session`, session);
    }

    #toggleSessionSelection(id) {
        if (!this.#isSelectionMode) {
            this.#isSelectionMode = true;
        }
        
        if (this.#selectedSessionIds.has(id)) {
            this.#selectedSessionIds.delete(id);
        } else {
            this.#selectedSessionIds.add(id);
        }
        
        // 更新UI
        this.loadSessions();
        this.#updateSelectionControls();
    }

    toggleSelectAll() {
        const sessions = this.#getCurrentSessions();
        
        if (!this.#isSelectionMode) {
            this.#isSelectionMode = true;
        }
        
        // 如果当前已全选，则取消全选，否则全选
        if (this.#selectedSessionIds.size === sessions.length) {
            this.#selectedSessionIds.clear();
        } else {
            this.#selectedSessionIds = new Set(sessions.map(s => s.id));
        }
        
        // 更新UI
        this.loadSessions();
        this.#updateSelectionControls();
    }

    #updateSelectionControls() {
        const hasSelection = this.#selectedSessionIds.size > 0;
        this.#elements.deleteSelectedBtn.disabled = !hasSelection;
        
        // 更新全选按钮文本
        const sessions = this.#getCurrentSessions();
        const selectAllBtn = this.#elements.selectAllBtn;
        
        if (this.#selectedSessionIds.size === sessions.length && sessions.length > 0) {
            selectAllBtn.innerHTML = '<i class="fas fa-times-circle icon-spacing"></i><span class="btn-text">取消全选</span>';
        } else {
            selectAllBtn.innerHTML = '<i class="fas fa-check-square icon-spacing"></i><span class="btn-text">全选</span>';
        }
    }

    deleteSelectedSessions() {
        if (this.#selectedSessionIds.size === 0) return;
        
        const confirmed = confirm(`确定要删除选中的 ${this.#selectedSessionIds.size} 个${this.#getSessionTypeText()}吗？`);
        if (!confirmed) return;
        
        storageManager.deleteSessions(this.#currentType, Array.from(this.#selectedSessionIds));
        this.#selectedSessionIds.clear();
        this.#isSelectionMode = false;
    }
}

export default new SessionManager();
