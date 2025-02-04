let currentClozeNumber = 1;
let sessions = [];
let currentSessionId = null;

// 初始化
function init() {
    loadSessions();
    if (sessions.length === 0) {
        addNewSession();
    }
    document.getElementById('editor').addEventListener('input', renderPreview);

    // 绑定按钮事件
    document.getElementById('saveDeckInfoBtn').addEventListener('click', saveYamlFile);
    document.getElementById('openYamlFileBtn').addEventListener('click', openYamlFile);
    document.getElementById('wrapClozeBtn').addEventListener('click', wrapCloze);
    document.getElementById('nextClozeBtn').addEventListener('click', nextCloze);
    document.getElementById('formatBoldBtn').addEventListener('click', () => formatText('bold'));
    document.getElementById('formatItalicBtn').addEventListener('click', () => formatText('italic'));
    document.getElementById('toHtmlBtn').addEventListener('click', sessionContent2Html);
    
    document.getElementById('addNewSessionBtn').addEventListener('click', addNewSession);
    document.getElementById('selectAllBtn').addEventListener('click', toggleSelectAll);
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);

    // 事件委托：处理 session 列表的点击事件
    document.getElementById('session-list').addEventListener('click', (event) => {
        // Use closest with a more specific selector
        const sessionContent = event.target.closest('li > .session-content'); // More specific!
        const editButton = event.target.closest('.edit-title-btn');
        const checkbox = event.target.closest('.session-checkbox');
    
        if (editButton) {
            const id = editButton.getAttribute('data-id');
            editSessionTitle(id, event);
        } else if (sessionContent) {  // Clicked directly on the session content (not children)
            const id = sessionContent.closest('li').getAttribute('data-id');
            selectSession(id);
        } else if (checkbox) {
            updateSelectedState();
        }
    });
    

    // 同步滚动 editor 和 preview
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    editor.addEventListener('scroll', () => {
        const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
    });
}


// 加载 sessions
function loadSessions() {
    document.getElementById('deckId').value = localStorage.getItem('deckId');
    document.getElementById('deckName').value = localStorage.getItem('deckName');
    const savedSessions = localStorage.getItem('sessions');
    if (savedSessions) {
        sessions = JSON.parse(savedSessions);
        renderSessionList();
        if (sessions.length > 0) {
            selectSession(sessions[0].id);
        }
    }
}

// 保存 sessions
function saveSessions() {
    localStorage.setItem('deckId', document.getElementById('deckId').value);
    localStorage.setItem('deckName', document.getElementById('deckName').value);
    localStorage.setItem('sessions', JSON.stringify(sessions));
}

// 生成唯一 ID
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 添加新 session
function addNewSession() {
    const id = generateId();
    const timestamp = new Date().toLocaleString();
    sessions.push({
        id: id,
        title: `新 Session ${timestamp}`,
        content: '',
    });
    renderSessionList();
    selectSession(id);
    saveSessions();
}

// 渲染 session 列表
function renderSessionList() {
    const list = document.getElementById('session-list');
    list.innerHTML = sessions.map(session => {
        const isChecked = false;//currentSessionId === session.id; // Check if the session is currently selected
        return `
            <li data-id="${session.id}" ${isChecked ? 'class="selected"' : ''}>
                <input type="checkbox" class="session-checkbox" ${isChecked ? 'checked' : ''}>
                <div class="session-content">
                    <span>${session.title}</span>
                    <button class="edit-title-btn" data-id="${session.id}">编辑</button>
                </div>
            </li>
        `;
    }).join('');
    updateSelectedState(); // Ensure delete button visibility is updated
}

function sessionContent2Html() {
    const session = sessions.find((s) => s.id === currentSessionId);
    if (session) {
        session.content = md2Html(session.content);
        session.format = 'html';
        document.getElementById('editor').value = session.content;
        renderPreview();
    }
}

// 选择 session
function selectSession(id) {
    currentSessionId = id;
    const session = sessions.find((s) => s.id === id);
    if (session) {
        document.getElementById('editor').value = session.content;
        renderPreview();
    }

    // 更新 session 列表选中状态
    renderSessionList();

    // 更新复选框状态和删除按钮可见性
    updateSelectedState(); // This should be called here to ensure consistency
}

// 编辑 session 标题
function editSessionTitle(id, event) {
    event.stopPropagation();
    const li = event.target.closest('li');
    const session = sessions.find((s) => s.id === id);
    const currentTitle = session.title;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.style.width = '100px';
    li.textContent = '';
    li.appendChild(input);
    input.focus();

    input.addEventListener('blur', () => {
        saveSessionTitle(id, input.value);
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveSessionTitle(id, input.value);
        }
    });
}

// 保存 session 标题
function saveSessionTitle(id, newTitle) {
    if (newTitle.trim() === '') return;
    const session = sessions.find((s) => s.id === id);
    session.title = newTitle.trim();
    renderSessionList();
    saveSessions();
}


// 渲染预览
function renderPreview() {
    const markdownText = document.getElementById('editor').value;
    let htmlContent = marked.parse(markdownText);

    // Regular expression to find Anki clozes
    const clozeRegex = /\{\{c\d+::(.*?)\}\}/g; // Matches {{c#::content}}

    // Replace cloze syntax with highlighted spans
    htmlContent = htmlContent.replace(clozeRegex, '<span class="cloze-highlight">$1</span>'); // $1 = matching group

    document.getElementById('preview').innerHTML = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['br', 'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'code'],
        ADD_ATTR: ['class'], // Allow class attribute for styling
    });

    MathJax.typesetPromise().then(() => {
        console.log('MathJax rendering complete');
    }).catch((err) => {
        console.error('MathJax rendering error', err);
    });
    saveCurrentSessionContent();
}

// 保存当前 session 内容
function saveCurrentSessionContent() {
    if (!currentSessionId) return;
    const session = sessions.find((s) => s.id === currentSessionId);
    session.content = document.getElementById('editor').value;
    saveSessions();
}

// 全选/取消全选
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.session-checkbox');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
    });
    
    selectAllBtn.textContent = allChecked ? '全选' : '取消全选';
    updateSelectedState();
}

// 删除选中的 sessions
function deleteSelected() {
    const selectedIds = Array.from(document.querySelectorAll('.session-checkbox:checked'))
        .map(checkbox => checkbox.closest('li').getAttribute('data-id'));
    
    if (selectedIds.length === 0) {
        alert('请选择要删除的 Session');
        return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个 Session 吗？`)) {
        return;
    }

    // 如果当前选中的 session 在待删除列表中，需要选择新的当前 session
    const currentWillBeDeleted = selectedIds.includes(currentSessionId);
    
    // 从数组中移除选中的 sessions
    sessions = sessions.filter(session => !selectedIds.includes(session.id));
    
    // 如果没有剩余的 sessions，创建一个新的
    if (sessions.length === 0) {
        addNewSession();
    } else if (currentWillBeDeleted) {
        // 如果当前 session 被删除，选择第一个可用的 session
        selectSession(sessions[0].id);
    }
    
    saveSessions();
    renderSessionList();
}

// 更新选中状态
function updateSelectedState() {
    const checkboxes = document.querySelectorAll('.session-checkbox');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    
    selectAllBtn.textContent = allChecked ? '取消全选' : '全选';
    document.getElementById('deleteSelectedBtn').style.display = anyChecked ? 'block' : 'none';
}

// Cloze 处理
function wrapCloze() {
    const editor = document.getElementById('editor');
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (selectedText.trim() === '') return;
        const cloze = `{{c${currentClozeNumber}::${selectedText}}}`;
        range.deleteContents();
        const textNode = document.createTextNode(cloze);
        range.insertNode(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        currentClozeNumber++;
        saveCurrentSessionContent();
    }
}

function nextCloze() {
    currentClozeNumber = 1;
}

// 格式工具
function formatText(command) {
    const editor = document.getElementById('editor');
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (selectedText.trim() === '') return;

        let formattedText;
        if (command === 'bold') {
            formattedText = `**${selectedText}**`;
        } else if (command === 'italic') {
            formattedText = `*${selectedText}*`;
        }

        range.deleteContents();
        const textNode = document.createTextNode(formattedText);
        range.insertNode(textNode);
        saveCurrentSessionContent();
    }
}

function md2Html(mdText){
    htmlContent = marked.parse(mdText, {
        breaks: true,
        gfm: true  // 启用 GitHub Flavored Markdown，支持表格
    });

    // 处理 Anki cloze 语法
    const clozeRegex = /\{\{c\d+::(.*?)\}\}/g;
    htmlContent = htmlContent.replace(clozeRegex, '{{c1::$1}}');

    // 使用 DOMPurify 清理 HTML，添加表格相关标签
    htmlContent = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: [
            // 基本标签
            'br', 'p', 'div', 'strong', 'em', 'code', 'span',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            // 表格相关标签
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        ALLOWED_ATTR: ['class', 'style']  // 允许 style 属性以支持表格边框等样式
    });

    // 可以添加默认的表格样式
    htmlContent = htmlContent.replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%;">');
    htmlContent = htmlContent.replace(/<t[hd]/g, '<$& style="border: 1px solid #ddd; padding: 8px;">');

    return htmlContent;
}

// 打开 YAML 文件
function openYamlFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            document.getElementById('session-list').innerHTML = "<li>Loading...</li>";

            try {
                const parsedContent = jsyaml.load(content);
                sessions = [];
                parsedContent.forEach((item) => {
                    if (item.deckId) {
                        document.getElementById('deckId').value = item.deckId;
                    }
                    else if (item.deckName) {
                        document.getElementById('deckName').value = item.deckName;
                    }
                    else {
                        // 使用 marked 转换 Markdown（包括表格）
                        let htmlContent = item.format === 'html' ? item.content : md2Html(item.content);
                        sessions.push({
                            id: generateId(),
                            title: item.title,
                            content: htmlContent,
                            rawContent: item.content,
                            format: 'html'  // 添加格式标记
                        });
                    }
                });

                renderSessionList();
                if (sessions.length > 0) {
                    selectSession(sessions[0].id);
                }
            } catch (error) {
                console.error('YAML 解析错误:', error);
                document.getElementById('session-list').innerHTML = "<li>Error loading YAML</li>"; // Display error message
            }
        };
        reader.readAsText(file);
    };
    

    input.click();
}


// 保存Deck信息
function saveYamlFile() {
    // Get deck info and sessions data
    const deckId = document.getElementById('deckId').value;
    const deckName = document.getElementById('deckName').value;
    
    // Create YAML structure
    const yamlData = [
        { deckId: deckId },
        { deckName: deckName },
        ...sessions.map(session => ({
            title: session.title,
            content: session.content,
            format: session.format
        }))
    ];
    
    // Convert to YAML string
    const yamlString = jsyaml.dump(yamlData);
    
    // Create and download file
    const blob = new Blob([yamlString], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deckName || 'deck'}.yaml`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Still save to localStorage if needed
    localStorage.setItem('deckId', deckId);
    localStorage.setItem('deckName', deckName);
}

// 初始化执行
init();