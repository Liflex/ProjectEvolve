// Template: Sidebar — loaded before Alpine initializes
(function() {
    const el = document.getElementById('sidebar-root');
    if (!el) return;
    el.innerHTML = `
        <!-- Logo -->
        <div class="p-4 border-b-2 border-[var(--v-dim)] flex items-center justify-between">
            <div>
                <div class="font-bold text-xs tracking-widest synth-text" style="font-family:'Press Start 2P',monospace"
                     x-show="!settings.compactSidebar">
                    AUTORESEARCH
                </div>
                <div class="text-[0.625rem] tracking-[0.3em] text-[var(--v3)] mt-1" x-show="!settings.compactSidebar">[ HACK THE PLANET ]</div>
                <!-- Command palette hint -->
                <div class="text-[0.5625rem] text-[var(--v3)] mt-1.5 cursor-pointer hover:text-[var(--v)] transition-colors"
                     x-show="!settings.compactSidebar"
                     @click="openCmdPalette()"
                     title="Open Command Palette (Ctrl+Shift+P)">
                    Ctrl+Shift+P
                </div>
                <!-- Compact logo: just icon -->
                <div class="text-xs text-[var(--v)] glow-sm text-center" x-show="settings.compactSidebar" style="font-family:'Press Start 2P',monospace">AR</div>
            </div>
            <!-- Sidebar collapse toggle -->
            <button @click="toggleSetting('compactSidebar')" class="text-[var(--v3)] hover:text-[var(--v)] text-xs tracking-wider transition-colors"
                    :title="settings.compactSidebar ? 'Expand sidebar' : 'Collapse sidebar'"
                    x-text="settings.compactSidebar ? '>>' : '<<'">
            </button>
        </div>

        <!-- Cat Companion -->
        <div x-show="settings.catCompanion" class="py-3 border-b-2 border-[var(--v-dim)] flex flex-col items-center">
            <div class="cat-frame" :class="{'cat-frame-hover': _catHovering}">
                <canvas id="cat-canvas" width="180" height="148"
                        style="cursor:pointer"
                        @click="onCatClick()"
                        @mouseenter="_catHovering = true; if(window.CatModule && CatModule.setHovering) CatModule.setHovering(true)"
                        @mouseleave="_catHovering = false; if(window.CatModule && CatModule.setHovering) CatModule.setHovering(false)"></canvas>
            </div>
            <div class="mt-1.5 text-center" x-show="!settings.compactSidebar">
                <div class="text-[0.5rem] tracking-widest text-[var(--v)]" style="font-family:'Press Start 2P',monospace">COMPANION</div>
                <div class="text-[0.625rem] text-[var(--ng3)] mt-0.5">GEN <span x-text="String(stats.total_experiments || 0).padStart(3,'0')"></span></div>
            </div>
            <!-- Cat speech bubble -->
            <div x-show="catSpeech" x-cloak
                 x-transition:enter="cat-bubble-enter"
                 x-transition:enter-start="cat-bubble-enter-from"
                 x-transition:enter-end="cat-bubble-enter-to"
                 class="cat-speech-bubble"
                 :class="[
                     settings.compactSidebar ? 'cat-bubble-compact' : '',
                     'cat-mood-' + (catExpression || 'neutral'),
                     catSpeechAction ? 'cat-speech-actionable' : ''
                 ]"
                 @click="catSpeechAction && onCatSpeechClick()"
                 :title="catSpeechAction ? 'Click to insert: ' + catSpeechAction.value.trim() : ''">
                <span x-show="catSpeechAction" class="cat-speech-action-hint">&#x2726;</span>
                <span x-text="settings.compactSidebar ? (catSpeech.length > 8 ? catSpeech.slice(0,8) + '..' : catSpeech) : catSpeech"></span>
            </div>
        </div>

        <!-- === MAIN NAV: Research Lab / Chat === -->
        <nav class="flex flex-col border-b-2 border-[var(--v-dim)]">
            <button @click="navigateSection('lab')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2.5 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', section === 'lab' && 'active']"
                    data-tip="RESEARCH LAB (Alt+1)">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>RESEARCH LAB</span></template>
                <template x-if="!settings.compactSidebar"><span class="ml-auto text-[0.5625rem] text-[var(--v-dim)] font-mono">Alt+1</span></template>
            </button>
            <button @click="navigateSection('chat')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2.5 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', section === 'chat' && 'active']"
                    data-tip="CHAT (Alt+2)">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>CHAT</span></template>
                <template x-if="!settings.compactSidebar"><span class="ml-auto text-[0.5625rem] text-[var(--v-dim)] font-mono">Alt+2</span></template>
            </button>
        </nav>

        <!-- Lab sub-navigation (shown in Research Lab section) -->
        <nav x-show="section === 'lab'" class="flex-1 py-2 overflow-y-auto">
            <button @click="navigate('dashboard')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'dashboard' && 'active']"
                    data-tip="DASHBOARD">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>DASHBOARD</span></template>
            </button>
            <button @click="navigate('experiments')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'experiments' && 'active']"
                    data-tip="EXPERIMENTS">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>EXPERIMENTS</span></template>
                <template x-if="!settings.compactSidebar"><span class="ml-auto text-[0.625rem] text-[var(--v3)]" x-text="String(stats.total_experiments || 0).padStart(3,'0')"></span></template>
            </button>
            <button @click="navigate('changes')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'changes' && 'active']"
                    data-tip="CHANGELOG">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>CHANGELOG</span></template>
            </button>
            <div class="my-2 mx-4 border-t border-[var(--v-dim)]" x-show="!settings.compactSidebar"></div>
            <button @click="navigate('prompt')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'prompt' && 'active']"
                    data-tip="PROMPT">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>PROMPT</span></template>
            </button>
            <button @click="navigate('config')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'config' && 'active']"
                    data-tip="CONFIG">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>CONFIG</span></template>
            </button>
            <div class="my-2 mx-4 border-t border-[var(--v-dim)]" x-show="!settings.compactSidebar"></div>
            <button @click="navigate('run')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'run' && 'active']"
                    data-tip="RUN EXPERIMENT">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>RUN EXPERIMENT</span></template>
                <span class="w-2 h-2" :class="runStatus.running ? 'bg-[var(--v)] pulse' : 'bg-[var(--v3)]'"></span>
            </button>
        </nav>

        <!-- Chat sidebar content (shown in Chat section) -->
        <div x-show="section === 'chat'" class="flex-1 py-2 overflow-y-auto">
            <!-- Compact mode: just session count -->
            <div x-show="settings.compactSidebar" class="flex flex-col items-center justify-center h-full px-2">
                <div class="text-lg text-[var(--v)] glow-sm" style="font-family:'Press Start 2P',monospace" x-text="String(chatTabs.length).padStart(2,'0')"></div>
                <div class="text-[0.5rem] text-[var(--v3)] mt-1">SESSIONS</div>
            </div>
            <!-- Full sidebar -->
            <div x-show="!settings.compactSidebar">
                <!-- Aggregate stats -->
                <div class="px-4 mb-3">
                    <div class="text-[0.5rem] tracking-[0.15em] text-[var(--v3)] mb-2">CHAT_OVERVIEW</div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <div class="csb-stat-card">
                            <div class="csb-stat-label">SESSIONS</div>
                            <div class="csb-stat-value" x-text="chatTabs.length + '/5'"></div>
                        </div>
                        <div class="csb-stat-card">
                            <div class="csb-stat-label">MESSAGES</div>
                            <div class="csb-stat-value" style="color:var(--cyan)" x-text="chatTabs.reduce(function(s,t){return s + t.messages.length}, 0)"></div>
                        </div>
                        <div class="csb-stat-card">
                            <div class="csb-stat-label">TOKENS</div>
                            <div class="csb-stat-value csb-stat-value-sm" style="color:var(--ng2)" x-text="(chatTabs.reduce(function(s,t){return s + (t.tokens ? t.tokens.input : 0)}, 0) / 1000).toFixed(1) + 'K'"></div>
                        </div>
                        <div class="csb-stat-card">
                            <div class="csb-stat-label">COST</div>
                            <div class="csb-stat-value csb-stat-value-sm" style="color:var(--yellow)" x-text="'$' + chatTabs.reduce(function(s,t){return s + (t.tokens ? t.tokens.cost : 0)}, 0).toFixed(2)"></div>
                        </div>
                    </div>
                </div>
                <div class="mx-4 border-t border-[var(--v-dim)]"></div>
                <!-- Session list -->
                <div class="px-4 mt-3">
                    <div class="text-[0.5rem] tracking-[0.15em] text-[var(--v3)] mb-2">ACTIVE_SESSIONS</div>
                    <div class="space-y-1.5">
                        <template x-for="tab in chatTabs" :key="tab.tab_id">
                            <div class="csb-session-card"
                                 :class="activeChatTab === tab.tab_id && 'csb-session-active'"
                                 @click="activateChatTab(tab.tab_id)">
                                <div class="flex items-center gap-1.5">
                                    <span class="csb-session-dot"
                                          :class="tab.is_streaming ? 'csb-dot-streaming' : tab.ws_state === 'connected' ? 'csb-dot-connected' : tab.ws_state === 'connecting' ? 'csb-dot-connecting' : 'csb-dot-error'"></span>
                                    <span class="csb-session-label" x-text="tab.label"></span>
                                    <span class="csb-session-msgs" x-text="tab.messages.length"></span>
                                </div>
                                <div x-show="tab.messages.length > 0"
                                     class="csb-session-preview"
                                     x-text="getLastMsgPreview(tab)"></div>
                            </div>
                        </template>
                        <div x-show="chatTabs.length === 0" class="text-center py-3">
                            <div class="text-[0.5625rem] text-[var(--v3)] tracking-wider">NO_SESSIONS</div>
                            <div class="text-[0.5rem] text-[var(--v3)] mt-1">+ NEW TAB to start</div>
                        </div>
                    </div>
                </div>
                <div class="mx-4 mt-3 border-t border-[var(--v-dim)]"></div>
                <!-- Quick actions -->
                <div class="px-4 mt-3 space-y-1">
                    <button @click="openFileBrowserForTab()" class="csb-action-btn">+ NEW TAB</button>
                    <button x-show="chatTabs.length > 0" @click="showSessionPicker()" class="csb-action-btn" style="color:var(--cyan)">RESUME</button>
                    <button x-show="chatTabs.length > 1" @click="chatTabs.slice().forEach(function(t){closeChatTab(t.tab_id)})" class="csb-action-btn" style="color:var(--red)">CLOSE ALL</button>
                </div>
            </div>
        </div>

        <!-- Global Settings (always visible, bottom of sidebar) -->
        <div class="border-t-2 border-[var(--v-dim)]">
            <button @click="navigateSection('lab'); $nextTick(() => navigate('settings'))" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'settings' && section === 'lab' && 'active']"
                    data-tip="SETTINGS (Alt+9)">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>SETTINGS</span></template>
                <template x-if="!settings.compactSidebar"><span class="ml-auto text-[0.5625rem] text-[var(--v-dim)] font-mono">Alt+9</span></template>
            </button>
        </div>

        <!-- Footer -->
        <div class="p-3 border-t-2 border-[var(--v-dim)] flex items-center justify-between">
            <span class="text-[0.625rem] text-[var(--v3)]" x-show="!settings.compactSidebar">v1.0.0</span>
            <a href="/api/docs" target="_blank" class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--v)] transition-colors" x-show="!settings.compactSidebar">API_</a>
        </div>
    `;
})();
