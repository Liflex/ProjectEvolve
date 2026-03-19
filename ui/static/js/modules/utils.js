// === AppUtils — shared utility functions ===
// Loaded before app.js, spread into Alpine data object
window.AppUtils = (function() {
    return {
        api(url, opts = {}) {
            return fetch(url, opts).then(async r => {
                if (!r.ok) {
                    let detail = '';
                    try {
                        const j = await r.json();
                        detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail || j);
                    } catch (e) {
                        detail = r.status + ' ' + r.statusText;
                    }
                    throw new Error(detail);
                }
                return r.json();
            });
        },

        showToast(msg, type = 'success') {
            this.toast = { show: true, message: msg, type };
            setTimeout(() => { this.toast.show = false; }, 3000);
        },

        fmtTime(ts) {
            if (!ts) return '';
            const d = new Date(ts);
            return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        },

        relativeTime(ts) {
            if (!ts) return '';
            const diff = Math.floor((Date.now() - ts) / 1000);
            if (diff < 10) return 'сейчас';
            if (diff < 60) return diff + 'с';
            if (diff < 3600) { const m = Math.floor(diff / 60); return m + 'м'; }
            if (diff < 86400) { const h = Math.floor(diff / 3600); const m = Math.floor((diff % 3600) / 60); return m > 0 ? h + 'ч ' + m + 'м' : h + 'ч'; }
            const d = new Date(ts);
            return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2);
        },

        dateGroupLabel(ts) {
            if (!ts) return '';
            const now = new Date();
            const d = new Date(ts);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diffDays = Math.floor((today - msgDay) / 86400000);
            if (diffDays === 0) return 'Сегодня';
            if (diffDays === 1) return 'Вчера';
            const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            const day = d.getDate();
            const month = months[d.getMonth()];
            const year = d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '';
            return day + ' ' + month + year;
        },

        formatFileSize(bytes) {
            if (bytes < 1024) return bytes + 'B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
            return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
        },

        insertTab(e) {
            const ta = e.target, s = ta.selectionStart;
            ta.value = ta.value.substring(0, s) + '    ' + ta.value.substring(ta.selectionEnd);
            ta.selectionStart = ta.selectionEnd = s + 4;
            this.prompt = ta.value;
        },

        typeBadgeCls(t) {
            return { 'Bug Fix': 't-bugfix', 'Security': 't-security', 'Feature': 't-feature', 'Refactoring': 't-refactor', 'Improvement': 't-improvement', 'Docs': 't-docs' }[t] || 't-other';
        },
        typeBarCls(t) {
            return { 'Bug Fix': 'bg-[var(--red)]', 'Security': 'bg-[var(--amber)]', 'Feature': 'bg-[var(--cyan)]', 'Refactoring': 'bg-[var(--pink)]', 'Improvement': 'bg-[var(--ng)]', 'Docs': 'bg-[#cc88ff]' }[t] || 'bg-[#555]';
        },
        scoreCls(s) {
            try { const v = parseFloat(s); return v >= 0.85 ? 'text-[var(--v)] glow-sm' : v >= 0.7 ? 'text-[var(--amber)]' : 'text-[var(--red)]'; } catch (e) { return 'text-[var(--v3)]'; }
        },
        decisionCls(d) {
            return d === 'KEEP' || d === 'ACCEPT' ? 'text-[var(--ng)]' : d === 'DISCARD' ? 'text-[var(--red)]' : 'text-[var(--amber)]';
        },
    };
})();
