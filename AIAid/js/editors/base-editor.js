// editors/base-editor.js


// @ts-check
"use strict";

import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';

export class BaseEditor {
    #type = ''; // 'cloze', 'anki', 'ai'
    #currentSession = null;
    
    constructor(type) {
        this.#type = type;
        this.#bindCommonEvents();
    }
    
    #bindCommonEvents() {
        // 监听会话加载事件
        eventBus.on(`load-${this.#type}-session`, (session) => {
            this.loadSession(session);
        });
        
        // 监听新会话创建事件
        eventBus.on(`new-${this.#type}-session-created`, (session) => {
            this.loadSession(session);
        });
    }
    
    loadSession(session) {
        this.#currentSession = session;
        this.onSessionLoaded(session);
    }
    
    // 由子类实现的方法
    onSessionLoaded(session) {
        // 子类实现具体加载逻辑
    }
    
    saveSession(sessionData) {
        if (!this.#currentSession) return;
        
        const updatedSession = {
            // @ts-ignore
            ...this.#currentSession,
            ...sessionData,
            updated: new Date().toISOString()
        };
        
        // @ts-ignore
        storageManager.updateSession(this.#type, this.#currentSession.id, updatedSession);
        this.#currentSession = updatedSession;
    }
    
    get currentSession() {
        return this.#currentSession;
    }
    
    get type() {
        return this.#type;
    }
}
