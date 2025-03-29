// ai/handlers/ai-handler.js

// @ts-check
"use strict";

/**
 * AI处理器基类
 */
export class AIHandler {
    /**
     * @param {Object} server - 服务器配置
     * @param {Object} bot - 机器人配置
     */
    constructor(server, bot) {
        this.server = server;
        this.bot = bot;
    }

    /**
     * 构建请求体
     * @param {Array<any>} messages - 消息列表
     * @returns {Object} 请求体
     */
    buildRequestBody(messages) {
        throw new Error('必须实现 buildRequestBody 方法');
    }

    /**
     * 解析响应数据
     * @param {any} data - 响应数据
     * @returns {Object} 解析结果，包含主要内容和额外内容
     */
    parseResponse(data) {
        throw new Error('必须实现 parseResponse 方法');
    }

    /**
     * 获取请求头
     * @returns {Object} 请求头
     */
    getRequestHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.server.key}`
        };
    }

    /**
     * 获取API URL
     * @returns {string} API URL
     */
    getApiUrl() {
        return this.server.url;
    }

    /**
     * 获取服务名称
     * @returns {string} 服务名称
     */
    getServiceName() {
        return this.server.name || '未知服务';
    }
}
