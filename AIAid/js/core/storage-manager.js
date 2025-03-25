// core/storage-manager.js


// @ts-check
"use strict";

import eventBus from './event-bus.js';

export class StorageManager {
    #data = {
        aisettings: {
            servers: [],
            bots: []
        },
        aisessions: [],
        clozesessions: [],
        ankisessions: []
    };
    
    #saveTimer = null;
    #storageKey = 'anki-editor-data';

    constructor() {
        this.loadFromStorage();
        this.#setupAutoSave();
        this.#setupEventListeners();
    }

    #setupAutoSave() {
        // 每5分钟自动保存 
        // @ts-ignore
        this.#saveTimer = setInterval(() => this.saveToStorage(), 300_000);
    }

    #setupEventListeners() {
        // 监听需要触发存储的事件
        eventBus.on('ai-settings-updated', () => this.saveToStorage());
        eventBus.on('ai-session-updated', () => this.saveToStorage());
    }

    loadFromStorage() {
        try {
            const storedData = localStorage.getItem(this.#storageKey);
            if (storedData) {
                const parsed = JSON.parse(storedData);
                // 只从localStorage加载aisettings和aisessions
                if (parsed.aisettings) this.#data.aisettings = parsed.aisettings;
                if (parsed.aisessions) this.#data.aisessions = parsed.aisessions;
                console.log('Data loaded from localStorage');
            }
        } catch (e) {
            console.error('Failed to load data from localStorage:', e);
        }
        return this;
    }

    saveToStorage() {
        try {
            // 只保存需要持久化的数据
            const dataToStore = {
                aisettings: this.#data.aisettings,
                aisessions: this.#data.aisessions
            };
            localStorage.setItem(this.#storageKey, JSON.stringify(dataToStore));
            console.log('Data saved to localStorage');
        } catch (e) {
            console.error('Failed to save data to localStorage:', e);
        }
        return this;
    }

    // AI设置相关方法
    get aisettings() {
        return structuredClone(this.#data.aisettings);
    }

    updateAISettings(newSettings) {
        this.#data.aisettings = {...newSettings};
        this.saveToStorage();
        eventBus.emit('ai-settings-updated', this.aisettings);
        return this;
    }

    // 会话管理相关方法
    get aisessions() {
        return structuredClone(this.#data.aisessions);
    }

    get clozesessions() {
        return structuredClone(this.#data.clozesessions);
    }

    get ankisessions() {
        return structuredClone(this.#data.ankisessions);
    }

    // 添加新会话
    addSession(type, sessionData) {
        const sessionKey = `${type}sessions`;
        if (!this.#data[sessionKey]) {
            console.error(`Invalid session type: ${type}`);
            return this;
        }
        
        // 确保有唯一ID
        const newSession = {
            id: Date.now().toString(),
            created: new Date().toISOString(),
            ...sessionData
        };
        
        this.#data[sessionKey].push(newSession);
        
        // 只有AI会话需要持久化
        if (type === 'ai') this.saveToStorage();
        
        eventBus.emit('session-updated', type);
        return this;
    }

    // 更新现有会话
    updateSession(type, id, sessionData) {
        const sessionKey = `${type}sessions`;
        if (!this.#data[sessionKey]) return this;
        
        const index = this.#data[sessionKey].findIndex(s => s.id === id);
        if (index !== -1) {
            this.#data[sessionKey][index] = {
                ...this.#data[sessionKey][index],
                ...sessionData,
                updated: new Date().toISOString()
            };
            
            if (type === 'ai') this.saveToStorage();
            eventBus.emit('session-updated', type);
        }
        
        return this;
    }

    // 删除会话
    deleteSession(type, id) {
        const sessionKey = `${type}sessions`;
        if (!this.#data[sessionKey]) return this;
        
        this.#data[sessionKey] = this.#data[sessionKey].filter(s => s.id !== id);
        
        if (type === 'ai') this.saveToStorage();
        eventBus.emit('session-updated', type);
        return this;
    }

    // 批量删除会话
    deleteSessions(type, ids) {
        const sessionKey = `${type}sessions`;
        if (!this.#data[sessionKey]) return this;
        
        this.#data[sessionKey] = this.#data[sessionKey].filter(s => !ids.includes(s.id));
        
        if (type === 'ai') this.saveToStorage();
        eventBus.emit('session-updated', type);
        return this;
    }

    // 清除所有会话数据（用于测试或重置）
    clearAllData() {
        this.#data = {
            aisettings: { servers: [], bots: [] },
            aisessions: [],
            clozesessions: [],
            ankisessions: []
        };
        localStorage.removeItem(this.#storageKey);
        eventBus.emit('all-data-cleared');
        return this;
    }
}

// 导出单例
export default new StorageManager();
