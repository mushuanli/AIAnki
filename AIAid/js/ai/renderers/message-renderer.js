// ai/renderers/message-renderer.js

// @ts-check
"use strict";

/**
 * 消息渲染器类
 */
export class MessageRenderer {
    /**
     * @param {HTMLElement} containerElement - 容器元素
     */
    constructor(containerElement) {
        this.container = containerElement;
    }

    /**
     * 渲染消息
     * @param {Object} message - 消息对象
     */
    renderMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${message.role}`;
        
        if (message.id) {
            messageElement.id = message.id;
        }
        
        if (message.isError) {
            messageElement.classList.add('error');
        }
        
        const avatarIcon = this.getAvatarIconForRole(message.role);
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="${avatarIcon}"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-role">${this.getRoleName(message.role)}</span>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
                <div class="message-text"></div>
            </div>
        `;
        
        // 渲染文本内容
        const contentElement = messageElement.querySelector('.message-text');
        // @ts-ignore
        contentElement.innerHTML = DOMPurify.sanitize(marked.parse(message.content));
        
        // 如果有附件，渲染附件
        if (message.attachments && message.attachments.length > 0) {
            this.renderAttachments(message.attachments, messageElement);
        }
        
        // 应用代码高亮和MathJax
        // @ts-ignore
        this.applyFormatting(contentElement);
        
        this.container.appendChild(messageElement);
    }

    /**
     * 渲染附件
     * @param {Array<Object>} attachments - 附件列表
     * @param {HTMLElement} messageElement - 消息元素
     */
    renderAttachments(attachments, messageElement) {
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'message-attachments';
        
        attachments.forEach(attachment => {
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
                const icon = this.getFileIcon(attachment.type);
                attachmentElement.innerHTML = `
                    <div class="attachment-icon"><i class="${icon}"></i></div>
                    <div class="attachment-info">${attachment.name}</div>
                `;
            }
            
            attachmentsContainer.appendChild(attachmentElement);
        });
        
        messageElement.querySelector('.message-content')?.appendChild(attachmentsContainer);
    }

    /**
     * 应用格式化（代码高亮、MathJax）
     * @param {Element} element - 要格式化的元素
     */
    applyFormatting(element) {
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
     * 获取角色对应的头像图标
     * @param {string} role - 角色
     * @returns {string} 图标类
     */
    getAvatarIconForRole(role) {
        switch (role) {
            case 'user': return 'fas fa-user';
            case 'assistant': return 'fas fa-robot';
            case 'system': return 'fas fa-cog';
            default: return 'fas fa-comment';
        }
    }

    /**
     * 获取角色名称
     * @param {string} role - 角色
     * @returns {string} 角色名称
     */
    getRoleName(role) {
        switch (role) {
            case 'user': return '用户';
            case 'assistant': return 'AI助手';
            case 'system': return '系统';
            default: return role;
        }
    }

    /**
     * 格式化时间
     * @param {string} timestamp - 时间戳
     * @returns {string} 格式化后的时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * 获取文件图标
     * @param {string} mimeType - MIME类型
     * @returns {string} 图标类
     */
    getFileIcon(mimeType) {
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
}
