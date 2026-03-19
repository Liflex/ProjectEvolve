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

// === Code block line selection ===
(function() {
    // Per-block selection state: blockId -> Set of line numbers
    const selections = {};
    // Last clicked line per block (for shift-range)
    const lastClicked = {};

    function getBlockId(lnEl) {
        const block = lnEl.closest('.code-block');
        return block ? block.dataset.cbId : null;
    }

    function updateBlockUI(blockId) {
        const sel = selections[blockId];
        const count = sel ? sel.size : 0;
        const block = document.querySelector('.code-block[data-cb-id="' + blockId + '"]');
        if (!block) return;
        const selBtn = block.querySelector('.code-copy-sel');
        if (selBtn) {
            if (count > 0) {
                selBtn.style.display = '';
                selBtn.textContent = '[COPY ' + count + ']';
            } else {
                selBtn.style.display = 'none';
            }
        }
        // Update .code-selected classes
        block.querySelectorAll('.code-line').forEach(line => {
            const ln = parseInt(line.dataset.ln);
            if (sel && sel.has(ln)) {
                line.classList.add('code-selected');
            } else {
                line.classList.remove('code-selected');
            }
        });
    }

    function clearSelection(blockId) {
        if (selections[blockId]) selections[blockId].clear();
        lastClicked[blockId] = null;
        updateBlockUI(blockId);
    }

    function selectLine(blockId, lineNum, shiftKey, ctrlKey) {
        if (!selections[blockId]) selections[blockId] = new Set();
        const sel = selections[blockId];

        if (shiftKey && lastClicked[blockId] != null) {
            // Range selection
            const from = Math.min(lastClicked[blockId], lineNum);
            const to = Math.max(lastClicked[blockId], lineNum);
            // If only one line was selected before, start fresh range
            if (sel.size === 1 && sel.has(lastClicked[blockId])) {
                sel.clear();
            }
            for (let i = from; i <= to; i++) sel.add(i);
        } else if (ctrlKey && sel.size > 0) {
            // Ctrl+click: toggle individual line in selection
            if (sel.has(lineNum)) sel.delete(lineNum);
            else sel.add(lineNum);
            lastClicked[blockId] = lineNum;
        } else {
            // Toggle single line
            if (sel.has(lineNum) && sel.size === 1) {
                sel.clear();
                lastClicked[blockId] = null;
            } else {
                sel.clear();
                sel.add(lineNum);
                lastClicked[blockId] = lineNum;
            }
        }
        updateBlockUI(blockId);
    }

    // Event delegation for line number clicks
    document.addEventListener('click', function(evt) {
        const lnEl = evt.target.closest('.code-ln');
        if (!lnEl) return;
        evt.preventDefault();
        evt.stopPropagation();
        const blockId = getBlockId(lnEl);
        if (!blockId) return;
        const lineNum = parseInt(lnEl.dataset.ln);
        selectLine(blockId, lineNum, evt.shiftKey, evt.ctrlKey || evt.metaKey);
    });

    // Copy selected lines
    document.addEventListener('click', function(evt) {
        const selBtn = evt.target.closest('.code-copy-sel');
        if (!selBtn) return;
        evt.preventDefault();
        evt.stopPropagation();
        const blockId = selBtn.dataset.cb;
        const block = document.querySelector('.code-block[data-cb-id="' + blockId + '"]');
        if (!block) return;
        const sel = selections[blockId];
        if (!sel || sel.size === 0) return;
        // Collect selected lines in order
        const lines = [];
        block.querySelectorAll('.code-line').forEach(line => {
            const ln = parseInt(line.dataset.ln);
            if (sel.has(ln)) {
                // Get text content excluding the line number element
                const clone = line.cloneNode(true);
                const lnSpan = clone.querySelector('.code-ln');
                if (lnSpan) lnSpan.remove();
                lines.push(clone.textContent);
            }
        });
        const text = lines.join('\n');
        const origText = selBtn.textContent;
        navigator.clipboard.writeText(text).then(() => {
            selBtn.textContent = '[COPIED]';
            selBtn.classList.add('copied');
            setTimeout(() => { selBtn.textContent = origText; selBtn.classList.remove('copied'); }, 1500);
        }).catch(() => {
            selBtn.textContent = '[FAIL]';
            setTimeout(() => { selBtn.textContent = origText; }, 1500);
        });
    });

    // ESC to clear all selections
    document.addEventListener('keydown', function(evt) {
        if (evt.key === 'Escape') {
            Object.keys(selections).forEach(clearSelection);
        }
    });
})()
// === Code block wrap and fold toggles ===
window._toggleCodeWrap = function(btn, preId) {
    var block = btn.closest('.code-block');
    if (!block) return;
    var isWrapped = block.classList.toggle('code-wrap');
    btn.textContent = isWrapped ? '[NOWRAP]' : '[WRAP]';
    btn.classList.toggle('code-ctrl-active', isWrapped);
};

window._toggleCodeFold = function(btn, preId) {
    var block = btn.closest('.code-block');
    if (!block) return;
    var isFolded = block.classList.toggle('code-folded');
    btn.textContent = isFolded ? '[UNFOLD]' : '[FOLD]';
    btn.classList.toggle('code-ctrl-active', isFolded);
};
;

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
        heatmapTooltip: null,  // { date, count, x, y } for activity heatmap
        _heatmapData: null,     // cached heatmap data, updated when experiments load
        _streakData: null,      // cached streak data
        catSpeech: '',
        catSpeechAction: null,
        catExpression: 'neutral',
        organismSVG: '',
        organismStage: 'DORMANT',
        runElapsed: '',
        settings: JSON.parse(localStorage.getItem('ar-settings') || '{"matrixRain":true,"crtEffect":true,"catCompanion":true,"theme":"synthwave","fontSize":16,"chatDensity":"comfortable","compactSidebar":false,"showThinking":false}'),
        _matrixRainStopped: false,
        _catHovering: false,

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

        // Prompt templates — skill-based quick actions
        _showPromptTemplates: true,
        promptTemplates: [
            // Spec Kit workflow
            { id: 'spec', label: 'Spec фичи', icon: 'SP', text: '/speckit.specify ', cat: 'speckit' },
            { id: 'clarify', label: 'Уточнить', icon: 'CL', text: '/speckit.clarify ', cat: 'speckit' },
            { id: 'plan', label: 'План', icon: 'PL', text: '/speckit.plan ', cat: 'speckit' },
            { id: 'tasks', label: 'Задачи', icon: 'TK', text: '/speckit.tasks ', cat: 'speckit' },
            { id: 'impl', label: 'Реализовать', icon: 'IM', text: '/speckit.implement ', cat: 'speckit' },
            { id: 'feature', label: 'Быстрая фича', icon: 'QF', text: '/speckit.features ', cat: 'speckit' },
            // Code quality
            { id: 'simplify', label: 'Simplify', icon: 'SI', text: '/simplify ', cat: 'code' },
            { id: 'review', label: 'Code Review', icon: 'CR', text: '/code-reviewer ', cat: 'code' },
            // Git
            { id: 'commit', label: 'Commit', icon: 'CM', text: '/commit ', cat: 'git' },
            { id: 'push', label: 'Push', icon: 'PU', text: '/push ', cat: 'git' },
        ],

        // Chat Search (Ctrl+F)
        chatSearch: { show: false, query: '', total: 0, current: 0, _elements: [] },

        // Chat message keyboard navigation (j/k)
        _chatNavIdx: -1,  // focused message index, -1 = none
        _chatNavTabId: null,

        // Pinned messages
        pinnedMessages: [], // [{tabId, msgIdx, role, preview, ts, content}]
        showPinsPanel: false,
        showStatsPanel: false,
        showExportMenu: false,

        // Context menu
        ctxMenu: { show: false, items: [], x: 0, y: 0 },

        // Image lightbox
        lightbox: { show: false, src: '', alt: '' },

        // Tab rename
        _renamingTabId: null,
        _renameText: '',

        // Tab context menu
        tabCtxMenu: { show: false, tabId: null, x: 0, y: 0 },

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

        // Keyboard Shortcuts Panel
        showShortcuts: false,
        shortcutsFilter: '',

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
        // Keyboard Shortcuts reference data (for shortcuts overlay)
        keyboardShortcuts: [
            { category: 'NAVIGATION', items: [
                { keys: 'Alt+1', desc: 'Research Lab' },
                { keys: 'Alt+2', desc: 'Chat' },
                { keys: 'Alt+3 — 9', desc: 'Lab pages (Dashboard, Experiments, ...)' },
                { keys: 'Ctrl+K', desc: 'Command Palette' },
                { keys: '?', desc: 'Keyboard Shortcuts (this panel)' },
            ]},
            { category: 'CHAT', items: [
                { keys: 'Ctrl+F', desc: 'Search in messages' },
                { keys: 'Enter', desc: 'Send message' },
                { keys: 'Shift+Enter', desc: 'New line' },
                { keys: 'Up / Down', desc: 'Message history (shell-style)' },
                { keys: 'ESC', desc: 'Cancel edit / exit history / close panels' },
                { keys: '/', desc: 'Skill autocomplete menu' },
            ]},
            { category: 'MESSAGE NAV (j/k)', items: [
                { keys: 'j / k', desc: 'Navigate messages down / up' },
                { keys: 'ESC', desc: 'Clear message focus' },
                { keys: 'c', desc: 'Copy focused message' },
                { keys: 'q', desc: 'Quote focused message' },
                { keys: 'e', desc: 'Edit focused message (user only)' },
                { keys: 'f', desc: 'Fold / unfold focused message' },
                { keys: 'p', desc: 'Pin / unpin focused message' },
                { keys: 'd', desc: 'Delete focused message' },
            ]},
            { category: 'INPUT FORMATTING', items: [
                { keys: 'Ctrl+Shift+B', desc: 'Bold **text**' },
                { keys: 'Ctrl+Shift+I', desc: 'Italic *text*' },
                { keys: 'Ctrl+Shift+K', desc: 'Link [text](url)' },
                { keys: 'Ctrl+Shift+C', desc: 'Code block ```' },
            ]},
            { category: 'MESSAGES', items: [
                { keys: 'Right-click', desc: 'Context menu (Copy, Quote, Edit, Pin, etc.)' },
                { keys: 'Double-click tab', desc: 'Rename tab' },
                { keys: 'Hover + actions', desc: 'COPY / QUOTE / EDIT / REGEN / PIN / FOLD / DEL' },
            ]},
            { category: 'FILES & MEDIA', items: [
                { keys: 'Paste image', desc: 'Attach clipboard image to message' },
                { keys: 'Drag & drop', desc: 'Drop files into chat input' },
                { keys: 'Clip button', desc: 'File picker for attachments' },
            ]},
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
        get filteredShortcuts() {
            if (!this.shortcutsFilter) return this.keyboardShortcuts;
            const q = this.shortcutsFilter.toLowerCase();
            return this.keyboardShortcuts.map(cat => ({
                category: cat.category,
                items: cat.items.filter(item =>
                    item.keys.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
                ),
            })).filter(cat => cat.items.length > 0);
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
            // Restore chat sessions from localStorage
            this.restoreChatState();
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
                    this.catSpeechAction = CatModule.getSpeechAction();
                    this.catExpression = CatModule.getExpression();
                }
                // Refresh chat relative time every 30s
                if (this._clockTick % 30 === 0 && this.activeChatTab) {
                    this.chatTick++;
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
            // Save chat state on page unload
            window.addEventListener('beforeunload', () => { this.saveChatState(); });
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
                if (e.key === 'Escape' && this.lightbox.show) { this.closeLightbox(); }
                if ((e.ctrlKey || e.metaKey) && e.key === 'f' && this.section === 'chat' && this.activeTab) {
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                    e.preventDefault();
                    this.openChatSearch();
                }
                if (e.key === 'Escape' && this.chatSearch.show) { this.closeChatSearch(); }
                if (e.key === 'Escape' && this.tabCtxMenu.show) { this.tabCtxMenu.show = false; }
                if (e.key === 'Escape' && this._renamingTabId) { this.cancelRenameTab(); }
                if (e.key === 'Escape' && this.showShortcuts) { this.closeShortcuts(); }
                // ? opens keyboard shortcuts panel (when not in input)
                if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
                    e.preventDefault();
                    this.showShortcuts ? this.closeShortcuts() : this.openShortcuts();
                }
                if (e.key === 'Enter' && this.chatSearch.show && document.activeElement.id === 'chat-search-input') {
                    e.preventDefault();
                    this.navigateChatMatch(e.shiftKey ? -1 : 1);
                }
                // Chat message keyboard navigation (j/k) — only when in chat section, not in input
                if (this.section === 'chat' && this.activeTab && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
                    const inSlashMenu = this.slashMenu.show;
                    const inCmdPalette = this.cmdPalette.show;
                    const inSearch = this.chatSearch.show;
                    if (!inInput && !inSlashMenu && !inCmdPalette && !inSearch) {
                        if (e.key === 'j') { e.preventDefault(); this.chatNavFocus(1); }
                        else if (e.key === 'k') { e.preventDefault(); this.chatNavFocus(-1); }
                        else if (e.key === 'Escape' && this._chatNavIdx >= 0) { this.chatNavClear(); }
                        else if (this._chatNavIdx >= 0) {
                            // Action shortcuts on focused message
                            if (e.key === 'c') { e.preventDefault(); this.chatNavAction('copy'); }
                            else if (e.key === 'q') { e.preventDefault(); this.chatNavAction('quote'); }
                            else if (e.key === 'f') { e.preventDefault(); this.chatNavAction('fold'); }
                            else if (e.key === 'd') { e.preventDefault(); this.chatNavAction('del'); }
                            else if (e.key === 'p') { e.preventDefault(); this.chatNavAction('pin'); }
                            else if (e.key === 'e') { e.preventDefault(); this.chatNavAction('edit'); }
                        }
                    }
                }
            });
        },

        // ========== NAVIGATION ==========
        navigateSection(section) {
            this.section = section;
            if (section === 'lab' && !this.page) this.page = 'dashboard';
            if (section === 'chat') this.page = '';
            if (window.CatModule && CatModule.isActive()) {
                if (CatModule.resetIdle) CatModule.resetIdle();
                if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                if (section === 'lab') CatModule.setSpeechText('Research mode_ *прищурился*', 3000);
                else { CatModule.setSpeechText('Chat mode! *мурлычет*', 3000); CatModule.setPage('chat'); }
            }
        },

        // ========== CAT INTERACTION ==========
        onCatClick() {
            if (window.CatModule && CatModule.isActive() && CatModule.onClick) {
                CatModule.onClick();
            }
        },

        onCatSpeechClick() {
            if (!window.CatModule || !CatModule.isActive()) return;
            const action = CatModule.consumeSpeechAction();
            if (!action || action.type !== 'insert' || !action.value) return;
            // Navigate to chat if not there, then insert command
            if (this.section !== 'chat') {
                this.navigateSection('chat');
            }
            this.$nextTick(() => {
                const tab = this.activeTab;
                if (tab) {
                    tab.input_text = action.value;
                    this.chatTick++;
                    this.$nextTick(() => {
                        const textarea = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col')?.querySelector('textarea');
                        if (textarea) textarea.focus();
                    });
                }
            });
            // Cat reaction to being clicked
            CatModule.setExpression('happy');
            CatModule.setSpeechText('*довольный мурр*', 2000);
            CatModule.triggerPawWave && CatModule.triggerPawWave();
            setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 3000);
        },

        navigate(page) {
            this.page = page; this.selectedExp = null; this.selectedExpData = null;
            if (page === 'experiments') { this.loadExperiments(); this.expPage = 0; }
            if (page === 'changes') this.loadChangesLog();
            if (page === 'prompt') this.loadPrompt();
            if (page === 'config') this.loadConfig();
            if (page === 'dashboard') { this.loadStats(); this.loadExperiments(); }
            if (page === 'run') { this.pollRunStatus(); if (this.runStatus.running) this.connectResearchWs(); }
            if (page !== 'run') this.disconnectResearchWs();
            if (window.CatModule && CatModule.isActive() && CatModule.setPage) { CatModule.setPage(page); }
            if (window.CatModule && CatModule.isActive()) {
                if (CatModule.resetIdle) CatModule.resetIdle();
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

        // ========== KEYBOARD SHORTCUTS PANEL ==========
        openShortcuts() {
            this.showShortcuts = true;
            this.shortcutsFilter = '';
            this.$nextTick(() => {
                const inp = document.getElementById('shortcuts-filter-input');
                if (inp) inp.focus();
            });
        },
        closeShortcuts() {
            this.showShortcuts = false;
            this.shortcutsFilter = '';
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
