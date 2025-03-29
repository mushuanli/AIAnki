// ai/handlers/default-handler.js

// @ts-check
"use strict";

import { AIHandler } from './ai-handler.js';

/**
 * 默认处理器 (模拟响应)
 */
export class DefaultHandler extends AIHandler {
    #responseIndex = 0;
    #fullResponse = '';
    
    /**
     * 构建请求体
     * @param {Array<any>} messages - 消息列表
     * @returns {Object} 请求体
     */
    buildRequestBody(messages) {
        // 这里只是模拟，实际不会发送请求
        this.#fullResponse = `这是模拟的AI响应，来自 ${this.bot.name} (${this.bot.model})。\n\n您的请求已收到，但这是一个模拟环境。在实际应用中，您会看到来自AI的真实回复。`;
        this.#responseIndex = 0;
        
        return {}; 
    }

    /**
     * 解析响应数据
     * @param {any} data - 响应数据
     * @returns {Object} 解析结果
     */
    parseResponse(data) {
        // 模拟流式响应，每次返回一些字符
        const chunkSize = 5;
        const start = this.#responseIndex;
        const end = Math.min(start + chunkSize, this.#fullResponse.length);
        
        const mainContent = this.#fullResponse.substring(start, end);
        this.#responseIndex = end;
        
        return { mainContent };
    }
    
    /**
     * 覆盖请求方法，返回模拟读取器
     * @returns {Promise<ReadableStream>} 模拟流
     */
    async getResponseStream() {
        // 创建一个模拟的流
        return new ReadableStream({
            start: (controller) => {
                let index = 0;
                
                const interval = setInterval(() => {
                    if (index >= this.#fullResponse.length) {
                        clearInterval(interval);
                        controller.close();
                        return;
                    }
                    
                    const chunk = this.#fullResponse.substring(
                        index, 
                        Math.min(index + 5, this.#fullResponse.length)
                    );
                    
                    const data = {
                        choices: [{ delta: { content: chunk } }]
                    };
                    
                    const encoder = new TextEncoder();
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    
                    index += 5;
                }, 50);
            }
        });
    }
}
