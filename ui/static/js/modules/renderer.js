// === AppRenderer — Markdown rendering, syntax highlighting, HTML utilities ===
// Loaded before app.js, spread into Alpine data object
window.AppRenderer = (function() {
    return {
        escHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },

        linkFilePaths(html) {
            if (!html) return '';
            // Protect <code> blocks and <a> tags from modification
            const protectedBlocks = [];
            let result = html.replace(/<(?:code|a)[\s>][\s\S]*?<\/(?:code|a)>/gi, (m) => {
                protectedBlocks.push(m);
                return '\x00PB' + (protectedBlocks.length - 1) + '\x00';
            });
            const pathRe = /((?:[a-zA-Z0-9_.\-]+[\\\/]|[A-Za-z]:[\\\/]|[.\/~])[a-zA-Z0-9_.\-\\\/]+\.[a-zA-Z0-9_\-]{1,8})/g;
            result = result.replace(pathRe, (match) => {
                const rawPath = match.replace(/\\/g, '/').replace(/'/g, "\\'");
                return '<span class="fp-link" onclick="event.stopPropagation();navigator.clipboard.writeText(\'' + rawPath + '\').then(function(){window._app&&window._app.showToast(\'Путь скопирован\')})" title="' + match.replace(/"/g, '&quot;') + ' \u2014 click to copy">' + match + '</span>';
            });
            for (let i = 0; i < protectedBlocks.length; i++) {
                result = result.replace('\x00PB' + i + '\x00', protectedBlocks[i]);
            }
            return result;
        },

        highlightCode(code, lang) {
            const l = (lang || '').toLowerCase();
            const kwSets = {
                python: /\b(def|class|if|elif|else|for|while|return|import|from|as|with|try|except|finally|raise|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|async|await|nonlocal|global|assert|del)\b/g,
                javascript: /\b(function|const|let|var|if|else|for|while|return|import|export|from|class|new|this|try|catch|finally|throw|async|await|yield|typeof|instanceof|null|undefined|true|false|switch|case|default|break|continue|of|in|delete|void|super|extends|static|get|set)\b/g,
                bash: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|source|alias|unset|local|readonly|declare|set|shift|trap|eval|exec|cd|pwd|test)\b/g,
                generic: /\b(if|else|for|while|return|function|class|import|export|const|let|var|new|try|catch|throw|true|false|null|nil|None|self|this|def|end|do|begin|module|package|struct|enum|interface|type|pub|fn|impl|use|match|async|await)\b/g
            };
            const kw = kwSets[l] || kwSets[({ py: 'python', js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', sh: 'bash', shell: 'bash', zsh: 'bash' })[l]] || kwSets.generic;
            const isHash = l === 'python' || l === 'py' || l === 'bash' || l === 'sh' || l === 'shell' || l === 'zsh' || l === 'ruby' || l === 'yaml' || l === 'yml';
            const isSlash = !isHash || l === 'javascript' || l === 'js' || l === 'ts' || l === 'tsx' || l === 'jsx' || l === 'java' || l === 'c' || l === 'cpp' || l === 'go' || l === 'rust' || l === 'kotlin' || l === '';
            const tokens = [];
            const re = /(&#39;&#39;&#39;[\s\S]*?&#39;&#39;&#39;|&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;|&#39;(?:[^&#]|&#\w+;)*?&#39;|&quot;(?:[^&#]|&#\w+;)*?&quot;|`(?:[^`\\]|\\.)*?`)|(#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\b\d+\.?\d*\b)/g;
            let last = 0, m;
            while ((m = re.exec(code)) !== null) {
                if (m.index > last) tokens.push({ type: 'code', text: code.slice(last, m.index) });
                if (m[1]) tokens.push({ type: 'str', text: m[0] });
                else if (m[2]) {
                    const c = m[2];
                    if ((c.startsWith('#') && isHash) || (c.startsWith('//') && isSlash) || c.startsWith('/*'))
                        tokens.push({ type: 'cmt', text: m[0] });
                    else tokens.push({ type: 'code', text: m[0] });
                }
                else if (m[3]) tokens.push({ type: 'num', text: m[0] });
                last = re.lastIndex;
            }
            if (last < code.length) tokens.push({ type: 'code', text: code.slice(last) });
            return tokens.map(t => {
                if (t.type === 'str') return '<span class="tok-str">' + t.text + '</span>';
                if (t.type === 'cmt') return '<span class="tok-cmt">' + t.text + '</span>';
                if (t.type === 'num') return '<span class="tok-num">' + t.text + '</span>';
                return t.text.replace(kw, '<span class="tok-kw">$1</span>')
                    .replace(/(\w+)(\()/g, '<span class="tok-fn">$1</span>$2');
            }).join('');
        },

        renderMarkdown(t) {
            if (!t) return '';
            try {
                const html = marked.parse(t, { breaks: true });
                const str = typeof html === 'string' ? html : String(html);
                const clean = DOMPurify.sanitize(str, { ADD_ATTR: ['class'] });
                // Language-specific accent colors for code block headers
                const langAccents = {
                    python: '#3572A5', py: '#3572A5',
                    javascript: '#f1e05a', js: '#f1e05a', jsx: '#61dafb', tsx: '#3178c6',
                    typescript: '#3178c6', ts: '#3178c6',
                    bash: '#89e051', sh: '#89e051', shell: '#89e051', zsh: '#89e051',
                    json: '#292929', yaml: '#cb171e', yml: '#cb171e',
                    html: '#e34c26', css: '#563d7c',
                    rust: '#dea584', rs: '#dea584',
                    go: '#00ADD8', java: '#b07219',
                    sql: '#e38c00', markdown: '#083fa1', md: '#083fa1',
                    cpp: '#f34b7d', c: '#555555', ruby: '#701516', php: '#4F5D95',
                };
                return clean.replace(/<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
                    (match, lang, code) => {
                        const label = lang ? lang.toUpperCase() : 'CODE';
                        const id = 'cb-' + Math.random().toString(36).slice(2, 8);
                        const highlighted = this.highlightCode(code, lang);
                        const lines = highlighted.split('\n');
                        if (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
                        const lineCount = lines.length;
                        const numbered = lines.map(l => '<span class="code-line">' + (l || ' ') + '</span>').join('\n');
                        const accentColor = langAccents[(lang || '').toLowerCase()] || 'var(--md-code-header-accent, var(--v3))';
                        return '<div class="code-block"><div class="code-header">'
                            + '<span class="code-lang" style="color:' + accentColor + '">' + label + '</span>'
                            + '<span class="code-lines-count">' + lineCount + ' lines</span>'
                            + '<span class="code-copy" onclick="window._copyCode(this,\'' + id + '\')">[COPY]</span>'
                            + '</div><pre id="' + id + '"><code>' + numbered + '</code></pre></div>';
                    });
            } catch (e) {
                console.error('[renderMarkdown]', e);
                return t.replace(/</g, '&lt;').replace(/\n/g, '<br>');
            }
        },
    };
})();
