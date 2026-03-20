// Template: Lab Dashboard — loaded before Alpine initializes
(function() {
    const el = document.getElementById('lab-dashboard-root');
    if (!el) return;
    el.innerHTML = `
        <div class="mb-6">
            <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">SYSTEM OVERVIEW</h2>
            <p class="text-xs text-[var(--v3)] mt-1 tracking-wider">PROJECT EVOLUTION METRICS_</p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">TOTAL_EXPS</div>
                <div class="text-3xl text-[var(--v)] mt-1 glow-sm" style="font-family:'Press Start 2P',monospace" x-text="String(stats.total_experiments || 0).padStart(3,'0')"></div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">AVG_QUALITY</div>
                <div class="text-3xl mt-1 text-[var(--v)] glow-sm" style="font-family:'Press Start 2P',monospace" x-text="(stats.avg_score || 0).toFixed(2)"></div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">KEEP/DISCARD</div>
                <div class="flex items-baseline gap-2 mt-1">
                    <span class="text-3xl text-[var(--v)] glow-sm" style="font-family:'Press Start 2P',monospace" x-text="stats.keep_count || 0"></span>
                    <span class="text-[var(--v3)]">/</span>
                    <span class="text-2xl text-[var(--red)]/50" style="font-family:'Press Start 2P',monospace" x-text="stats.discard_count || 0"></span>
                </div>
                <div class="text-[0.5625rem] text-[var(--v3)] mt-1" x-text="stats.total_experiments ? ((stats.keep_count / stats.total_experiments) * 100).toFixed(0) + '% SURVIVAL' : ''"></div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">DIVERSITY</div>
                <div class="text-3xl text-[var(--pink)] mt-1 glow-sm" style="font-family:'Press Start 2P',monospace" x-text="Object.keys(stats.type_distribution || {}).length"></div>
                <div class="text-[0.5625rem] text-[var(--v3)] mt-1">TYPES DISCOVERED</div>
            </div>
        </div>

        <!-- Activity Heatmap + Streaks -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <div class="lg:col-span-2 pixel-border bg-[var(--bg2)] p-4" @mouseleave="heatmapTooltip=null">
                <div class="flex items-center justify-between mb-3">
                    <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">ACTIVITY_HEATMAP_</div>
                    <div class="flex items-center gap-2 text-[0.5rem] text-[var(--v3)]">
                        <span>Less</span>
                        <span class="heatmap-cell" style="background:var(--bg)"></span>
                        <span class="heatmap-cell" style="background:rgba(180,74,255,0.15)"></span>
                        <span class="heatmap-cell" style="background:rgba(180,74,255,0.3)"></span>
                        <span class="heatmap-cell" style="background:rgba(180,74,255,0.5)"></span>
                        <span class="heatmap-cell" style="background:rgba(180,74,255,0.75)"></span>
                        <span>More</span>
                    </div>
                </div>
                <div class="relative overflow-x-auto">
                    <div class="heatmap-grid" style="display:flex;gap:3px">
                        <template x-for="(week, wi) in (_heatmapData?.weeks || [])" :key="wi">
                            <div style="display:flex;flex-direction:column;gap:3px">
                                <template x-for="(day, di) in week" :key="di">
                                    <div class="heatmap-cell"
                                         :style="'background:' + heatmapColor(heatmapLevel(day.count, _heatmapData?.maxCount || 1))"
                                         :title="day.date + ': ' + day.count + ' exp' + (day.count !== 1 ? 's' : '')"
                                         @mouseenter="heatmapTooltip = { date: day.date, count: day.count, el: $event.currentTarget }"
                                         @mouseleave="heatmapTooltip = null">
                                    </div>
                                </template>
                            </div>
                        </template>
                    </div>
                    <!-- Day labels -->
                    <div class="heatmap-day-labels">
                        <span style="position:absolute;left:-20px;top:0px;line-height:11px">Mon</span>
                        <span style="position:absolute;left:-20px;top:33px;line-height:11px">Wed</span>
                        <span style="position:absolute;left:-20px;top:55px;line-height:11px">Fri</span>
                    </div>
                    <!-- Month labels -->
                    <div class="heatmap-month-labels" x-html="heatmapMonthLabels()"></div>
                    <!-- Tooltip -->
                    <div x-show="heatmapTooltip" x-transition.opacity.duration.100ms
                         class="heatmap-tooltip z-30"
                         :style="'position:fixed;left:' + (heatmapTooltip?.el?.getBoundingClientRect().left + 16) + 'px;top:' + (heatmapTooltip?.el?.getBoundingClientRect().top - 8) + 'px'">
                        <div class="text-[0.6875rem] text-[var(--ng2)]" x-text="(heatmapTooltip?.count || 0) + ' experiment' + ((heatmapTooltip?.count || 0) !== 1 ? 's' : '')"></div>
                        <div class="text-[0.5625rem] text-[var(--v3)]" x-text="heatmapTooltip?.date || ''"></div>
                    </div>
                    <!-- Summary -->
                    <div class="flex items-center gap-4 mt-3 text-[0.5625rem] text-[var(--v3)]">
                        <span><span class="text-[var(--ng2)]" x-text="_heatmapData?.totalDays || 0"></span> active days</span>
                        <span><span class="text-[var(--cyan)]" x-text="_heatmapData?.weekCount || 0"></span> this week</span>
                        <span><span class="text-[var(--ng)]" x-text="_heatmapData?.todayCount || 0"></span> today</span>
                    </div>
                </div>
            </div>

            <!-- Streak Tracker -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)] mb-3">STREAK_TRACKER_</div>
                <div class="space-y-3">
                    <!-- Current KEEP streak -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">CURRENT_KEEP</span>
                            <span class="text-lg text-[var(--ng)] glow-green" style="font-family:'Press Start 2P',monospace" x-text="_streakData?.current || 0"></span>
                        </div>
                        <div class="h-1.5 bg-[var(--bg)] overflow-hidden">
                            <div class="h-full bg-[var(--ng)] transition-all duration-500" :style="'width:' + Math.min(100, ((_streakData?.current || 0) / Math.max(_streakData?.best || 1, 1)) * 100) + '%'"></div>
                        </div>
                    </div>
                    <!-- Best KEEP streak -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">BEST_KEEP</span>
                            <span class="text-lg text-[var(--v)] glow-sm" style="font-family:'Press Start 2P',monospace" x-text="_streakData?.best || 0"></span>
                        </div>
                        <div class="h-1.5 bg-[var(--bg)] overflow-hidden">
                            <div class="h-full bg-[var(--v)] transition-all duration-500" :style="'width:' + ((_streakData?.best || 0) > 0 ? '100' : '0') + '%'"></div>
                        </div>
                    </div>
                    <!-- Current DISCARD streak -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">CURRENT_DISCARD</span>
                            <span class="text-lg" :class="(_streakData?.currentDiscard || 0) > 0 ? 'text-[var(--red)]' : 'text-[var(--v3)]'" style="font-family:'Press Start 2P',monospace" x-text="_streakData?.currentDiscard || 0"></span>
                        </div>
                        <div class="h-1.5 bg-[var(--bg)] overflow-hidden">
                            <div class="h-full transition-all duration-500" :class="(_streakData?.currentDiscard || 0) > 0 ? 'bg-[var(--red)]' : ''" :style="'width:' + ((_streakData?.currentDiscard || 0) > 0 ? Math.min(100, ((_streakData?.currentDiscard || 0) / Math.max(_streakData?.bestDiscard || 1, 1)) * 100) : 0) + '%'"></div>
                        </div>
                    </div>
                    <!-- Milestone indicator -->
                    <div class="mt-2 pt-2 border-t border-[var(--v-dim)]">
                        <div class="text-[0.5rem] text-[var(--v3)] tracking-wider mb-1">NEXT_MILESTONE</div>
                        <div x-show="(_streakData?.best || 0) < 5">
                            <span class="text-[0.625rem] text-[var(--amber)]">5 KEEP streak</span>
                            <span class="text-[0.5rem] text-[var(--v3)] ml-1" x-text="'(' + (5 - (_streakData?.best || 0)) + ' more)'"></span>
                        </div>
                        <div x-show="(_streakData?.best || 0) >= 5 &amp;&amp; (_streakData?.best || 0) < 10">
                            <span class="text-[0.625rem] text-[var(--cyan)]">10 KEEP streak</span>
                            <span class="text-[0.5rem] text-[var(--v3)] ml-1" x-text="'(' + (10 - (_streakData?.best || 0)) + ' more)'"></span>
                        </div>
                        <div x-show="(_streakData?.best || 0) >= 10 &amp;&amp; (_streakData?.best || 0) < 20">
                            <span class="text-[0.625rem] text-[var(--ng)]">20 KEEP streak</span>
                            <span class="text-[0.5rem] text-[var(--v3)] ml-1" x-text="'(' + (20 - (_streakData?.best || 0)) + ' more)'"></span>
                        </div>
                        <div x-show="(_streakData?.best || 0) >= 20">
                            <span class="text-[0.625rem] text-[var(--pink)] glow-sm" x-text="'LEGENDARY: ' + (_streakData?.best || 0) + ' streak!'"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Score Chart + Types -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="lg:col-span-2 pixel-border bg-[var(--bg2)] p-4" @mouseleave="chartHover=null">
                <div class="flex items-center justify-between mb-3">
                    <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">QUALITY_TIMELINE_</div>
                    <div class="flex items-center gap-3 text-[0.5rem] text-[var(--v3)]">
                        <span class="flex items-center gap-1"><span class="inline-block w-2 h-0.5 rounded bg-[var(--v)]"></span>SCORE</span>
                        <span class="flex items-center gap-1"><span class="inline-block w-2 h-0.5 rounded bg-[var(--amber)]" style="border-bottom:1px dashed var(--amber)"></span>AVG(3)</span>
                        <span class="flex items-center gap-1"><span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--ng)]"></span>KEEP</span>
                        <span class="flex items-center gap-1"><span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--red)]"></span>DISCARD</span>
                    </div>
                </div>
                <template x-if="!stats.score_trend || stats.score_trend.length === 0">
                    <div class="text-center py-8 text-[var(--v3)] text-sm tracking-widest">NO_DATA</div>
                </template>
                <template x-if="stats.score_trend && stats.score_trend.length > 0">
                    <div class="relative overflow-x-auto">
                        <svg :viewBox="'0 0 ' + Math.max((stats.score_trend?.length || 0) * 28 + 50, 200) + ' 110'" class="w-full h-36"
                             @mousemove="chartHover = scoreTrendHitTest($event)" @click="chartHover && navigate('experiments'); $nextTick(() => loadExperiment(chartHover.number))">
                            <defs>
                                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="var(--v)" stop-opacity="0.15"/>
                                    <stop offset="100%" stop-color="var(--v)" stop-opacity="0.01"/>
                                </linearGradient>
                                <filter id="glowDot"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                            </defs>
                            <!-- Grid -->
                            <line x1="40" y1="5" x2="40" y2="85" stroke="var(--v-dim)" stroke-width="0.5"/>
                            <line x1="40" y1="85" :x2="(stats.score_trend?.length || 0) * 28 + 40" y2="85" stroke="var(--v-dim)" stroke-width="0.5"/>
                            <line x1="40" y1="45" :x2="(stats.score_trend?.length || 0) * 28 + 40" y2="45" stroke="var(--v-dim)" stroke-width="0.3" stroke-dasharray="2 4"/>
                            <text x="22" y="48" fill="var(--v3)" font-size="7" font-family="'VT323',monospace" text-anchor="end">0.5</text>
                            <line x1="40" y1="28" :x2="(stats.score_trend?.length || 0) * 28 + 40" y2="28" stroke="var(--amber)" stroke-width="0.4" stroke-dasharray="4 3" opacity="0.6"/>
                            <text x="22" y="31" fill="var(--amber)" font-size="7" font-family="'VT323',monospace" text-anchor="end" opacity="0.7">0.7</text>
                            <line x1="40" y1="16" :x2="(stats.score_trend?.length || 0) * 28 + 40" y2="16" stroke="var(--cyan)" stroke-width="0.4" stroke-dasharray="4 3" opacity="0.6"/>
                            <text x="22" y="19" fill="var(--cyan)" font-size="7" font-family="'VT323',monospace" text-anchor="end" opacity="0.7">0.85</text>
                            <text x="8" y="9" fill="var(--v3)" font-size="7" font-family="'VT323',monospace">1.0</text>
                            <text x="8" y="89" fill="var(--v3)" font-size="7" font-family="'VT323',monospace">0.0</text>
                            <!-- Area fill -->
                            <polygon :points="'40,85 ' + (stats.score_trend || []).map((p,i) => (40+i*28)+','+(85-(p.score||0)*80)).join(' ') + ' ' + (40+Math.max(0,(stats.score_trend||[]).length-1)*28)+',85'"
                                     fill="url(#scoreGrad)"/>
                            <!-- Score line -->
                            <polyline fill="none" stroke="var(--v)" stroke-width="1.5" stroke-linejoin="round" opacity="0.8"
                                      :points="(stats.score_trend || []).map((p,i) => (40+i*28)+','+(85-(p.score||0)*80)).join(' ')"/>
                            <!-- Moving average (3-point) -->
                            <polyline fill="none" stroke="var(--amber)" stroke-width="1" stroke-linejoin="round" stroke-dasharray="4 3" opacity="0.7"
                                      :points="movingAvgPoints()"/>
                            <!-- Hover crosshair -->
                            <template x-if="chartHover && chartHover.idx != null">
                                <g>
                                    <line :x1="40 + ((chartHover?.idx)||0) * 28" y1="5" :x2="40 + ((chartHover?.idx)||0) * 28" y2="85" stroke="var(--v-dim)" stroke-width="0.5" stroke-dasharray="2 2"/>
                                    <circle :cx="40 + ((chartHover?.idx)||0) * 28" :cy="85 - ((chartHover?.score)||0)*80" r="5" fill="var(--v)" opacity="0.2"/>
                                    <circle :cx="40 + ((chartHover?.idx)||0) * 28" :cy="85 - ((chartHover?.score)||0)*80" r="3" fill="var(--v)" filter="url(#glowDot)"/>
                                </g>
                            </template>
                            <!-- Data points + x-axis labels -->
                            <g x-html="scoreTrendSvg()"></g>
                        </svg>
                        <!-- Tooltip -->
                        <div x-show="chartHover && chartHover.idx != null" x-transition.opacity
                             class="absolute z-20 bg-[var(--bg)] border border-[var(--v-dim)] rounded px-3 py-2 pointer-events-none shadow-lg"
                             :style="'left:' + ((chartHover||{}).px || 0) + 'px; top:' + (((chartHover||{}).py || 0) - 10) + 'px; transform:translateX(-50%)'">
                            <div class="text-[0.625rem] text-[var(--v3)]" x-text="'#' + ((chartHover||{}).number || '')"></div>
                            <div class="text-xs text-[var(--ng2)] max-w-[200px] truncate" x-text="(chartHover||{}).title"></div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-sm" :class="scoreCls((chartHover||{}).score)" style="font-family:'Press Start 2P',monospace" x-text="(chartHover||{}).score"></span>
                                <span class="text-[0.625rem]" :class="decisionCls((chartHover||{}).decision)" x-text="(chartHover||{}).decision"></span>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)] mb-3">GENOME_MAP_</div>
                <div class="space-y-2" x-show="stats.type_distribution">
                    <template x-for="[type, count] in Object.entries(stats.type_distribution || {}).sort((a,b) => b[1]-a[1])" :key="type">
                        <div class="flex items-center gap-2">
                            <span class="text-[0.6875rem] px-1.5 py-px w-20 truncate" :class="typeBadgeCls(type)" x-text="type"></span>
                            <div class="flex-1 h-1.5 bg-[var(--bg)]">
                                <div class="h-full transition-all duration-500" :class="typeBarCls(type)"
                                     :style="'width:' + (count / (stats.total_experiments||1) * 100) + '%'"></div>
                            </div>
                            <span class="text-[0.6875rem] text-[var(--v3)] w-6 text-right" x-text="count"></span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- Score Distribution + Score by Type -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <!-- Score Distribution Histogram -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)] mb-3">SCORE_DISTRIBUTION_</div>
                <template x-if="scoreDistribution().length === 0">
                    <div class="text-center py-6 text-[var(--v3)] text-sm tracking-widest">NO_DATA</div>
                </template>
                <template x-if="scoreDistribution().length > 0">
                    <div>
                        <div class="flex items-end gap-1.5" style="height:80px">
                            <template x-for="(bucket, bi) in scoreDistribution()" :key="bi">
                                <div class="flex-1 flex flex-col items-center gap-1">
                                    <div class="text-[0.5rem] text-[var(--v3)] tabular-nums" x-text="bucket.count || ''"></div>
                                    <div class="w-full transition-all duration-500 rounded-t-sm"
                                         :style="'height:' + Math.max(2, (bucket.count / scoreDistributionMax()) * 60) + 'px;background:' + scoreDistributionBarColor(bi)"
                                         :title="bucket.label + ': ' + bucket.count + ' exp' + (bucket.count !== 1 ? 's' : '')">
                                    </div>
                                </div>
                            </template>
                        </div>
                        <div class="flex gap-1.5 mt-1">
                            <template x-for="(bucket, bi) in scoreDistribution()" :key="'l-'+bi">
                                <div class="flex-1 text-center">
                                    <span class="text-[0.4375rem] text-[var(--v3)] tracking-wider" x-text="bucket.label"></span>
                                </div>
                            </template>
                        </div>
                        <div class="flex items-center gap-2 mt-2 text-[0.5rem] text-[var(--v3)]">
                            <span>BAD</span>
                            <div class="flex-1 h-px bg-[var(--v-dim)]"></div>
                            <span>GOOD</span>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Average Score by Type -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)] mb-3">SCORE_BY_TYPE_</div>
                <template x-if="scoreByType().length === 0">
                    <div class="text-center py-6 text-[var(--v3)] text-sm tracking-widest">NO_DATA</div>
                </template>
                <template x-if="scoreByType().length > 0">
                    <div class="space-y-2">
                        <template x-for="(item, ti) in scoreByType()" :key="item.type">
                            <div>
                                <div class="flex items-center gap-2 mb-0.5">
                                    <span class="text-[0.6875rem] px-1.5 py-px w-20 truncate" :class="typeBadgeCls(item.type)" x-text="item.type"></span>
                                    <div class="flex-1 h-2 bg-[var(--bg)] overflow-hidden rounded-sm">
                                        <div class="h-full transition-all duration-500 rounded-sm"
                                             :class="item.avg >= 0.7 ? 'bg-[var(--ng)]' : item.avg >= 0.5 ? 'bg-[var(--cyan)]' : item.avg >= 0.3 ? 'bg-[var(--amber)]' : 'bg-[var(--red)]'"
                                             :style="'width:' + (item.avg * 100) + '%'">
                                        </div>
                                    </div>
                                    <span class="text-[0.6875rem] tabular-nums w-10 text-right" :class="item.avg >= 0.7 ? 'text-[var(--ng)]' : item.avg >= 0.5 ? 'text-[var(--cyan)]' : item.avg >= 0.3 ? 'text-[var(--amber)]' : 'text-[var(--red)]'"
                                          x-text="item.avg.toFixed(2)"></span>
                                </div>
                                <div class="flex items-center gap-3 text-[0.5rem] text-[var(--v3)]">
                                    <span x-text="item.count + ' exp' + (item.count !== 1 ? 's' : '')"></span>
                                    <span class="text-[var(--ng)]" x-text="item.keep + ' keep'"></span>
                                    <span class="text-[var(--red)]" x-text="item.discard + ' discard'"></span>
                                    <span x-text="'range: ' + item.min.toFixed(1) + '-' + item.max.toFixed(1)"></span>
                                </div>
                            </div>
                        </template>
                    </div>
                </template>
            </div>
        </div>

        <!-- Judge Analytics -->
        <template x-if="judgeAnalytics && judgeAnalytics.total_verdicts > 0">
        <div class="mt-3 pixel-border bg-[var(--bg2)] p-4">
            <div class="flex items-center justify-between mb-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">JUDGE_ANALYTICS_</div>
                <div class="flex items-center gap-3">
                    <span class="text-[0.5rem] text-[var(--v3)]" x-text="judgeAnalytics.total_verdicts + ' JUDGED'"></span>
                    <span class="text-sm text-[var(--cyan)]" style="font-family:'Press Start 2P',monospace" x-text="'AVG ' + judgeAnalytics.avg_consensus_score"></span>
                </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <!-- Consensus Distribution -->
                <div class="p-3 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                    <div class="text-[0.5rem] tracking-widest text-[var(--v3)] mb-2">CONSENSUS_DIST_</div>
                    <div class="flex items-end gap-2" style="height:50px">
                        <template x-for="[label, count] in Object.entries(judgeAnalytics.consensus_distribution || {}).sort((a,b) => b[1]-a[1])" :key="label">
                            <div class="flex-1 flex flex-col items-center gap-1">
                                <div class="text-[0.5rem] tabular-nums" :class="label === 'KEEP' ? 'text-[var(--ng)]' : label === 'DISCARD' ? 'text-[var(--red)]' : 'text-[var(--amber)]'" x-text="count"></div>
                                <div class="w-full rounded-t-sm transition-all duration-500"
                                     :class="label === 'KEEP' ? 'bg-[var(--ng)]' : label === 'DISCARD' ? 'bg-[var(--red)]' : 'bg-[var(--amber)]'"
                                     :style="'height:' + Math.max(4, (count / Math.max(1, ...Object.values(judgeAnalytics.consensus_distribution || {}))) * 40) + 'px'">
                                </div>
                                <div class="text-[0.4375rem] tracking-wider" :class="label === 'KEEP' ? 'text-[var(--ng)]' : label === 'DISCARD' ? 'text-[var(--red)]' : 'text-[var(--amber)]'" x-text="label"></div>
                            </div>
                        </template>
                    </div>
                </div>
                <!-- Profile Accuracy -->
                <div class="p-3 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                    <div class="text-[0.5rem] tracking-widest text-[var(--v3)] mb-2">PROFILE_AGREEMENT_</div>
                    <div class="space-y-2">
                        <template x-for="[name, data] in Object.entries(judgeAnalytics.profile_accuracy || {}).sort((a,b) => (b[1].rate||0) - (a[1].rate||0))" :key="name">
                            <div>
                                <div class="flex items-center justify-between mb-0.5">
                                    <span class="text-[0.5625rem] px-1 py-px tracking-wider" :class="name === 'strict' ? 'text-[var(--red)]' : name === 'lenient' ? 'text-[var(--ng)]' : 'text-[var(--cyan)]'" x-text="name.toUpperCase()"></span>
                                    <span class="text-[0.625rem] tabular-nums" :class="(data.rate||0) >= 0.8 ? 'text-[var(--ng)]' : (data.rate||0) >= 0.5 ? 'text-[var(--amber)]' : 'text-[var(--red)]'" x-text="(data.rate * 100).toFixed(0) + '%'"></span>
                                </div>
                                <div class="h-1.5 bg-[var(--bg2)] overflow-hidden">
                                    <div class="h-full transition-all duration-500" :class="(data.rate||0) >= 0.8 ? 'bg-[var(--ng)]' : (data.rate||0) >= 0.5 ? 'bg-[var(--amber)]' : 'bg-[var(--red)]'"
                                         :style="'width:' + (data.rate * 100) + '%'"></div>
                                </div>
                                <div class="text-[0.4375rem] text-[var(--v3)] mt-0.5" x-text="data.agrees_with_consensus + '/' + data.total + ' agreed with consensus'"></div>
                            </div>
                        </template>
                    </div>
                </div>
                <!-- Weight Adjustment Suggestions -->
                <div class="p-3 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                    <div class="text-[0.5rem] tracking-widest text-[var(--v3)] mb-2">SELF_ADJUST_</div>
                    <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        <template x-for="[check, adj] in Object.entries(judgeAnalytics.weight_adjustments || {})" :key="check">
                            <div class="flex items-start gap-1.5">
                                <span class="text-[0.5625rem] mt-0.5 shrink-0" :class="adj.suggestion === 'increase_weight' ? 'text-[var(--ng)]' : adj.suggestion === 'reduce_weight' ? 'text-[var(--red)]' : adj.suggestion === 'lower_threshold' ? 'text-[var(--amber)]' : 'text-[var(--v3)]'"
                                      x-text="adj.suggestion === 'increase_weight' ? '&#9650;' : adj.suggestion === 'reduce_weight' ? '&#9660;' : adj.suggestion === 'lower_threshold' ? '&#9654;' : '&#8226;'"></span>
                                <div class="min-w-0">
                                    <div class="text-[0.5625rem] text-[var(--v3)]" x-text="check"></div>
                                    <div class="text-[0.4375rem] text-[var(--v-dim)] leading-snug" x-text="adj.reason"></div>
                                    <div class="text-[0.4375rem] tabular-nums" :class="adj.multiplier >= 1 ? 'text-[var(--ng)]' : 'text-[var(--red)]'" x-text="'x' + adj.multiplier.toFixed(1)"></div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
            <!-- Judge Score Trend (mini) -->
            <div class="mt-3" x-show="judgeAnalytics.score_trend && judgeAnalytics.score_trend.length > 1">
                <div class="text-[0.5rem] tracking-widest text-[var(--v3)] mb-1">JUDGE_SCORE_TREND_</div>
                <div class="flex items-end gap-0.5" style="height:30px">
                    <template x-for="(pt, pi) in judgeAnalytics.score_trend" :key="pi">
                        <div class="flex-1 rounded-t-sm transition-all duration-300"
                             :class="pt.consensus === 'KEEP' ? 'bg-[var(--ng)]' : pt.consensus === 'DISCARD' ? 'bg-[var(--red)]' : 'bg-[var(--amber)]'"
                             :style="'height:' + Math.max(2, (pt.consensus_score || 0) * 28) + 'px'"
                             :title="'Exp #' + pt.experiment + ': ' + pt.consensus + ' (' + pt.consensus_score + ')'">
                        </div>
                    </template>
                </div>
            </div>
        </div>
        </template>

        <!-- Revert Analytics -->
        <div x-data="revertAnalytics(judgeAnalytics)" x-show="totalReverts > 0 || _loading" class="mt-3 pixel-border bg-[var(--bg2)] p-4">
            <div class="flex items-center justify-between mb-3 cursor-pointer select-none" @click="_open = !_open">
                <div class="flex items-center gap-3">
                    <span class="text-[0.5625rem] tracking-widest text-[var(--v3)]">AUTO_REVERT_ANALYTICS_</span>
                    <span x-show="_loading" class="thinking-spinner" style="width:10px;height:10px;border-width:1.5px;border-color:var(--red)"></span>
                    <span class="text-[0.5rem] px-1.5 py-px bg-[rgba(255,60,60,0.12)] text-[var(--red)]" x-text="totalReverts + ' REVERT' + (totalReverts !== 1 ? 'S' : '')"></span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm text-[var(--red)]" style="font-family:'Press Start 2P',monospace" x-text="revertRate + '%'"></span>
                    <span class="text-[0.5rem] text-[var(--v3)] transition-transform duration-200" :class="_open && 'rotate-180'" x-text="'&#x25BC;'"></span>
                </div>
            </div>

            <div x-show="_open" x-transition>
                <!-- Summary cards -->
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div class="p-2 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                        <div class="text-[0.4375rem] tracking-widest text-[var(--v3)]">TOTAL_REVERTS</div>
                        <div class="text-xl text-[var(--red)] mt-0.5" style="font-family:'Press Start 2P',monospace" x-text="totalReverts"></div>
                    </div>
                    <div class="p-2 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                        <div class="text-[0.4375rem] tracking-widest text-[var(--v3)]">AUTO_REVERTS</div>
                        <div class="text-xl text-[var(--red)] mt-0.5" style="font-family:'Press Start 2P',monospace" x-text="autoReverts"></div>
                    </div>
                    <div class="p-2 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                        <div class="text-[0.4375rem] tracking-widest text-[var(--v3)]">MANUAL_REVERTS</div>
                        <div class="text-xl text-[var(--amber)] mt-0.5" style="font-family:'Press Start 2P',monospace" x-text="manualReverts"></div>
                    </div>
                </div>

                <!-- Revert rate bar -->
                <div class="mb-3">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-[0.4375rem] tracking-widest text-[var(--v3)]">REVERT_RATE</span>
                        <span class="text-[0.5rem] text-[var(--v3)]" x-text="totalReverts + '/' + totalJudged + ' judged experiments'"></span>
                    </div>
                    <div class="h-2 bg-[var(--bg)] overflow-hidden" style="border:1px solid var(--v-dim)">
                        <div class="h-full bg-[var(--red)] transition-all duration-500"
                             :style="'width:' + Math.min(100, parseFloat(revertRate)) + '%'"></div>
                    </div>
                </div>

                <!-- Top Revert Reasons -->
                <div x-show="topReasons.length > 0" class="mb-3">
                    <div class="text-[0.4375rem] tracking-widest text-[var(--v3)] mb-2">TOP_REVERT_REASONS_</div>
                    <div class="space-y-1.5">
                        <template x-for="item in topReasons" :key="item.reason">
                            <div class="flex items-center gap-2">
                                <span class="text-[0.5625rem] text-[var(--ng2)] truncate w-40" x-text="item.reason"></span>
                                <div class="flex-1 h-1.5 bg-[var(--bg)] overflow-hidden">
                                    <div class="h-full bg-[var(--red)] transition-all duration-500"
                                         :style="'width:' + reasonBarWidth(item.count)"></div>
                                </div>
                                <span class="text-[0.5625rem] text-[var(--v3)] tabular-nums w-5 text-right" x-text="item.count"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Recent Revert Events Timeline -->
                <div class="text-[0.4375rem] tracking-widest text-[var(--v3)] mb-2">RECENT_REVERTS_</div>
                <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    <template x-for="ev in revertEvents" :key="ev.experiment">
                        <div class="flex items-start gap-2 p-2 bg-[var(--bg)]" style="border:1px solid var(--v-dim)">
                            <span class="text-[0.5625rem] text-[var(--v3)] mt-0.5 shrink-0" style="font-family:'Press Start 2P',monospace"
                                  x-text="'#' + String(ev.experiment || 0).padStart(2,'0')"></span>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[0.625rem] text-[var(--ng2)] truncate" x-text="ev.title || 'Untitled'"></span>
                                    <span class="text-[0.4375rem] px-1 py-px" :class="revertTypeCls(ev)" x-text="revertReason(ev)"></span>
                                </div>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-[0.4375rem] text-[var(--v3)]" x-text="'Consensus: ' + (ev.consensus || 'N/A')"></span>
                                    <span class="text-[0.4375rem] text-[var(--v-dim)]" x-text="'Score: ' + (ev.consensus_score != null ? ev.consensus_score : 'N/A')"></span>
                                </div>
                            </div>
                            <span class="text-[0.4375rem] text-[var(--v-dim)] shrink-0 tabular-nums" x-text="formatTimestamp(ev.reverted_at || ev.timestamp)"></span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- Goal Progress Tracker -->
        <div class="mt-3 pixel-border bg-[var(--bg2)] p-4">
            <div class="flex items-center justify-between mb-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)]">GOAL_PROGRESS_</div>
                <div class="flex items-center gap-3">
                    <span class="text-[0.5rem] text-[var(--v3)]" x-text="goalProgressData().completed + '/' + goalProgressData().total + ' DONE'"></span>
                    <span class="text-lg" :class="goalProgressPct() >= 50 ? 'text-[var(--ng)] glow-green' : goalProgressPct() >= 25 ? 'text-[var(--cyan)]' : 'text-[var(--amber)]'" style="font-family:'Press Start 2P',monospace" x-text="goalProgressPct() + '%'"></span>
                </div>
            </div>
            <!-- Progress bar -->
            <div class="h-2.5 bg-[var(--bg)] overflow-hidden mb-3" style="border:1px solid var(--v-dim)">
                <div class="h-full transition-all duration-700"
                     :class="goalProgressPct() >= 50 ? 'bg-[var(--ng)]' : goalProgressPct() >= 25 ? 'bg-[var(--cyan)]' : 'bg-[var(--amber)]'"
                     :style="'width:' + goalProgressPct() + '%'"></div>
            </div>
            <!-- Project info -->
            <div x-show="config.name || config.description" class="mb-3 pb-3" style="border-bottom:1px solid var(--v-dim)">
                <div x-show="config.name" class="text-sm text-[var(--v)] tracking-wider" x-text="config.name"></div>
                <div x-show="config.description" class="text-[0.625rem] text-[var(--v3)] mt-1 leading-relaxed" x-text="config.description"></div>
            </div>
            <!-- Active goals with status classification -->
            <div x-show="goalProgressData().goals.length > 0">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-[0.5rem] tracking-widest text-[var(--amber)]">ACTIVE_GOALS</span>
                    <span class="text-[0.5rem] px-1.5 py-px bg-[rgba(255,187,0,0.1)] text-[var(--amber)]" x-text="goalProgressData().active"></span>
                    <div class="flex-1 h-px bg-[var(--v-dim)]"></div>
                </div>
                <div class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    <template x-for="goal in goalProgressData().goals.sort((a,b) => goalStatusWeight(a.status) - goalStatusWeight(b.status))" :key="goal.idx">
                        <div class="goal-item" :style="'border-left:2px solid ' + goalStatusColor(goal.status)">
                            <span class="goal-status-icon" :style="'color:' + goalStatusColor(goal.status)" x-html="goalStatusIcon(goal.status)"></span>
                            <span class="goal-text" x-text="goal.label" :title="goal.text"></span>
                            <span class="goal-status-label" :style="'color:' + goalStatusColor(goal.status)"
                                  x-text="goal.status === 'in-progress' ? 'WIP' : goal.status === 'needs-backend' ? 'BACKEND' : goal.status === 'done-note' ? 'NOTED' : 'TODO'"></span>
                        </div>
                    </template>
                </div>
            </div>
            <!-- Empty state -->
            <div x-show="goalProgressData().total === 0" class="text-center py-4 text-[var(--v3)] text-sm tracking-widest">NO_GOALS_CONFIGURED</div>
            <!-- Completed goals (collapsible) -->
            <div x-show="goalProgressData().completedGoals.length > 0" class="mt-3 pt-3" style="border-top:1px solid var(--v-dim)">
                <div class="flex items-center gap-2 cursor-pointer select-none" @click="_goalsShowCompleted = !_goalsShowCompleted">
                    <span class="text-[0.5rem] tracking-widest text-[var(--ng)]">COMPLETED</span>
                    <span class="text-[0.5rem] px-1.5 py-px bg-[rgba(57,255,20,0.1)] text-[var(--ng)]" x-text="goalProgressData().completed"></span>
                    <span class="text-[0.5rem] text-[var(--v3)] transition-transform duration-200" :class="_goalsShowCompleted && 'rotate-180'" x-text="'&#x25BC;'"></span>
                </div>
                <div x-show="_goalsShowCompleted" x-transition class="space-y-1 mt-2 max-h-48 overflow-y-auto pr-1">
                    <template x-for="goal in goalProgressData().completedGoals" :key="'c'+goal.idx">
                        <div class="goal-item" style="border-left:2px solid var(--ng);opacity:0.7">
                            <span class="goal-status-icon text-[var(--ng)]">&#x2713;</span>
                            <span class="goal-text" style="color:var(--v3);text-decoration:line-through;text-decoration-color:var(--v-dim)" x-text="goal.label" :title="goal.text"></span>
                        </div>
                    </template>
                </div>
            </div>
            <!-- Legend -->
            <div class="flex items-center gap-4 mt-3 pt-2 text-[0.4375rem] text-[var(--v3)]" style="border-top:1px solid var(--v-dim)">
                <span class="flex items-center gap-1"><span style="color:var(--cyan)">&#x25C9;</span> WIP</span>
                <span class="flex items-center gap-1"><span style="color:var(--v3)">&#x25CB;</span> TODO</span>
                <span class="flex items-center gap-1"><span style="color:var(--amber)">&#x25C7;</span> BACKEND</span>
                <span class="flex items-center gap-1"><span style="color:var(--ng)">&#x2713;</span> DONE</span>
            </div>
        </div>

        <!-- Last Experiment -->
        <div x-show="stats.last_experiment && stats.last_experiment.number" class="mt-3 pixel-border bg-[var(--bg2)] p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-[0.5625rem] tracking-widest text-[var(--v3)]">LATEST_MUTATION_</span>
                <button @click="navigate('experiments'); $nextTick(() => loadExperiment(stats.last_experiment?.number))" class="text-[0.625rem] text-[var(--cyan)] hover:text-white tracking-wider">INSPECT_</button>
            </div>
            <div class="flex items-start gap-3">
                <span class="text-[var(--v3)] text-xs mt-0.5" style="font-family:'Press Start 2P',monospace" x-text="'#'+String(stats.last_experiment?.number || 0).padStart(2,'0')"></span>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm text-[var(--ng2)]" x-text="stats.last_experiment?.title"></span>
                        <span class="text-[0.5625rem] px-1 py-px" :class="typeBadgeCls(stats.last_experiment?.type)" x-text="stats.last_experiment?.type"></span>
                        <span class="text-[0.5625rem]" :class="decisionCls(stats.last_experiment?.decision)" x-text="stats.last_experiment?.decision"></span>
                    </div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-0.5" x-text="stats.last_experiment?.date"></div>
                    <div class="text-xs text-[var(--ng3)] mt-1 line-clamp-2" x-text="stats.last_experiment?.what_done"></div>
                </div>
                <div class="text-xl text-[var(--v)] glow-sm shrink-0" style="font-family:'Press Start 2P',monospace" x-text="stats.last_experiment?.score"></div>
            </div>
        </div>
    `;
})();
