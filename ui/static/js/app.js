// Global copy handler for IDE code blocks
window._copyCode = function(btn, preId) {
    const pre = document.getElementById(preId);
    if (!pre) return;
    const text = pre.textContent || pre.innerText;
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '[COPIED]';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '[COPY]'; btn.classList.remove('copied'); }, 1500);
    }).catch(() => {});
};

function _buildAppData() {
    return {
        // ========== MODULE SPREADS (loaded from js/modules/*.js) ==========
        ...window.AppUtils,
        ...window.AppThemes,
        ...window.AppRenderer,
        ...window.AppLab,

        // ========== STATE ==========
        section: 'chat',  // top-level: 'lab' or 'chat'
        page: 'dashboard',  // lab sub-page
        stats: { score_trend: [], type_distribution: {} },
        experiments: [],
        selectedExp: null,
        selectedExpData: null,
        expLoading: false,
        expDetailTab: 'output',
        fileDiffData: null,
        fileDiffLoading: false,
        expSearch: '',
        expFilterType: '',
        expPage: 0,
        compareMode: false,
        compareExps: [],
        compareData: {},
        compareLoading: false,
        config: { name: '', description: '', goals: [], constraints: [], tech_stack: [], focus_areas: [] },
        prompt: '',
        changesLog: '',
        promptSaving: false,
        configSaving: false,
        runConfig: { iterations: 10, timeout: 5, max_time: 600, project: '.', strategy: 'default', token_threshold: 100000 },
        runStatus: { running: false, current_exp: 0, total_exps: 0, started_at: null, recent_logs: [], error: null, tokens: null, session_id: null },
        researchWs: null,
        toast: { show: false, message: '', type: 'success' },
        chartHover: null,
        catSpeech: '',
        organismSVG: '',
        organismStage: 'DORMANT',
        runElapsed: '',
        settings: JSON.parse(localStorage.getItem('ar-settings') || '{"matrixRain":true,"crtEffect":true,"catCompanion":true,"theme":"synthwave","fontSize":16,"chatDensity":"comfortable","compactSidebar":false,"showThinking":false}'),
        _matrixRainStopped: false,

        // Chat state
        chatTabs: [],
        activeChatTab: null,
        chatWs: {},
        showTabLimitWarning: false,
        showSessionPickerModal: false,
        sessionPickerSearch: '',
        pastSessions: [],
        showNewSessionModal: false,
        newSessionPath: '.',
        chatTick: 0,
        chatBottomPanel: 'closed',
        chatBottomPanelHeight: 180,
        _panelResizing: false,

        // Slash command menu
        slashMenu: { show: false, items: [], filter: '', selected: 0, _tabId: null },
        chatDragOver: false,

        // Chat Search (Ctrl+F)
        chatSearch: { show: false, query: '', total: 0, current: 0, _elements: [] },

        // Live Log
        liveLog: [],
        liveLogFilter: 'all',
        liveLogAutoScroll: true,
        liveLogPaused: false,
        _liveLogMax: 500,

        // Command Palette (Ctrl+Shift+P)
        cmdPalette: { show: false, query: '', selected: 0, _results: [] },
        cmdPaletteCommands: [
            // Navigation
            { id: 'nav-dashboard', label: 'Research Lab: Dashboard', shortcut: 'Alt+3', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('dashboard')); } },
            { id: 'nav-experiments', label: 'Research Lab: Experiments', shortcut: 'Alt+4', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('experiments')); } },
            { id: 'nav-changes', label: 'Research Lab: Changelog', shortcut: 'Alt+5', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('changes')); } },
            { id: 'nav-prompt', label: 'Research Lab: Prompt Editor', shortcut: 'Alt+6', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('prompt')); } },
            { id: 'nav-config', label: 'Research Lab: Config', shortcut: 'Alt+7', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('config')); } },
            { id: 'nav-run', label: 'Research Lab: Run Experiment', shortcut: 'Alt+8', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('run')); } },
            { id: 'nav-settings', label: 'Settings', shortcut: 'Alt+9', category: 'NAV', action: () => { this.navigateSection('lab'); this.$nextTick(() => this.navigate('settings')); } },
            { id: 'nav-lab', label: 'Switch to Research Lab', shortcut: 'Alt+1', category: 'NAV', action: () => this.navigateSection('lab') },
            { id: 'nav-chat', label: 'Switch to Chat', shortcut: 'Alt+2', category: 'NAV', action: () => this.navigateSection('chat') },
            // Chat actions
            { id: 'chat-new', label: 'Chat: New Session', category: 'CHAT', action: () => { if (this.section !== 'chat') this.navigateSection('chat'); this.$nextTick(() => this.openFileBrowserForTab()); } },
            { id: 'chat-clear', label: 'Chat: Clear Messages', category: 'CHAT', action: () => { if (this.activeTab) this.clearActiveChat(); } },
            { id: 'chat-export', label: 'Chat: Export as Markdown', category: 'CHAT', action: () => { if (this.activeTab) this.exportActiveChat(); } },
            { id: 'chat-resume', label: 'Chat: Resume Session', category: 'CHAT', action: () => { if (this.section !== 'chat') this.navigateSection('chat'); this.$nextTick(() => this.showSessionPicker()); } },
            // Themes
            { id: 'theme-synthwave', label: 'Theme: Synthwave', category: 'THEME', action: () => { this.settings.theme = 'synthwave'; localStorage.setItem('ar-settings', JSON.stringify(this.settings)); this.applySettings(); this.showToast('Synthwave'); } },
            { id: 'theme-darcula', label: 'Theme: Darcula (JetBrains)', category: 'THEME', action: () => { this.settings.theme = 'darcula'; localStorage.setItem('ar-settings', JSON.stringify(this.settings)); this.applySettings(); this.showToast('Darcula'); } },
            { id: 'theme-one-dark', label: 'Theme: One Dark (Atom)', category: 'THEME', action: () => { this.settings.theme = 'one-dark'; localStorage.setItem('ar-settings', JSON.stringify(this.settings)); this.applySettings(); this.showToast('One Dark'); } },
            { id: 'theme-dracula', label: 'Theme: Dracula', category: 'THEME', action: () => { this.settings.theme = 'dracula'; localStorage.setItem('ar-settings', JSON.stringify(this.settings)); this.applySettings(); this.showToast('Dracula'); } },
            // Settings toggles
            { id: 'toggle-matrix', label: 'Toggle: Matrix Rain', category: 'TOGGLE', action: () => this.toggleSetting('matrixRain') },
            { id: 'toggle-crt', label: 'Toggle: CRT Effect', category: 'TOGGLE', action: () => this.toggleSetting('crtEffect') },
            { id: 'toggle-cat', label: 'Toggle: Cat Companion', category: 'TOGGLE', action: () => this.toggleSetting('catCompanion') },
            { id: 'toggle-sidebar', label: 'Toggle: Compact Sidebar', category: 'TOGGLE', action: () => this.toggleSetting('compactSidebar') },
            { id: 'toggle-thinking', label: 'Toggle: Show Thinking Blocks', category: 'TOGGLE', action: () => this.toggleSetting('showThinking') },
        ],
        slashCommands: [
            { cmd: '/clear', desc: 'Очистить чат', action: 'clear' },
            { cmd: '/export', desc: 'Экспорт в Markdown', action: 'export' },
            { cmd: '/cancel', desc: 'Остановить генерацию', action: 'cancel' },
            { cmd: '/compact', desc: 'Компактный режим', action: 'compact' },
            { cmd: '/help', desc: 'Показать команды', action: 'help' },
        ],

        // ========== COMPUTED PROPERTIES ==========
        get filteredExperiments() {
            let list = this.experiments || [];
            if (this.expSearch) { const q = this.expSearch.toLowerCase(); list = list.filter(e => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || String(e.number).includes(q)); }
            if (this.expFilterType) list = list.filter(e => e.type === this.expFilterType);
            return list;
        },
        get expTotalPages() { return Math.max(1, Math.ceil(this.filteredExperiments.length / 50)); },
        get paginatedExperiments() { const s = this.expPage * 50; return this.filteredExperiments.slice(s, s + 50); },
        get filteredPastSessions() {
            if (!this.sessionPickerSearch) return this.pastSessions;
            const q = this.sessionPickerSearch.toLowerCase();
            return this.pastSessions.filter(s =>
                s.project_path.toLowerCase().includes(q) ||
                s.topic_preview.toLowerCase().includes(q)
            );
        },
        get activeTab() {
            return this.chatTabs.find(t => t.tab_id === this.activeChatTab) || null;
        },

        // Pet events tracking
        _lastExpCount: 0,

        // ========== INIT ==========
        async init() {
            console.log('[app] init() called, section=' + this.section + ' page=' + this.page);
            // Migrate: add missing settings fields for older localStorage
            let migrated = false;
            if (this.settings.fontSize === undefined) { this.settings.fontSize = 16; migrated = true; }
            if (this.settings.chatDensity === undefined) { this.settings.chatDensity = 'comfortable'; migrated = true; }
            if (this.settings.compactSidebar === undefined) { this.settings.compactSidebar = false; migrated = true; }
            if (this.settings.showThinking === undefined) { this.settings.showThinking = false; migrated = true; }
            if (migrated) localStorage.setItem('ar-settings', JSON.stringify(this.settings));
            this.applySettings();
            window._app = this;
            if (this.settings.matrixRain && window.MatrixRain) MatrixRain.init();
            await Promise.all([this.loadStats(), this.loadExperiments()]);
            this._lastExpCount = this.stats.total_experiments || 0;
            this.$nextTick(() => {
                setTimeout(() => {
                    if (window.CatModule && !CatModule.isActive()) {
                        const el = document.getElementById('cat-canvas');
                        if (el) CatModule.start(el, 'neutral', 4);
                    }
                }, 100);
            });
            setInterval(async () => {
                if (this.page === 'dashboard') await this.loadStats();
                if (this.page === 'run') await this.pollRunStatus();
                if (window.CatModule && CatModule.isActive()) {
                    this.catSpeech = CatModule.getSpeech();
                }
                if (this.runStatus.running && this.runStatus.started_at) {
                    const diff = Math.floor((Date.now() - new Date(this.runStatus.started_at).getTime()) / 1000);
                    const m = String(Math.floor(diff / 60)).padStart(2, '0');
                    const s = String(diff % 60).padStart(2, '0');
                    this.runElapsed = m + ':' + s;
                } else if (!this.runStatus.running) {
                    this.runElapsed = '';
                }
            }, 1000);

            // Keyboard shortcuts
            const LAB_PAGES = ['dashboard', 'experiments', 'changes', 'prompt', 'config', 'run', 'settings'];
            window.addEventListener('keydown', (e) => {
                if (e.altKey && e.key === '1') { e.preventDefault(); this.navigateSection('lab'); }
                if (e.altKey && e.key === '2') { e.preventDefault(); this.navigateSection('chat'); }
                if (e.altKey && e.key >= '3' && e.key <= '9') {
                    e.preventDefault();
                    this.navigateSection('lab');
                    this.$nextTick(() => this.navigate(LAB_PAGES[parseInt(e.key) - 3]));
                }
                if (e.key === 'Escape' && this.selectedExp !== null) {
                    this.selectedExp = null; this.selectedExpData = null;
                }
                if (e.key === '/' && this.page === 'experiments' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                    e.preventDefault();
                    const searchEl = document.querySelector('input[placeholder="SEARCH_"]');
                    if (searchEl) searchEl.focus();
                }
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                    e.preventDefault();
                    this.cmdPalette.show = !this.cmdPalette.show;
                    if (this.cmdPalette.show) {
                        this.cmdPalette.query = ''; this.cmdPalette.selected = 0;
                        this.$nextTick(() => { const inp = document.getElementById('cmd-palette-input'); if (inp) inp.focus(); });
                    }
                }
                if (e.key === 'Escape' && this.cmdPalette.show) { this.cmdPalette.show = false; }
                if ((e.ctrlKey || e.metaKey) && e.key === 'f' && this.section === 'chat' && this.activeTab) {
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                    e.preventDefault();
                    this.openChatSearch();
                }
                if (e.key === 'Escape' && this.chatSearch.show) { this.closeChatSearch(); }
                if (e.key === 'Enter' && this.chatSearch.show && document.activeElement.id === 'chat-search-input') {
                    e.preventDefault();
                    this.navigateChatMatch(e.shiftKey ? -1 : 1);
                }
            });
        },

        // ========== NAVIGATION ==========
        navigateSection(section) {
            this.section = section;
            if (section === 'lab' && !this.page) this.page = 'dashboard';
            if (section === 'chat') this.page = '';
            if (window.CatModule && CatModule.isActive()) {
                if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                if (section === 'lab') CatModule.setSpeechText('Research mode_ *прищурился*', 3000);
                else { CatModule.setSpeechText('Chat mode! *мурлычет*', 3000); CatModule.setPage('chat'); }
            }
        },

        navigate(page) {
            this.page = page; this.selectedExp = null; this.selectedExpData = null;
            if (page === 'experiments') { this.loadExperiments(); this.expPage = 0; }
            if (page === 'changes') this.loadChangesLog();
            if (page === 'prompt') this.loadPrompt();
            if (page === 'config') this.loadConfig();
            if (page === 'dashboard') this.loadStats();
            if (page === 'run') { this.pollRunStatus(); if (this.runStatus.running) this.connectResearchWs(); }
            if (page !== 'run') this.disconnectResearchWs();
            if (window.CatModule && CatModule.isActive() && CatModule.setPage) { CatModule.setPage(page); }
            if (window.CatModule && CatModule.isActive()) {
                const tips = {
                    dashboard: ['Наблюдаю за метриками_', '*осматривается*', 'Всё под контролем!'],
                    experiments: ['Хмм, что тут интересного...', 'Ищешь баги?', 'Полезные были эти хаки!'],
                    changes: ['История мутаций_ *шуршит страницами*', 'Много чего натворили...'],
                    prompt: ['Секретные инструкции! *широко открывает глаза*', 'Правильный промпт — половина успеха!'],
                    config: ['Настройки режимов_', '*тычет лапой в параметры*'],
                    run: this.runStatus.running
                        ? ['Эксперимент идёт!', '*наблюдает за логами*', 'Работаю_ *концентрируется*']
                        : ['Нажми INITIATE чтобы начать_', 'Готов к запуску! Мяу!', 'Жду команду_'],
                    settings: ['Настройки! *интересно смотрит*', 'Можно отключить CRT эффект_', 'Тут всё настраивается!'],
                };
                CatModule.setExpression('thinking');
                if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                setTimeout(() => {
                    if (window.CatModule && CatModule.isActive()) {
                        CatModule.setExpression('neutral');
                        const pool = tips[page];
                        if (pool) {
                            const msg = pool[Math.floor(Math.random() * pool.length)];
                            CatModule.setSpeechText(msg, 5000);
                        }
                    }
                }, 800);
            }
        },

        // ========== CHAT: SESSIONS ==========
        async openFileBrowserForTab() {
            if (this.chatTabs.length >= 5) { this.showTabLimitWarning = true; return; }
            this.newSessionPath = '.';
            this.showNewSessionModal = true;
            this.$nextTick(() => {
                const input = this.$refs.newSessionInput;
                if (input) { input.focus(); input.select(); }
            });
        },

        async createSessionFromModal() {
            const path = (this.newSessionPath || '.').trim();
            if (!path) return;
            this.showNewSessionModal = false;
            await this.createChatTab(path);
        },

        async createChatTab(projectPath, resumeId) {
            console.log('[chat] createChatTab:', projectPath, 'resume:', resumeId);
            try {
                const res = await this.api('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cwd: projectPath, resume: resumeId || null }),
                });
                console.log('[chat] session created:', JSON.stringify(res));
                if (res.warning) this.showToast(res.warning, 'error');
                if (!res.session_id) { console.error('[chat] no session_id in response'); return; }
                const label = projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath;
                const tab = {
                    tab_id: 'tab-' + Date.now(),
                    session_id: res.session_id,
                    project_path: projectPath,
                    label: label,
                    messages: [],
                    is_active: true,
                    is_streaming: false,
                    is_thinking: false,
                    ws_state: 'connecting',
                    input_text: '',
                    scrolledUp: false,
                    created_at: new Date().toISOString(),
                    tokens: { input: 0, output: 0, cost: 0, threshold: 180000 },
                };
                this.chatTabs.push(tab);
                this.activeChatTab = tab.tab_id;
                this.connectChatWebSocket(tab);
                this.showToast('SESSION STARTED', 'success');
            } catch (e) {
                console.error('[chat] createChatTab failed:', e);
                this.showToast('SESSION FAILED: ' + e.message, 'error');
            }
        },

        activateChatTab(tabId) {
            this.activeChatTab = tabId;
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (tab) this.page = '';
            if (window.refitTerminal) refitTerminal(tabId);
        },

        async closeChatTab(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab) return;
            const ws = this.chatWs[tabId];
            if (ws) { try { ws.close(); } catch (e) { } delete this.chatWs[tabId]; }
            if (window.destroyTerminal) destroyTerminal(tabId);
            try { await this.api('/api/sessions/' + tab.session_id, { method: 'DELETE' }); } catch (e) { }
            this.chatTabs = this.chatTabs.filter(t => t.tab_id !== tabId);
            if (this.activeChatTab === tabId) {
                this.activeChatTab = this.chatTabs.length > 0 ? this.chatTabs[this.chatTabs.length - 1].tab_id : null;
            }
        },

        // ========== CHAT: WEBSOCKET ==========
        connectChatWebSocket(tab) {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const url = `${protocol}//${location.host}/ws/chat/${tab.session_id}`;
            console.log('[ws] connecting to:', url);
            const ws = new WebSocket(url);
            this.chatWs[tab.tab_id] = ws;
            const _app = this;

            ws.onopen = () => { tab.ws_state = 'connected'; _app.chatTick++; console.log('[ws] connected:', tab.session_id); };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('[ws]', msg.type, msg.event_type || '', '- data keys:', Object.keys(msg.data || {}).slice(0, 5).join(','));
                    if (msg.type === 'claude_event') {
                        const data = msg.data || {};
                        const etype = data.type || msg.event_type;
                        if (etype === 'text') {
                            const text = data.text || '';
                            if (text) {
                                tab.is_thinking = false;
                                if (tab._catThinking && window.CatModule && CatModule.isActive()) {
                                    tab._catThinking = false;
                                    CatModule.setExpression('neutral');
                                }
                                const lastMsg = tab.messages[tab.messages.length - 1];
                                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.is_streaming) {
                                    lastMsg.content += text;
                                } else {
                                    const thinkingContent = tab._thinkingBuffer || '';
                                    tab.messages.push({ role: 'assistant', content: text, thinking: thinkingContent || undefined, is_streaming: true, ts: Date.now() });
                                    tab._thinkingBuffer = '';
                                }
                                tab.is_streaming = true;
                                _app.chatTick++;
                            }
                        } else if (etype === 'thinking') {
                            tab.is_thinking = true;
                            tab.is_streaming = true;
                            const thinkingText = data.text || data.thinking || data.content || '';
                            if (thinkingText) {
                                tab._thinkingBuffer = (tab._thinkingBuffer || '') + thinkingText;
                            }
                            if (window.CatModule && CatModule.isActive() && !tab._catThinking) {
                                tab._catThinking = true;
                                CatModule.setExpression('thinking');
                                if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                            }
                            _app.chatTick++;
                        } else if (etype === 'assistant') {
                            const content = data.content;
                            let text = '';
                            let thinkingText = tab._thinkingBuffer || '';
                            let hasThinking = false;
                            if (Array.isArray(content)) {
                                for (const block of content) {
                                    if (block.text) text += block.text;
                                    if (block.thinking) { hasThinking = true; thinkingText += (thinkingText ? '\n---\n' : '') + block.thinking; }
                                }
                            } else if (typeof content === 'string') {
                                text = content;
                            }
                            if (hasThinking && !text) tab.is_thinking = true;
                            console.log('[ws] assistant extracted text:', JSON.stringify(text).slice(0, 200), 'len:', text.length, 'msgs before:', tab.messages.length);
                            if (text) {
                                tab.is_thinking = false;
                                const lastMsg = tab.messages[tab.messages.length - 1];
                                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.is_streaming) {
                                    lastMsg.content += text;
                                    if (thinkingText) lastMsg.thinking = (lastMsg.thinking ? lastMsg.thinking + '\n---\n' : '') + thinkingText;
                                } else {
                                    tab.messages.push({ role: 'assistant', content: text, thinking: thinkingText || undefined, is_streaming: true, ts: Date.now() });
                                }
                                tab._thinkingBuffer = '';
                                tab.is_streaming = true;
                                _app.chatTick++;
                            }
                        } else if (etype === 'tool') {
                            const name = data.name || (data.tool_name ? data.tool_name : 'tool_call');
                            const toolInput = data.input || data.tool_input || {};
                            const toolUse = data.tool_use || {};
                            const input = toolInput.input || toolUse.input || toolInput || {};
                            let toolType = 'other';
                            let toolDetail = '';
                            let toolPath = '';
                            const nameLower = (name || '').toLowerCase();
                            if (nameLower.includes('read') || nameLower.includes('read_file')) {
                                toolType = 'read';
                                const fp = input.file_path || input.path || '';
                                toolPath = fp;
                                toolDetail = fp.split(/[\\/]/).pop() || name;
                            } else if (nameLower.includes('edit') || nameLower.includes('write') || nameLower.includes('create_file')) {
                                toolType = nameLower.includes('edit') ? 'edit' : 'write';
                                const fp = input.file_path || input.path || '';
                                toolPath = fp;
                                toolDetail = fp.split(/[\\/]/).pop() || name;
                            } else if (nameLower.includes('bash') || nameLower.includes('command') || nameLower.includes('shell')) {
                                toolType = 'bash';
                                const cmd = (input.command || input.cmd || '');
                                toolDetail = cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
                            } else if (nameLower.includes('glob') || nameLower.includes('search') || nameLower.includes('grep')) {
                                toolType = 'search';
                                toolDetail = input.pattern || input.query || name;
                                if (input.path) toolPath = input.path;
                            } else {
                                toolDetail = name;
                            }
                            tab.messages.push({ role: 'tool', content: name, toolType, toolDetail, toolPath });
                            _app.chatTick++;
                        } else if (etype === 'result') {
                            const usage = data.usage || {};
                            if (usage.input_tokens) tab.tokens.input = usage.input_tokens;
                            if (usage.output_tokens) tab.tokens.output += usage.output_tokens;
                            if (data.total_cost_usd) tab.tokens.cost += data.total_cost_usd;
                            _app.chatTick++;
                        }
                    } else if (msg.type === 'stream_end') {
                        tab.is_streaming = false;
                        tab._catThinking = false;
                        const lastMsg = tab.messages[tab.messages.length - 1];
                        if (lastMsg) lastMsg.is_streaming = false;
                        if (window.CatModule && CatModule.isActive()) {
                            CatModule.setExpression('happy');
                            setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 2000);
                        }
                        _app.chatTick++;
                    } else if (msg.type === 'error') {
                        tab.messages.push({ role: 'assistant', content: '[ERROR] ' + (msg.message || 'Unknown error'), ts: Date.now() });
                        tab.is_streaming = false;
                        if (window.CatModule && CatModule.isActive()) {
                            CatModule.setExpression('surprised');
                            if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                            CatModule.setSpeechText('Мяу?! Ошибка!', 3000);
                            setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 3000);
                        }
                        _app.chatTick++;
                    }
                    setTimeout(() => _app.smartScroll(tab), 50);
                } catch (e) {
                    console.error('[ws parse]', e);
                }
            };

            ws.onclose = (e) => {
                console.log('[ws] closed:', tab.session_id, 'code:', e.code, 'reason:', e.reason);
                tab.is_streaming = false;
                tab.ws_state = 'disconnected';
                _app.chatTick++;
            };

            ws.onerror = (e) => {
                console.error('[ws] error:', tab.session_id, e);
                tab.messages.push({ role: 'assistant', content: '[ERROR] WebSocket connection failed', ts: Date.now() });
                tab.is_streaming = false;
                tab.ws_state = 'disconnected';
                _app.chatTick++;
            };
        },

        sendChatMessage(tab) {
            if (!tab.input_text?.trim() || tab.is_streaming) return;
            const content = tab.input_text.trim();
            tab.input_text = '';
            tab.scrolledUp = false;
            tab.messages.push({ role: 'user', content: content, id: 'msg-' + Date.now(), ts: Date.now() });
            this.chatTick++;
            setTimeout(() => {
                const el = document.getElementById('chat-messages-' + tab.tab_id);
                if (el) el.scrollTop = el.scrollHeight;
            }, 50);
            const ws = this.chatWs[tab.tab_id];
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'message', content: content }));
            } else {
                tab.messages.push({ role: 'assistant', content: '[ERROR] Not connected. Session may have ended.', ts: Date.now() });
                this.chatTick++;
            }
        },

        cancelChatStream(tab) {
            const ws = this.chatWs[tab.tab_id];
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'cancel' }));
            }
            tab.is_streaming = false;
        },

        // ========== CHAT: SLASH COMMANDS ==========
        handleChatInput(tab, e) {
            const text = (tab.input_text || '');
            if (text.startsWith('/')) {
                const query = text.slice(1).toLowerCase().split(' ')[0];
                if (query.length < 15) {
                    this.slashMenu.items = this.slashCommands.filter(c =>
                        c.cmd.slice(1).startsWith(query) || c.desc.toLowerCase().includes(query)
                    );
                    this.slashMenu.selected = 0;
                    this.slashMenu.show = this.slashMenu.items.length > 0;
                    this.slashMenu._tabId = tab.tab_id;
                    return;
                }
            }
            this.slashMenu.show = false;
        },

        handleChatKeydown(tab, e) {
            if (this.slashMenu.show && this.slashMenu._tabId === tab.tab_id) {
                if (e.key === 'ArrowDown') { e.preventDefault(); this.slashMenu.selected = Math.min(this.slashMenu.selected + 1, this.slashMenu.items.length - 1); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); this.slashMenu.selected = Math.max(this.slashMenu.selected - 1, 0); return; }
                if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); this.selectSlashCommand(this.slashMenu.items[this.slashMenu.selected]); return; }
                if (e.key === 'Escape') { e.preventDefault(); this.slashMenu.show = false; return; }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage(tab);
            }
        },

        selectSlashCommand(cmd) {
            if (!cmd) return;
            const tab = this.activeTab;
            if (!tab) return;
            tab.input_text = '';
            this.slashMenu.show = false;
            switch (cmd.action) {
                case 'clear': this.clearActiveChat(); break;
                case 'export': this.exportActiveChat(); break;
                case 'cancel': this.cancelChatStream(tab); break;
                case 'compact':
                    this.settings.chatDensity = this.settings.chatDensity === 'compact' ? 'comfortable' : 'compact';
                    localStorage.setItem('ar-settings', JSON.stringify(this.settings));
                    this.applySettings();
                    this.showToast('CHAT DENSITY: ' + this.settings.chatDensity.toUpperCase());
                    break;
                case 'help': {
                    const helpMsg = this.slashCommands.map(c => '`' + c.cmd + '` — ' + c.desc).join('\n');
                    tab.messages.push({ role: 'assistant', content: '**Доступные команды:**\n\n' + helpMsg + '\n\n_Перетащите файл в поле ввода для вставки содержимого_', ts: Date.now() });
                    this.chatTick++;
                    break;
                }
            }
            this.$nextTick(() => {
                const ta = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (ta) ta.focus();
            });
        },

        // ========== CHAT: FILE DRAG & DROP ==========
        async handleChatDrop(tab, e) {
            this.chatDragOver = false;
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            for (const file of files) {
                if (file.size > 500 * 1024) {
                    this.showToast('FILE TOO LARGE: ' + file.name + ' (max 500KB)', 'error');
                    continue;
                }
                try {
                    const text = await file.text();
                    const ext = file.name.split('.').pop().toLowerCase();
                    const langMap = { py: 'python', js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx', sh: 'bash', json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown', html: 'html', css: 'css', sql: 'sql', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c', rb: 'ruby', php: 'php' };
                    const lang = langMap[ext] || '';
                    const header = '**' + file.name + '** (' + this.formatFileSize(file.size) + '):\n';
                    const codeBlock = '```' + lang + '\n' + text + '\n```\n';
                    tab.input_text += (tab.input_text ? '\n' : '') + header + codeBlock;
                } catch (err) {
                    this.showToast('FAILED TO READ: ' + file.name, 'error');
                }
            }
            this.$nextTick(() => {
                const ta = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (ta) ta.focus();
            });
        },

        // ========== COMMAND PALETTE ==========
        get filteredCommands() {
            const q = this.cmdPalette.query.toLowerCase().trim();
            if (!q) return this.cmdPaletteCommands;
            return this.cmdPaletteCommands.filter(c =>
                c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || (c.id.toLowerCase().includes(q))
            );
        },
        openCmdPalette() {
            this.cmdPalette.show = true;
            this.cmdPalette.query = '';
            this.cmdPalette.selected = 0;
            this.$nextTick(() => {
                const inp = document.getElementById('cmd-palette-input');
                if (inp) inp.focus();
            });
        },
        closeCmdPalette() {
            this.cmdPalette.show = false;
        },
        executeCmdPalette() {
            const results = this.filteredCommands;
            if (results.length === 0) return;
            const cmd = results[this.cmdPalette.selected];
            if (!cmd) return;
            this.cmdPalette.show = false;
            if (cmd.action) cmd.action();
        },
        onCmdPaletteKeydown(e) {
            const results = this.filteredCommands;
            if (e.key === 'ArrowDown') { e.preventDefault(); this.cmdPalette.selected = Math.min(this.cmdPalette.selected + 1, results.length - 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.cmdPalette.selected = Math.max(this.cmdPalette.selected - 1, 0); }
            else if (e.key === 'Enter') { e.preventDefault(); this.executeCmdPalette(); }
        },

        // ========== CHAT: RENDER ==========
        renderChatHTML(tab) {
            const _ = this.chatTick;
            if (!tab || !tab.messages || tab.messages.length === 0) {
                return '<div style="display:flex;align-items:center;justify-content:center;height:100%;text-align:center">'
                    + '<div>'
                    + '<div style="font-size:10px;letter-spacing:0.2em;color:var(--v3);margin-bottom:8px">CLAUDE_CODE_SESSION</div>'
                    + '<div style="font-size:12px;color:var(--v3)">Target: ' + this.escHtml(tab?.project_path || '') + '</div>'
                    + '<div style="font-size:9px;color:var(--v3);margin-top:4px">Type a message to start_</div>'
                    + '</div></div>';
            }
            let html = '';
            const icons = { read: '&#x1f4d6;', edit: '&#x270f;', write: '&#x1f4be;', bash: '&#x2328;', search: '&#x1f50d;', other: '&#x2699;' };
            const colors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            const labels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'TOOL' };
            const avatarUser = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
            const avatarAsst = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
            const avatarTool = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
            const msgs = tab.messages;
            let i = 0;
            while (i < msgs.length) {
                const msg = msgs[i];
                if (msg.role === 'user') {
                    const uTime = this.fmtTime(msg.ts);
                    html += '<div class="msg-wrap chat-msg-fadein chat-msg-row chat-msg-row-user">'
                        + '<div class="chat-avatar chat-avatar-user">' + avatarUser + '</div>'
                        + '<div class="chat-body">'
                        + '<div class="msg-actions">'
                        + '<button class="act-copy" onclick="event.stopPropagation();window._app.copyChatMsg(\'' + tab.tab_id + '\',' + i + ')" title="Copy">COPY</button>'
                        + '<button class="act-edit" onclick="event.stopPropagation();window._app.editUserMsg(\'' + tab.tab_id + '\',' + i + ')" title="Edit & resend">EDIT</button>'
                        + '</div>'
                        + '<div class="chat-role chat-role-user">USER_' + (uTime ? ' <span style="color:var(--v3);font-weight:normal">' + uTime + '</span>' : '') + '</div>'
                        + '<div class="chat-bubble-user" style="max-width:100%;padding:var(--chat-msg-padding,8px 12px);font-size:inherit;color:var(--ng2)">'
                        + this.escHtml(msg.content || '')
                        + '</div></div></div>';
                    i++;
                } else if (msg.role === 'assistant') {
                    const cursorHtml = msg.is_streaming ? '<span class="streaming-cursor"></span>' : '';
                    const contentHtml = msg.is_streaming
                        ? '<div class="md">' + this.linkFilePaths(this.renderMarkdown(msg.content)) + cursorHtml + '</div>'
                        : '<div class="md">' + this.linkFilePaths(this.renderMarkdown(msg.content)) + '</div>';
                    const aTime = this.fmtTime(msg.ts);
                    const isLastAssistant = !msg.is_streaming && !tab.is_streaming && msgs.slice(i + 1).filter(m => m.role === 'assistant').length === 0;
                    let thinkingHtml = '';
                    if (msg.thinking && msg.thinking.trim().length > 0) {
                        const showThinking = _app.settings.showThinking !== false;
                        const thinkingPreview = msg.thinking.length > 120 ? msg.thinking.slice(0, 120) + '...' : msg.thinking;
                        const escapedPreview = _app.escHtml(thinkingPreview).replace(/\n/g, '<br>');
                        const escapedFull = _app.escHtml(msg.thinking).replace(/\n/g, '<br>');
                        const thinkId = 'think-' + tab.tab_id + '-' + i;
                        thinkingHtml = '<div class="thinking-block" style="margin-bottom:4px">'
                            + '<div class="thinking-toggle" onclick="var b=document.getElementById(\'' + thinkId + '\');var a=this.querySelector(\'[data-tarrow]\');if(b.style.display===\'none\'){b.style.display=\'block\';a.textContent=\'\\u25BC\';this.classList.add(\'open\');}else{b.style.display=\'none\';a.textContent=\'\\u25B6\';this.classList.remove(\'open\');}" '
                            + 'style="display:flex;align-items:center;gap:6px;padding:3px 8px;cursor:pointer;border:1px solid var(--v-dim);background:rgba(180,74,255,0.04);user-select:none;font-size:10px;letter-spacing:0.1em;color:var(--v3);transition:background 0.15s" '
                            + 'onmouseenter="this.style.background=\'rgba(180,74,255,0.08)\'" onmouseleave="this.style.background=\'rgba(180,74,255,0.04)\'">'
                            + '<span data-tarrow style="font-size:7px;min-width:8px;color:var(--v3)">' + (showThinking ? '&#x25BC;' : '&#x25B6;') + '</span>'
                            + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--amber);flex-shrink:0"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5.1 7.5l.9-1.8A6 6 0 0 1 6 10a6 6 0 1 1 12 0c0 1.5-.5 2.8-1.4 3.9l-1.4-1.4c.6-.7.8-1.5.8-2.5 0-2.2-1.8-4-4-4S8 7.8 8 10s1.8 4 4 4c.7 0 1.3-.2 1.9-.5l1.2 1.5A5.8 5.8 0 0 1 12 16a6 6 0 0 1-6-6 8 8 0 0 0 6 8z"/></svg>'
                            + '<span style="color:var(--amber);font-weight:bold;letter-spacing:0.12em">THINKING</span>'
                            + '<span style="color:var(--v3);opacity:0.6;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50ch">' + escapedPreview + '</span>'
                            + '</div>'
                            + '<div id="' + thinkId + '" style="display:' + (showThinking ? 'block' : 'none') + ';border:1px solid var(--v-dim);border-top:none;background:rgba(12,11,20,0.4);padding:6px 10px;font-size:12px;color:var(--ng3);line-height:1.6;font-style:italic;max-height:200px;overflow-y:auto">'
                            + escapedFull
                            + '</div></div>';
                    }
                    html += '<div class="msg-wrap chat-msg-fadein chat-msg-row">'
                        + '<div class="chat-avatar chat-avatar-asst">' + avatarAsst + '</div>'
                        + '<div class="chat-body">'
                        + '<div class="msg-actions">'
                        + '<button class="act-copy" onclick="event.stopPropagation();window._app.copyChatMsg(\'' + tab.tab_id + '\',' + i + ')" title="Copy">COPY</button>'
                        + (isLastAssistant ? '<button class="act-regen" onclick="event.stopPropagation();window._app.regenerateResponse(\'' + tab.tab_id + '\')" title="Regenerate">REGEN</button>' : '')
                        + '</div>'
                        + '<div class="chat-role chat-role-assistant">CLAUDE_' + (aTime ? ' <span style="color:var(--v3);font-weight:normal">' + aTime + '</span>' : '') + '</div>'
                        + thinkingHtml
                        + '<div class="chat-bubble-asst" style="max-width:100%;padding:var(--chat-msg-padding,8px 12px);font-size:inherit">'
                        + contentHtml
                        + '</div></div></div>';
                    i++;
                } else if (msg.role === 'tool') {
                    const toolGroup = [];
                    while (i < msgs.length && msgs[i].role === 'tool') { toolGroup.push(msgs[i]); i++; }
                    const isLastGroup = (i >= msgs.length) || (i === msgs.length - 1 && msgs[i]?.role === 'assistant' && msgs[i]?.is_streaming);
                    const collapsed = !isLastGroup;
                    const counts = {};
                    for (const t of toolGroup) { const k = labels[t.toolType || 'other'] || 'TOOL'; counts[k] = (counts[k] || 0) + 1; }
                    const summaryParts = Object.entries(counts).map(([k, v]) => k + (v > 1 ? ' x' + v : ''));
                    const primaryTarget = toolGroup[0]?.toolPath || toolGroup[0]?.toolDetail || '';
                    const summaryText = toolGroup.length === 1
                        ? (toolGroup[0].toolDetail || toolGroup[0].content || summaryParts[0])
                        : summaryParts.join(', ');
                    const countLabel = toolGroup.length === 1 ? '1 TOOL' : toolGroup.length + ' TOOLS';
                    let detailHtml = '';
                    for (const t of toolGroup) {
                        const tt = t.toolType || 'other';
                        const td = t.toolDetail || t.content || '';
                        const tp = t.toolPath || '';
                        if (tp && (tt === 'read' || tt === 'edit' || tt === 'write')) {
                            const fname = tp.split(/[\\/]/).pop();
                            detailHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 18px">'
                                + '<span style="font-size:10px">' + (icons[tt] || icons.other) + '</span>'
                                + '<span style="font-size:8px;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px">[' + (labels[tt] || 'TOOL') + ']</span>'
                                + '<span class="fp-link" style="font-size:10px" title="' + this.escHtml(tp) + ' — click to copy" onclick="event.stopPropagation();navigator.clipboard.writeText(\'' + this.escHtml(tp).replace(/'/g, "\\'") + '\').then(function(){window._app&&window._app.showToast(\'Путь скопирован\')})">' + this.escHtml(fname) + '</span>'
                                + '<span style="font-size:9px;color:var(--v3);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="' + this.escHtml(tp) + '">' + this.escHtml(tp) + '</span>'
                                + '</div>';
                        } else if (tt === 'bash') {
                            detailHtml += '<div style="display:flex;align-items:flex-start;gap:6px;padding:2px 0 2px 18px">'
                                + '<span style="font-size:10px;margin-top:1px">' + (icons[tt] || icons.other) + '</span>'
                                + '<span style="font-size:8px;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px;margin-top:1px">[' + (labels[tt] || 'TOOL') + ']</span>'
                                + '<code style="font-size:10px;color:var(--tok-str, var(--ng2));background:var(--code-bg, var(--bg));padding:1px 6px;border:1px solid var(--v-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60ch;display:inline-block" title="' + this.escHtml(td) + '">$ ' + this.escHtml(td) + '</code>'
                                + '</div>';
                        } else if (tt === 'search') {
                            detailHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 18px">'
                                + '<span style="font-size:10px">' + (icons[tt] || icons.other) + '</span>'
                                + '<span style="font-size:8px;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px">[' + (labels[tt] || 'TOOL') + ']</span>'
                                + '<code style="font-size:10px;color:var(--yellow);padding:1px 4px">' + this.escHtml(td) + '</code>'
                                + (tp ? '<span style="font-size:9px;color:var(--v3);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40ch" title="' + this.escHtml(tp) + '">in ' + this.escHtml(tp) + '</span>' : '')
                                + '</div>';
                        } else {
                            detailHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 18px">'
                                + '<span style="font-size:10px">' + (icons[tt] || icons.other) + '</span>'
                                + '<span style="font-size:8px;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px">[' + (labels[tt] || 'TOOL') + ']</span>'
                                + '<span style="font-size:10px;color:var(--ng3);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55ch" title="' + this.escHtml(td) + '">' + this.escHtml(td) + '</span>'
                                + '</div>';
                        }
                    }
                    const arrowChar = collapsed ? '&#x25B6;' : '&#x25BC;';
                    const detailDisplay = collapsed ? 'none' : 'block';
                    const typeIcons = [...new Set(toolGroup.map(t => icons[t.toolType || 'other'] || icons.other))].join(' ');
                    const headerTarget = primaryTarget
                        ? '<span class="fp-link" style="font-size:10px" title="' + this.escHtml(primaryTarget) + ' — click to copy" onclick="event.stopPropagation();navigator.clipboard.writeText(\'' + this.escHtml(primaryTarget).replace(/'/g, "\\'") + '\').then(function(){window._app&&window._app.showToast(\'Путь скопирован\')})">' + this.escHtml(primaryTarget.split(/[\\/]/).pop()) + '</span>'
                        + '<span style="font-size:8px;color:var(--v3);font-family:monospace;margin-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:30ch" title="' + this.escHtml(primaryTarget) + '">' + this.escHtml(primaryTarget) + '</span>'
                        : '<span style="font-size:9px;color:var(--ng3);letter-spacing:0.08em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50ch" title="' + this.escHtml(summaryText) + '">' + this.escHtml(summaryText) + '</span>';
                    html += '<div class="chat-msg-row" style="padding:2px 0"><div class="chat-avatar chat-avatar-tool">' + avatarTool + '</div><div style="flex:1;min-width:0">'
                        + '<div onclick="var d=this.nextElementSibling,a=this.querySelector(\'[data-arrow]\');if(d.style.display===\'none\'){d.style.display=\'block\';a.textContent=\'\\u25BC\';}else{d.style.display=\'none\';a.textContent=\'\\u25B6\';}" '
                        + 'style="display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border:1px solid var(--v-dim);background:rgba(180,74,255,0.03);user-select:none" '
                        + 'onmouseenter="this.style.borderColor=\'var(--v2)\'" onmouseleave="this.style.borderColor=\'var(--v-dim)\'">'
                        + '<span data-arrow style="font-size:8px;color:var(--v3);min-width:10px">' + arrowChar + '</span>'
                        + '<span style="font-size:10px">' + typeIcons + '</span>'
                        + '<span style="font-size:9px;color:var(--v);letter-spacing:0.12em;font-weight:bold">' + countLabel + '</span>'
                        + headerTarget
                        + '</div>'
                        + '<div style="display:' + detailDisplay + ';border:1px solid var(--v-dim);border-top:none;background:rgba(12,11,20,0.5);padding:4px 6px">'
                        + detailHtml
                        + '</div></div></div>';
                } else {
                    i++;
                }
            }
            if (tab.is_streaming) {
                const lastMsg = msgs[msgs.length - 1];
                const hasContent = lastMsg && lastMsg.role === 'assistant' && lastMsg.content && lastMsg.content.trim().length > 0;
                if (!hasContent) {
                    html += '<div class="chat-msg-fadein chat-msg-row">'
                        + '<div class="chat-avatar chat-avatar-asst">' + avatarAsst + '</div>'
                        + '<div class="chat-body">'
                        + '<div class="chat-role chat-role-asistant">CLAUDE_</div>'
                        + '<div class="chat-bubble-asst typing-indicator-bubble" style="max-width:100%;padding:var(--chat-msg-padding,8px 12px);display:flex;align-items:center;gap:10px">'
                        + '<span class="thinking-spinner"></span>'
                        + '<div class="typing-dots">'
                        + '<span></span><span></span><span></span>'
                        + '</div>'
                        + '<span style="font-size:10px;color:var(--v3);letter-spacing:0.12em">думает...</span>'
                        + '</div></div></div>';
                } else {
                    html += '<div class="chat-msg-row" style="opacity:0.6">'
                        + '<div class="chat-avatar chat-avatar-asst" style="opacity:0.3">' + avatarAsst + '</div>'
                        + '<div style="display:flex;align-items:center;gap:6px;padding:4px 0">'
                        + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--cyan);animation:breathe 1.2s ease-in-out infinite"></span>'
                        + '<span style="font-size:9px;color:var(--cyan);letter-spacing:0.1em">STREAMING</span>'
                        + '</div></div>';
                }
            }
            return html;
        },

        // ========== CHAT: SEARCH (Ctrl+F) ==========
        openChatSearch() {
            this.chatSearch.show = true;
            this.chatSearch.query = '';
            this.chatSearch.total = 0;
            this.chatSearch.current = 0;
            this.chatSearch._elements = [];
            this.$nextTick(() => {
                const inp = document.getElementById('chat-search-input');
                if (inp) inp.focus();
            });
        },
        closeChatSearch() {
            this.chatSearch.show = false;
            this.chatSearch.query = '';
            this.chatSearch.total = 0;
            this.chatSearch.current = 0;
            this.chatSearch._elements = [];
            document.querySelectorAll('.chat-search-hl').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            });
        },
        executeChatSearch() {
            const tab = this.activeTab;
            if (!tab || !this.chatSearch.query.trim()) {
                this.chatSearch.total = 0; this.chatSearch.current = 0; this.chatSearch._elements = [];
                document.querySelectorAll('.chat-search-hl').forEach(el => {
                    const parent = el.parentNode;
                    parent.replaceChild(document.createTextNode(el.textContent), el);
                    parent.normalize();
                });
                return;
            }
            document.querySelectorAll('.chat-search-hl').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            });
            const query = this.chatSearch.query.trim();
            const flags = 'gi';
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escaped, flags);
            const container = document.getElementById('chat-messages-' + tab.tab_id);
            if (!container) return;
            const matches = [];
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (node.parentElement.closest('.chat-search-bar, .msg-actions, button, textarea, input')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (re.test(node.textContent)) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            });
            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);
            for (const node of textNodes) {
                const text = node.textContent;
                const newRe = new RegExp(escaped, flags);
                let match;
                let lastIndex = 0;
                const fragment = document.createDocumentFragment();
                let hasMatch = false;
                while ((match = newRe.exec(text)) !== null) {
                    hasMatch = true;
                    if (match.index > lastIndex) { fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index))); }
                    const span = document.createElement('span');
                    span.className = 'chat-search-hl';
                    span.textContent = match[0];
                    matches.push(span);
                    fragment.appendChild(span);
                    lastIndex = newRe.lastIndex;
                    if (match[0].length === 0) newRe.lastIndex++;
                }
                if (hasMatch) {
                    if (lastIndex < text.length) { fragment.appendChild(document.createTextNode(text.slice(lastIndex))); }
                    node.parentNode.replaceChild(fragment, node);
                }
            }
            this.chatSearch._elements = matches;
            this.chatSearch.total = matches.length;
            this.chatSearch.current = matches.length > 0 ? 1 : 0;
            if (matches.length > 0) this.scrollToChatMatch(0);
        },
        navigateChatMatch(dir) {
            const els = this.chatSearch._elements;
            if (els.length === 0) return;
            els.forEach(el => el.classList.remove('chat-search-hl-current'));
            let idx = this.chatSearch.current - 1 + dir;
            if (idx >= els.length) idx = 0;
            if (idx < 0) idx = els.length - 1;
            this.chatSearch.current = idx + 1;
            els[idx].classList.add('chat-search-hl-current');
            this.scrollToChatMatch(idx);
        },
        scrollToChatMatch(idx) {
            const el = this.chatSearch._elements[idx];
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },

        // ========== CHAT: SCROLL & CLICK ==========
        onChatClick(event) {
            if (event.target.tagName === 'A') { event.target.target = '_blank'; }
        },
        onChatScroll(tab, event) {
            const el = event.target;
            tab.scrolledUp = !(el.scrollTop + el.clientHeight >= el.scrollHeight - 100);
        },
        smartScroll(tab) {
            if (!tab.scrolledUp) {
                const el = document.getElementById('chat-messages-' + tab.tab_id);
                if (el) el.scrollTop = el.scrollHeight;
            }
        },
        scrollToBottom(tab) {
            const el = document.getElementById('chat-messages-' + tab.tab_id);
            if (el) el.scrollTop = el.scrollHeight;
            tab.scrolledUp = false;
        },

        // ========== CHAT: MESSAGE ACTIONS ==========
        copyChatMsg(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            const content = tab.messages[msgIdx].content || '';
            navigator.clipboard.writeText(content).then(() => { this.showToast('Copied to clipboard'); }).catch(() => { });
        },
        editUserMsg(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || tab.is_streaming) return;
            const msg = tab.messages[msgIdx];
            if (!msg || msg.role !== 'user') return;
            const content = msg.content || '';
            tab.messages = tab.messages.slice(0, msgIdx);
            tab.input_text = content;
            this.chatTick++;
            this.$nextTick(() => {
                const textarea = document.querySelector('#chat-messages-' + tabId)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (textarea) { textarea.focus(); textarea.setSelectionRange(content.length, content.length); }
            });
        },
        regenerateResponse(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || tab.is_streaming) return;
            let lastUserIdx = -1;
            for (let j = tab.messages.length - 1; j >= 0; j--) {
                if (tab.messages[j].role === 'user') { lastUserIdx = j; break; }
            }
            if (lastUserIdx === -1) return;
            tab.messages = tab.messages.slice(0, lastUserIdx + 1);
            this.chatTick++;
            const ws = this.chatWs[tabId];
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'message', content: tab.messages[lastUserIdx].content }));
            }
            this.showToast('Regenerating response...');
        },

        // ========== CHAT: BOTTOM PANEL ==========
        toggleBottomPanel(panel) {
            this.chatBottomPanel = this.chatBottomPanel === panel ? 'closed' : panel;
            this.chatTick++;
        },
        getBottomPanelLog() {
            const tab = this.activeTab;
            if (!tab || !tab.messages) return [];
            const log = [];
            const icons = { read: '📖', edit: '✏️', write: '💾', bash: '⌨️', search: '🔍', other: '⚙️' };
            const colors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            const labels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'TOOL' };
            for (const msg of tab.messages) {
                if (msg.role === 'tool') {
                    const tt = msg.toolType || 'other';
                    log.push({ time: this.fmtTime(msg.ts) || '--:--', type: labels[tt] || 'TOOL', color: colors[tt] || colors.other, detail: msg.toolDetail || msg.content || '(no output)' });
                }
            }
            return log;
        },
        getToolSummary() {
            const tab = this.activeTab;
            if (!tab || !tab.messages) return [];
            const icons = { read: '📖', edit: '✏️', write: '💾', bash: '⌨️', search: '🔍', other: '⚙️' };
            const colors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            const labels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'TOOL' };
            const counts = {};
            const details = {};
            for (const msg of tab.messages) {
                if (msg.role === 'tool') {
                    const tt = msg.toolType || 'other';
                    const k = labels[tt] || 'TOOL';
                    counts[k] = (counts[k] || 0) + 1;
                    if (!details[k]) details[k] = [];
                    const d = msg.toolDetail || msg.content || '';
                    if (d && details[k].length < 3) details[k].push(d);
                }
            }
            return Object.entries(counts).map(([k, count]) => ({
                icon: icons[Object.keys(labels).find(l => labels[l] === k) || 'other'] || icons.other,
                label: k, count,
                color: colors[Object.keys(labels).find(l => labels[l] === k) || 'other'] || colors.other,
                detail: (details[k] || []).join(' | '),
            })).sort((a, b) => b.count - a.count);
        },
        clearBottomPanelLog() {
            const tab = this.activeTab;
            if (!tab) return;
            tab.messages = tab.messages.filter(m => m.role !== 'tool');
            this.chatTick++;
            this.showToast('TOOL_LOG_CLEARED');
        },
        clearActiveChat() {
            const tab = this.activeTab;
            if (!tab) return;
            tab.messages = [];
            this.chatTick++;
            this.showToast('CHAT_CLEARED');
        },
        exportActiveChat() {
            const tab = this.activeTab;
            if (!tab || !tab.messages.length) { this.showToast('NOTHING_TO_EXPORT', 'error'); return; }
            let md = '# Chat Export: ' + (tab.label || tab.project_path || 'session') + '\n\n';
            md += '_Exported: ' + new Date().toISOString() + '_\n\n---\n\n';
            for (const msg of tab.messages) {
                if (msg.role === 'user') { md += '## User\n\n' + (msg.content || '') + '\n\n'; }
                else if (msg.role === 'assistant') { md += '## Claude\n\n' + (msg.content || '') + '\n\n'; }
                else if (msg.role === 'tool') {
                    const label = { read: 'Read', edit: 'Edit', write: 'Write', bash: 'Bash', search: 'Search', other: 'Tool' }[msg.toolType || 'other'] || 'Tool';
                    md += '> **[' + label + ']** ' + (msg.toolDetail || msg.content || '') + '\n>\n';
                }
            }
            const blob = new Blob([md], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat-export-' + (tab.label || 'session').replace(/[^a-z0-9]/gi, '-') + '.md';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('CHAT_EXPORTED');
        },
        startPanelResize(e) {
            e.preventDefault();
            this._panelResizing = true;
            const startY = e.clientY;
            const startH = this.chatBottomPanelHeight;
            const onMove = (ev) => { this.chatBottomPanelHeight = Math.max(80, Math.min(400, startH + (startY - ev.clientY))); };
            const onUp = () => {
                this._panelResizing = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        },

        // ========== SESSION PICKER ==========
        async showSessionPicker() {
            this.sessionPickerSearch = '';
            this.showSessionPickerModal = true;
            try {
                const data = await this.api('/api/sessions/history');
                this.pastSessions = data.sessions || [];
            } catch (e) { this.showToast('FAILED TO LOAD SESSIONS', 'error'); }
        },
        async resumeSession(session) {
            this.showSessionPickerModal = false;
            await this.createChatTab(session.project_path, session.session_id);
        },

        // ========== SETTINGS ==========
        toggleSetting(key) {
            this.settings[key] = !this.settings[key];
            localStorage.setItem('ar-settings', JSON.stringify(this.settings));
            this.applySettings();
            // Force chat re-render for settings that affect message display
            if (key === 'showThinking' || key === 'chatDensity') this.chatTick++;
        },
        applySettings() {
            this.applyTheme(this.settings.theme || 'synthwave');
            // Font size: set CSS variable for rem-based scaling + zoom for px-based elements
            const fontSize = this.settings.fontSize || 16;
            document.documentElement.style.setProperty('--user-font-size', fontSize + 'px');
            document.documentElement.style.zoom = Math.max(0.6, Math.min(2.0, fontSize / 16));
            if (this.settings.chatDensity === 'compact') {
                document.documentElement.style.setProperty('--chat-msg-padding', '4px 8px');
                document.documentElement.style.setProperty('--chat-msg-gap', '2px');
            } else {
                document.documentElement.style.setProperty('--chat-msg-padding', '8px 12px');
                document.documentElement.style.setProperty('--chat-msg-gap', '6px');
            }
            document.body.classList.toggle('crt', this.settings.crtEffect);
            document.body.classList.toggle('flicker', this.settings.crtEffect);
            if (window.MatrixRain && typeof MatrixRain.toggle === 'function') {
                if (!this.settings.matrixRain && !this._matrixRainStopped) { MatrixRain.toggle(); this._matrixRainStopped = true; }
                else if (this.settings.matrixRain && this._matrixRainStopped) { MatrixRain.toggle(); this._matrixRainStopped = false; }
            }
            if (window.CatModule) {
                if (!this.settings.catCompanion && CatModule.isActive()) { CatModule.stop(); }
                else if (this.settings.catCompanion && !CatModule.isActive()) {
                    const el = document.getElementById('cat-canvas');
                    if (el) CatModule.start(el, 'neutral', 4);
                }
            }
        },
    };
}

// Wrapper with diagnostic logging
function app() {
    console.log('[app] modules check:', {
        AppUtils: !!window.AppUtils,
        AppThemes: !!window.AppThemes,
        AppRenderer: !!window.AppRenderer,
        AppLab: !!window.AppLab,
    });
    try {
        const data = _buildAppData();
        console.log('[app] _buildAppData() OK, keys:', Object.keys(data).length);
        return data;
    } catch (e) {
        console.error('[app] _buildAppData() FAILED:', e);
        // Return minimal data so Alpine at least renders something
        return {
            section: 'lab', page: 'dashboard',
            stats: { score_trend: [], type_distribution: {} },
            experiments: [], runStatus: { running: false, tokens: null },
            settings: { matrixRain: false, crtEffect: false, catCompanion: false, theme: 'synthwave', fontSize: 16, chatDensity: 'comfortable', compactSidebar: false, showThinking: false },
            toast: { show: false, message: '', type: 'error' },
            showToast(msg) { console.error('[app-toast]', msg); },
            async init() { this.showToast('APP INIT FAILED: ' + e.message); },
        };
    }
}
