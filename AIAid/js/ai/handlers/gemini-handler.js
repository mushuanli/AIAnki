// ai/handlers/gemini-handler.js

// @ts-check
"use strict";

import { AIHandler } from './ai-handler.js';

/**
 * Google Gemini 处理器
 */
export class GeminiHandler extends AIHandler {
    /**
     * 构建请求体
     * @param {Array<any>} messages - 消息列表
     * @returns {Object} 请求体
     * @override
     */
    buildRequestBody(messages) {
        // 转换为Gemini格式
        const geminiMessages = [];
        let hasSystemPrompt = false;
        
        // 处理系统提示和历史消息
        for (const msg of messages) {
            if (msg.role === 'system') {
                hasSystemPrompt = true;
                geminiMessages.push({
                    role: 'user',
                    parts: [{ text: msg.content }]
                });
                geminiMessages.push({
                    role: 'model',
                    parts: [{ text: 'I understand and will follow these instructions.' }]
                });
            } else if (msg.role === 'user') {
                geminiMessages.push({
                    role: 'user',
                    parts: [{ text: msg.content }]
                });
            } else if (msg.role === 'assistant') {
                geminiMessages.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }
        
        return {
            contents: geminiMessages,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                topP: 0.9,
                topK: 40
            }
        };
    }

    /**
     * 获取API URL
     * @returns {string} API URL
     * @override
     */
    getApiUrl() {
        // 替换URL中的模型占位符
        const modelName = this.bot.model;
        const apiUrl = this.server.url.replace('__MODEL_NAME__', modelName);
        
        // 添加API密钥作为查询参数
        const apiKey = this.server.key;
        return `${apiUrl}?key=${apiKey}`;
    }

    /**
     * 获取请求头
     * @returns {Object} 请求头
     * @override
     */
    getRequestHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    /**
     * 解析响应数据
     * @param {any} data - 响应数据
     * @returns {Object} 解析结果，包含主要内容和额外内容
     * @override
     */
    parseResponse(data) {
        // Gemini通常不是流式响应，但我们保持一致的接口
        // 如果是流式响应的情况
        if (data.candidates && data.candidates[0]?.content?.parts) {
            const parts = data.candidates[0].content.parts;
            if (parts && parts.length > 0) {
                return {
                    mainContent: parts[0].text || ''
                };
            }
        }
        
        // 处理非流式响应结果
        if (data.candidates && data.candidates[0]?.content?.parts) {
            const parts = data.candidates[0].content.parts;
            let fullText = '';
            
            for (const part of parts) {
                if (part.text) {
                    fullText += part.text;
                }
            }
            
            return {
                mainContent: fullText
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
        return 'Gemini';
    }
    
    /**
     * 处理多模态消息
     * @param {Array<any>} messages - 消息列表
     * @returns {Array<Object>} 处理后的消息
     */
    #processMultimodalMessages(messages) {
        const result = [];
        
        for (const msg of messages) {
            if (msg.role === 'user') {
                const parts = [];
                
                // 添加文本内容
                if (msg.content) {
                    parts.push({
                        text: msg.content
                    });
                }
                
                // 处理附件
                if (msg.attachments && msg.attachments.length > 0) {
                    for (const attachment of msg.attachments) {
                        if (attachment.type.startsWith('image/') && attachment.data) {
                            parts.push({
                                inlineData: {
                                    mimeType: attachment.type,
                                    data: attachment.data.replace(/^data:image\/[^;]+;base64,/, '')
                                }
                            });
                        }
                    }
                }
                
                if (parts.length > 0) {
                    result.push({
                        role: 'user',
                        parts
                    });
                }
            } else if (msg.role === 'assistant') {
                result.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }
        
        return result;
    }
}
