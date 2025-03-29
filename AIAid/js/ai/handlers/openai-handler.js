// ai/handlers/openai-handler.js

// @ts-check
"use strict";

import { AIHandler } from './ai-handler.js';

/**
 * OpenAI处理器
 */
export class OpenAIHandler extends AIHandler {
    /**
     * 构建请求体
     * @param {Array<any>} messages - 消息列表
     * @returns {Object} 请求体
     * @override
     */
    buildRequestBody(messages) {
        return {
            model: this.bot.model,
            messages,
            temperature: 0.7,
            stream: true
        };
    }

    /**
     * 解析响应数据
     * @param {any} data - 响应数据
     * @returns {Object} 解析结果，包含主要内容和额外内容
     * @override
     */
    parseResponse(data) {
        const delta = data.choices[0]?.delta?.content || '';
        return {
            mainContent: delta
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
            'Authorization': `Bearer ${this.server.key}`
        };

        // 添加自定义头部（如果有）
        if (this.server.headers) {
            Object.assign(headers, this.server.headers);
        }

        return headers;
    }

    /**
     * 获取服务名称
     * @returns {string} 服务名称
     * @override
     */
    getServiceName() {
        return 'OpenAI';
    }
}
