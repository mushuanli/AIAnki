// ai/handlers/grok-handler.js

// @ts-check
"use strict";

import { AIHandler } from './ai-handler.js';

/**
 * Grok处理器
 */
export class GrokHandler extends AIHandler {
    /**
     * 构建请求体
     * @param {Array<any>} messages - 消息列表
     * @returns {Object} 请求体
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
     * @returns {Object} 解析结果
     */
    parseResponse(data) {
        const delta = data.choices[0]?.delta?.content || '';
        return {
            mainContent: delta
        };
    }
}
