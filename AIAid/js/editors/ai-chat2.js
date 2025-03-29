// editors/ai-chat.js

// @ts-check
"use strict";

import { BaseEditor } from './base-editor.js';
import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';
import aiConfigDialog from './ai-config-dialog.js';

export class AIChat extends BaseEditor {
    #elements = {
        container: /** @type {HTMLDivElement} */ (document.getElementById('ai-editor-container')),
        chatHistory: /** @type {HTMLDivElement} */ (document.getElementById('ai-chat-history')),
        messageInput: /** @type {HTMLTextAreaElement} */ (document.getElementById('ai-message-input')),
        sendButton: /** @type {HTMLButtonElement} */ (document.getElementById('ai-send-button')),
        uploadButton: /** @type {HTMLButtonElement} */ (document.getElementById('ai-upload-button')),
        fileUpload: /** @type {HTMLInputElement} */ (document.getElementById('ai-file-upload')),
        clearButton: /** @type {HTMLButtonElement} */ (document.getElementById('ai-tool-1')),
        exportButton: /** @type {HTMLButtonElement} */ (document.getElementById('ai-tool-2')),
        saveButton: /** @type {HTMLButtonElement} */ (document.getElementById('ai-save-convo-btn')),
        botSelect: /** @type {HTMLSelectElement} */ (document.getElementById('ai-selectBot')),
        configButton: /** @type {HTMLButtonElement} */ (document.getElementById('ai-settings-button')),
        loading: /** @type {HTMLDivElement} */ (document.getElementById('loading')),
        resizeHandle: /** @type {HTMLDivElement} */ (document.getElementById('ai-input-resize-handle')),
        attachmentsContainer: /** @type {HTMLDivElement} */ (document.getElementById('ai-attachments-container')),
        attachmentsList: /** @type {HTMLDivElement} */ (document.querySelector('.ai-attachments-list'))
    };

    
    #messages = [];
    #isWaitingForResponse = false;
    #currentAttachments = [];
    #currentController = null;

    constructor() {
        super('ai');
        this.#bindEditorEvents();
        this.#setupResizeHandle();
        this.#populateBotSelect();
    }

    #bindEditorEvents() {
        // 发送消息
        this.#elements.sendButton.addEventListener('click', () => {
            this.#sendMessage();
        });
        
        // 按Enter键发送消息
        this.#elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.#sendMessage();
            }
        });
        
        // 上传文件
        this.#elements.uploadButton.addEventListener('click', () => {
            this.#elements.fileUpload.click();
        });
        
        this.#elements.fileUpload.addEventListener('change', (e) => {
            // @ts-ignore
            this.#handleFileUpload(e.target.files);
        });
        
        // 清除对话
        this.#elements.clearButton.addEventListener('click', () => {
            this.#clearChat();
        });
        
        // 导出对话
        this.#elements.exportButton.addEventListener('click', () => {
            this.#exportChat();
        });
        
        // 保存为会话
        this.#elements.saveButton.addEventListener('click', () => {
            this.#saveConversation();
        });
        
        // 配置按钮
        this.#elements.configButton.addEventListener('click', () => {
            aiConfigDialog.show();
        });
        
        // Bot选择下拉
        this.#elements.botSelect.addEventListener('change', () => {
            this.#botChanged();
        });
        
        // 监听AI设置更新
        eventBus.on('ai-settings-updated', () => {
            this.#populateBotSelect();
        });
    }

    #setupResizeHandle() {
        let startY;
        let startHeight;
        
        this.#elements.resizeHandle.addEventListener('mousedown', (e) => {
            startY = e.clientY;
            // @ts-ignore
            startHeight = parseInt(document.defaultView.getComputedStyle(this.#elements.messageInput).height, 10);
            
            document.addEventListener('mousemove', resizeMove);
            document.addEventListener('mouseup', resizeStop);
        });
        
        const resizeMove = (e) => {
            const newHeight = startHeight - (e.clientY - startY);
            if (newHeight > 50 && newHeight < 300) {
                this.#elements.messageInput.style.height = `${newHeight}px`;
            }
        };
        
        const resizeStop = () => {
            document.removeEventListener('mousemove', resizeMove);
            document.removeEventListener('mouseup', resizeStop);
        };
    }

    #populateBotSelect() {
        const botSelect = this.#elements.botSelect;
        const settings = storageManager.aisettings;
        
        // 保存当前选中的值
        const currentValue = botSelect.value;
        
        botSelect.innerHTML = '';
        
        if (!settings.bots || Object.keys(settings.bots).length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '没有可用的Bot';
            botSelect.appendChild(option);
            botSelect.disabled = true;
            return;
        }
        
        botSelect.disabled = false;
        
        Object.entries(settings.bots).forEach(([name, bot]) => {
            const option = document.createElement('option');
            option.value = name;  // Use the bot's key (name) as the value
            // @ts-ignore
            option.textContent = bot.name;  // Display the bot's name
            if (name === settings.curBot) {
                option.selected = true;  // Select the current bot
            }
            botSelect.appendChild(option);
        });

        
        // 尝试恢复之前选中的值
        if (currentValue && Array.from(botSelect.options).some(opt => opt.value === currentValue)) {
            botSelect.value = currentValue;
        }
        
        // 如果当前会话有botId，则选中对应bot
        // @ts-ignore
        if (this.currentSession && this.currentSession.botId) {
            // @ts-ignore
            if (Array.from(botSelect.options).some(opt => opt.value === this.currentSession.botId)) {
                // @ts-ignore
                botSelect.value = this.currentSession.botId;
            }
        }
    }

    async #sendMessage() {
        const messageText = this.#elements.messageInput.value.trim();
        if ((!messageText && this.#currentAttachments.length === 0) || this.#isWaitingForResponse) return;
        
        const botId = this.#elements.botSelect.value;
        if (!botId) {
            alert('请先选择一个Bot');
            return;
        }
        
        // Save the message input content in case we need to restore it
        const originalMessage = messageText;
        const originalAttachments = [...this.#currentAttachments];
        
        try {
            // Create user message object
            const userMessage = {
                role: 'user',
                content: messageText,
                timestamp: new Date().toISOString()
            };
            
            // Add attachments if any
            if (this.#currentAttachments.length > 0) {
                userMessage.attachments = this.#currentAttachments;
            }
            
            this.#messages.push(userMessage);
            this.#renderMessage(userMessage);
            this.#elements.messageInput.value = '';
            
            // Clear attachments
            this.#currentAttachments = [];
            this.#updateAttachmentsUI();
            
            // Request AI response
            await this.#requestAIResponse(botId);
            
            // Save current session
            this.#saveCurrentSession();
        } catch (error) {
            // On error, restore the input field and attachments
            this.#elements.messageInput.value = originalMessage;
            this.#currentAttachments = originalAttachments;
            this.#updateAttachmentsUI();
            
            // Note: The user message is already removed from #messages by the DeepSeek request handler
            // The error will be displayed by the outer error handler
            
            // Don't rethrow here - the error is already handled by #requestAIResponse
        }
    }
    

    async #requestAIResponse(botId) {
        this.#isWaitingForResponse = true;
        this.#elements.loading.style.display = 'flex';
        // @ts-ignore
        this.#currentController = new AbortController();
        
        try {
            // 获取bot配置
            const settings = storageManager.aisettings;
            const bot = settings.bots[botId];
            
            if (!bot) {
                throw new Error('找不到选中的Bot配置');
            }
            
            // 获取服务器配置
            const server = settings.servers[bot.server];
            
            if (!server) {
                throw new Error('找不到Bot对应的服务器配置');
            }
            
            // 构建请求参数
            const messages = this.#formatMessagesForAPI(bot);
            
            // 创建聊天记录中的AI响应占位
            const aiMessageId = `ai-response-${Date.now()}`;
            const aiMessage = {
                id: aiMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString()
            };
            this.#messages.push(aiMessage);
            this.#renderMessage(aiMessage);
            
            // 根据不同AI服务发送请求
            switch (bot.server) {
                case 'openai':
                    await this.#sendOpenAIRequest(server, bot, messages, aiMessageId);
                    break;
                case 'claude':
                    await this.#sendClaudeRequest(server, bot, messages, aiMessageId);
                    break;
                case 'gemini':
                    await this.#sendGeminiRequest(server, bot, messages, aiMessageId);
                    break;
                case 'deepseek':
                    await this.#sendDeepSeekRequest(server, bot, messages, aiMessageId);
                    break;
                case 'grok':
                    await this.#sendGrokRequest(server, bot, messages, aiMessageId);
                    break;
                default:
                    // 默认模拟响应
                    await this.#simulateAIResponse(bot, aiMessageId);
            }
            
            // 保存当前会话
            this.#saveCurrentSession();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('请求被取消');
                return;
            }
            
            console.error('AI响应错误:', error);
            
            // 显示错误消息
            const errorMessage = {
                role: 'system',
                content: `错误: ${error.message}`,
                timestamp: new Date().toISOString(),
                isError: true
            };
            
            this.#renderMessage(errorMessage);
            this.#messages.push(errorMessage);
            this.#saveCurrentSession();
        } finally {
            this.#isWaitingForResponse = false;
            this.#elements.loading.style.display = 'none';
            this.#currentController = null;
        }
    }

    async #getAIReader(server,requestBody,headers = undefined){
        const apiUrl = server.url;
        const apiKey = server.key;

        if( headers === undefined ){
            // @ts-ignore
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            // @ts-ignore
            signal: this.#currentController?.signal
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(`${server.name} API错误: ${error.error?.message || '未知错误'}`);
            } else {
                const errorText = await response.text();
                throw new Error(`${server.name} API错误: ${errorText || '未知错误'}`);
            }
        }        
        
        const reader = response.body?.getReader();
        if( !reader ){
            throw new Error(`${server.name} API错误: 读响应失败`);
        }

        return reader;
    }
    
    async #sendOpenAIRequest(server, bot, messages, aiMessageId) {
        
        const requestBody = {
            model: bot.model,
            messages: messages,
            temperature: 0.7,
            stream: true
        };
        
        const reader = await this.#getAIReader(server,requestBody);

        const decoder = new TextDecoder('utf-8');
        let content = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.substring(6));
                        const delta = data.choices[0]?.delta?.content || '';
                        content += delta;
                        this.#updateAIMessage(aiMessageId, content);
                    } catch (e) {
                        console.warn('解析OpenAI响应出错:', e);
                    }
                }
            }
        }
        
        if (content === '') {
            content = '(AI返回了空响应)';
            this.#updateAIMessage(aiMessageId, content);
        }
    }

    async #sendClaudeRequest(server, bot, messages, aiMessageId) {
        const apiKey = server.key;
        
        // Claude API有不同的消息格式
        const claudeMessages = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user'),
            content: msg.role === 'system' ? [{type: 'text', text: msg.content}] : [{type: 'text', text: msg.content}]
        }));
        
        const requestBody = {
            model: bot.model,
            messages: claudeMessages,
            stream: true
        };
        
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        };
        
        if (server.headers) {
            Object.assign(headers, server.headers);
        }
        
        // @ts-ignore
        const reader = await this.#getAIReader(server,requestBody,headers);


        const decoder = new TextDecoder('utf-8');
        let content = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.type === 'content_block_delta') {
                            const delta = data.delta?.text || '';
                            content += delta;
                            this.#updateAIMessage(aiMessageId, content);
                        }
                    } catch (e) {
                        console.warn('解析Claude响应出错:', e);
                    }
                }
            }
        }
        
        if (content === '') {
            content = '(AI返回了空响应)';
            this.#updateAIMessage(aiMessageId, content);
        }
    }

    async #sendGeminiRequest(server, bot, messages, aiMessageId) {
        // 替换URL中的模型占位符
        const modelName = bot.model;
        const apiUrl = server.url.replace('__MODEL_NAME__', modelName);
        const apiKey = server.key;
        
        // 转换为Gemini格式
        const geminiMessages = [];
        let hasSystemPrompt = false;
        
        // 处理系统提示
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
        
        const requestBody = {
            contents: geminiMessages,
            generationConfig: {
                temperature: 0.7
            }
        };
        
        // Gemini API URL需要包含API Key
        const fullUrl = `${apiUrl}?key=${apiKey}`;
        
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            // @ts-ignore
            signal: this.#currentController.signal
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Gemini API错误: ${error.error?.message || '未知错误'}`);
        }

        const result = await response.json();
        const content = result.candidates[0]?.content?.parts[0]?.text || '(Gemini返回了空响应)';
        
        this.#updateAIMessage(aiMessageId, content);
    }

    async #sendDeepSeekRequest(server, bot, messages, aiMessageId) {
        const requestBody = {
            model: bot.model,
            messages: messages,
            temperature: 0.7,
            stream: true
        };
        
        const reader = await this.#getAIReader(server, requestBody);
        
        const decoder = new TextDecoder('utf-8');
        let content = '';
        let reasoningContent = '';
        let hasReasoning = false; // 是否有推理内容
        let isReasoningActive = false; // 当前是否正在接收推理内容
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.substring(6));
                        const delta = data.choices[0]?.delta;
                        
                        // 处理推理内容
                        if (delta?.reasoning_content) {
                            if (!isReasoningActive) {
                                // 开始接收推理内容
                                isReasoningActive = true;
                                hasReasoning = true;
                            }
                            reasoningContent += delta.reasoning_content;
                            // 更新消息，显示展开的推理内容（放在顶部）
                            this.#updateAIMessage(aiMessageId, 
                                (hasReasoning ? '<details class="reasoning-container" open><summary>推理过程</summary>\n' + reasoningContent + '\n</details>\n\n' : '') +
                                content
                            );
                        } 
                        // 处理普通内容
                        else if (delta?.content) {
                            // 如果之前有推理内容但现在是普通内容，则折叠推理内容
                            if (isReasoningActive) {
                                isReasoningActive = false;
                            }
                            
                            content += delta.content;
                            // 更新消息，推理内容放在顶部并折叠
                            this.#updateAIMessage(aiMessageId, 
                                (hasReasoning ? '<details class="reasoning-container"><summary>推理过程</summary>\n' + reasoningContent + '\n</details>\n\n' : '') +
                                content
                            );
                        }
                    } catch (e) {
                        console.warn('解析DeepSeek响应出错:', e);
                    }
                }
            }
        }
        
        // 最终处理，确保消息格式正确（推理内容在前）
        let finalContent = (hasReasoning ? '<details class="reasoning-container"><summary>推理过程</summary>\n' + reasoningContent + '\n</details>\n\n' : '') + content;
        
        if (finalContent.trim() === '') {
            finalContent = '(AI返回了空响应)';
        }
        
        this.#updateAIMessage(aiMessageId, finalContent);
        
        // 保存最终消息内容
        const messageIndex = this.#messages.findIndex(msg => msg.id === aiMessageId);
        if (messageIndex !== -1) {
            this.#messages[messageIndex].content = content;
            if (hasReasoning) {
                this.#messages[messageIndex].reasoning = reasoningContent;
            }
        }
    }
    
    
    

    async #sendGrokRequest(server, bot, messages, aiMessageId) {
        const apiUrl = server.url;
        const apiKey = server.key;
        
        const requestBody = {
            model: bot.model,
            messages: messages,
            temperature: 0.7,
            stream: true
        };
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            // @ts-ignore
            signal: this.#currentController.signal
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Grok API错误: ${error.error?.message || '未知错误'}`);
        }
        
        const reader = response.body?.getReader();
        if( !reader ){
            throw new Error(`Grok API错误: 读响应失败`);
        }
        const decoder = new TextDecoder('utf-8');
        let content = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.substring(6));
                        const delta = data.choices[0]?.delta?.content || '';
                        content += delta;
                        this.#updateAIMessage(aiMessageId, content);
                    } catch (e) {
                        console.warn('解析Grok响应出错:', e);
                    }
                }
            }
        }
        
        if (content === '') {
            content = '(AI返回了空响应)';
            this.#updateAIMessage(aiMessageId, content);
        }
    }

    async #simulateAIResponse(bot, aiMessageId) {
        let content = '';
        const fullResponse = `这是模拟的AI响应，来自 ${bot.name} (${bot.model})。\n\n您的请求已收到，但这是一个模拟环境。在实际应用中，您会看到来自AI的真实回复。`;
        
        // 模拟流式响应
        for (let i = 0; i < fullResponse.length; i += 5) {
            // @ts-ignore
            if (this.#currentController && this.#currentController.signal.aborted) {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
            content += fullResponse.substring(i, Math.min(i + 5, fullResponse.length));
            this.#updateAIMessage(aiMessageId, content);
        }
    }

    #updateAIMessage(messageId, content) {
        // 更新消息内容
        const messageIndex = this.#messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            this.#messages[messageIndex].content = content;
        }
        
        // 更新UI
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-text');
            if (contentElement) {
                // @ts-ignore
                contentElement.innerHTML = DOMPurify.sanitize(marked.parse(content));
                
                // 代码高亮
                // @ts-ignore
                if (window.hljs) {
                    // @ts-ignore
                    contentElement.querySelectorAll('pre code').forEach((block) => {
                        // @ts-ignore
                        hljs.highlightElement(block);
                    });
                }
                
                // MathJax渲染
                // @ts-ignore
                if (window.MathJax) {
                    // @ts-ignore
                    MathJax.typesetPromise([contentElement]).catch((err) => {
                        console.error('MathJax error:', err);
                    });
                }
            }
        }
        
        this.#scrollToBottom();
    }

    #formatMessagesForAPI(bot) {
        // 转换消息格式以适应不同AI API
        const messages = [];
        
        // 添加系统提示
        if (bot.systemPrompt) {
            messages.push({
                role: 'system',
                content: bot.systemPrompt
            });
        }
        
        // 添加对话历史
        this.#messages.forEach(msg => {
            if (msg.role !== 'system') {  // 跳过系统消息，它们是UI用的
                const formattedMsg = {
                    role: msg.role,
                    content: msg.content
                };
                
                // 如果消息有附件，根据不同API处理
                if (msg.attachments && msg.attachments.length > 0) {
                    // 暂时简单处理：在消息末尾添加附件描述
                    const attachmentDesc = msg.attachments.map(att => 
                        `[附件: ${att.name} (${att.type})]`).join('\n');
                    formattedMsg.content += '\n\n' + attachmentDesc;
                    
                    // TODO: 为不同AI服务添加多模态支持
                }
                
                messages.push(formattedMsg);
            }
        });
        
        return messages;
    }

    #renderMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${message.role}`;
        
        if (message.id) {
            messageElement.id = message.id;
        }
        
        if (message.isError) {
            messageElement.classList.add('error');
        }
        
        const avatarIcon = this.#getAvatarIconForRole(message.role);
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="${avatarIcon}"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-role">${this.#getRoleName(message.role)}</span>
                    <span class="message-time">${this.#formatTime(message.timestamp)}</span>
                </div>
                <div class="message-text"></div>
            </div>
        `;
        
        // 首先渲染文本内容
        const contentElement = messageElement.querySelector('.message-text');
        // @ts-ignore
        contentElement.innerHTML = DOMPurify.sanitize(marked.parse(message.content));
        
        // 如果有附件，渲染附件
        if (message.attachments && message.attachments.length > 0) {
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.className = 'message-attachments';
            
            message.attachments.forEach(attachment => {
                const attachmentElement = document.createElement('div');
                attachmentElement.className = 'message-attachment';
                
                // 根据附件类型显示预览
                if (attachment.type.startsWith('image/')) {
                    // 图片附件显示缩略图
                    attachmentElement.innerHTML = `
                        <img src="${attachment.data}" alt="${attachment.name}" class="attachment-preview">
                        <div class="attachment-info">${attachment.name}</div>
                    `;
                } else {
                    // 其他类型附件显示图标
                    const icon = this.#getFileIcon(attachment.type);
                    attachmentElement.innerHTML = `
                        <div class="attachment-icon"><i class="${icon}"></i></div>
                        <div class="attachment-info">${attachment.name}</div>
                    `;
                }
                
                attachmentsContainer.appendChild(attachmentElement);
            });
            
            messageElement.querySelector('.message-content')?.appendChild(attachmentsContainer);
        }
        
        // 代码高亮
        // @ts-ignore
        if (window.hljs) {
            // @ts-ignore
            contentElement.querySelectorAll('pre code').forEach((block) => {
                // @ts-ignore
                hljs.highlightElement(block);
            });
        }
        
        // MathJax渲染
        // @ts-ignore
        if (window.MathJax) {
            // @ts-ignore
            MathJax.typesetPromise([contentElement]).catch((err) => {
                console.error('MathJax error:', err);
            });
        }
        
        this.#elements.chatHistory.appendChild(messageElement);
        this.#scrollToBottom();
    }

    #getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) {
            return 'fas fa-file-image';
        } else if (mimeType.startsWith('text/')) {
            return 'fas fa-file-alt';
        } else if (mimeType.startsWith('application/pdf')) {
            return 'fas fa-file-pdf';
        } else if (mimeType.includes('word') || mimeType.includes('document')) {
            return 'fas fa-file-word';
        } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
            return 'fas fa-file-excel';
        } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
            return 'fas fa-file-powerpoint';
        } else if (mimeType.includes('zip') || mimeType.includes('compressed')) {
            return 'fas fa-file-archive';
        } else if (mimeType.includes('audio')) {
            return 'fas fa-file-audio';
        } else if (mimeType.includes('video')) {
            return 'fas fa-file-video';
        } else if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('json')) {
            return 'fas fa-file-code';
        } else {
            return 'fas fa-file';
        }
    }

    #getAvatarIconForRole(role) {
        switch (role) {
            case 'user': return 'fas fa-user';
            case 'assistant': return 'fas fa-robot';
            case 'system': return 'fas fa-cog';
            default: return 'fas fa-comment';
        }
    }

    #getRoleName(role) {
        switch (role) {
            case 'user': return '用户';
            case 'assistant': return 'AI助手';
            case 'system': return '系统';
            default: return role;
        }
    }

    #formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    #scrollToBottom() {
        this.#elements.chatHistory.scrollTop = this.#elements.chatHistory.scrollHeight;
    }

    #saveCurrentSession() {
        if (!this.currentSession) return;
        
        this.saveSession({
            messages: this.#messages,
            botId: this.#elements.botSelect.value,
            title: this.#generateTitle()
        });
    }

    #generateTitle() {
        // 从第一条用户消息生成标题
        const firstUserMessage = this.#messages.find(m => m.role === 'user');
        if (firstUserMessage) {
            return firstUserMessage.content.substring(0, 30) + 
                  (firstUserMessage.content.length > 30 ? '...' : '');
        }
        
        return '新对话';
    }

    #clearChat() {
        if (this.#messages.length === 0) return;
        
        const confirmed = confirm('确定要清空当前对话吗？');
        if (!confirmed) return;
        
        this.#messages = [];
        this.#elements.chatHistory.innerHTML = '';
        
        // 清空附件
        this.#currentAttachments = [];
        this.#updateAttachmentsUI();
        
        // 如果有活动会话，保存清空状态
        if (this.currentSession) {
            this.saveSession({ messages: [] });
        }
    }

    #exportChat() {
        if (this.#messages.length === 0) {
            alert('没有可导出的对话内容');
            return;
        }
        
        // 格式化为Markdown文本
        let markdown = '# 聊天记录\n\n';
        markdown += `导出时间: ${new Date().toLocaleString()}\n\n`;
        
        this.#messages.forEach(msg => {
            const role = this.#getRoleName(msg.role);
            const time = this.#formatTime(msg.timestamp);
            markdown += `## ${role} (${time})\n\n${msg.content}\n\n`;
            
            // 添加附件信息
            if (msg.attachments && msg.attachments.length > 0) {
                markdown += '### 附件:\n\n';
                msg.attachments.forEach(att => {
                    markdown += `- ${att.name} (${att.type})\n`;
                });
                markdown += '\n';
            }
            
            markdown += '---\n\n';
        });
        
        // 创建下载文件
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        // @ts-ignore
        saveAs(blob, `chat-export-${Date.now()}.md`);
    }

    #saveConversation() {
        if (this.#messages.length === 0) {
            alert('没有可保存的对话内容');
            return;
        }
        
        // 创建新会话
        const newSessionId = Date.now().toString();
        const session = {
            id: newSessionId,
            title: this.#generateTitle(),
            messages: this.#messages,
            botId: this.#elements.botSelect.value,
            created: new Date().toISOString()
        };
        
        storageManager.addSession('ai', session);
        alert('对话已保存为新会话');
    }

    #handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // 处理每个上传的文件
        Array.from(files).forEach(file => {
            // 检查文件大小
            if (file.size > 10 * 1024 * 1024) { // 10MB 限制
                alert(`文件 ${file.name} 太大，请上传10MB以内的文件`);
                return;
            }
            
            // 读取文件
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const attachment = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: /** @type {string} */e.target?.result
                };
                
                this.#currentAttachments.push(attachment);
                this.#updateAttachmentsUI();
            };
            
            reader.onerror = () => {
                alert(`文件 ${file.name} 读取失败`);
            };
            
            // 根据文件类型决定如何读取
            if (file.type.startsWith('text/') || 
                file.type.includes('json') || 
                file.type.includes('javascript') || 
                file.name.endsWith('.py') || 
                file.name.endsWith('.md')) {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        });
        
        // 清空文件输入，允许再次上传同一文件
        this.#elements.fileUpload.value = '';
    }

    #updateAttachmentsUI() {
        const container = this.#elements.attachmentsContainer;
        const list = this.#elements.attachmentsList;
        
        if (this.#currentAttachments.length === 0) {
            container.style.display = 'none';
            list.innerHTML = '';
            return;
        }
        
        container.style.display = 'block';
        list.innerHTML = '';
        
        this.#currentAttachments.forEach((attachment, index) => {
            const attachmentEl = document.createElement('div');
            attachmentEl.className = 'attachment-item';
            
            // 根据文件类型显示不同的预览
            let previewHTML = '';
            if (attachment.type.startsWith('image/')) {
                previewHTML = `<img src="${attachment.data}" alt="${attachment.name}" class="attachment-thumbnail">`;
            } else {
                const icon = this.#getFileIcon(attachment.type);
                previewHTML = `<div class="attachment-icon"><i class="${icon}"></i></div>`;
            }
            
            attachmentEl.innerHTML = `
                ${previewHTML}
                <div class="attachment-name">${attachment.name}</div>
                <button class="attachment-remove" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // 绑定删除按钮事件
            attachmentEl.querySelector('.attachment-remove')?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.#removeAttachment(index);
            });
            
            list.appendChild(attachmentEl);
        });
    }

    #removeAttachment(index) {
        if (index >= 0 && index < this.#currentAttachments.length) {
            this.#currentAttachments.splice(index, 1);
            this.#updateAttachmentsUI();
        }
    }

    #formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' bytes';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }

    #botChanged() {
        // 保存新的bot选择
        if (this.currentSession) {
            this.saveSession({
                botId: this.#elements.botSelect.value
            });
        }
    }

    // BaseEditor方法实现
    onSessionLoaded(session) {
        // 加载会话消息
        this.#messages = session.messages || [];
        this.#elements.chatHistory.innerHTML = '';
        
        // 清空附件
        this.#currentAttachments = [];
        this.#updateAttachmentsUI();
        
        // 设置bot
        if (session.botId && this.#elements.botSelect.querySelector(`option[value="${session.botId}"]`)) {
            this.#elements.botSelect.value = session.botId;
        }
        
        // 渲染所有消息
        this.#messages.forEach(msg => this.#renderMessage(msg));
        this.#scrollToBottom();
    }
}

export default new AIChat();
