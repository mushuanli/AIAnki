// core/event-bus.js


// @ts-check
"use strict";

export class EventBus {
    #listeners = new Map();

    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
        return this; // 支持链式调用
    }

    off(event, callback) {
        if (this.#listeners.has(event)) {
            this.#listeners.get(event).delete(callback);
        }
        return this;
    }

    emit(event, ...args) {
        if (this.#listeners.has(event)) {
            this.#listeners.get(event).forEach(cb => cb(...args));
        }
        return this;
    }

    // 用于调试
    listEvents() {
        return Array.from(this.#listeners.keys());
    }
}

// 创建全局单例
export default new EventBus();
