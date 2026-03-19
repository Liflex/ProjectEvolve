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
                 class="mt-1 px-2 py-0.5 border border-[var(--v)] text-[0.5625rem] text-[var(--cyan)] tracking-wider max-w-[200px] text-center truncate"
                 :class="settings.compactSidebar ? 'max-w-[52px] text-[0.4375rem]' : ''"
                 style="background:rgba(12,11,20,0.95); box-shadow: 0 0 10px rgba(180,74,255,0.15);"
                 x-text="settings.compactSidebar ? (catSpeech.length > 8 ? catSpeech.slice(0,8) + '..' : catSpeech) : '> ' + catSpeech"></div>
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
            <div class="my-2 mx-4 border-t border-[var(--v-dim)]" x-show="!settings.compactSidebar"></div>
            <button @click="navigate('settings')" class="nav-link w-full flex items-center gap-2.5 px-4 py-2 text-sm tracking-wider text-[var(--ng3)]"
                    :class="[settings.compactSidebar ? 'justify-center px-2 sidebar-tooltip' : '', page === 'settings' && 'active']"
                    data-tip="SETTINGS (Alt+9)">
                <span class="text-xs">[>]</span>
                <template x-if="!settings.compactSidebar"><span>SETTINGS</span></template>
                <template x-if="!settings.compactSidebar"><span class="ml-auto text-[0.5625rem] text-[var(--v-dim)] font-mono">Alt+9</span></template>
            </button>
        </nav>

        <!-- Chat sidebar content (shown in Chat section) -->
        <div x-show="section === 'chat'" class="flex-1 py-2 flex flex-col items-center justify-center text-center px-4">
            <div class="text-[0.5625rem] tracking-widest text-[var(--v3)] mb-2" x-show="!settings.compactSidebar">ACTIVE_SESSIONS</div>
            <div class="text-2xl text-[var(--v)] glow-sm" style="font-family:'Press Start 2P',monospace" x-text="String(chatTabs.length).padStart(2,'0')"></div>
            <div class="text-[0.5625rem] text-[var(--v3)] mt-1" x-show="!settings.compactSidebar">/ 5 LIMIT</div>
        </div>

        <!-- Footer -->
        <div class="p-3 border-t-2 border-[var(--v-dim)] flex items-center justify-between">
            <span class="text-[0.625rem] text-[var(--v3)]" x-show="!settings.compactSidebar">v1.0.0</span>
            <a href="/api/docs" target="_blank" class="text-[0.625rem] text-[var(--v3)] hover:text-[var(--v)] transition-colors" x-show="!settings.compactSidebar">API_</a>
        </div>
    `;
})();
