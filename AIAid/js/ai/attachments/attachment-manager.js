// ai/attachments/attachment-manager.js

// @ts-check
"use strict";

/**
 * 附件管理器类
 */
export class AttachmentManager {
    /**
     * @param {HTMLElement} containerElement - 容器元素
     * @param {HTMLElement} listElement - 列表元素
     * @param {HTMLInputElement} fileInput - 文件输入元素
     */
    constructor(containerElement, listElement, fileInput) {
        this.container = containerElement;
        this.list = listElement;
        this.fileInput = fileInput;
        this.attachments = [];
        
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    }

    /**
     * 处理文件上传
     * @param {FileList|null} files - 文件列表
     */
    handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // 处理每个上传的文件
        Array.from(files).forEach(file => {
            // 检查文件大小
            if (file.size > this.MAX_FILE_SIZE) {
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
                
                this.attachments.push(attachment);
                this.updateAttachmentsUI();
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
        this.fileInput.value = '';
    }

    /**
     * 更新附件UI
     */
    updateAttachmentsUI() {
        if (this.attachments.length === 0) {
            this.container.style.display = 'none';
            this.list.innerHTML = '';
            return;
        }
        
        this.container.style.display = 'block';
        this.list.innerHTML = '';
        
        this.attachments.forEach((attachment, index) => {
            const attachmentEl = document.createElement('div');
            attachmentEl.className = 'attachment-item';
            
            // 根据文件类型显示不同的预览
            let previewHTML = '';
            if (attachment.type.startsWith('image/')) {
                previewHTML = `<img src="${attachment.data}" alt="${attachment.name}" class="attachment-thumbnail">`;
            } else {
                const icon = this.getFileIcon(attachment.type);
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
            const removeButton = attachmentEl.querySelector('.attachment-remove');
            if (removeButton) {
                removeButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.removeAttachment(index);
                });
            }
            
            this.list.appendChild(attachmentEl);
        });
    }

    /**
     * 移除附件
     * @param {number} index - 附件索引
     */
    removeAttachment(index) {
        if (index >= 0 && index < this.attachments.length) {
            this.attachments.splice(index, 1);
            this.updateAttachmentsUI();
        }
    }

    /**
     * 清空所有附件
     */
    clearAttachments() {
        this.attachments = [];
        this.updateAttachmentsUI();
    }

    /**
     * 获取当前附件列表
     * @returns {Array<Object>} 附件列表
     */
    getCurrentAttachments() {
        return [...this.attachments];
    }

    /**
     * 设置附件列表
     * @param {Array<Object>} attachments - 附件列表
     */
    setAttachments(attachments) {
        this.attachments = [...attachments];
        this.updateAttachmentsUI();
    }

    /**
     * 获取文件图标
     * @param {string} mimeType - MIME类型
     * @returns {string} 图标类名
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

    /**
     * 格式化文件大小
     * @param {number} bytes - 文件字节数
     * @returns {string} 格式化的大小
     */
    formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' bytes';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }
}
