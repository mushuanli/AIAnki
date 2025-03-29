// ai/handlers/deepseek-handler.js

// @ts-check
"use strict";

import { AIHandler } from './ai-handler.js';

/**
 * DeepSeek处理器
 */
export class DeepSeekHandler extends AIHandler {
    constructor(server, bot) {
        super(server, bot);
        this.isReasoningActive = false;
        this.reasoningContent = '';
    }

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
        const delta = data.choices[0]?.delta;
        const result = { mainContent: '', additionalContent: {} };
        
        if (delta?.reasoning_content) {
            // 处理推理内容
            if (!this.isReasoningActive) {
                this.isReasoningActive = true;
            }
            
            this.reasoningContent += delta.reasoning_content;
            
            result.additionalContent = {
                reasoning: this.reasoningContent,
                isReasoningActive: true
            };
        } 
        else if (delta?.content) {
            // 处理普通内容
            if (this.isReasoningActive) {
                this.isReasoningActive = false;
                
                // 更新推理状态
                result.additionalContent = {
                    reasoning: this.reasoningContent,
                    isReasoningActive: false
                };
            }
            
            result.mainContent = delta.content;
        }
        
        return result;
    }
}
