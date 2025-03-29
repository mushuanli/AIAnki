// editors/ai-chat.js

// @ts-check
"use strict";

import { BaseEditor } from './base-editor.js';
import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';
import aiConfigDialog from './ai-config-dialog.js';
import { AIHandlerFactory } from '../ai/handlers/ai-handler-factory.js';
import { MessageRenderer } from '../ai/renderers/message-renderer.js';
import { AttachmentManager } from '../ai/attachments/attachment-manager.js';

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

    /** @type {Array<any>} */
    #messages = [];
    
    /** @type {boolean} */
    #isWaitingForResponse = false;
    
    /** @type {AbortController|null} */
    #currentController = null;
    
    /** @type {MessageRenderer} */
    #messageRenderer;
    
    /** @type {AttachmentManager} */
    #attachmentManager;

    constructor() {
        super('ai');
        this.#messageRenderer = new MessageRenderer(this.#elements.chatHistory);
        this.#attachmentManager = new AttachmentManager(
            this.#elements.attachmentsContainer,
            this.#elements.attachmentsList,
            this.#elements.fileUpload
        );
        this.#initialize();
    }

    #initialize() {
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
            this.#attachmentManager.handleFileUpload(e.target.files);
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
            option.value = name;  
            // @ts-ignore
            option.textContent = bot.name;
            if (name === settings.curBot) {
                option.selected = true;
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
        const attachments = this.#attachmentManager.getCurrentAttachments();
        
        if ((!messageText && attachments.length === 0) || this.#isWaitingForResponse) return;
        
        const botId = this.#elements.botSelect.value;
        if (!botId) {
            alert('请先选择一个Bot');
            return;
        }
        
        // 保存原始输入内容以备恢复
        const originalMessage = messageText;
        const originalAttachments = [...attachments];
        
        try {
            // 创建用户消息对象
            const userMessage = {
                role: 'user',
                content: messageText,
                timestamp: new Date().toISOString()
            };
            
            // 添加附件
            if (attachments.length > 0) {
                userMessage.attachments = attachments;
            }
            
            this.#messages.push(userMessage);
            this.#messageRenderer.renderMessage(userMessage);
            this.#elements.messageInput.value = '';
            
            // 清空附件
            this.#attachmentManager.clearAttachments();
            
            // 请求AI响应
            await this.#requestAIResponse(botId);
            
            // 保存当前会话
            this.#saveCurrentSession();
        } catch (error) {
            // 恢复输入和附件
            this.#elements.messageInput.value = originalMessage;
            this.#attachmentManager.setAttachments(originalAttachments);
            
            console.error('发送消息错误:', error);
        }
    }
    
    /**
     * 请求AI响应
     * @param {string} botId - Bot ID
     */
    async #requestAIResponse(botId) {
        this.#isWaitingForResponse = true;
        this.#elements.loading.style.display = 'flex';
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
            
            // 创建AI处理器
            const aiHandler = AIHandlerFactory.createHandler(bot.server, server, bot);
            
            // 创建聊天记录中的AI响应占位
            const aiMessageId = `ai-response-${Date.now()}`;
            const aiMessage = {
                id: aiMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString()
            };
            
            this.#messages.push(aiMessage);
            this.#messageRenderer.renderMessage(aiMessage);
            
            // 准备消息数据
            const messages = this.#formatMessagesForAPI(bot);
            
            // 处理AI请求
            await this.#processAIRequest(aiHandler, messages, aiMessageId);
            
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
            
            this.#messageRenderer.renderMessage(errorMessage);
            this.#messages.push(errorMessage);
            this.#saveCurrentSession();
        } finally {
            this.#isWaitingForResponse = false;
            this.#elements.loading.style.display = 'none';
            this.#currentController = null;
        }
    }

    /**
     * 处理AI请求
     * @param {import('../ai/handlers/ai-handler.js').AIHandler} aiHandler - AI处理器
     * @param {Array<any>} messages - 消息列表
     * @param {string} aiMessageId - AI消息ID
     */
    async #processAIRequest(aiHandler, messages, aiMessageId) {
        try {
            // 构建请求体
            const requestBody = aiHandler.buildRequestBody(messages);
            
            // 获取响应流读取器
            const reader = await this.#getResponseReader(aiHandler, requestBody);
            
            // 处理流式响应
            await this.#processStreamResponse(reader, aiHandler, aiMessageId);
        } catch (error) {
            // 删除最后一个AI消息，让外层错误处理来显示错误
            const lastIndex = this.#messages.findIndex(msg => msg.id === aiMessageId);
            if (lastIndex !== -1) {
                this.#messages.splice(lastIndex, 1);
                const messageElement = document.getElementById(aiMessageId);
                if (messageElement) {
                    messageElement.remove();
                }
            }
            
            throw error;
        }
    }
    
    /**
     * 获取响应流读取器
     * @param {import('../ai/handlers/ai-handler.js').AIHandler} aiHandler - AI处理器
     * @param {any} requestBody - 请求体
     * @returns {Promise<ReadableStreamDefaultReader<Uint8Array>>} 读取器
     */
    async #getResponseReader(aiHandler, requestBody) {
        const response = await fetch(aiHandler.getApiUrl(), {
            method: 'POST',
            headers: aiHandler.getRequestHeaders(),
            body: JSON.stringify(requestBody),
            signal: this.#currentController?.signal
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('Content-Type');
            let errorMessage = '';
            
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                errorMessage = error.error?.message || '未知错误';
            } else {
                const errorText = await response.text();
                errorMessage = errorText || '未知错误';
            }
            
            throw new Error(`${aiHandler.getServiceName()} API错误: ${errorMessage}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error(`${aiHandler.getServiceName()} API错误: 无法读取响应`);
        }
        
        return reader;
    }

    /**
     * 处理流式响应
     * @param {ReadableStreamDefaultReader<Uint8Array>} reader - 读取器
     * @param {import('../ai/handlers/ai-handler.js').AIHandler} aiHandler - AI处理器 
     * @param {string} aiMessageId - AI消息ID
     */
    async #processStreamResponse(reader, aiHandler, aiMessageId) {
        const decoder = new TextDecoder('utf-8');
        let content = '';
        let additionalContent = {}; // 存储额外内容，如推理过程
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (this.#isValidDataLine(line)) {
                        const data = this.#parseLineData(line);
                        if (data) {
                            const result = aiHandler.parseResponse(data);
                            
                            // 处理常规内容和额外内容（如推理过程）
                            if (result.mainContent !== undefined) {
                                content += result.mainContent;
                            }
                            
                            // 合并额外内容
                            if (result.additionalContent) {
                                additionalContent = {
                                    ...additionalContent,
                                    ...result.additionalContent
                                };
                            }
                            
                            // 根据处理器更新消息
                            this.#updateAIMessage(aiMessageId, content, additionalContent);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('处理流响应出错:', error);
            throw new Error(`处理${aiHandler.getServiceName()}响应出错: ${error.message}`);
        } finally {
            // 确保消息格式正确
            if (content.trim() === '') {
                content = '(AI返回了空响应)';
            }
            
            this.#updateAIMessage(aiMessageId, content, additionalContent);
            
            // 更新消息对象的内容
            this.#updateMessageContent(aiMessageId, content, additionalContent);
        }
    }

    /**
     * 检查响应行是否是有效的数据行
     * @param {string} line - 响应行
     * @returns {boolean} 是否有效
     */
    #isValidDataLine(line) {
        return line.startsWith('data: ') && line !== 'data: [DONE]';
    }

    /**
     * 解析响应行数据
     * @param {string} line - 响应行
     * @returns {any|null} 解析后的数据
     */
    #parseLineData(line) {
        try {
            return JSON.parse(line.substring(6));
        } catch (e) {
            console.warn('解析响应行失败:', e);
            return null;
        }
    }

    /**
     * 更新AI消息内容
     * @param {string} messageId - 消息ID
     * @param {string} content - 主要内容
     * @param {Object} additionalContent - 额外内容
     */
    #updateAIMessage(messageId, content, additionalContent = {}) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        
        const contentElement = messageElement.querySelector('.message-text');
        if (!contentElement) return;
        
        // 构建最终显示内容
        let finalContent = content;
        
        // 添加额外内容（如推理过程）
        if (additionalContent.reasoning) {
            const isOpen = additionalContent.isReasoningActive || false;
            finalContent = 
                `<details class="reasoning-container" ${isOpen ? 'open' : ''}>` +
                `<summary>推理过程</summary>\n${additionalContent.reasoning}\n</details>\n\n` + 
                content;
        }
        
        // 更新DOM
        // @ts-ignore
        contentElement.innerHTML = DOMPurify.sanitize(marked.parse(finalContent));
        
        // 应用代码高亮和数学公式渲染
        this.#applyFormatting(contentElement);
        
        // 滚动到底部
        this.#scrollToBottom();
    }

    /**
     * 更新消息对象的内容
     * @param {string} messageId - 消息ID
     * @param {string} content - 主要内容
     * @param {Object} additionalContent - 额外内容
     */
    #updateMessageContent(messageId, content, additionalContent = {}) {
        const messageIndex = this.#messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) return;
        
        this.#messages[messageIndex].content = content;
        
        // 保存额外内容
        for (const [key, value] of Object.entries(additionalContent)) {
            this.#messages[messageIndex][key] = value;
        }
    }

    /**
     * 应用格式化（代码高亮、数学公式）
     * @param {Element} element - 要格式化的元素
     */
    #applyFormatting(element) {
        // 代码高亮
        // @ts-ignore
        if (window.hljs) {
            // @ts-ignore
            element.querySelectorAll('pre code').forEach((block) => {
                // @ts-ignore
                hljs.highlightElement(block);
            });
        }
        
        // MathJax渲染
        // @ts-ignore
        if (window.MathJax) {
            // @ts-ignore
            MathJax.typesetPromise([element]).catch((err) => {
                console.error('MathJax error:', err);
            });
        }
    }

    /**
     * 为API格式化消息
     * @param {any} bot - Bot配置
     * @returns {Array<any>} 格式化后的消息
     */
    #formatMessagesForAPI(bot) {
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
                
                // 如果消息有附件，添加描述
                if (msg.attachments && msg.attachments.length > 0) {
                    const attachmentDesc = msg.attachments.map(att => 
                        `[附件: ${att.name} (${att.type})]`).join('\n');
                    formattedMsg.content += '\n\n' + attachmentDesc;
                }
                
                messages.push(formattedMsg);
            }
        });
        
        return messages;
    }

    /**
     * 滚动到聊天历史底部
     */
    #scrollToBottom() {
        this.#elements.chatHistory.scrollTop = this.#elements.chatHistory.scrollHeight;
    }

    /**
     * 保存当前会话
     */
    #saveCurrentSession() {
        if (!this.currentSession) return;
        
        this.saveSession({
            messages: this.#messages,
            botId: this.#elements.botSelect.value,
            title: this.#generateTitle()
        });
    }

    /**
     * 根据内容生成标题
     * @returns {string} 生成的标题
     */
    #generateTitle() {
        // 从第一条用户消息生成标题
        const firstUserMessage = this.#messages.find(m => m.role === 'user');
        if (firstUserMessage) {
            return firstUserMessage.content.substring(0, 30) + 
                  (firstUserMessage.content.length > 30 ? '...' : '');
        }
        
        return '新对话';
    }

    /**
     * 清空聊天
     */
    #clearChat() {
        if (this.#messages.length === 0) return;
        
        const confirmed = confirm('确定要清空当前对话吗？');
        if (!confirmed) return;
        
        this.#messages = [];
        this.#elements.chatHistory.innerHTML = '';
        
        // 清空附件
        this.#attachmentManager.clearAttachments();
        
        // 如果有活动会话，保存清空状态
        if (this.currentSession) {
            this.saveSession({ messages: [] });
        }
    }

    /**
     * 导出聊天记录
     */
    #exportChat() {
        if (this.#messages.length === 0) {
            alert('没有可导出的对话内容');
            return;
        }
        
        // 格式化为Markdown文本
        let markdown = '# 聊天记录\n\n';
        markdown += `导出时间: ${new Date().toLocaleString()}\n\n`;
        
        this.#messages.forEach(msg => {
            const role = this.#messageRenderer.getRoleName(msg.role);
            const time = this.#messageRenderer.formatTime(msg.timestamp);
            markdown += `## ${role} (${time})\n\n${msg.content}\n\n`;
            
            // 添加附件信息
            if (msg.attachments && msg.attachments.length > 0) {
                markdown += '### 附件:\n\n';
                msg.attachments.forEach(att => {
                    markdown += `- ${att.name} (${att.type})\n`;
                });
                markdown += '\n';
            }
            
            // 添加推理过程
            if (msg.reasoning) {
                markdown += '### 推理过程:\n\n';
                markdown += `${msg.reasoning}\n\n`;
            }
            
            markdown += '---\n\n';
        });
        
        // 创建下载文件
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        // @ts-ignore
        saveAs(blob, `chat-export-${Date.now()}.md`);
    }

    /**
     * 保存为新会话
     */
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

    /**
     * Bot选择改变处理
     */
    #botChanged() {
        // 保存新的bot选择
        if (this.currentSession) {
            this.saveSession({
                botId: this.#elements.botSelect.value
            });
        }
    }

    /**
     * 加载会话
     * @param {any} session - 会话数据
     * @override
     */
    onSessionLoaded(session) {
        // 加载会话消息
        this.#messages = session.messages || [];
        this.#elements.chatHistory.innerHTML = '';
        
        // 清空附件
        this.#attachmentManager.clearAttachments();
        
        // 设置bot
        if (session.botId && this.#elements.botSelect.querySelector(`option[value="${session.botId}"]`)) {
            this.#elements.botSelect.value = session.botId;
        }
        
        // 渲染所有消息
        this.#messages.forEach(msg => {
            this.#messageRenderer.renderMessage(msg);
        });
        
        this.#scrollToBottom();
    }
}

export default new AIChat();
