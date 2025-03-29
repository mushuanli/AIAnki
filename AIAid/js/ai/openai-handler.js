// ai/openai-handler.js
// @ts-check
"use strict";

import { BaseAIHandler } from './base-ai-handler.js';

/**
 * @typedef {import('./base-ai-handler.js').ServerConfig} ServerConfig
 * @typedef {import('./base-ai-handler.js').BotConfig} BotConfig
 * @typedef {import('./base-ai-handler.js').ChatMessage} ChatMessage
 * @typedef {import('./base-ai-handler.js').StreamCallback} StreamCallback
 */

export class DeepSeekHandler extends BaseAIHandler {
    /**
     * @param {ServerConfig} serverConfig
     * @param {BotConfig} botConfig
     */
    constructor(serverConfig, botConfig) {
        super(serverConfig, botConfig);
    }

    /**
     * @override
     * @param {ChatMessage[]} messagesHistory
     * @returns {object[]}
     */
    formatMessages(messagesHistory) {
         // DeepSeek uses role/content like OpenAI.
         const formatted = [];
         if (this.botConfig.systemPrompt) {
             formatted.push({ role: 'system', content: this.botConfig.systemPrompt });
         }
         messagesHistory.forEach(msg => {
             if (msg.role === 'user' || msg.role === 'assistant') {
                 let content = msg.content;
                 if (msg.attachments && msg.attachments.length > 0) {
                     const attachmentDesc = msg.attachments.map(att =>
                         `[Attachment: ${att.name} (${att.type})]`).join('\n');
                     content += '\n\n' + attachmentDesc;
                     // TODO: Implement actual multimodal support
                 }
                 formatted.push({ role: msg.role, content: content });
             }
         });
         return formatted;
    }

    /**
     * @override
     * @param {ChatMessage[]} messagesHistory
     * @param {AbortSignal} abortSignal
     * @param {StreamCallback} streamCallback
     * @returns {Promise<void>}
     */
    async sendRequest(messagesHistory, abortSignal, streamCallback) {
        const apiUrl = this.serverConfig.url;
        const apiKey = this.serverConfig.key;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        const body = {
            model: this.botConfig.model,
            messages: this.formatMessages(messagesHistory),
            temperature: 0.7, // Or from botConfig
            stream: true,
            // DeepSeek specific: request reasoning
            stream_options: { include_reasoning: true }
        };

        try {
            const reader = await this._getStreamReader(apiUrl, body, headers, abortSignal);
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const delta = data.choices?.[0]?.delta;

                            if (delta?.reasoning_content) {
                                streamCallback({ type: 'reasoning_chunk', content: delta.reasoning_content });
                            } else if (delta?.content) {
                                streamCallback({ type: 'chunk', content: delta.content });
                            }
                        } catch (e) {
                            console.warn("Error parsing DeepSeek SSE chunk:", e, "Line:", line);
                            // streamCallback({ type: 'error', message: `Failed to parse stream chunk: ${e.message}` });
                        }
                    }
                }
            }
            streamCallback({ type: 'done' });
        } catch (error) {
            console.error("DeepSeek Request Error:", error);
            streamCallback({ type: 'error', message: error.message });
        }
    }
}