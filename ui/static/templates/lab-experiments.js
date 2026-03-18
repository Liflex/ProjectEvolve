// Template: Lab Experiments — loaded before Alpine initializes
(function() {
    const el = document.getElementById('lab-experiments-root');
    if (!el) return;
    el.innerHTML = `
        <div class="flex items-end justify-between mb-5">
            <div>
                <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">EXPERIMENT_LOG</h2>
                <p class="text-xs text-[var(--ng3)] mt-1" x-text="filteredExperiments.length + ' RECORDS_'"></p>
            </div>
            <div class="flex items-center gap-2">
                <input x-model="expSearch" type="text" placeholder="SEARCH_"
                       class="bg-[var(--bg2)] border border-[var(--v-dim)] rounded-sm px-2 py-1 text-sm text-[var(--v)] w-44 tracking-wider">
                <select x-model="expFilterType" class="bg-[var(--bg2)] border border-[var(--v-dim)] rounded-sm px-2 py-1 text-sm text-[var(--ng2)]">
                    <option value="">ALL_TYPES</option>
                    <option value="Bug Fix">BUG_FIX</option>
                    <option value="Feature">FEATURE</option>
                    <option value="Improvement">IMPROVE</option>
                    <option value="Refactoring">REFACTOR</option>
                    <option value="Security">SECURITY</option>
                    <option value="Docs">DOCS</option>
                    <option value="Other">OTHER</option>
                </select>
                <button @click="compareMode = !compareMode; if (!compareMode) compareExps = [];"
                        class="text-[0.625rem] px-2 py-1 tracking-wider border transition-all"
                        :class="compareMode ? 'border-[var(--v)] text-[var(--v)] bg-[rgba(180,74,255,0.1)]' : 'border-[var(--v-dim)] text-[var(--v3)] hover:border-[var(--v2)] hover:text-[var(--ng2)]'"
                        x-text="compareMode ? '[COMPARE ON]' : '[COMPARE]'"></button>
                <button x-show="compareExps.length === 2" @click="runCompare()"
                        class="text-[0.625rem] px-3 py-1 tracking-wider border border-[var(--cyan)] text-[var(--cyan)] hover:bg-[rgba(0,229,255,0.1)] transition-all">
                    COMPARE (<span x-text="compareExps.length"></span>)
                </button>
                <button x-show="compareMode && compareExps.length > 0" @click="compareExps = [];"
                        class="text-[0.625rem] px-2 py-1 tracking-wider border border-[var(--v-dim)] text-[var(--v3)] hover:text-[var(--red)] hover:border-[var(--red)] transition-all">
                    CLEAR
                </button>
            </div>
        </div>

        <!-- Experiment List -->
        <div class="space-y-1">
            <template x-for="(exp, idx) in paginatedExperiments" :key="'exp-' + idx">
                <div>
                    <!-- Row -->
                    <div @click="compareMode ? toggleCompare(exp.number) : toggleExperiment(exp.number)"
                         class="pixel-border bg-[var(--bg2)] px-3 py-2.5 cursor-pointer hover:bg-[var(--bg3)] transition-all"
                         :class="(selectedExp === exp.number && !compareMode) && 'bg-[rgba(180,74,255,0.05)] border-[var(--v3)]' || compareExps.includes(exp.number) && 'bg-[rgba(0,229,255,0.05)] border-[var(--cyan)]'">
                        <div class="flex items-center gap-3">
                            <div x-show="compareMode" @click.stop="toggleCompare(exp.number)"
                                 class="w-4 h-4 shrink-0 border transition-all flex items-center justify-center"
                                 :class="compareExps.includes(exp.number) ? 'border-[var(--cyan)] bg-[var(--cyan)]' : 'border-[var(--v-dim)]'"
                                 style="min-width:16px">
                                <span x-show="compareExps.includes(exp.number)" class="text-[var(--bg)] text-[0.625rem] font-bold">&#x2713;</span>
                            </div>
                            <span class="text-[var(--v3)] text-xs w-8 shrink-0" style="font-family:'Press Start 2P',monospace" x-text="'#'+String(exp.number).padStart(3,'0')"></span>
                            <div class="flex-1 min-w-0 flex items-center gap-2">
                                <span class="text-sm text-[var(--ng2)] truncate" x-text="exp.title"></span>
                                <span class="text-[0.5625rem] px-1 py-px shrink-0" :class="typeBadgeCls(exp.type)" x-text="exp.type"></span>
                            </div>
                            <span class="text-[0.625rem] text-[var(--v3)] w-28 truncate shrink-0" x-text="exp.date"></span>
                            <span class="text-sm w-10 text-right shrink-0" :class="scoreCls(exp.score)" style="font-family:'Press Start 2P',monospace" x-text="exp.score"></span>
                            <span class="text-[0.625rem] w-16 text-right shrink-0" :class="decisionCls(exp.decision)" x-text="exp.decision"></span>
                            <span class="text-[var(--v3)] text-xs transition-transform shrink-0" :class="selectedExp === exp.number && 'rotate-90 text-[var(--v)]'" x-text="selectedExp === exp.number ? 'v' : '>'"></span>
                        </div>
                    </div>
                    <!-- Accordion Detail -->
                    <div x-show="selectedExp === exp.number" x-collapse class="pixel-border border-t-0 bg-[var(--bg2)] overflow-hidden">
                        <!-- Tabs -->
                        <div class="flex border-b-2 border-[var(--v-dim)]">
                            <template x-for="tab in ['OUTPUT', 'PROMPT', 'FILES', 'SUMMARY']" :key="tab">
                                <button @click="expDetailTab = tab.toLowerCase()"
                                        class="px-4 py-2 text-xs tracking-widest transition-colors"
                                        :class="expDetailTab === tab.toLowerCase() ? 'text-[var(--v)] border-b-2 border-[var(--v)] -mb-[2px]' : 'text-[var(--v3)] hover:text-[var(--ng2)]'"
                                        x-text="'[ ' + tab + ' ]'"></button>
                            </template>
                            <div class="flex-1"></div>
                            <button @click="selectedExp = null; selectedExpData = null" class="px-3 text-[var(--v3)] hover:text-[var(--red)] tracking-wider">[X]</button>
                        </div>
                        <!-- Content -->
                        <div class="p-4 max-h-[65vh] overflow-y-auto">
                            <!-- Loading -->
                            <div x-show="expLoading" class="text-center py-8 text-[var(--v3)] tracking-widest">
                                <span class="blink">LOADING_</span>
                            </div>
                            <!-- Output -->
                            <template x-if="selectedExp === exp.number && expDetailTab === 'output' && !expLoading">
                                <div>
                                    <div x-show="selectedExpData?.output" class="md" x-html="renderMarkdown(selectedExpData?.output)"></div>
                                    <div x-show="!selectedExpData?.output" class="text-center py-6 text-[var(--v3)] text-xs tracking-widest">
                                        NO_OUTPUT_GENERATED_<br>
                                        <span class="text-[var(--v3)] text-[0.6875rem]">(experiment required no code changes)</span>
                                    </div>
                                </div>
                            </template>
                            <!-- Prompt -->
                            <template x-if="selectedExp === exp.number && expDetailTab === 'prompt' && !expLoading">
                                <div>
                                    <div x-show="selectedExpData?.prompt" class="md" x-html="renderMarkdown(selectedExpData?.prompt)"></div>
                                    <div x-show="!selectedExpData?.prompt" class="text-center py-6 text-[var(--v3)] text-xs tracking-widest">NO_PROMPT_DATA_</div>
                                </div>
                            </template>
                            <!-- Files / Diff Viewer -->
                            <template x-if="selectedExp === exp.number && expDetailTab === 'files' && !expLoading">
                                <div>
                                    <div x-show="!fileDiffData" class="text-center py-6">
                                        <div x-show="selectedExpData?.files_modified?.length" class="space-y-2">
                                            <div class="text-[0.5625rem] text-[var(--v3)] tracking-widest mb-2">MODIFIED_FILES_</div>
                                            <template x-for="f in (selectedExpData?.files_modified || [])" :key="f">
                                                <button @click="loadFileDiff(f)"
                                                        class="w-full text-left px-3 py-2 bg-[var(--bg)] pixel-border hover:border-[var(--cyan)] transition-all group">
                                                    <div class="flex items-center gap-2">
                                                        <span style="font-size:0.625rem">&#x1f4c4;</span>
                                                        <code class="text-[0.6875rem] text-[var(--cyan)] truncate flex-1" x-text="f"></code>
                                                        <span class="text-[0.5rem] text-[var(--v3)] group-hover:text-[var(--v)] tracking-wider">VIEW_DIFF</span>
                                                    </div>
                                                </button>
                                            </template>
                                            <div class="text-[0.5625rem] text-[var(--v3)] mt-3 tracking-wider">CLICK_FILE_TO_SEE_CURRENT_GIT_DIFF_</div>
                                        </div>
                                        <div x-show="!selectedExpData?.files_modified?.length" class="text-[var(--v3)] text-xs tracking-widest">NO_FILES_MODIFIED_</div>
                                    </div>
                                    <!-- Diff content -->
                                    <div x-show="fileDiffData">
                                        <div class="flex items-center justify-between mb-2">
                                            <div class="flex items-center gap-2">
                                                <span style="font-size:0.625rem">&#x1f4c4;</span>
                                                <code class="text-[0.6875rem] text-[var(--cyan)]" x-text="fileDiffData.path"></code>
                                                <span x-show="fileDiffData.has_changes" class="text-[0.5rem] px-1 py-px bg-[rgba(57,255,20,0.08)] text-[var(--ng)]">CHANGED</span>
                                                <span x-show="!fileDiffData.has_changes" class="text-[0.5rem] px-1 py-px bg-[rgba(85,85,85,0.06)] text-[var(--v3)]">NO_CHANGES</span>
                                            </div>
                                            <button @click="fileDiffData = null" class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--red)] tracking-wider">[BACK]</button>
                                        </div>
                                        <div x-show="fileDiffData.has_changes" class="bg-[var(--bg)] pixel-border overflow-x-auto max-h-[55vh] overflow-y-auto">
                                            <pre class="text-[0.6875rem] leading-relaxed p-3" style="font-family:'JetBrains Mono','Fira Code',monospace" x-html="renderDiffHtml(fileDiffData.diff + fileDiffData.staged_diff, fileDiffData.ext)"></pre>
                                        </div>
                                        <div x-show="!fileDiffData.has_changes" class="text-center py-8 text-[var(--v3)] text-xs tracking-widest">
                                            NO_DIFF_FOR_THIS_FILE_<br>
                                            <span class="text-[0.625rem]">(changes may already be committed)</span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <!-- Summary -->
                            <template x-if="selectedExp === exp.number && expDetailTab === 'summary' && !expLoading">
                                <div>
                                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                                        <div class="bg-[var(--bg)] p-2 pixel-border"><div class="text-[0.5rem] text-[var(--v3)] tracking-widest">EXP</div><div class="text-xs text-[var(--v)] mt-1" x-text="'#'+(selectedExpData?.number||'')+' '+(selectedExpData?.title||'')"></div></div>
                                        <div class="bg-[var(--bg)] p-2 pixel-border"><div class="text-[0.5rem] text-[var(--v3)] tracking-widest">TYPE</div><span class="text-[0.625rem] px-1 py-px mt-1 inline-block" :class="typeBadgeCls(selectedExpData?.type)" x-text="selectedExpData?.type"></span></div>
                                        <div class="bg-[var(--bg)] p-2 pixel-border"><div class="text-[0.5rem] text-[var(--v3)] tracking-widest">SCORE</div><div class="text-sm mt-1" :class="scoreCls(selectedExpData?.score)" style="font-family:'Press Start 2P',monospace" x-text="selectedExpData?.score"></div></div>
                                        <div class="bg-[var(--bg)] p-2 pixel-border"><div class="text-[0.5rem] text-[var(--v3)] tracking-widest">DECISION</div><div class="text-xs mt-1" :class="decisionCls(selectedExpData?.decision)" x-text="selectedExpData?.decision"></div></div>
                                    </div>
                                    <div x-show="selectedExpData?.files_modified?.length" class="mb-3">
                                        <div class="text-[0.5625rem] text-[var(--v3)] tracking-widest mb-1">FILES_MODIFIED_</div>
                                        <div class="flex flex-wrap gap-1">
                                            <template x-for="f in (selectedExpData?.files_modified || [])" :key="f">
                                                <code class="text-[0.625rem] bg-[var(--bg)] text-[var(--cyan)] px-1.5 py-0.5 pixel-border" x-text="f"></code>
                                            </template>
                                        </div>
                                    </div>
                                    <div x-show="selectedExpData?.notes" class="bg-[var(--bg)] p-3 pixel-border">
                                        <div class="text-[0.5625rem] text-[var(--pink)] tracking-widest mb-1">NOTES_FOR_NEXT_</div>
                                        <p class="text-xs text-[var(--ng3)]" x-text="selectedExpData?.notes"></p>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </template>
            <div x-show="filteredExperiments.length === 0" class="text-center py-10 text-[var(--v3)] tracking-widest">NO_MATCHES_</div>
        </div>

        <!-- ==================== COMPARE VIEW ==================== -->
        <div x-show="Object.keys(compareData).length === 2" x-transition class="mt-4 pixel-border bg-[var(--bg2)] overflow-hidden">
            <!-- Compare Header -->
            <div class="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--v-dim)]">
                <div class="flex items-center gap-3">
                    <span class="text-sm text-[var(--cyan)] glow-sm tracking-wider">SIDE_BY_SIDE</span>
                    <span class="text-[0.5625rem] text-[var(--v3)]">EXP <span x-text="compareExps[0]"></span> vs EXP <span x-text="compareExps[1]"></span></span>
                </div>
                <button @click="compareData = {}; compareExps = []; compareMode = false;"
                        class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--red)] tracking-wider">[CLOSE]</button>
            </div>
            <!-- Compare Loading -->
            <div x-show="compareLoading" class="text-center py-8 text-[var(--v3)] tracking-widest">
                <span class="blink">LOADING_DATA_</span>
            </div>
            <!-- Compare Content -->
            <div x-show="!compareLoading" class="p-4">
                <template x-for="field in compareFields()" :key="field.key">
                    <div class="mb-3">
                        <div class="text-[0.5625rem] text-[var(--v3)] tracking-[0.3em] mb-1.5 flex items-center gap-2">
                            <span x-text="field.label"></span>
                            <span x-show="field.diff" class="text-[var(--cyan)]">&#x25C6; DIFF</span>
                            <span x-show="!field.diff" class="text-[var(--ng-dim)]">&#x2261; SAME</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-[var(--bg)] p-2.5 pixel-border text-xs" :class="field.diff && 'border-l-2 border-l-[var(--v)]'">
                                <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mb-1">EXP #<span x-text="compareExps[0]"></span></div>
                                <div x-html="field.renderLeft"></div>
                            </div>
                            <div class="bg-[var(--bg)] p-2.5 pixel-border text-xs" :class="field.diff && 'border-l-2 border-l-[var(--cyan)]'">
                                <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mb-1">EXP #<span x-text="compareExps[1]"></span></div>
                                <div x-html="field.renderRight"></div>
                            </div>
                        </div>
                    </div>
                </template>
                <!-- Files Modified Comparison -->
                <div class="mb-3" x-show="compareData[compareExps[0]]?.files_modified?.length || compareData[compareExps[1]]?.files_modified?.length">
                    <div class="text-[0.5625rem] text-[var(--v3)] tracking-[0.3em] mb-1.5">FILES_MODIFIED_</div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-[var(--bg)] p-2.5 pixel-border border-l-2 border-l-[var(--v)]">
                            <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mb-1">EXP #<span x-text="compareExps[0]"></span></div>
                            <div class="flex flex-wrap gap-1">
                                <template x-for="f in (compareData[compareExps[0]]?.files_modified || [])" :key="f">
                                    <code class="text-[0.625rem] bg-[var(--bg2)] text-[var(--cyan)] px-1.5 py-0.5 pixel-border" x-text="f"></code>
                                </template>
                                <span x-show="!compareData[compareExps[0]]?.files_modified?.length" class="text-[0.625rem] text-[var(--v3)]">&#x2014;</span>
                            </div>
                        </div>
                        <div class="bg-[var(--bg)] p-2.5 pixel-border border-l-2 border-l-[var(--cyan)]">
                            <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mb-1">EXP #<span x-text="compareExps[1]"></span></div>
                            <div class="flex flex-wrap gap-1">
                                <template x-for="f in (compareData[compareExps[1]]?.files_modified || [])" :key="f">
                                    <code class="text-[0.625rem] bg-[var(--bg2)] text-[var(--cyan)] px-1.5 py-0.5 pixel-border" x-text="f"></code>
                                </template>
                                <span x-show="!compareData[compareExps[1]]?.files_modified?.length" class="text-[0.625rem] text-[var(--v3)]">&#x2014;</span>
                            </div>
                        </div>
                    </div>
                    <!-- Shared files -->
                    <div x-show="compareSharedFiles().length" class="mt-2">
                        <div class="text-[0.5rem] text-[var(--amber)] tracking-widest">SHARED_FILES_</div>
                        <div class="flex flex-wrap gap-1 mt-1">
                            <template x-for="f in compareSharedFiles()" :key="f">
                                <code class="text-[0.625rem] bg-[rgba(255,170,0,0.08)] text-[var(--amber)] px-1.5 py-0.5 border border-[rgba(255,170,0,0.2)]" x-text="f"></code>
                            </template>
                        </div>
                    </div>
                </div>
                <!-- Notes for Next Comparison -->
                <div x-show="compareData[compareExps[0]]?.notes || compareData[compareExps[1]]?.notes" class="mb-2">
                    <div class="text-[0.5625rem] text-[var(--v3)] tracking-[0.3em] mb-1.5">NOTES_FOR_NEXT_</div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-[var(--bg)] p-2.5 pixel-border border-l-2 border-l-[var(--v)]">
                            <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mb-1">EXP #<span x-text="compareExps[0]"></span></div>
                            <p class="text-[0.6875rem] text-[var(--ng3)]" x-text="compareData[compareExps[0]]?.notes || '&#x2014;'"></p>
                        </div>
                        <div class="bg-[var(--bg)] p-2.5 pixel-border border-l-2 border-l-[var(--cyan)]">
                            <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mb-1">EXP #<span x-text="compareExps[1]"></span></div>
                            <p class="text-[0.6875rem] text-[var(--ng3)]" x-text="compareData[compareExps[1]]?.notes || '&#x2014;'"></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pagination -->
        <div class="mt-3 flex items-center justify-between text-[0.625rem] text-[var(--v3)] tracking-wider">
            <span x-text="'RECORDS ' + (expPage * 50 + 1) + '-' + Math.min((expPage+1)*50, filteredExperiments.length) + '/' + filteredExperiments.length"></span>
            <div class="flex gap-1">
                <button @click="expPage = Math.max(0, expPage-1)" :disabled="expPage===0" class="px-2 py-0.5 border border-[var(--v-dim)] hover:border-[var(--v)] disabled:opacity-30 tracking-wider">&lt; PREV</button>
                <button @click="expPage = Math.min(expTotalPages-1, expPage+1)" :disabled="expPage>=expTotalPages-1" class="px-2 py-0.5 border border-[var(--v-dim)] hover:border-[var(--v)] disabled:opacity-30 tracking-wider">NEXT &gt;</button>
            </div>
        </div>
    `;
})();
