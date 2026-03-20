// === AppLab — Lab experiments, dashboard, run control, research WebSocket ===
// Loaded before app.js, spread into Alpine data object
window.AppLab = (function() {
    return {
        // --- Chart helpers ---
        scoreTrendSvg() {
            const t = this.stats.score_trend || [];
            if (!t.length) return '';
            return t.map((p, i) => {
                const x = 40 + i * 28;
                const y = 85 - (p.score || 0) * 80;
                const c = p.decision === 'KEEP' ? 'var(--ng)' : p.decision === 'DISCARD' ? 'var(--red)' : 'var(--amber)';
                const lv = (i % 5 === 0) ? '' : ' visibility="hidden"';
                return '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + c + '" stroke="var(--bg2)" stroke-width="0.5"/><text x="' + x + '" y="97" fill="var(--v3)" font-size="7" font-family="VT323,monospace" text-anchor="middle"' + lv + '>#' + (p.number || i + 1) + '</text>';
            }).join('');
        },
        movingAvgPoints() {
            const t = this.stats.score_trend || [];
            if (t.length < 3) return '';
            const w = 3; const pts = [];
            for (let i = 0; i < t.length; i++) {
                const start = Math.max(0, i - w + 1);
                const end = Math.min(t.length, i + 1);
                let sum = 0;
                for (let j = start; j < end; j++) sum += (t[j].score || 0);
                const avg = sum / (end - start);
                pts.push((40 + i * 28) + ',' + (85 - avg * 80));
            }
            return pts.join(' ');
        },
        scoreTrendHitTest(e) {
            const svg = e.currentTarget;
            if (!svg || !svg.viewBox || !svg.viewBox.baseVal) return null;
            const rect = svg.getBoundingClientRect();
            const scaleX = svg.viewBox.baseVal.width / rect.width;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * (svg.viewBox.baseVal.height / rect.height);
            const t = this.stats.score_trend || [];
            let best = null; let bestDist = 20;
            for (let i = 0; i < t.length; i++) {
                const x = 40 + i * 28;
                const y = 85 - (t[i].score || 0) * 80;
                const d = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
                if (d < bestDist) { bestDist = d; best = { idx: i, ...t[i], px: e.clientX - rect.left, py: e.clientY - rect.top }; }
            }
            return best;
        },

        // --- Data loading ---
        async loadStats() {
            try {
                const prevTotal = this.stats.total_experiments || 0;
                const data = await this.api('/api/stats');
                data.last_experiment = data.last_experiment || { number: 0, title: 'No experiments yet', date: '', type: '', score: '0.5', decision: 'N/A', what_done: '', files_modified: [], results: '', notes: '' };
                data.score_trend = data.score_trend || [];
                data.type_distribution = data.type_distribution || {};
                this.stats = data;
                const newTotal = this.stats.total_experiments || 0;
                // Cat: detect new experiments
                if (newTotal > prevTotal) {
                    const lastExp = this.stats.last_experiment;
                    if (lastExp && window.CatModule && CatModule.isActive() && CatModule.reactToExperiment) {
                        CatModule.reactToExperiment(lastExp.decision, parseFloat(lastExp.score) || 0, lastExp.number || newTotal);
                    }
                }
                // Organism: update visualizer
                if (window.OrganismModule) {
                    const totalExp = this.stats.total_experiments || 0;
                    const avgScore = this.stats.avg_score || 0;
                    const typeDist = this.stats.type_distribution || {};
                    const isRunning = this.runStatus.running;
                    this.organismSVG = OrganismModule.renderSVG(totalExp, avgScore, typeDist, isRunning);
                    this.organismStage = OrganismModule.getStage(totalExp).name;
                }
            } catch (e) { }
        },
        async loadExperiments() {
            try {
                const data = await this.api('/api/experiments');
                this.experiments = Array.isArray(data) ? data.filter(e => e && typeof e === 'object' && e.number != null).reverse() : [];
                this._heatmapData = this.heatmapData();
                this._streakData = this.streakData();
            } catch (e) { this.experiments = []; }
        },

        // --- Activity heatmap ---
        heatmapData() {
            const exps = this.experiments || [];
            if (!exps.length) return { weeks: [], maxCount: 0, totalDays: 0, todayCount: 0, weekCount: 0 };
            // Parse experiment dates and count per day
            const dayCounts = {};
            const today = new Date(); today.setHours(0,0,0,0);
            const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
            let todayCount = 0, weekCount = 0;
            for (const exp of exps) {
                if (!exp.date) continue;
                const d = new Date(exp.date); d.setHours(0,0,0,0);
                if (isNaN(d.getTime())) continue;
                const key = d.toISOString().slice(0, 10);
                dayCounts[key] = (dayCounts[key] || 0) + 1;
                if (d.getTime() === today.getTime()) todayCount++;
                if (d >= weekAgo) weekCount++;
            }
            // Build 12-week grid (84 days), ending today
            const totalDays = 84;
            const startDate = new Date(today); startDate.setDate(startDate.getDate() - totalDays + 1);
            const weeks = [];
            let currentWeek = [];
            let activeDays = 0;
            for (let i = 0; i < totalDays; i++) {
                const d = new Date(startDate); d.setDate(d.getDate() + i);
                const key = d.toISOString().slice(0, 10);
                const count = dayCounts[key] || 0;
                if (count > 0) activeDays++;
                currentWeek.push({ date: key, count, dayOfWeek: d.getDay() });
                if (currentWeek.length === 7 || i === totalDays - 1) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }
            const maxCount = Math.max(1, ...Object.values(dayCounts));
            return { weeks, maxCount, totalDays: activeDays, todayCount, weekCount };
        },

        heatmapLevel(count, maxCount) {
            if (count === 0) return 0;
            if (maxCount <= 1) return count > 0 ? 3 : 0;
            const ratio = count / maxCount;
            if (ratio <= 0.25) return 1;
            if (ratio <= 0.5) return 2;
            if (ratio <= 0.75) return 3;
            return 4;
        },

        heatmapColor(level) {
            const colors = ['var(--bg)', 'rgba(180,74,255,0.15)', 'rgba(180,74,255,0.3)', 'rgba(180,74,255,0.5)', 'rgba(180,74,255,0.75)'];
            return colors[level] || colors[0];
        },

        heatmapMonthLabels() {
            const hm = this.heatmapData();
            if (!hm.weeks.length) return '';
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            let html = '';
            let lastMonth = -1;
            for (let wi = 0; wi < hm.weeks.length; wi++) {
                const week = hm.weeks[wi];
                if (!week.length) continue;
                const firstDay = week[0];
                const d = new Date(firstDay.date);
                const m = d.getMonth();
                if (m !== lastMonth) {
                    lastMonth = m;
                    const left = wi * 14; // 11px cell + 3px gap
                    html += '<span style="position:absolute;left:' + left + 'px;bottom:-16px;font-size:0.5rem;color:var(--v3);white-space:nowrap">' + months[m] + '</span>';
                }
            }
            return html;
        },

        // --- Score distribution histogram ---
        scoreDistribution() {
            const exps = this.experiments || [];
            if (!exps.length) return [];
            const buckets = [
                { label: '0.0-0.2', min: 0, max: 0.2, count: 0 },
                { label: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
                { label: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
                { label: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
                { label: '0.8-1.0', min: 0.8, max: 1.01, count: 0 },
            ];
            for (const exp of exps) {
                const s = parseFloat(exp.score);
                if (isNaN(s)) continue;
                for (const b of buckets) {
                    if (s >= b.min && s < b.max) { b.count++; break; }
                }
            }
            return buckets;
        },
        scoreDistributionMax() {
            const dist = this.scoreDistribution();
            return Math.max(1, ...dist.map(b => b.count));
        },
        scoreDistributionBarColor(idx) {
            const colors = ['var(--red)', 'var(--amber)', 'var(--yellow)', 'var(--cyan)', 'var(--ng)'];
            return colors[idx] || 'var(--v3)';
        },

        // --- Average score by type ---
        scoreByType() {
            const exps = this.experiments || [];
            if (!exps.length) return [];
            const map = {};
            for (const exp of exps) {
                const t = exp.type || 'Other';
                if (!map[t]) map[t] = { type: t, scores: [], keep: 0, discard: 0 };
                map[t].scores.push(parseFloat(exp.score) || 0);
                if (exp.decision === 'KEEP' || exp.decision === 'ACCEPT') map[t].keep++;
                else if (exp.decision === 'DISCARD') map[t].discard++;
            }
            return Object.values(map)
                .map(g => ({
                    type: g.type,
                    avg: g.scores.length ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 0,
                    count: g.scores.length,
                    keep: g.keep,
                    discard: g.discard,
                    min: Math.min(...g.scores),
                    max: Math.max(...g.scores),
                }))
                .sort((a, b) => b.count - a.count);
        },

        // --- Streak tracking ---
        streakData() {
            const exps = this.experiments || [];
            if (!exps.length) return { current: 0, best: 0, currentDiscard: 0 };
            let current = 0, best = 0, streak = 0, currentDiscard = 0, dStreak = 0, bestDiscard = 0;
            // Walk from newest to oldest
            for (let i = exps.length - 1; i >= 0; i--) {
                const d = exps[i].decision;
                if (d === 'KEEP' || d === 'ACCEPT') {
                    streak++;
                    dStreak = 0;
                    if (streak > best) best = streak;
                    // Track current only from the end
                    if (current === 0 && currentDiscard === 0) current = streak;
                    else if (currentDiscard > 0) break; // streak broken before we started counting
                } else if (d === 'DISCARD') {
                    dStreak++;
                    streak = 0;
                    if (dStreak > bestDiscard) bestDiscard = dStreak;
                    if (current === 0 && currentDiscard === 0) currentDiscard = dStreak;
                    else if (current > 0) break;
                } else {
                    streak = 0; dStreak = 0;
                }
            }
            return { current, best, currentDiscard, bestDiscard };
        },

        // --- Goal progress tracker ---
        goalProgressData() {
            const goals = this.config?.goals || [];
            const completed = this.config?.completed_goals || [];
            const total = goals.length + completed.length;
            if (total === 0) return { total: 0, active: 0, completed: 0, percent: 0, goals: [], completedGoals: [] };
            // Classify active goals by status keywords
            const activeGoals = goals.map((g, i) => {
                const text = g.toLowerCase();
                let status = 'pending'; // pending | in-progress | needs-backend
                if (/реализовано|done|complete|реализован/im.test(g)) status = 'done-note';
                else if (/осталось|partially|частично/im.test(g)) status = 'in-progress';
                else if (/система|мультиагент|судей|judgement/im.test(g)) status = 'needs-backend';
                else if (/улучшени/im.test(g)) status = 'in-progress';
                // Extract a short label (first ~60 chars)
                const label = g.length > 80 ? g.slice(0, 77) + '...' : g;
                return { idx: i, text: g, label, status };
            });
            const completedGoals = completed.map((g, i) => {
                const label = g.length > 80 ? g.slice(0, 77) + '...' : g;
                return { idx: i, text: g, label };
            });
            return {
                total,
                active: goals.length,
                completed: completed.length,
                percent: total > 0 ? Math.round((completed.length / total) * 100) : 0,
                goals: activeGoals,
                completedGoals,
            };
        },
        goalStatusIcon(status) {
            const icons = {
                'pending': '&#x25CB;',       // ○
                'in-progress': '&#x25C9;',   // ◉
                'needs-backend': '&#x25C7;',  // ◇
                'done-note': '&#x2713;',      // ✓
            };
            return icons[status] || '&#x25CB;';
        },
        goalStatusColor(status) {
            const colors = {
                'pending': 'var(--v3)',
                'in-progress': 'var(--cyan)',
                'needs-backend': 'var(--amber)',
                'done-note': 'var(--ng)',
            };
            return colors[status] || 'var(--v3)';
        },
        goalStatusWeight(status) {
            // Sort order: in-progress first, then pending, needs-backend, done-note
            const weights = { 'in-progress': 0, 'pending': 1, 'needs-backend': 2, 'done-note': 3 };
            return weights[status] ?? 1;
        },
        goalProgressPct() {
            return this.goalProgressData().percent;
        },

        // --- Experiment detail ---
        toggleExperiment(n) {
            if (this.selectedExp === n) { this.selectedExp = null; this.selectedExpData = null; this.fileDiffData = null; this.judgeVerdict = null; return; }
            this.loadExperiment(n);
        },
        async loadExperiment(n) {
            this.selectedExp = n; this.expLoading = true; this.expDetailTab = 'output'; this.fileDiffData = null; this.judgeVerdict = null;
            try {
                const data = await this.api('/api/experiments/' + n);
                this.selectedExpData = data;
            } catch (e) {
                console.error('[loadExperiment] FAILED:', e);
                this.showToast('LOAD FAILED', 'error');
                this.selectedExp = null; this.selectedExpData = null;
            } finally { this.expLoading = false; }
        },
        async loadFileDiff(filepath) {
            this.fileDiffData = null; this.fileDiffLoading = true;
            try {
                const encoded = encodeURIComponent(filepath);
                const data = await this.api('/api/git/diff/' + encoded);
                this.fileDiffData = data;
            } catch (e) {
                console.error('[loadFileDiff] FAILED:', e);
                this.showToast('DIFF LOAD FAILED', 'error');
            } finally { this.fileDiffLoading = false; }
        },
        renderDiffHtml(diff, ext) {
            if (!diff || !diff.trim()) return '';
            const lines = diff.split('\n');
            let html = '';
            for (const line of lines) {
                if (line.startsWith('+++') || line.startsWith('---')) {
                    html += '<div style="color:var(--v);font-weight:bold">' + this.escHtml(line) + '</div>';
                } else if (line.startsWith('@@')) {
                    html += '<div style="color:var(--cyan);font-weight:bold;background:rgba(0,229,255,0.05)">' + this.escHtml(line) + '</div>';
                } else if (line.startsWith('+')) {
                    html += '<div style="background:rgba(57,255,20,0.06);border-left:2px solid rgba(57,255,20,0.3)">' + this.escHtml(line) + '</div>';
                } else if (line.startsWith('-')) {
                    html += '<div style="background:rgba(255,51,102,0.06);border-left:2px solid rgba(255,51,102,0.3)">' + this.escHtml(line) + '</div>';
                } else if (line.startsWith(' ')) {
                    html += '<div style="color:var(--ng3)">' + this.escHtml(line) + '</div>';
                } else {
                    html += '<div style="color:var(--v3)">' + this.escHtml(line) + '</div>';
                }
            }
            return html;
        },

        // --- Compare ---
        toggleCompare(n) {
            const idx = this.compareExps.indexOf(n);
            if (idx >= 0) { this.compareExps.splice(idx, 1); }
            else if (this.compareExps.length < 2) { this.compareExps.push(n); }
        },

        // --- Judge ---
        async judgeExperiment(n, profile) {
            this.judgeVerdict = null;
            this.judgeAllVerdicts = null;
            try {
                const url = '/api/judge/' + n + (profile && profile !== 'balanced' ? '?profile=' + profile : '');
                this.judgeVerdict = await this.api(url);
            } catch (e) {
                console.error('[judgeExperiment] FAILED:', e);
                this.showToast('JUDGE FAILED', 'error');
            }
        },
        async judgeExperimentAll(n) {
            this.judgeVerdict = null;
            this.judgeAllVerdicts = null;
            this.judgeProfileView = null;
            try {
                this.judgeAllVerdicts = await this.api('/api/judge/' + n + '/all');
            } catch (e) {
                console.error('[judgeExperimentAll] FAILED:', e);
                this.showToast('ALL JUDGES FAILED', 'error');
            }
        },
        async runCompare() {
            if (this.compareExps.length !== 2) return;
            this.compareLoading = true; this.compareData = {};
            try {
                const [d1, d2] = await Promise.all([
                    this.api('/api/experiments/' + this.compareExps[0]),
                    this.api('/api/experiments/' + this.compareExps[1]),
                ]);
                this.compareData[this.compareExps[0]] = d1;
                this.compareData[this.compareExps[1]] = d2;
            } catch (e) {
                console.error('[runCompare] FAILED:', e);
                this.showToast('COMPARE FAILED', 'error');
                this.compareData = {};
            } finally { this.compareLoading = false; }
        },
        compareFields() {
            const a = this.compareData[this.compareExps[0]];
            const b = this.compareData[this.compareExps[1]];
            if (!a || !b) return [];
            const esc = (s) => s ? this.renderMarkdown(String(s)) : '<span class="text-[var(--v3)]">—</span>';
            const badge = (type) => `<span class="text-[0.5625rem] px-1 py-px inline-block ${this.typeBadgeCls(type)}">${type || 'N/A'}</span>`;
            const scoreH = (s) => `<span class="${this.scoreCls(s)}" style="font-family:'Press Start 2P',monospace">${s}</span>`;
            const decH = (d) => `<span class="${this.decisionCls(d)}">${d}</span>`;
            return [
                { key: 'title', label: 'TITLE', diff: a.title !== b.title, renderLeft: esc(a.title), renderRight: esc(b.title) },
                { key: 'type', label: 'TYPE', diff: a.type !== b.type, renderLeft: badge(a.type), renderRight: badge(b.type) },
                { key: 'score', label: 'SCORE', diff: a.score !== b.score, renderLeft: scoreH(a.score), renderRight: scoreH(b.score) },
                { key: 'decision', label: 'DECISION', diff: a.decision !== b.decision, renderLeft: decH(a.decision), renderRight: decH(b.decision) },
                { key: 'date', label: 'DATE', diff: a.date !== b.date, renderLeft: esc(a.date), renderRight: esc(b.date) },
            ];
        },
        compareSharedFiles() {
            const a = this.compareData[this.compareExps[0]]?.files_modified || [];
            const b = this.compareData[this.compareExps[1]]?.files_modified || [];
            return a.filter(f => b.includes(f));
        },

        // --- CRUD ---
        async loadChangesLog() { try { this.changesLog = (await this.api('/api/changes-log')).content; } catch (e) { } },
        async loadPrompt() { try { this.prompt = (await this.api('/api/prompt')).content; } catch (e) { } },
        async savePrompt() {
            this.promptSaving = true;
            try { await this.api('/api/prompt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.prompt }) }); this.showToast('PROMPT COMPILED', 'success'); }
            catch (e) { this.showToast('COMPILE FAILED', 'error'); } finally { this.promptSaving = false; }
        },
        async loadConfig() { try { this.config = await this.api('/api/config'); } catch (e) { } },
        async saveConfig() {
            this.configSaving = true;
            try { await this.api('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.config) }); this.showToast('CONFIG COMMITTED', 'success'); }
            catch (e) { this.showToast('COMMIT FAILED', 'error'); } finally { this.configSaving = false; }
        },

        // --- Research WebSocket ---
        connectResearchWs() {
            if (this.researchWs && this.researchWs.readyState <= 1) return;
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const url = `${proto}//${location.host}/ws/research`;
            console.log('[lab] connectResearchWs() connecting to:', url);
            this.researchWs = new WebSocket(url);
            this.researchWs.onopen = () => console.log('[lab] WS OPEN');
            this.researchWs.onerror = (e) => console.error('[lab] WS ERROR', e);
            this.researchWs.onmessage = (e) => {
                try {
                    const event = JSON.parse(e.data);
                    // DEBUG: log every received event
                    if (!event.type || event.type !== 'tokens_update') {
                        console.log('[lab] WS event:', event.type, JSON.stringify(event).slice(0, 300));
                    }
                    // Live log — use window._app (Alpine proxy) for reactivity
                    const entry = this._formatLiveLogEntry(event);
                    if (entry) {
                        const _a = window._app;
                        if (_a && !_a.liveLogPaused) {
                            _a.liveLog = [...(_a.liveLog || []), entry];
                            if (_a.liveLog.length > (_a._liveLogMax || 500)) {
                                _a.liveLog = _a.liveLog.slice(_a.liveLog.length - (_a._liveLogMax || 500));
                            }
                            _a.scrollLiveLog();
                        }
                    }
                    // Status updates
                    if (event.type === 'tokens_update' && event.input_tokens !== undefined) {
                        this.runStatus.tokens = event;
                    } else if (event.type === 'session_reset') {
                        this.runStatus.session_id = null;
                    } else if (event.type === 'experiment_start') {
                        this.runStatus.current_exp = event.number;
                        this.runStatus.session_id = event.session_id;
                        if (event.tokens) this.runStatus.tokens = event.tokens;
                        if (window.CatModule && CatModule.isActive()) {
                            CatModule.setExpression('surprised');
                            if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                            CatModule.setSpeechText('Новый эксперимент! Мяу!', 3000);
                            setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('thinking'); }, 2000);
                        }
                    } else if (event.type === 'experiment_end') {
                        if (event.tokens) this.runStatus.tokens = event.tokens;
                        this.runStatus.session_id = event.session_id;
                        if (window.CatModule && CatModule.isActive() && CatModule.reactToExperiment) {
                            CatModule.reactToExperiment(
                                event.decision || event.status || '',
                                parseFloat(event.score) || 0,
                                event.number || this.runStatus.current_exp || 0
                            );
                        }
                    } else if (event.type === 'run_end') {
                        this.runStatus.running = false;
                        this.pollRunStatus();
                        if (window.CatModule && CatModule.isActive()) {
                            CatModule.setExpression('sleepy'); CatModule.setMood('sleepy');
                            if (CatModule.triggerStretch) CatModule.triggerStretch();
                            CatModule.setSpeechText('*устало моргает*... Всё_', 5000);
                            setTimeout(() => {
                                if (CatModule.isActive()) { CatModule.setExpression('neutral'); CatModule.setMood('neutral'); }
                            }, 8000);
                        }
                    }
                } catch (err) { }
            };
            this.researchWs.onclose = () => {
                if (this.page === 'run' && this.runStatus.running) {
                    setTimeout(() => this.connectResearchWs(), 2000);
                }
            };
        },
        disconnectResearchWs() {
            if (this.researchWs) { this.researchWs.close(); this.researchWs = null; }
        },

        // --- Live Log ---
        _formatLiveLogEntry(event) {
            const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const etype = event.type || '';
            if (etype === 'experiment_start') {
                const n = event.number || 0, t = event.total || 0;
                const cont = event.session_continued ? ' (cont.)' : '';
                return { ts, type: 'exp', icon: '▶', color: 'var(--v)', text: `Эксперимент ${n}/${t}${cont}` };
            } else if (etype === 'experiment_end') {
                const n = event.number || 0, st = event.status || '?', cost = event.cost ? ` | $${event.cost.toFixed(4)}` : '';
                return { ts, type: 'exp', icon: '■', color: event.status === 'KEEP' || event.status === 'ACCEPT' ? 'var(--ng)' : event.status === 'DISCARD' ? 'var(--amber)' : 'var(--v3)', text: `Эксперимент ${n}: ${st}${cost}` };
            } else if (etype === 'run_end') {
                const ok = event.successful || 0, tot = event.total_run || 0, cost = event.total_cost_usd ? ` | $${event.total_cost_usd.toFixed(4)}` : '';
                return { ts, type: 'info', icon: '✓', color: 'var(--ng)', text: `Завершено: ${ok}/${tot} успешно${cost}` };
            } else if (etype === 'session_reset') {
                return { ts, type: 'info', icon: '↻', color: 'var(--amber)', text: `Session reset: ${event.reason || ''}` };
            } else if (etype === 'tokens_update') {
                return null;
            } else if (etype === 'connected') {
                return { ts, type: 'info', icon: '●', color: 'var(--ng)', text: 'WebSocket connected' };
            } else if (etype === 'agent_event') {
                const msgType = event.message_type || '';
                const data = event.data || {};
                if (msgType === 'AssistantMessage') {
                    for (const block of (data.content || [])) {
                        if (typeof block !== 'object') continue;
                        // Plain text block
                        if (block.text) {
                            const txt = block.text.length > 300 ? block.text.slice(0, 300) + '...' : block.text;
                            return { ts, type: 'agent', icon: '◆', color: 'var(--ng2)', text: txt.replace(/\n/g, ' ') };
                        }
                        // Thinking block
                        if (block.thinking) {
                            const txt = block.thinking.length > 200 ? block.thinking.slice(0, 200) + '...' : block.thinking;
                            return { ts, type: 'agent', icon: '💭', color: 'var(--amber)', text: 'thinking: ' + txt.replace(/\n/g, ' ') };
                        }
                        // Tool-use block embedded in AssistantMessage (server sends tools this way)
                        if (block.name && block.input) {
                            const name = block.name;
                            const input = block.input;
                            let detail = '';
                            if (input.command) detail = input.command.length > 80 ? input.command.slice(0, 80) + '...' : input.command;
                            else if (input.file_path) detail = input.file_path.split(/[\\\/]/).pop() || '';
                            else if (input.pattern) detail = input.pattern;
                            else if (input.query) detail = input.query.length > 60 ? input.query.slice(0, 60) + '...' : input.query;
                            const detailStr = detail ? ` → ${detail}` : '';
                            return { ts, type: 'tool', icon: '⚙', color: 'var(--pink)', text: `${name}${detailStr}` };
                        }
                    }
                } else if (msgType === 'UserMessage') {
                    return null;
                } else if (msgType === 'SystemMessage') {
                    const sub = data.subtype || data.data?.subtype || '';
                    return { ts, type: 'info', icon: '◈', color: 'var(--cyan)', text: 'system: ' + (sub || 'init') };
                } else if (msgType === 'ToolUse') {
                    const name = data.name || data.tool_name || '?';
                    const input = data.input || {};
                    let detail = '';
                    if (input.command) detail = input.command.length > 80 ? input.command.slice(0, 80) + '...' : input.command;
                    else if (input.file_path) detail = input.file_path.split('/').pop() || '';
                    else if (input.pattern) detail = input.pattern;
                    else if (input.query) detail = input.query.length > 60 ? input.query.slice(0, 60) + '...' : input.query;
                    const detailStr = detail ? ` → ${detail}` : '';
                    return { ts, type: 'tool', icon: '⚙', color: 'var(--pink)', text: `${name}${detailStr}` };
                } else if (msgType === 'ToolResult') {
                    return null;
                }
                return null;
            } else if (etype === 'log') {
                return { ts, type: 'info', icon: '·', color: 'var(--v3)', text: event.message || '' };
            } else if (etype === 'error') {
                return { ts, type: 'error', icon: '✕', color: 'var(--red)', text: event.message || 'Unknown error' };
            }
            return null;
        },
        filteredLiveLog() {
            const log = this.liveLog || [];
            if (this.liveLogFilter === 'all') return log;
            return log.filter(e => e.type === this.liveLogFilter);
        },
        clearLiveLog() { this.liveLog = []; },
        toggleLiveLogPause() { this.liveLogPaused = !this.liveLogPaused; },
        liveLogFilterCounts() {
            const counts = { all: this.liveLog.length };
            for (const e of this.liveLog) { counts[e.type] = (counts[e.type] || 0) + 1; }
            return counts;
        },
        scrollLiveLog() {
            if (!this.liveLogAutoScroll) return;
            this.$nextTick(() => {
                const el = document.getElementById('live-log-container');
                if (el) el.scrollTop = el.scrollHeight;
            });
        },

        // --- Run control ---
        async startRun() {
            console.log('[lab] startRun() called, config:', JSON.stringify(this.runConfig));
            try {
                const res = await this.api('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.runConfig) });
                console.log('[lab] startRun() API response:', JSON.stringify(res).slice(0, 200));
                this.showToast('EXPERIMENT STARTED', 'success');
                if (window.CatModule) {
                    CatModule.setExpression('working');
                    if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                    CatModule.setMood('neutral');
                    CatModule.setSpeechText('Погнали! *встряхивается*', 3000);
                }
                this.connectResearchWs();
                await this.pollRunStatus();
            } catch (e) {
                console.error('[startRun] FAILED:', e);
                const msg = (e.message || '').toLowerCase();
                if (msg.includes('not configured') || msg.includes('configure')) {
                    this.showToast('PROJECT NOT CONFIGURED — use SETUP WIZARD', 'error');
                    this.showSetupWizard();
                } else {
                    this.showToast('LAUNCH FAILED', 'error');
                }
            }
        },
        async stopRun() {
            try {
                await this.api('/api/run/stop', { method: 'POST' });
                this.showToast('TERMINATED', 'success');
                if (window.CatModule) {
                    CatModule.setExpression('sleepy');
                    CatModule.setSpeechText('*обиженно* Зачем остановили...', 4000);
                    setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 4000);
                }
                await this.pollRunStatus();
            } catch (e) { this.showToast('TERMINATE FAILED', 'error'); }
        },
        async pollRunStatus() {
            try {
                const prevTokens = this.runStatus.tokens;
                const status = await this.api('/api/run/status');
                console.log('[lab] pollRunStatus() running=' + status.running);
                if (status.tokens) { status.tokens = status.tokens; }
                else if (prevTokens) { status.tokens = prevTokens; }
                this.runStatus = status;
                if (this.runStatus.running) {
                    this.$nextTick(() => {
                        const el = this.$refs.logContainer;
                        if (el) el.scrollTop = el.scrollHeight;
                    });
                    this.connectResearchWs();
                }
            } catch (e) { }
        },

        // ========== RUN: FILE BROWSER ==========
        async browseDir(path) {
            try {
                const data = await this.api('/api/fs/list?path=' + encodeURIComponent(path || '.'));
                this._browsePath = path || '.';
                this._browseEntries = data.entries || [];
                return data.entries;
            } catch (e) {
                console.error('[browseDir] FAILED:', e);
                this.showToast('BROWSE FAILED: ' + e.message, 'error');
                return [];
            }
        },
        async navigateDir(path) {
            await this.browseDir(path);
        },
        selectDir(path) {
            this.runConfig.project = path;
            this._showBrowsePanel = false;
            // Run preflight check automatically
            this.runPreflight(path);
        },
        toggleBrowsePanel() {
            this._showBrowsePanel = !this._showBrowsePanel;
            if (this._showBrowsePanel && (!this._browseEntries || this._browseEntries.length === 0)) {
                this.browseDir(this.runConfig.project || '.');
            }
        },

        // ========== RUN: PREFLIGHT CHECK ==========
        async runPreflight(path) {
            try {
                const data = await this.api('/api/fs/preflight?path=' + encodeURIComponent(path || this.runConfig.project || '.'));
                this._preflightResult = data;
                return data;
            } catch (e) {
                console.error('[preflight] FAILED:', e);
                this._preflightResult = { ready: false, checks: [], error: e.message };
                return this._preflightResult;
            }
        },

        // ========== RUN: SETUP WIZARD ==========
        _showSetupWizard: false,
        _setupStep: 0,
        _setupSaving: false,
        _setupData: { name: '', description: '', goals: '', tech_stack: '', focus_areas: '', constraints: '' },

        _setupSteps: [
            { key: 'name', label: 'PROJECT_INFO', icon: '>' },
            { key: 'goals', label: 'GOALS', icon: '>>' },
            { key: 'tech', label: 'STACK_&_FOCUS', icon: '>>>' },
            { key: 'constraints', label: 'CONSTRAINTS', icon: '>>>>' },
        ],

        showSetupWizard() {
            // Pre-fill from existing preflight data if available
            this._setupStep = 0;
            this._setupSaving = false;
            this._setupData = { name: '', description: '', goals: '', tech_stack: '', focus_areas: '', constraints: '' };
            // Try to load existing config for pre-fill
            const path = this.runConfig.project || '.';
            this.api('/api/config?project=' + encodeURIComponent(path)).then(data => {
                if (data && data.name) this._setupData.name = data.name;
                if (data && data.description) this._setupData.description = data.description;
                if (data && data.goals && data.goals.length) this._setupData.goals = data.goals.join('\n');
                if (data && data.tech_stack && data.tech_stack.length) this._setupData.tech_stack = data.tech_stack.join(', ');
                if (data && data.focus_areas && data.focus_areas.length) this._setupData.focus_areas = data.focus_areas.join(', ');
                if (data && data.constraints && data.constraints.length) this._setupData.constraints = data.constraints.join('\n');
            }).catch(() => {});
            this._showSetupWizard = true;
        },
        closeSetupWizard() { this._showSetupWizard = false; },
        nextSetupStep() { if (this._setupStep < this._setupSteps.length - 1) this._setupStep++; },
        prevSetupStep() { if (this._setupStep > 0) this._setupStep--; },
        _setupCanProceed() {
            if (this._setupStep === 0) return this._setupData.name.trim().length > 0;
            if (this._setupStep === 1) return this._setupData.goals.trim().split('\n').filter(l => l.trim()).length > 0;
            return true;
        },
        async saveSetup() {
            this._setupSaving = true;
            try {
                const goals = this._setupData.goals.split('\n').map(l => l.trim()).filter(Boolean);
                const techStack = this._setupData.tech_stack.split(',').map(s => s.trim()).filter(Boolean);
                const focusAreas = this._setupData.focus_areas.split(',').map(s => s.trim()).filter(Boolean);
                const constraints = this._setupData.constraints.split('\n').map(l => l.trim()).filter(Boolean);
                await this.api('/api/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project: this.runConfig.project || '.',
                        name: this._setupData.name.trim(),
                        description: this._setupData.description.trim(),
                        goals, tech_stack: techStack, focus_areas: focusAreas, constraints,
                    }),
                });
                this.showToast('PROJECT CONFIGURED', 'success');
                this._showSetupWizard = false;
                if (window.CatModule) {
                    CatModule.setExpression('happy');
                    CatModule.setSpeechText('Настройка завершена! Готов к работе! =^._.^=', 4000);
                    setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 4000);
                }
                // Re-run preflight
                this.runPreflight(this.runConfig.project);
            } catch (e) {
                console.error('[saveSetup] FAILED:', e);
                this.showToast('SETUP FAILED: ' + e.message, 'error');
            } finally { this._setupSaving = false; }
        },
    };
})();
