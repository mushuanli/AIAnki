// ai/handlers/ai-handler-factory.js

// @ts-check
"use strict";

import { OpenAIHandler } from './openai-handler.js';
import { ClaudeHandler } from './claude-handler.js';
import { GeminiHandler } from './gemini-handler.js';
import { DeepSeekHandler } from './deepseek-handler.js';
import { GrokHandler } from './grok-handler.js';
import { DefaultHandler } from './default-handler.js';

/**
 * AI处理器工厂类
 */
export class AIHandlerFactory {
    /**
     * 创建AI处理器
     * @param {string} serviceName - 服务名称
     * @param {Object} server - 服务器配置
     * @param {Object} bot - 机器人配置
     * @returns {import('./ai-handler.js').AIHandler} AI处理器
     */
    static createHandler(serviceName, server, bot) {
        switch (serviceName) {
            case 'openai':
                return new OpenAIHandler(server, bot);
            case 'claude':
                return new ClaudeHandler(server, bot);
            case 'gemini':
                return new GeminiHandler(server, bot);
            case 'deepseek':
                return new DeepSeekHandler(server, bot);
            case 'grok':
                return new GrokHandler(server, bot);
            default:
                return new DefaultHandler(server, bot);
        }
    }
}
