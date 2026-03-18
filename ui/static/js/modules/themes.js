// === AppThemes — theme definitions and application ===
// Loaded before app.js, spread into Alpine data object
window.AppThemes = (function() {
    return {
        // Theme preview metadata — swatches + labels for settings UI
        themeMeta: {
            synthwave: {
                label: 'SYNTHWAVE', desc: 'Неоновый ретро Kung Fury',
                swatches: ['#0c0b14', '#b44aff', '#39ff14', '#00e5ff', '#ff00aa', '#ffe033'],
            },
            darcula: {
                label: 'DARCULA', desc: 'JetBrains IDE классика',
                swatches: ['#2b2b2b', '#9876aa', '#cc7832', '#6897bb', '#6a8759', '#ffc66d'],
            },
            'one-dark': {
                label: 'ONE DARK', desc: 'Atom / GitHub стиль',
                swatches: ['#282c34', '#c678dd', '#e06c75', '#56b6c2', '#98c379', '#e5c07b'],
            },
            dracula: {
                label: 'DRACULA', desc: 'Тёмная классика Dracula',
                swatches: ['#282a36', '#bd93f9', '#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c'],
            },
        },

        // Theme definitions — CSS variable overrides
        themes: {
            synthwave: {
                '--ng': '#39ff14', '--ng2': '#b8f0c8', '--ng3': '#3a6a48', '--ng-dim': '#1a2820',
                '--bg': 'rgba(12,11,20,0.82)', '--bg2': 'rgba(17,15,28,0.78)', '--bg3': 'rgba(24,21,40,0.75)',
                '--v': '#b44aff', '--v2': '#9050cc', '--v3': '#6b3a8f', '--v-dim': '#1e1430',
                '--pink': '#ff00aa', '--cyan': '#00e5ff', '--yellow': '#ffe033', '--red': '#ff3366', '--amber': '#ffaa00',
                'body-bg': '#0c0b14', 'body-color': '#b8f0c8',
                'body-font': "'VT323', monospace",
                'code-font': "'VT323', monospace",
                'font-size': '16px',
                'chat-user-bg': 'rgba(180,74,255,0.1)', 'chat-user-border': 'var(--v-dim)',
                'chat-asst-bg': 'var(--bg2)', 'chat-asst-border': 'var(--v-dim)',
                'chat-role-font': "'Press Start 2P', monospace",
                '--tok-kw': '#b44aff', '--tok-str': '#39ff14', '--tok-cmt': '#6b3a8f',
                '--tok-fn': '#00e5ff', '--tok-num': '#ff00aa',
                '--code-bg': 'rgba(8,7,16,0.95)', '--code-header-bg': 'rgba(24,21,40,0.9)', '--code-lang-color': '#b44aff',
                '--thinking-bg': 'rgba(180,74,255,0.04)', '--thinking-bg-hover': 'rgba(180,74,255,0.08)',
                '--thinking-content-bg': 'rgba(12,11,20,0.4)',
                '--tool-header-bg': 'rgba(180,74,255,0.03)', '--tool-detail-bg': 'rgba(12,11,20,0.5)',
                // Markdown-specific theme tokens
                '--md-h1-color': '#b44aff', '--md-h2-color': '#00e5ff', '--md-h3-color': '#b44aff',
                '--md-h1-shadow': 'rgba(180,74,255,0.4)', '--md-h2-border': 'rgba(0,229,255,0.15)',
                '--md-link-color': '#00e5ff', '--md-link-hover': '#39ff14',
                '--md-strong-color': '#b44aff', '--md-em-color': '#ff00aa',
                '--md-blockquote-border': '#ff00aa', '--md-blockquote-text': '#6b3a8f',
                '--md-list-bullet': '#b44aff', '--md-hr-color': '#3c3f41',
                '--md-table-header-bg': 'rgba(180,74,255,0.08)', '--md-table-stripe-bg': 'rgba(180,74,255,0.03)',
                '--md-code-bg': 'rgba(180,74,255,0.1)', '--md-code-color': '#00e5ff',
                '--md-code-header-accent': '#b44aff',
            },
            darcula: {
                '--ng': '#a9b7c6', '--ng2': '#a9b7c6', '--ng3': '#606366', '--ng-dim': '#3c3f41',
                '--bg': 'rgba(43,43,43,0.95)', '--bg2': 'rgba(49,49,49,0.92)', '--bg3': 'rgba(60,63,65,0.88)',
                '--v': '#9876aa', '--v2': '#7b5e97', '--v3': '#5a4a6e', '--v-dim': '#3c3f41',
                '--pink': '#cc7832', '--cyan': '#6897bb', '--yellow': '#ffc66d', '--red': '#ff6b68', '--amber': '#cc7832',
                'body-bg': '#2b2b2b', 'body-color': '#a9b7c6',
                'body-font': "'JetBrains Mono', monospace",
                'code-font': "'JetBrains Mono', monospace",
                'font-size': '13px',
                'chat-user-bg': 'rgba(98,76,150,0.12)', 'chat-user-border': 'rgba(98,76,150,0.3)',
                'chat-asst-bg': 'rgba(49,49,49,0.8)', 'chat-asst-border': 'rgba(60,63,65,0.5)',
                'chat-role-font': "'JetBrains Mono', monospace",
                '--tok-kw': '#cc7832', '--tok-str': '#6a8759', '--tok-cmt': '#808080',
                '--tok-fn': '#ffc66d', '--tok-num': '#6897bb',
                '--code-bg': 'rgba(30,30,30,0.98)', '--code-header-bg': 'rgba(49,49,49,0.95)', '--code-lang-color': '#a9b7c6',
                '--thinking-bg': 'rgba(152,118,170,0.06)', '--thinking-bg-hover': 'rgba(152,118,170,0.1)',
                '--thinking-content-bg': 'rgba(30,30,30,0.5)',
                '--tool-header-bg': 'rgba(152,118,170,0.04)', '--tool-detail-bg': 'rgba(30,30,30,0.6)',
                // Markdown-specific theme tokens
                '--md-h1-color': '#9876aa', '--md-h2-color': '#6897bb', '--md-h3-color': '#9876aa',
                '--md-h1-shadow': 'rgba(152,118,170,0.3)', '--md-h2-border': 'rgba(104,151,187,0.2)',
                '--md-link-color': '#6897bb', '--md-link-hover': '#ffc66d',
                '--md-strong-color': '#cc7832', '--md-em-color': '#cc7832',
                '--md-blockquote-border': '#cc7832', '--md-blockquote-text': '#808080',
                '--md-list-bullet': '#9876aa', '--md-hr-color': '#3c3f41',
                '--md-table-header-bg': 'rgba(152,118,170,0.08)', '--md-table-stripe-bg': 'rgba(152,118,170,0.03)',
                '--md-code-bg': 'rgba(152,118,170,0.12)', '--md-code-color': '#cc7832',
                '--md-code-header-accent': '#9876aa',
            },
            'one-dark': {
                '--ng': '#abb2bf', '--ng2': '#abb2bf', '--ng3': '#5c6370', '--ng-dim': '#282c34',
                '--bg': 'rgba(40,44,52,0.95)', '--bg2': 'rgba(47,52,62,0.92)', '--bg3': 'rgba(59,64,76,0.88)',
                '--v': '#c678dd', '--v2': '#a855c9', '--v3': '#7a4489', '--v-dim': '#3e4451',
                '--pink': '#e06c75', '--cyan': '#56b6c2', '--yellow': '#e5c07b', '--red': '#e06c75', '--amber': '#d19a66',
                'body-bg': '#282c34', 'body-color': '#abb2bf',
                'body-font': "'Fira Code', monospace",
                'code-font': "'Fira Code', monospace",
                'font-size': '14px',
                'chat-user-bg': 'rgba(198,120,221,0.08)', 'chat-user-border': 'rgba(198,120,221,0.2)',
                'chat-asst-bg': 'rgba(47,52,62,0.7)', 'chat-asst-border': 'rgba(62,68,81,0.5)',
                'chat-role-font': "'Fira Code', monospace",
                '--tok-kw': '#c678dd', '--tok-str': '#98c379', '--tok-cmt': '#5c6370',
                '--tok-fn': '#61afef', '--tok-num': '#d19a66',
                '--code-bg': 'rgba(33,37,43,0.98)', '--code-header-bg': 'rgba(47,52,62,0.95)', '--code-lang-color': '#e5c07b',
                '--thinking-bg': 'rgba(198,120,221,0.06)', '--thinking-bg-hover': 'rgba(198,120,221,0.1)',
                '--thinking-content-bg': 'rgba(33,37,43,0.5)',
                '--tool-header-bg': 'rgba(198,120,221,0.04)', '--tool-detail-bg': 'rgba(33,37,43,0.6)',
                // Markdown-specific theme tokens
                '--md-h1-color': '#c678dd', '--md-h2-color': '#61afef', '--md-h3-color': '#c678dd',
                '--md-h1-shadow': 'rgba(198,120,221,0.3)', '--md-h2-border': 'rgba(97,175,239,0.2)',
                '--md-link-color': '#61afef', '--md-link-hover': '#98c379',
                '--md-strong-color': '#e06c75', '--md-em-color': '#e06c75',
                '--md-blockquote-border': '#e06c75', '--md-blockquote-text': '#5c6370',
                '--md-list-bullet': '#c678dd', '--md-hr-color': '#3e4451',
                '--md-table-header-bg': 'rgba(198,120,221,0.08)', '--md-table-stripe-bg': 'rgba(198,120,221,0.03)',
                '--md-code-bg': 'rgba(198,120,221,0.1)', '--md-code-color': '#e06c75',
                '--md-code-header-accent': '#c678dd',
            },
            dracula: {
                '--ng': '#f8f8f2', '--ng2': '#f8f8f2', '--ng3': '#6272a4', '--ng-dim': '#21222c',
                '--bg': 'rgba(40,42,54,0.97)', '--bg2': 'rgba(46,48,63,0.95)', '--bg3': 'rgba(68,71,90,0.9)',
                '--v': '#bd93f9', '--v2': '#9b6dff', '--v3': '#7a5ccc', '--v-dim': '#44475a',
                '--pink': '#ff79c6', '--cyan': '#8be9fd', '--yellow': '#f1fa8c', '--red': '#ff5555', '--amber': '#ffb86c',
                'body-bg': '#282a36', 'body-color': '#f8f8f2',
                'body-font': "'JetBrains Mono', 'Fira Code', monospace",
                'code-font': "'JetBrains Mono', 'Fira Code', monospace",
                'font-size': '14px',
                'chat-user-bg': 'rgba(189,147,249,0.1)', 'chat-user-border': 'rgba(189,147,249,0.25)',
                'chat-asst-bg': 'rgba(46,48,63,0.75)', 'chat-asst-border': 'rgba(68,71,90,0.5)',
                'chat-role-font': "'JetBrains Mono', monospace",
                '--tok-kw': '#ff79c6', '--tok-str': '#f1fa8c', '--tok-cmt': '#6272a4',
                '--tok-fn': '#50fa7b', '--tok-num': '#bd93f9',
                '--code-bg': 'rgba(33,34,44,0.98)', '--code-header-bg': 'rgba(46,48,63,0.95)', '--code-lang-color': '#bd93f9',
                '--thinking-bg': 'rgba(189,147,249,0.06)', '--thinking-bg-hover': 'rgba(189,147,249,0.1)',
                '--thinking-content-bg': 'rgba(33,34,44,0.5)',
                '--tool-header-bg': 'rgba(189,147,249,0.04)', '--tool-detail-bg': 'rgba(33,34,44,0.6)',
                // Markdown-specific theme tokens
                '--md-h1-color': '#bd93f9', '--md-h2-color': '#8be9fd', '--md-h3-color': '#bd93f9',
                '--md-h1-shadow': 'rgba(189,147,249,0.3)', '--md-h2-border': 'rgba(139,233,253,0.2)',
                '--md-link-color': '#8be9fd', '--md-link-hover': '#50fa7b',
                '--md-strong-color': '#bd93f9', '--md-em-color': '#ff79c6',
                '--md-blockquote-border': '#ff79c6', '--md-blockquote-text': '#6272a4',
                '--md-list-bullet': '#bd93f9', '--md-hr-color': '#44475a',
                '--md-table-header-bg': 'rgba(189,147,249,0.08)', '--md-table-stripe-bg': 'rgba(189,147,249,0.03)',
                '--md-code-bg': 'rgba(189,147,249,0.1)', '--md-code-color': '#ff79c6',
                '--md-code-header-accent': '#bd93f9',
            },
        },

        applyTheme(name) {
            const vars = this.themes[name];
            if (!vars) return;
            const root = document.documentElement;
            for (const [prop, val] of Object.entries(vars)) {
                if (prop === 'body-bg') {
                    document.body.style.background = val;
                } else if (prop === 'body-color') {
                    document.body.style.color = val;
                } else if (prop === 'body-font') {
                    document.body.style.fontFamily = val;
                } else if (prop === 'font-size' || prop === 'code-font') {
                    // font-size handled by zoom in applySettings(), code-font as CSS var
                    if (prop === 'code-font') root.style.setProperty('--code-font', val);
                } else {
                    root.style.setProperty(prop, val);
                }
            }
            if (vars['chat-role-font']) root.style.setProperty('--chat-role-font', vars['chat-role-font']);
            if (vars['chat-user-bg']) root.style.setProperty('--chat-user-bg', vars['chat-user-bg']);
            if (vars['chat-user-border']) root.style.setProperty('--chat-user-border', vars['chat-user-border']);
            if (vars['chat-asst-bg']) root.style.setProperty('--chat-asst-bg', vars['chat-asst-bg']);
            if (vars['chat-asst-border']) root.style.setProperty('--chat-asst-border', vars['chat-asst-border']);
        },
    };
})();
