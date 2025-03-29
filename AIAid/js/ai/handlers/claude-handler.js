// ai/handlers/claude-handler.js

// @ts-check
"use strict";

import { AIHandler } from './ai-handler.js';

/**
 * Claude AI处理器
 */
export class ClaudeHandler extends AIHandler {
    /**
     * 构建请求体
     * @param {Array<any>} messages - 消息列表
     * @returns {Object} 请求体
     * @override
     */
    buildRequestBody(messages) {
        // Claude需要特殊处理消息格式
        const claudeMessages = messages.map(msg => ({
            role: this.#mapRole(msg.role),
            content: this.#formatContent(msg.content)
        }));

        return {
            model: this.bot.model,
            messages: claudeMessages,
            stream: true,
            temperature: 0.7
        };
    }

    /**
     * 获取请求头
     * @returns {Object} 请求头
     * @override
     */
    getRequestHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.server.key
        };

        // 添加自定义头部（如果有）
        if (this.server.headers) {
            Object.assign(headers, this.server.headers);
        }

        return headers;
    }

    /**
     * 解析响应数据
     * @param {any} data - 响应数据
     * @returns {Object} 解析结果，包含主要内容和额外内容
     * @override
     */
    parseResponse(data) {
        // Claude的流式响应格式
        if (data.type === 'content_block_delta') {
            const delta = data.delta?.text || '';
            return {
                mainContent: delta
            };
        } else if (data.type === 'message_start') {
            // 消息开始，返回空内容
            return {
                mainContent: ''
            };
        } else if (data.type === 'message_stop') {
            // 消息结束，返回空内容
            return {
                mainContent: ''
            };
        }

        return { mainContent: '' };
    }

    /**
     * 获取服务名称
     * @returns {string} 服务名称
     * @override
     */
    getServiceName() {
        return 'Claude';
    }

    /**
     * 映射角色到Claude角色
     * @param {string} role - 原角色
     * @returns {string} Claude角色
     */
    #mapRole(role) {
        switch (role) {
            case 'user':
                return 'user';
            case 'assistant':
                return 'assistant';
            case 'system':
                return 'system';
            default:
                return 'user';
        }
    }

    /**
     * 格式化Claude内容
     * @param {string} content - 内容
     * @returns {Array<Object>} 格式化的内容
     */
    #formatContent(content) {
        // Claude API要求消息内容为数组格式
        return [{
            type: 'text',
            text: content
        }];
    }
}
