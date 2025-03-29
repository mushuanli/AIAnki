// editors/ai-config-dialog.js

// @ts-check
"use strict";

import eventBus from '../core/event-bus.js';
import storageManager from '../core/storage-manager.js';

const defaultConfig = {
    server: {
        deepseek: {
            name: 'deepseek',
            url: 'https://api.deepseek.com/v1/chat/completions',
            key: '',
            models: ['deepseek-chat', 'deepseek-reasoner']
        },
        gemini: {
            name: 'gemini',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/__MODEL_NAME__:generateContent',
            key: '',
            models: ['gemini-2.0-flash-exp-image-generation', 'gemini-pro-vision', 'gemini-2.5-pro-exp-03-25']
        },
        openai: {
            name: 'openai',
            url: 'https://api.openai.com/v1/chat/completions',
            key: '',
            models: ['gpt-4o_2024-05-13', 'gpt-4-turbo-preview', 'gpt-4', 'gpt-4-0613', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo-0613']
        },
        claude: {
            name: 'claude',
            url: 'https://api.anthropic.com/v1/messages',
            key: '',
            models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-2.1', 'claude-2'],
            headers: { 'anthropic-version': '2023-10-01' }
        },
        grok: {
            name: 'grok',
            url: 'https://api.x.ai/v1/chat/completions',
            key: '',
            models: ['grok-3']
        },
        openrouter: {
            name: 'openrouter',
            url: 'https://api.openrouter.ai/v1/chat/completions',
            key: '',
            models: ['anthropic/claude-3.7-sonnet','anthropic/claude-3.7-sonnet:thinking','anthropic/claude-3.5-sonnet','google/gemini-2.5-pro-exp-03-25:free']
        }
    },
    bot: {
        v3: {
            name: 'v3',
            server: 'deepseek',
            model: 'deepseek-chat',
            systemPrompt: ''
        },
        r1: {
            name: 'r1',
            server: 'deepseek',
            model: 'deepseek-reasoner',
            systemPrompt: ''
        }
    },
    curBot: 'v3'
};

export class AIConfigDialog {
    #elements = {
        dialog: /** @type {HTMLDialogElement} */ (document.getElementById('ai-configDialog')),
        serverList: /** @type {HTMLSelectElement} */ (document.getElementById('ai-config-serverList')),
        serverForm: /** @type {HTMLDivElement} */ (document.getElementById('ai-config-serverForm')),
        serverName: /** @type {HTMLInputElement} */ (document.getElementById('ai-config-serverName')),
        serverUrl: /** @type {HTMLInputElement} */ (document.getElementById('ai-config-serverUrl')),
        serverKey: /** @type {HTMLInputElement} */ (document.getElementById('ai-config-serverKey')),
        serverModels: /** @type {HTMLInputElement} */ (document.getElementById('ai-config-serverModels')),
        addServerBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-addserver')),
        saveServerBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-saveServer')),
        cancelServerBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-cancelServerEdit')),
        deleteServerBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-deleteServer')),
        
        botList: /** @type {HTMLSelectElement} */ (document.getElementById('ai-config-botList')),
        botForm: /** @type {HTMLDivElement} */ (document.getElementById('ai-config-botForm')),
        botName: /** @type {HTMLInputElement} */ (document.getElementById('ai-config-botName')),
        botServer: /** @type {HTMLSelectElement} */ (document.getElementById('ai-config-botServer')),
        botModel: /** @type {HTMLSelectElement} */ (document.getElementById('ai-config-botModel')),
        systemPrompt: /** @type {HTMLTextAreaElement} */ (document.getElementById('ai-config-systemPrompt')),
        addBotBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-addBot')),
        saveBotBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-saveBot')),
        cancelBotBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-cancelBotEdit')),
        deleteBotBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-deleteBot')),
        
        exportBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-exportConfig')),
        importBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-import')),
        importFile: /** @type {HTMLInputElement} */ (document.getElementById('ai-config-importFile')),
        closeBtn: /** @type {HTMLButtonElement} */ (document.getElementById('ai-config-closeDialog'))
    };

    /** @type {{ servers: Record<string, any>, bots: Record<string, any>, curBot: string }} */ // @ts-ignore
    #currentSettings = {};
    #editingServerName = null;
    #editingBotName = null;

    constructor() {

        // 初始化配置
        this.#initializeSettings();
        this.#bindEvents();
    }

    #initializeSettings() {
        const storedSettings = storageManager.aisettings;
        if (storedSettings && (Object.keys(storedSettings.servers).length > 0)) {
            // 合并默认配置和存储的配置，保留存储的key值
            const mergedServers = {};
            
            // 首先处理默认配置
            for (const [serverName, serverConfig] of Object.entries(defaultConfig.server)) {
                mergedServers[serverName] = {
                    ...serverConfig,
                    // 如果存储中有相同的server且key不为空，则使用存储的key
                    key: (storedSettings.servers[serverName]?.key || '')
                };
            }
            
            // 然后添加存储中独有的服务器配置
            for (const [serverName, serverConfig] of Object.entries(storedSettings.servers)) {
                if (!mergedServers[serverName]) {
                    mergedServers[serverName] = serverConfig;
                }
            }
            
            this.#currentSettings = {
                servers: mergedServers,
                bots: storedSettings.bots || { ...defaultConfig.bot },
                curBot: storedSettings.curBot || defaultConfig.curBot
            };
        } else {
            this.#currentSettings = {
                servers: { ...defaultConfig.server },
                bots: { ...defaultConfig.bot },
                curBot: defaultConfig.curBot
            };
        }
        
        storageManager.updateAISettings(this.#currentSettings);
    }

    #bindEvents() {
        this.#elements.closeBtn.addEventListener('click', () => this.close());
        this.#elements.addServerBtn.addEventListener('click', () => this.#showServerForm());
        this.#elements.saveServerBtn.addEventListener('click', () => this.#saveServer());
        this.#elements.cancelServerBtn.addEventListener('click', () => this.#hideServerForm());
        this.#elements.deleteServerBtn.addEventListener('click', () => this.#deleteServer());
        this.#elements.serverList.addEventListener('change', () => this.#onServerSelected());
        
        // Bot相关事件
        this.#elements.addBotBtn.addEventListener('click', () => this.#showBotForm());
        this.#elements.saveBotBtn.addEventListener('click', () => this.#saveBot());
        this.#elements.cancelBotBtn.addEventListener('click', () => this.#hideBotForm());
        this.#elements.deleteBotBtn.addEventListener('click', () => this.#deleteBot());
        this.#elements.botList.addEventListener('change', () => this.#onBotSelected());
        this.#elements.botServer.addEventListener('change', () => this.#updateModelsList());
        
        // 导入导出
        this.#elements.exportBtn.addEventListener('click', () => this.#exportConfig());
        this.#elements.importBtn.addEventListener('click', () => this.#elements.importFile.click());
        this.#elements.importFile.addEventListener('change', (e) => this.#importConfig(e));
    }

    show() {
        this.#populateServerList();
        this.#populateBotList();
        this.#hideServerForm();
        this.#hideBotForm();
        this.#elements.dialog.showModal();
    }

    #populateServerList() {
        const serverList = this.#elements.serverList;
        serverList.innerHTML = '<option value="">选择服务器</option>';
        
        Object.entries(this.#currentSettings.servers).forEach(([name, server]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = server.name;
            serverList.appendChild(option);
        });
    }

    #populateBotList() {
        const botList = this.#elements.botList;
        botList.innerHTML = '<option value="">选择Bot</option>';
        
        Object.entries(this.#currentSettings.bots).forEach(([name, bot]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = bot.name;
            botList.appendChild(option);
        });
    }

    #showServerForm(clear = true) {
        if (clear) {
            this.#editingServerName = null;
            this.#elements.serverName.value = '';
            this.#elements.serverUrl.value = '';
            this.#elements.serverKey.value = '';
            this.#elements.serverModels.value = '';
            this.#elements.serverName.disabled = false;
            this.#elements.deleteServerBtn.style.display = 'none';
        }
        this.#elements.serverForm.style.display = 'block';
    }

    #hideServerForm() {
        this.#elements.serverForm.style.display = 'none';
        this.#editingServerName = null;
    }

    #onServerSelected() {
        const serverName = this.#elements.serverList.value;
        if (!serverName) {
            this.#hideServerForm();
            return;
        }

        const server = this.#currentSettings.servers[serverName];
        if (server) {
            // @ts-ignore
            this.#editingServerName = serverName;
            this.#elements.serverName.value = server.name;
            this.#elements.serverName.disabled = true; // 修改时禁用 name
            this.#elements.serverUrl.value = server.url || '';
            this.#elements.serverKey.value = server.key || '';
            this.#elements.serverModels.value = Array.isArray(server.models) ? server.models.join(', ') : '';
            this.#elements.deleteServerBtn.style.display = 'inline-block';
            this.#showServerForm(false);
        }
    }

    #saveServer() {
        const name = this.#elements.serverName.value.trim();
        if (!name) {
            alert('请输入服务器名称');
            return;
        }

        const url = this.#elements.serverUrl.value.trim();
        if (!url) {
            alert('请输入服务器URL');
            return;
        }

        const modelsText = this.#elements.serverModels.value.trim();
        const models = modelsText ? modelsText.split(',').map(m => m.trim()).filter(Boolean) : [];

        const newServer = {
            name,
            url,
            key: this.#elements.serverKey.value.trim(),
            models
        };

        if (this.#editingServerName) {
            // 更新现有服务器（name 不变）
            this.#currentSettings.servers[this.#editingServerName] = {
                ...this.#currentSettings.servers[this.#editingServerName],
                url,
                key: newServer.key,
                models
            };
        } else {
            // 添加新服务器
            if (this.#currentSettings.servers[name]) {
                alert('服务器名称已存在');
                return;
            }
            this.#currentSettings.servers[name] = newServer;
        }

        storageManager.updateAISettings(this.#currentSettings);
        this.#populateServerList();
        this.#hideServerForm();
        this.#elements.serverList.value = name;
    }

    #deleteServer() {
        if (!this.#editingServerName) return;

        // 检查是否有 Bot 使用此服务器
        const isServerUsed = Object.values(this.#currentSettings.bots).some(bot => bot.server === this.#editingServerName);
        if (isServerUsed) {
            alert('此服务器正在被 Bot 使用，无法删除');
            return;
        }

        const confirmed = confirm(`确定要删除服务器 "${this.#editingServerName}" 吗？`);
        if (!confirmed) return;

        delete this.#currentSettings.servers[this.#editingServerName];
        storageManager.updateAISettings(this.#currentSettings);
        this.#hideServerForm();
        this.#populateServerList();
    }

    #showBotForm(clear = true) {
        if (clear) {
            this.#editingBotName = null;
            this.#elements.botName.value = '';
            this.#elements.botServer.selectedIndex = 0;
            this.#elements.botModel.innerHTML = '<option value="">请先选择服务器</option>';
            this.#elements.systemPrompt.value = '';
            this.#elements.botName.disabled = false;
            this.#elements.deleteBotBtn.style.display = 'none';
            this.#updateServerDropdown();
        }
        this.#elements.botForm.style.display = 'block';
    }

    #hideBotForm() {
        this.#elements.botForm.style.display = 'none';
        this.#editingBotName = null;
    }

    #updateServerDropdown() {
        const serverSelect = this.#elements.botServer;
        serverSelect.innerHTML = '<option value="">选择服务器</option>';
        
        Object.entries(this.#currentSettings.servers).forEach(([name, server]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = server.name;
            serverSelect.appendChild(option);
        });
    }

    #updateModelsList() {
        const serverName = this.#elements.botServer.value;
        const modelSelect = this.#elements.botModel;
        modelSelect.innerHTML = '';

        if (!serverName) {
            modelSelect.innerHTML = '<option value="">请先选择服务器</option>';
            return;
        }

        const server = this.#currentSettings.servers[serverName];
        if (!server || !Array.isArray(server.models) || server.models.length === 0) {
            modelSelect.innerHTML = '<option value="">没有可用模型</option>';
            return;
        }

        modelSelect.innerHTML = '<option value="">选择模型</option>';
        server.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }

    #onBotSelected() {
        const botName = this.#elements.botList.value;
        if (!botName) {
            this.#hideBotForm();
            return;
        }

        const bot = this.#currentSettings.bots[botName];
        if (bot) {
            // @ts-ignore
            this.#editingBotName = botName;
            this.#elements.botName.value = bot.name;
            this.#elements.botName.disabled = true; // 修改时禁用 name
            this.#updateServerDropdown();
            this.#elements.botServer.value = bot.server || '';
            this.#updateModelsList();
            this.#elements.botModel.value = bot.model || '';
            this.#elements.systemPrompt.value = bot.systemPrompt || '';
            this.#elements.deleteBotBtn.style.display = 'inline-block';
            this.#showBotForm(false);
        }
    }

    #saveBot() {
        const name = this.#elements.botName.value.trim();
        if (!name) {
            alert('请输入Bot名称');
            return;
        }

        const server = this.#elements.botServer.value;
        if (!server) {
            alert('请选择服务器');
            return;
        }

        const model = this.#elements.botModel.value;
        if (!model) {
            alert('请选择模型');
            return;
        }

        const newBot = {
            name,
            server,
            model,
            systemPrompt: this.#elements.systemPrompt.value.trim()
        };

        if (this.#editingBotName) {
            // 更新现有 Bot（name 不变）
            this.#currentSettings.bots[this.#editingBotName] = {
                ...this.#currentSettings.bots[this.#editingBotName],
                server,
                model,
                systemPrompt: newBot.systemPrompt
            };
        } else {
            // 添加新 Bot
            if (this.#currentSettings.bots[name]) {
                alert('Bot名称已存在');
                return;
            }
            this.#currentSettings.bots[name] = newBot;
        }

        storageManager.updateAISettings(this.#currentSettings);
        this.#populateBotList();
        this.#hideBotForm();
        this.#elements.botList.value = name;
    }

    #deleteBot() {
        if (!this.#editingBotName) return;

        const confirmed = confirm(`确定要删除Bot "${this.#editingBotName}" 吗？`);
        if (!confirmed) return;

        delete this.#currentSettings.bots[this.#editingBotName];
        storageManager.updateAISettings(this.#currentSettings);
        this.#hideBotForm();
        this.#populateBotList();
    }

    #exportConfig() {
        const dataStr = JSON.stringify(this.#currentSettings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-config.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    #importConfig(event) {
        const file = /** @type {HTMLInputElement} */ (event.target).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(/** @type {string} */ (e.target?.result));
                if (!config.servers || !config.bots) {
                    throw new Error('导入的配置文件格式无效');
                }

                this.#currentSettings = config;
                storageManager.updateAISettings(this.#currentSettings);
                this.#populateServerList();
                this.#populateBotList();
                alert('配置导入成功');
            } catch (err) {
                alert(`导入失败: ${err.message}`);
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // 清空文件输入
    }

    save() {
        storageManager.updateAISettings(this.#currentSettings);
    }

    close() {
        this.save();
        this.#elements.dialog.close();
    }
}

// 导出单例
export default new AIConfigDialog();
