// Template: Lab Minor Pages (Changes, Prompt, Config) — loaded before Alpine initializes
(function() {
    // Changes Log
    const changesEl = document.getElementById('lab-changes-root');
    if (changesEl) changesEl.innerHTML = `
        <div class="flex items-end justify-between mb-5">
            <div>
                <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">CHANGES_LOG</h2>
                <p class="text-xs text-[var(--ng3)] mt-1">MUTATION_CHRONICLE_</p>
            </div>
            <button @click="loadChangesLog()" class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--v)] tracking-wider border border-[var(--v-dim)] hover:border-[var(--v)] px-2 py-1 transition-all">REFRESH_</button>
        </div>
        <div class="pixel-border bg-[var(--bg2)] p-5 max-h-[80vh] overflow-y-auto md" x-html="renderMarkdown(changesLog)"></div>
    `;

    // Prompt Editor
    const promptEl = document.getElementById('lab-prompt-root');
    if (promptEl) promptEl.innerHTML = `
        <div class="flex items-end justify-between mb-5">
            <div>
                <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">PROMPT_ENGINE</h2>
                <p class="text-xs text-[var(--ng3)] mt-1">AGENT_DIRECTIVE_TEMPLATE_</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-[0.625rem] text-[var(--v3)]" x-text="prompt.length + ' CHARS'"></span>
                <button @click="savePrompt()" :disabled="promptSaving"
                        class="bg-[var(--bg2)] border border-[var(--v2)] text-[var(--v)] text-xs tracking-wider px-4 py-1.5 hover:bg-[rgba(180,74,255,0.1)] disabled:opacity-40 transition-all"
                        x-text="promptSaving ? 'SAVING...' : '[COMPILE]'"></button>
            </div>
        </div>
        <div class="pixel-border bg-[var(--bg2)] overflow-hidden">
            <div class="flex items-center justify-between px-3 py-1.5 bg-[var(--bg)] border-b border-[var(--v-dim)]">
                <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">config/default_prompt.md</span>
                <span class="text-[0.5625rem] text-[var(--v3)]">VARS: {iteration} {total} {project_name} {goals} {tech_stack} {constraints} {focus_areas}</span>
            </div>
            <textarea x-model="prompt" @keydown.tab.prevent="insertTab($event)"
                      class="editor w-full h-[70vh] p-4 bg-transparent text-[var(--ng2)] text-sm leading-relaxed resize-none border-none"
                      placeholder="INITIALIZING..."></textarea>
        </div>
    `;

    // Config
    const configEl = document.getElementById('lab-config-root');
    if (configEl) configEl.innerHTML = `
        <div class="flex items-end justify-between mb-5">
            <div>
                <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">CONFIG_MATRIX</h2>
                <p class="text-xs text-[var(--ng3)] mt-1">.autoresearch.json_</p>
            </div>
            <button @click="saveConfig()" :disabled="configSaving"
                    class="bg-[var(--bg2)] border border-[var(--v2)] text-[var(--v)] text-xs tracking-wider px-4 py-1.5 hover:bg-[rgba(180,74,255,0.1)] disabled:opacity-40 transition-all"
                    x-text="configSaving ? 'SAVING...' : '[COMMIT]'"></button>
        </div>
        <div class="space-y-3">
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <label class="text-[0.5625rem] tracking-widest text-[var(--v3)]">PROJECT_NAME</label>
                <input x-model="config.name" type="text" class="mt-1 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)]">
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <label class="text-[0.5625rem] tracking-widest text-[var(--v3)]">DESCRIPTION</label>
                <textarea x-model="config.description" rows="2" class="mt-1 w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)] resize-none"></textarea>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-[0.5625rem] tracking-widest text-[var(--v3)]">GOAL_QUEUE_</label>
                    <span class="text-[0.5625rem] text-[var(--cyan)]" x-text="config.goals.length + ' IN QUEUE'"></span>
                </div>
                <div class="space-y-0.5">
                    <template x-for="(g,i) in config.goals" :key="'g'+i">
                        <div class="flex items-center gap-1.5 group">
                            <span class="text-[0.5625rem] tabular-nums shrink-0 w-6 text-right" :class="i === 0 ? 'text-[var(--v)] glow-sm' : 'text-[var(--v3)]'" x-text="'#' + (i+1)"></span>
                            <input x-model="config.goals[i]" class="flex-1 bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1 text-sm text-[var(--ng2)] group-hover:border-[var(--v2)] transition-colors">
                            <button @click="config.goals.splice(i,1); config.goals.splice(i-1,0,g)" :disabled="i===0" class="text-[var(--v3)] hover:text-[var(--cyan)] text-[0.625rem] px-1 disabled:opacity-20 shrink-0" title="Move up">&#x25B2;</button>
                            <button @click="config.goals.splice(i,1); config.goals.splice(i+1,0,g)" :disabled="i===config.goals.length-1" class="text-[var(--v3)] hover:text-[var(--cyan)] text-[0.625rem] px-1 disabled:opacity-20 shrink-0" title="Move down">&#x25BC;</button>
                            <button @click="config.goals.splice(i,1)" class="text-[var(--v3)] hover:text-[var(--red)] text-xs px-1 shrink-0" title="Remove">X</button>
                        </div>
                    </template>
                    <div x-show="config.goals.length === 0" class="text-center py-3 text-[0.625rem] text-[var(--v3)] tracking-widest">QUEUE_EMPTY_</div>
                </div>
                <div class="flex gap-2 mt-2 border-t border-[var(--v-dim)] pt-2">
                    <button @click="config.goals.unshift('')" class="flex-1 text-[0.625rem] text-[var(--v)] border border-[var(--v2)] hover:bg-[rgba(180,74,255,0.1)] tracking-wider py-1 transition-all">[+] TOP PRIORITY</button>
                    <button @click="config.goals.push('')" class="flex-1 text-[0.625rem] text-[var(--cyan)] border border-[var(--v-dim)] hover:border-[var(--cyan)] hover:bg-[rgba(0,229,255,0.05)] tracking-wider py-1 transition-all">[+] ADD TO QUEUE</button>
                </div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3" x-show="config.completed_goals && config.completed_goals.length > 0">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-[0.5625rem] tracking-widest text-[var(--v3)]">COMPLETED_GOALS_</label>
                    <span class="text-[0.5625rem] text-[var(--ng3)]" x-text="(config.completed_goals?.length || 0) + ' DONE'"></span>
                </div>
                <div class="space-y-0.5">
                    <template x-for="(g,i) in config.completed_goals" :key="'cg'+i">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[0.5625rem] text-[var(--ng3)] shrink-0 w-4">&#x2713;</span>
                            <span class="text-[0.6875rem] text-[var(--ng3)] line-through flex-1 truncate" x-text="g"></span>
                            <button @click="config.completed_goals.splice(i,1)" class="text-[var(--v3)] hover:text-[var(--red)] text-[0.625rem] px-1 shrink-0 opacity-50 hover:opacity-100" title="Remove from completed">X</button>
                        </div>
                    </template>
                </div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="flex justify-between mb-2"><label class="text-[0.5625rem] tracking-widest text-[var(--v3)]">CONSTRAINTS_</label><span class="text-[0.5625rem] text-[var(--pink)]" x-text="config.constraints.length + ' ACTIVE'"></span></div>
                <div class="space-y-1">
                    <template x-for="(c,i) in config.constraints" :key="'c'+i">
                        <div class="flex items-center gap-1.5"><span class="text-[0.5625rem] text-[var(--v3)] w-4">C</span><input x-model="config.constraints[i]" class="flex-1 bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1 text-sm text-[var(--ng2)]"><button @click="config.constraints.splice(i,1)" class="text-[var(--v3)] hover:text-[var(--red)] text-xs px-1">X</button></div>
                    </template>
                    <button @click="config.constraints.push('')" class="text-[0.625rem] text-[var(--pink)] hover:text-white tracking-wider">+ ADD_CONSTRAINT</button>
                </div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-3">
                <div class="flex justify-between mb-2"><label class="text-[0.5625rem] tracking-widest text-[var(--v3)]">FOCUS_AREAS_</label><span class="text-[0.5625rem] text-[var(--v)]" x-text="config.focus_areas.length + ' ACTIVE'"></span></div>
                <div class="space-y-1">
                    <template x-for="(f,i) in config.focus_areas" :key="'f'+i">
                        <div class="flex items-center gap-1.5"><span class="text-[0.5625rem] text-[var(--v3)] w-4">F</span><input x-model="config.focus_areas[i]" class="flex-1 bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1 text-sm text-[var(--ng2)]"><button @click="config.focus_areas.splice(i,1)" class="text-[var(--v3)] hover:text-[var(--red)] text-xs px-1">X</button></div>
                    </template>
                    <button @click="config.focus_areas.push('')" class="text-[0.625rem] text-[var(--v)] hover:text-white tracking-wider">+ ADD_FOCUS</button>
                </div>
            </div>
        </div>
    `;
})();
