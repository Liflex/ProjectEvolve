// Global copy handler for IDE code blocks
window._copyCode = function(btn, preId) {
    const pre = document.getElementById(preId);
    if (!pre) return;
    const text = pre.textContent || pre.innerText;
    const origText = btn.textContent;
    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '&#x2713; COPIED';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = origText; btn.classList.remove('copied'); }, 1500);
    }).catch(() => {
        btn.innerHTML = '&#x2717; FAIL';
        setTimeout(() => { btn.textContent = origText; }, 1500);
    });
};

function _buildAppData() {
    return {
        // ========== MODULE SPREADS (loaded from js/modules/*.js) ==========
        ...window.AppUtils,
        ...window.AppThemes,
        ...window.AppRenderer,
        ...window.AppLab,
        ...window.AppChat,

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

        // Pinned messages
        pinnedMessages: [], // [{tabId, msgIdx, role, preview, ts, content}]
        showPinsPanel: false,

        // Context menu
        ctxMenu: { show: false, items: [], x: 0, y: 0 },

        // Clock tick (forces status bar re-render every second)
        _clockTick: 0,

        // Live Log
        liveLog: [],
        liveLogFilter: 'all',
        liveLogAutoScroll: true,
        liveLogPaused: false,
        _liveLogMax: 500,

        // Run: file browser state
        _showBrowsePanel: false,
        _browsePath: '.',
        _browseEntries: [],
        _preflightResult: null,

        // Command Palette (Ctrl+K / Ctrl+Shift+P)
        cmdPalette: { show: false, query: '', selected: 0, _recent: [] },
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
            { id: 'chat-fold-all', label: 'Chat: Fold All Messages', category: 'CHAT', action: () => { if (this.activeTab) this.collapseAllMessages(); } },
            { id: 'chat-unfold-all', label: 'Chat: Unfold All Messages', category: 'CHAT', action: () => { if (this.activeTab) this.expandAllMessages(); } },
            { id: 'chat-raw-log', label: 'Chat: Toggle Raw Tool Log', category: 'CHAT', action: () => { this.toggleBottomPanel('rawlog'); } },
            { id: 'chat-tools', label: 'Chat: Toggle Tools Summary', category: 'CHAT', action: () => { this.toggleBottomPanel('summary'); } },
            { id: 'chat-search', label: 'Chat: Search in Messages', shortcut: 'Ctrl+F', category: 'CHAT', action: () => { if (this.section !== 'chat') this.navigateSection('chat'); this.$nextTick(() => this.openChatSearch()); } },
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
            // Local commands (handled by frontend)
            { cmd: '/clear', desc: 'Очистить чат', action: 'clear', cat: 'local' },
            { cmd: '/export', desc: 'Экспорт в Markdown', action: 'export', cat: 'local' },
            { cmd: '/cancel', desc: 'Остановить генерацию', action: 'cancel', cat: 'local' },
            { cmd: '/compact', desc: 'Компактный режим', action: 'compact', cat: 'local' },
            { cmd: '/help', desc: 'Показать команды', action: 'help', cat: 'local' },
            // Claude Code skills (sent to agent)
            { cmd: '/commit', desc: 'Создать git коммит', cat: 'skill' },
            { cmd: '/simplify', desc: 'Ревью кода — качество и эффективность', cat: 'skill' },
            { cmd: '/push', desc: 'Автоматизация релиза', cat: 'skill' },
            { cmd: '/code-reviewer', desc: 'Комплексный code review', cat: 'skill' },
            { cmd: '/speckit.specify', desc: 'Spec Kit — спецификация фичи', cat: 'skill' },
            { cmd: '/speckit.plan', desc: 'Spec Kit — план реализации', cat: 'skill' },
            { cmd: '/speckit.tasks', desc: 'Spec Kit — генерация задач', cat: 'skill' },
            { cmd: '/speckit.implement', desc: 'Spec Kit — выполнение задач', cat: 'skill' },
            { cmd: '/speckit.analyze', desc: 'Spec Kit — анализ артефактов', cat: 'skill' },
            { cmd: '/speckit.clarify', desc: 'Spec Kit — уточнение спецификации', cat: 'skill' },
            { cmd: '/speckit.checklist', desc: 'Spec Kit — чеклист качества', cat: 'skill' },
            { cmd: '/speckit.feedback', desc: 'Spec Kit — обратная связь', cat: 'skill' },
            { cmd: '/speckit.loop', desc: 'Spec Kit — итерация качества', cat: 'skill' },
            { cmd: '/speckit.qa', desc: 'Spec Kit — QA дашборд', cat: 'skill' },
            { cmd: '/speckit.features', desc: 'Spec Kit — быстрая фича', cat: 'skill' },
            { cmd: '/speckit.implementloop', desc: 'Spec Kit — имплемент + quality loop', cat: 'skill' },
            { cmd: '/speckit.tobeads', desc: 'Spec Kit — импорт в Beads', cat: 'skill' },
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
                this._clockTick++; // Force status bar re-render for session duration
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
                    this.openCmdPalette();
                }
                // Ctrl+K opens command palette (like VS Code)
                if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
                    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
                    e.preventDefault();
                    this.openCmdPalette();
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
            // Load recent commands from localStorage
            try {
                const stored = localStorage.getItem('ar-cmd-recent');
                const recentIds = stored ? JSON.parse(stored) : [];
                this.cmdPalette._recent = recentIds
                    .map(id => this.cmdPaletteCommands.find(c => c.id === id))
                    .filter(Boolean)
                    .slice(0, 5);
            } catch (e) { this.cmdPalette._recent = []; }
            this.$nextTick(() => {
                const inp = document.getElementById('cmd-palette-input');
                if (inp) inp.focus();
            });
        },
        closeCmdPalette() {
            this.cmdPalette.show = false;
        },
        executePaletteCmd(cmd) {
            if (!cmd) return;
            this.cmdPalette.show = false;
            // Track as recently used
            try {
                let recentIds = JSON.parse(localStorage.getItem('ar-cmd-recent') || '[]');
                recentIds = recentIds.filter(id => id !== cmd.id);
                recentIds.unshift(cmd.id);
                recentIds = recentIds.slice(0, 10);
                localStorage.setItem('ar-cmd-recent', JSON.stringify(recentIds));
            } catch (e) {}
            if (cmd.action) cmd.action();
        },
        executeCmdPalette() {
            // If query is empty, execute from recent list; otherwise from filtered
            const items = this.cmdPalette.query ? this.filteredCommands : this.cmdPalette._recent;
            if (items.length === 0) return;
            const cmd = items[this.cmdPalette.selected];
            this.executePaletteCmd(cmd);
        },
        highlightMatch(label, query) {
            if (!query || !query.trim()) return this.escHtml(label);
            const q = query.trim();
            const idx = label.toLowerCase().indexOf(q.toLowerCase());
            if (idx === -1) return this.escHtml(label);
            const before = this.escHtml(label.slice(0, idx));
            const match = this.escHtml(label.slice(idx, idx + q.length));
            const after = this.escHtml(label.slice(idx + q.length));
            return before + '<span style="color:var(--v);font-weight:bold">' + match + '</span>' + after;
        },
        onCmdPaletteKeydown(e) {
            const items = this.cmdPalette.query ? this.filteredCommands : this.cmdPalette._recent;
            if (e.key === 'ArrowDown') { e.preventDefault(); this.cmdPalette.selected = Math.min(this.cmdPalette.selected + 1, items.length - 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.cmdPalette.selected = Math.max(this.cmdPalette.selected - 1, 0); }
            else if (e.key === 'Enter') { e.preventDefault(); this.executeCmdPalette(); }
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
            // Font size: rem-based scaling — html font-size drives all rem units
            const fontSize = this.settings.fontSize || 16;
            document.documentElement.style.setProperty('--user-font-size', fontSize + 'px');
            document.documentElement.style.fontSize = fontSize + 'px';
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
        AppChat: !!window.AppChat,
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
