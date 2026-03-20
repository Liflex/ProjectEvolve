// Template: Revert Analytics Panel — registered as Alpine component
// Renders inside lab-dashboard.js as a collapsible section.
// Data comes from judgeAnalytics (already fetched by lab.js).
// Falls back to empty state when no revert data is available.
document.addEventListener('alpine:init', function() {
    Alpine.data('revertAnalytics', function(judgeAnalytics) {
        return {
            judgeAnalytics: judgeAnalytics,
            _open: false,
            _loading: false,
            _apiStats: null,
            _apiError: false,

            init() {
                // Try loading dedicated revert-stats API endpoint (graceful fallback)
                this._tryLoadApiStats();
            },

            async _tryLoadApiStats() {
                this._loading = true;
                try {
                    const resp = await fetch('/api/parallel/revert-stats');
                    if (resp.ok) {
                        this._apiStats = await resp.json();
                    }
                } catch {
                    // Endpoint doesn't exist yet — use judgeAnalytics data instead
                    this._apiError = true;
                } finally {
                    this._loading = false;
                }
            },

            // --- Data getters (merge API stats with judgeAnalytics fallback) ---

            get revertEvents() {
                if (this._apiStats && this._apiStats.events) {
                    return this._apiStats.events.slice(0, 20);
                }
                // Fallback: compute from judgeAnalytics
                const ja = this.judgeAnalytics;
                if (!ja || !ja.verdicts) return [];
                return ja.verdicts
                    .filter(function(v) { return v.auto_reverted || v.manually_reverted; })
                    .sort(function(a, b) { return (b.experiment || 0) - (a.experiment || 0); })
                    .slice(0, 20);
            },

            get totalReverts() {
                if (this._apiStats) return this._apiStats.total_reverts || 0;
                var ja = this.judgeAnalytics;
                if (!ja || !ja.verdicts) return 0;
                return ja.verdicts.filter(function(v) { return v.auto_reverted || v.manually_reverted; }).length;
            },

            get totalJudged() {
                if (this._apiStats) return this._apiStats.total_judged || 0;
                return (this.judgeAnalytics && this.judgeAnalytics.total_verdicts) || 0;
            },

            get revertRate() {
                if (this.totalJudged === 0) return '0.0';
                return ((this.totalReverts / this.totalJudged) * 100).toFixed(1);
            },

            get autoReverts() {
                if (this._apiStats) return this._apiStats.auto_reverts || 0;
                var ja = this.judgeAnalytics;
                if (!ja || !ja.verdicts) return 0;
                return ja.verdicts.filter(function(v) { return v.auto_reverted; }).length;
            },

            get manualReverts() {
                if (this._apiStats) return this._apiStats.manual_reverts || 0;
                var ja = this.judgeAnalytics;
                if (!ja || !ja.verdicts) return 0;
                return ja.verdicts.filter(function(v) { return v.manually_reverted; }).length;
            },

            get topReasons() {
                if (this._apiStats && this._apiStats.top_reasons) {
                    return this._apiStats.top_reasons;
                }
                // Fallback: compute from revert events
                var reasons = {};
                var events = this.revertEvents;
                for (var i = 0; i < events.length; i++) {
                    var r = this.revertReason(events[i]);
                    if (r) {
                        reasons[r] = (reasons[r] || 0) + 1;
                    }
                }
                return Object.entries(reasons)
                    .sort(function(a, b) { return b[1] - a[1]; })
                    .slice(0, 5)
                    .map(function(entry) { return { reason: entry[0], count: entry[1] }; });
            },

            // --- Display helpers ---

            revertReason(v) {
                if (v.manually_reverted) return 'Manual revert';
                if (v.auto_reverted) {
                    if (v.consensus === 'DISCARD') return 'Auto-revert: DISCARD';
                    if (v.consensus === 'REWORK') return 'Auto-revert: REWORK';
                    return 'Auto-revert';
                }
                return '';
            },

            revertTypeCls(v) {
                if (v.manually_reverted) return 'text-[var(--amber)]';
                return 'text-[var(--red)]';
            },

            reasonBarWidth(count) {
                var max = Math.max.apply(null, this.topReasons.map(function(r) { return r.count; }));
                return max > 0 ? ((count / max) * 100) + '%' : '0%';
            },

            formatTimestamp(ts) {
                if (!ts) return '';
                try {
                    var d = new Date(ts);
                    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
                           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                } catch (e) {
                    return ts;
                }
            }
        };
    });
});
