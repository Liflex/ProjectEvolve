// Template: Lab Run Control — loaded before Alpine initializes
(function() {
    const el = document.getElementById('lab-run-root');
    if (!el) return;
    el.innerHTML = `
        <div class="mb-5">
            <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">EVOLUTION_CONTROL</h2>
            <p class="text-xs text-[var(--ng3)] mt-1">START_SEQUENCE_</p>
        </div>

        <div>
            <!-- Config panel (collapses when running) -->
            <div x-show="!runStatus.running" x-transition class="pixel-border bg-[var(--bg2)] p-4 mb-3">
                <div class="text-[0.5625rem] tracking-widest text-[var(--v3)] mb-3">LAUNCH_PARAMETERS_</div>
                <div class="grid grid-cols-2 gap-2">
                    <!-- PROJECT_PATH with file browser -->
                    <div class="col-span-2">
                        <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">PROJECT_PATH</label>
                        <div class="mt-0.5 flex gap-1.5">
                            <input x-model="runConfig.project"
                                   @change="runPreflight(runConfig.project)"
                                   class="flex-1 bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]"
                                   placeholder="."
                                   style="font-family:var(--code-font,monospace)">
                            <button @click="toggleBrowsePanel()"
                                    class="px-3 py-1.5 text-[0.5625rem] tracking-wider border border-[var(--v-dim)] text-[var(--v3)] hover:text-[var(--v)] hover:border-[var(--v2)] transition-all whitespace-nowrap"
                                    :class="_showBrowsePanel && 'text-[var(--v)] border-[var(--v2)] bg-[rgba(180,74,255,0.06)]'"
                                    title="Browse directories">
                                &#x1f4c1; BROWSE
                            </button>
                            <button @click="runPreflight(runConfig.project)"
                                    class="px-3 py-1.5 text-[0.5625rem] tracking-wider border border-[var(--v-dim)] text-[var(--v3)] hover:text-[var(--cyan)] hover:border-[rgba(0,229,255,0.3)] transition-all whitespace-nowrap"
                                    title="Check project readiness">
                                &#x2713; CHECK
                            </button>
                        </div>
                    </div>
                    <div><label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">ITERATIONS</label><input x-model.number="runConfig.iterations" type="number" min="1" max="500" class="mt-0.5 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]"></div>
                    <div><label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">INTERVAL_MIN</label><input x-model.number="runConfig.timeout" type="number" min="0" max="60" class="mt-0.5 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]"></div>
                    <div><label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">MAX_TIME_SEC</label><input x-model.number="runConfig.max_time" type="number" min="60" max="3600" step="60" class="mt-0.5 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]"></div>
                    <div><label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">TOKEN_THRESHOLD</label><input x-model.number="runConfig.token_threshold" type="number" min="20000" max="200000" step="10000" class="mt-0.5 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]"></div>
                </div>
                <!-- Strategy selector -->
                <div class="mt-3">
                    <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">STRATEGY_</label>
                    <select x-model="runConfig.strategy"
                        class="mt-0.5 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]">
                        <option value="default">BALANCED &#x2014; Full-featured research cycle</option>
                        <option value="execution">EXECUTION &#x2014; Goals & features, minimal overhead</option>
                        <option value="quality">QUALITY &#x2014; Bug fixes, security & tests</option>
                    </select>
                </div>

                <!-- Parallel Judges Toggle -->
                <div class="mt-3 flex items-center gap-3">
                    <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider cursor-pointer select-none flex items-center gap-2"
                           @click="runConfig.parallel_judges = !runConfig.parallel_judges">
                        <span class="inline-block w-8 h-4 rounded-full transition-colors relative"
                              :class="runConfig.parallel_judges ? 'bg-[var(--cyan)]' : 'bg-[var(--v-dim)]'">
                            <span class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                                  :class="runConfig.parallel_judges ? 'translate-x-4' : 'translate-x-0.5'"></span>
                        </span>
                        PARALLEL_JUDGES
                    </label>
                    <span class="text-[0.5rem] text-[var(--v3)] opacity-60" x-show="runConfig.parallel_judges">3 independent agents</span>
                </div>

                <!-- Decompose Toggle -->
                <div class="mt-2 flex items-center gap-3">
                    <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider cursor-pointer select-none flex items-center gap-2"
                           @click="runConfig.decompose = !runConfig.decompose">
                        <span class="inline-block w-8 h-4 rounded-full transition-colors relative"
                              :class="runConfig.decompose ? 'bg-[var(--v)]' : 'bg-[var(--v-dim)]'">
                            <span class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                                  :class="runConfig.decompose ? 'translate-x-4' : 'translate-x-0.5'"></span>
                        </span>
                        DECOMPOSE_TASKS
                    </label>
                    <span class="text-[0.5rem] text-[var(--v3)] opacity-60" x-show="runConfig.decompose">LLM splits goals into parallel sub-tasks</span>
                </div>

                <!-- File Browser Panel -->
                <div x-show="_showBrowsePanel" x-transition class="mt-3 border border-[var(--v-dim)] bg-[var(--bg)]">
                    <!-- Browser header / breadcrumb -->
                    <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--v-dim)] bg-[rgba(0,0,0,0.15)]">
                        <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">PATH:</span>
                        <span class="text-[0.625rem] text-[var(--cyan)] flex-1 truncate" style="font-family:var(--code-font,monospace)" x-text="_browsePath"></span>
                        <button @click="navigateDir(_browsePath + '/..')" class="text-[0.5625rem] text-[var(--v3)] hover:text-[var(--v)] tracking-wider transition-colors" title="Go up">&#x2191; UP</button>
                        <button @click="browseDir('.')" class="text-[0.5625rem] text-[var(--v3)] hover:text-[var(--v)] tracking-wider transition-colors" title="Go to root">&#x2302; ROOT</button>
                        <button @click="_showBrowsePanel = false" class="text-[0.5625rem] text-[var(--v3)] hover:text-[var(--red)] tracking-wider transition-colors">[X]</button>
                    </div>
                    <!-- Directory entries -->
                    <div class="max-h-[240px] overflow-y-auto p-1">
                        <template x-for="(entry, idx) in _browseEntries" :key="idx">
                            <div @click="entry.is_directory ? navigateDir(entry.path) : null"
                                 @dblclick="entry.is_directory && selectDir(entry.path)"
                                 class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
                                 :class="entry.is_directory ? 'hover:bg-[rgba(180,74,255,0.08)]' : 'hover:bg-[var(--bg3)]'"
                                 :title="entry.path">
                                <span class="text-[0.6875rem] shrink-0" x-text="entry.is_directory ? '&#x1f4c1;' : '&#x1f4c4;'"></span>
                                <span class="text-[0.6875rem] flex-1 truncate"
                                      :class="entry.is_directory ? 'text-[var(--ng2)]' : 'text-[var(--v3)]'"
                                      x-text="entry.name"></span>
                                <span x-show="entry.is_directory" class="text-[0.5rem] text-[var(--v3)] tracking-wider shrink-0">DIR</span>
                                <span x-show="!entry.is_directory" class="text-[0.5rem] text-[var(--v3)] shrink-0" x-text="formatFileSize(entry.size)"></span>
                                <button x-show="entry.is_directory"
                                        @click.stop="selectDir(entry.path)"
                                        class="text-[0.5rem] text-[var(--v)] tracking-wider px-1.5 py-0.5 border border-[var(--v-dim)] hover:border-[var(--v2)] hover:bg-[rgba(180,74,255,0.1)] transition-all shrink-0"
                                        title="Select this directory">
                                    SELECT
                                </button>
                            </div>
                        </template>
                        <div x-show="_browseEntries.length === 0" class="text-center py-4 text-[0.5625rem] text-[var(--v3)] tracking-wider">EMPTY_DIRECTORY_</div>
                    </div>
                </div>

                <!-- Pre-flight Check Results -->
                <div x-show="_preflightResult" x-transition class="mt-3 border border-[var(--v-dim)]" :class="_preflightResult && _preflightResult.ready ? 'border-[rgba(57,255,20,0.2)] bg-[rgba(57,255,20,0.03)]' : 'border-[rgba(255,170,0,0.2)] bg-[rgba(255,170,0,0.03)]'">
                    <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--v-dim)]">
                        <span x-text="_preflightResult && _preflightResult.ready ? '&#x2705;' : '&#x26A0;'" class="text-sm"></span>
                        <span class="text-[0.5625rem] tracking-widest" :class="_preflightResult && _preflightResult.ready ? 'text-[var(--ng)]' : 'text-[var(--amber)]'"
                              x-text="_preflightResult && _preflightResult.ready ? 'READY_TO_LAUNCH' : 'PREFLIGHT_WARNINGS_'"></span>
                        <span class="text-[0.5rem] text-[var(--v3)] ml-1 truncate" style="font-family:var(--code-font,monospace)" x-text="_preflightResult && _preflightResult.path"></span>
                        <button x-show="_preflightResult && !_preflightResult.ready"
                                @click="showSetupWizard()"
                                class="ml-auto mr-2 px-2 py-0.5 text-[0.5625rem] tracking-wider border border-[var(--v)] text-[var(--v)] hover:bg-[rgba(180,74,255,0.1)] transition-all"
                                title="Open setup wizard to configure project">
                            &#x2699; SETUP
                        </button>
                        <button @click="_preflightResult = null" class="text-[0.5625rem] text-[var(--v3)] hover:text-[var(--red)] tracking-wider">[X]</button>
                    </div>
                    <div class="p-2">
                        <template x-for="(check, ci) in (_preflightResult ? _preflightResult.checks : [])" :key="ci">
                            <div class="flex items-center gap-2 px-2 py-1 text-[0.5625rem]">
                                <span x-text="check.ok === true ? '&#x2705;' : check.ok === false ? '&#x274C;' : '&#x26AA;'" class="shrink-0 text-xs"></span>
                                <span class="tracking-wider" :class="check.ok === true ? 'text-[var(--ng)]' : check.ok === false ? 'text-[var(--red)]' : 'text-[var(--v3)]'" x-text="check.label"></span>
                                <span class="text-[var(--v3)]" x-text="check.detail"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Launch button -->
                <div class="mt-3 flex gap-2">
                    <button @click="startRun()" class="border border-[var(--v)] text-[var(--v)] text-xs tracking-wider px-5 py-2 hover:bg-[rgba(180,74,255,0.1)] transition-all">[> INITIATE]</button>
                </div>
            </div>

            <!-- Setup Wizard Modal -->
            <div x-show="_showSetupWizard" x-transition.opacity class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.6)">
                <div @click.outside="closeSetupWizard()" class="pixel-border bg-[var(--bg2)] w-full max-w-lg mx-4 shadow-2xl" style="border-color:var(--v2)">
                    <!-- Header -->
                    <div class="flex items-center gap-3 px-5 py-3 border-b border-[var(--v-dim)]">
                        <span class="text-sm">&#x2699;</span>
                        <span class="text-xs tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">SETUP_WIZARD</span>
                        <span class="text-[0.5rem] text-[var(--v3)]" x-text="'STEP ' + (_setupStep+1) + '/' + _setupSteps.length"></span>
                        <button @click="closeSetupWizard()" class="ml-auto text-[var(--v3)] hover:text-[var(--red)] tracking-wider text-xs">[X]</button>
                    </div>
                    <!-- Progress bar -->
                    <div class="flex gap-1 px-5 pt-3">
                        <template x-for="(s, si) in _setupSteps" :key="si">
                            <div class="flex-1 h-1 rounded-sm transition-all duration-300"
                                 :class="si <= _setupStep ? 'bg-[var(--v)]' : 'bg-[var(--v-dim)]'"></div>
                        </template>
                    </div>
                    <!-- Step content -->
                    <div class="p-5">
                        <!-- Step 0: Name & Description -->
                        <div x-show="_setupStep === 0" class="space-y-3">
                            <div class="text-[0.5625rem] tracking-widest text-[var(--cyan)] mb-2">PROJECT_INFO_</div>
                            <div>
                                <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">PROJECT_NAME <span class="text-[var(--red)]">*</span></label>
                                <input x-model="_setupData.name" @keydown.enter="if(_setupCanProceed()) nextSetupStep()"
                                       class="mt-1 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-3 py-2 text-sm text-[var(--ng2)] focus:border-[var(--v2)] outline-none transition-colors"
                                       placeholder="my-awesome-project">
                            </div>
                            <div>
                                <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">DESCRIPTION</label>
                                <textarea x-model="_setupData.description" rows="2"
                                          class="mt-1 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-3 py-2 text-sm text-[var(--ng2)] focus:border-[var(--v2)] outline-none transition-colors resize-none"
                                          placeholder="Brief project description..."></textarea>
                            </div>
                            <p class="text-[0.5rem] text-[var(--v3)]">* Required fields</p>
                        </div>
                        <!-- Step 1: Goals -->
                        <div x-show="_setupStep === 1" class="space-y-3">
                            <div class="text-[0.5625rem] tracking-widest text-[var(--cyan)] mb-2">GOALS_ <span class="text-[var(--red)]">*</span></div>
                            <p class="text-[0.5rem] text-[var(--v3)]">One goal per line. These define what the AI agent will work towards.</p>
                            <textarea x-model="_setupData.goals" rows="8"
                                      class="w-full bg-[var(--bg)] border border-[var(--v-dim)] px-3 py-2 text-sm text-[var(--ng2)] focus:border-[var(--v2)] outline-none transition-colors resize-none"
                                      style="font-family:var(--code-font,monospace)"
                                      placeholder="Add user authentication&#10;Implement search functionality&#10;Fix performance issues&#10;Improve test coverage"></textarea>
                            <div class="text-[0.5rem] text-[var(--v3)]">
                                <span x-text="(_setupData.goals || '').split('\n').filter(l => l.trim()).length"></span> goals defined
                            </div>
                        </div>
                        <!-- Step 2: Tech Stack & Focus -->
                        <div x-show="_setupStep === 2" class="space-y-3">
                            <div class="text-[0.5625rem] tracking-widest text-[var(--cyan)] mb-2">STACK_&_FOCUS_</div>
                            <div>
                                <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">TECH_STACK</label>
                                <p class="text-[0.5rem] text-[var(--v3)] mb-1">Comma-separated. Helps the agent understand the project.</p>
                                <input x-model="_setupData.tech_stack"
                                       class="w-full bg-[var(--bg)] border border-[var(--v-dim)] px-3 py-2 text-sm text-[var(--ng2)] focus:border-[var(--v2)] outline-none transition-colors"
                                       placeholder="Python, FastAPI, PostgreSQL, React">
                            </div>
                        </div>
                        <!-- Step 3: Constraints & Review -->
                        <div x-show="_setupStep === 3" class="space-y-3">
                            <div class="text-[0.5625rem] tracking-widest text-[var(--cyan)] mb-2">CONSTRAINTS_&_REVIEW</div>
                            <div>
                                <label class="text-[0.5625rem] text-[var(--v3)] tracking-wider">CONSTRAINTS <span class="text-[var(--v3)]">(optional)</span></label>
                                <p class="text-[0.5rem] text-[var(--v3)] mb-1">One per line. Rules the agent must follow.</p>
                                <textarea x-model="_setupData.constraints" rows="3"
                                          class="w-full bg-[var(--bg)] border border-[var(--v-dim)] px-3 py-2 text-sm text-[var(--ng2)] focus:border-[var(--v2)] outline-none transition-colors resize-none"
                                          style="font-family:var(--code-font,monospace)"
                                          placeholder="No breaking changes&#10;Must maintain backwards compatibility"></textarea>
                            </div>
                            <!-- Summary -->
                            <div class="mt-4 border border-[var(--v-dim)] bg-[var(--bg)] p-3 space-y-1">
                                <div class="text-[0.5625rem] tracking-widest text-[var(--v)] mb-2">SUMMARY_</div>
                                <div class="flex gap-2 text-[0.5625rem]">
                                    <span class="text-[var(--v3)] shrink-0 w-20">NAME:</span>
                                    <span class="text-[var(--ng2)]" x-text="_setupData.name || '—'"></span>
                                </div>
                                <div class="flex gap-2 text-[0.5625rem]" x-show="_setupData.description">
                                    <span class="text-[var(--v3)] shrink-0 w-20">DESC:</span>
                                    <span class="text-[var(--ng2)] truncate" x-text="_setupData.description"></span>
                                </div>
                                <div class="flex gap-2 text-[0.5625rem]">
                                    <span class="text-[var(--v3)] shrink-0 w-20">GOALS:</span>
                                    <span class="text-[var(--cyan)]" x-text="(_setupData.goals || '').split('\n').filter(l => l.trim()).length + ' items'"></span>
                                </div>
                                <div class="flex gap-2 text-[0.5625rem]" x-show="_setupData.tech_stack">
                                    <span class="text-[var(--v3)] shrink-0 w-20">STACK:</span>
                                    <span class="text-[var(--ng2)]" x-text="_setupData.tech_stack"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Footer navigation -->
                    <div class="flex items-center gap-3 px-5 py-3 border-t border-[var(--v-dim)]">
                        <button x-show="_setupStep > 0" @click="prevSetupStep()"
                                class="px-4 py-1.5 text-[0.5625rem] tracking-wider border border-[var(--v-dim)] text-[var(--v3)] hover:text-[var(--v)] hover:border-[var(--v2)] transition-all">
                            &lt; BACK
                        </button>
                        <div class="flex-1"></div>
                        <button x-show="_setupStep < _setupSteps.length - 1" @click="if(_setupCanProceed()) nextSetupStep()"
                                class="px-4 py-1.5 text-[0.5625rem] tracking-wider border transition-all"
                                :class="_setupCanProceed() ? 'border-[var(--v)] text-[var(--v)] hover:bg-[rgba(180,74,255,0.1)]' : 'border-[var(--v-dim)] text-[var(--v-dim)] cursor-not-allowed'"
                                :disabled="!_setupCanProceed()">
                            NEXT &gt;
                        </button>
                        <button x-show="_setupStep === _setupSteps.length - 1" @click="saveSetup()"
                                class="px-5 py-1.5 text-[0.5625rem] tracking-wider border border-[var(--v)] text-[var(--v)] hover:bg-[rgba(180,74,255,0.1)] transition-all"
                                :class="_setupSaving && 'opacity-50 cursor-wait'"
                                :disabled="_setupSaving">
                            <span x-show="!_setupSaving">&#x2713; SAVE &amp; CLOSE</span>
                            <span x-show="_setupSaving">SAVING_...</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Running controls (shown when active) -->
            <div x-show="runStatus.running" x-transition class="pixel-border bg-[var(--bg2)] p-4 mb-3">
                <div class="flex items-center gap-3 mb-1">
                    <span class="w-2 h-2 bg-[var(--v)] pulse"></span>
                    <span class="text-xs text-[var(--v)] tracking-widest">EXPERIMENT_RUNNING_</span>
                    <span class="text-[0.625rem] text-[var(--cyan)]" x-text="runStatus.current_exp ? 'EXP_' + runStatus.current_exp + '/' + runStatus.total_exps : ''"></span>
                    <span class="text-[0.625rem] text-[var(--v3)]" x-text="runStatus.started_at"></span>
                    <span class="text-[0.625rem] text-[var(--yellow)] tabular-nums" x-text="runElapsed"></span>
                    <button @click="stopRun()" class="ml-auto border border-[var(--red)] text-[var(--red)] text-xs tracking-wider px-5 py-1.5 hover:bg-[rgba(255,51,51,0.1)] transition-all">[X TERMINATE]</button>
                </div>
                <!-- Progress bar -->
                <div x-show="runStatus.total_exps > 0" class="mt-2 h-1.5 bg-[var(--bg)] pixel-border overflow-hidden">
                    <div class="h-full bg-[var(--v)] transition-all duration-500" :style="'width:' + Math.max(0, Math.min(100, (runStatus.current_exp / runStatus.total_exps) * 100)) + '%'"></div>
                </div>
                <!-- Token budget bar -->
                <div x-show="runStatus.tokens" class="mt-2">
                    <div class="flex items-center gap-3 text-[0.5625rem] tracking-wider">
                        <span class="text-[var(--v3)]">TOKENS_</span>
                        <span class="tabular-nums" :class="runStatus.tokens && runStatus.tokens.input_tokens > runStatus.tokens.soft_threshold ? 'text-[var(--amber)]' : 'text-[var(--cyan)]'"
                              x-text="runStatus.tokens ? (runStatus.tokens.input_tokens/1000).toFixed(1)+'K / '+(runStatus.tokens.threshold/1000).toFixed(0)+'K' : ''"></span>
                        <span x-show="runStatus.tokens && runStatus.tokens.output_tokens > 0" class="text-[var(--v3)] tabular-nums" x-text="runStatus.tokens ? 'OUT '+((runStatus.tokens.output_tokens||0)/1000).toFixed(1)+'K' : ''"></span>
                        <span class="text-[var(--v3)]">|</span>
                        <span class="tabular-nums" :class="runStatus.tokens && runStatus.tokens.input_tokens > runStatus.tokens.soft_threshold ? 'text-[var(--amber)]' : 'text-[var(--v3)]'"
                              x-text="runStatus.tokens ? Math.round(((runStatus.tokens.input_tokens||0) / (runStatus.tokens.threshold||100000)) * 100) + '%' : ''"></span>
                        <span class="text-[var(--v3)]">|</span>
                        <span class="text-[var(--ng2)] tabular-nums" x-text="runStatus.tokens ? 'avg: '+(runStatus.tokens.avg_experiment_tokens/1000).toFixed(1)+'K/exp' : ''"></span>
                        <span class="text-[var(--v3)]">|</span>
                        <span class="text-[var(--yellow)] tabular-nums" x-text="runStatus.tokens ? '$'+runStatus.tokens.total_cost_usd.toFixed(4) : ''"></span>
                        <span x-show="runStatus.tokens && runStatus.tokens.should_reset" class="text-[var(--amber)] blink">RESET_PENDING</span>
                        <span x-show="runStatus.session_id" class="ml-auto text-[var(--v3)]" x-text="'SID:' + (runStatus.session_id || '').substring(0,8)"></span>
                    </div>
                    <div class="mt-1 h-1 bg-[var(--bg)] pixel-border overflow-hidden">
                        <div class="h-full transition-all duration-500"
                             :class="runStatus.tokens && runStatus.tokens.input_tokens > runStatus.tokens.threshold * 0.9 ? 'bg-[var(--red)]' : runStatus.tokens && runStatus.tokens.input_tokens > runStatus.tokens.soft_threshold ? 'bg-[var(--amber)]' : 'bg-[var(--cyan)]'"
                             :style="'width:' + Math.min(100, ((runStatus.tokens?.input_tokens||0) / (runStatus.tokens?.threshold||100000)) * 100) + '%'"></div>
                    </div>
                </div>
            </div>

            <!-- Live Streaming Log -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <!-- Log toolbar -->
                <div class="flex items-center gap-2 mb-3 flex-wrap">
                    <span class="flex items-center gap-1.5 text-[0.625rem] tracking-wider" :class="runStatus.running ? 'text-[var(--v)]' : 'text-[var(--v3)]'">
                        <span class="w-1.5 h-1.5" :class="runStatus.running ? 'bg-[var(--v)] pulse' : 'bg-[var(--v3)]'"></span>
                        <span x-text="runStatus.running ? 'LIVE' : runStatus.error ? 'ERROR' : 'STANDBY'"></span>
                    </span>
                    <!-- Filter buttons -->
                    <div class="flex gap-1 ml-2">
                        <template x-for="[key, label] in [['all','ALL'],['exp','EXP'],['agent','AGENT'],['tool','TOOL'],['info','INFO'],['error','ERR']]" :key="key">
                            <button @click="liveLogFilter = key"
                                    class="text-[0.5625rem] tracking-wider px-1.5 py-0.5 transition-all"
                                    :class="liveLogFilter === key ? 'text-[var(--v)] border border-[var(--v)] bg-[rgba(180,74,255,0.08)]' : 'text-[var(--v3)] border border-[var(--v-dim)] hover:text-[var(--ng2)]'"
                                    x-text="label"></button>
                        </template>
                    </div>
                    <!-- Entry count -->
                    <span class="text-[0.5625rem] text-[var(--v3)] ml-1" x-text="filteredLiveLog().length + '/' + liveLog.length"></span>
                    <!-- Actions -->
                    <div class="ml-auto flex items-center gap-2">
                        <button @click="toggleLiveLogPause()"
                                class="text-[0.625rem] tracking-wider transition-colors"
                                :class="liveLogPaused ? 'text-[var(--amber)]' : 'text-[var(--v3)] hover:text-[var(--cyan)]'"
                                x-text="liveLogPaused ? '&#x25B6; RESUME' : '&#x275A;&#x275A; PAUSE'"></button>
                        <button @click="clearLiveLog()" class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--red)] tracking-wider">CLEAR</button>
                        <button @click="liveLogAutoScroll = !liveLogAutoScroll"
                                class="text-[0.625rem] tracking-wider transition-colors"
                                :class="liveLogAutoScroll ? 'text-[var(--cyan)]' : 'text-[var(--v3)]'"
                                x-text="liveLogAutoScroll ? '&#x2193; AUTO' : '&#x2193; MANUAL'"></button>
                        <button @click="pollRunStatus()" class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--cyan)] tracking-wider">PING</button>
                    </div>
                </div>
                <!-- Log entries -->
                <div class="relative">
                    <div id="live-log-container"
                         class="bg-[var(--bg)] pixel-border p-3 max-h-[500px] overflow-y-auto text-[0.6875rem] leading-relaxed font-mono"
                         @scroll="if ($el.scrollTop + $el.clientHeight < $el.scrollHeight - 100) liveLogAutoScroll = false">
                        <template x-for="(entry,i) in filteredLiveLog()" :key="'ll'+i">
                            <div class="flex gap-2 py-0.5 hover:bg-[var(--bg3)] px-1 -mx-1 transition-colors live-log-entry"
                                 :class="'live-log-type-' + entry.type">
                                <span class="text-[0.5625rem] text-[var(--v3)] shrink-0 w-14 text-right tabular-nums" x-text="entry.ts"></span>
                                <span class="shrink-0 w-3 text-center" :style="'color:' + entry.color" x-text="entry.icon"></span>
                                <span class="break-all whitespace-pre-wrap" :style="'color:' + entry.color" x-text="entry.text"></span>
                            </div>
                        </template>
                        <!-- Paused indicator -->
                        <div x-show="liveLogPaused" class="sticky bottom-0 left-0 right-0 bg-[var(--amber)]/10 border-t border-[var(--amber)]/30 px-3 py-1 text-[0.5625rem] text-[var(--amber)] tracking-wider text-center">
                            &#x23F8; LOG PAUSED &#x2014; incoming events buffered
                        </div>
                    </div>
                    <!-- Scroll-to-bottom FAB -->
                    <button x-show="!liveLogAutoScroll" x-cloak
                            @click.stop="liveLogAutoScroll = true; scrollLiveLog()"
                            class="absolute right-3 bottom-3 z-10 px-2 py-1 bg-[var(--bg2)] border border-[var(--v2)] text-[var(--v)] text-[0.5625rem] tracking-wider hover:bg-[rgba(180,74,255,0.15)] transition-all shadow-lg"
                            title="Resume auto-scroll">&#x2193; BOTTOM</button>
                </div>
                <!-- Empty state -->
                <div x-show="liveLog.length === 0" class="text-center py-8 text-[var(--v3)] text-xs tracking-widest">AWAITING_TRANSMISSION_</div>
                <!-- Error panel -->
                <div x-show="runStatus.error" class="mt-3 bg-[rgba(255,51,51,0.05)] pixel-border p-2" style="border-color:rgba(255,51,51,0.3)">
                    <div class="text-[0.5625rem] text-[var(--red)] tracking-widest mb-1">ERROR_REPORT_</div>
                    <pre class="text-[0.625rem] text-[var(--red)]/60 whitespace-pre-wrap" x-text="runStatus.error"></pre>
                </div>
            </div>
        </div>
    `;
})();
