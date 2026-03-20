// Template: Lab Settings — loaded before Alpine initializes
(function() {
    const el = document.getElementById('lab-settings-root');
    if (!el) return;
    el.innerHTML = `
        <div class="mb-5">
            <h2 class="text-lg tracking-widest text-[var(--v)] glow" style="font-family:'Press Start 2P',monospace">SETTINGS</h2>
            <p class="text-xs text-[var(--ng3)] mt-1">UI_PREFERENCES_</p>
        </div>
        <div class="space-y-3">
            <!-- Theme selector with visual preview cards -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <div class="text-sm text-[var(--ng2)] tracking-wider">COLOR_THEME</div>
                        <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">&#x0412;&#x0438;&#x0437;&#x0443;&#x0430;&#x043B;&#x044C;&#x043D;&#x0430;&#x044F; &#x0442;&#x0435;&#x043C;&#x0430; &#x0438;&#x043D;&#x0442;&#x0435;&#x0440;&#x0444;&#x0435;&#x0439;&#x0441;&#x0430;</div>
                    </div>
                    <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider" x-text="(themeMeta[settings.theme] || {}).label || settings.theme.toUpperCase()"></span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <template x-for="[key, meta] in Object.entries(themeMeta)" :key="key">
                        <button @click="settings.theme = key; localStorage.setItem('ar-settings', JSON.stringify(settings)); applySettings();"
                                class="theme-preview-card p-3 text-left transition-all"
                                :class="settings.theme === key ? 'theme-preview-active' : 'theme-preview-inactive'">
                            <!-- Color swatches row -->
                            <div class="flex gap-1 mb-2">
                                <template x-for="(color, ci) in meta.swatches" :key="ci">
                                    <div class="theme-swatch" :style="'background:' + color"></div>
                                </template>
                            </div>
                            <!-- Theme name -->
                            <div class="text-[0.625rem] tracking-[0.12em] mb-0.5"
                                 :class="settings.theme === key ? 'text-[var(--v)]' : 'text-[var(--ng3)]'"
                                 x-text="meta.label"></div>
                            <!-- Theme description -->
                            <div class="text-[0.5625rem]"
                                 :class="settings.theme === key ? 'text-[var(--ng2)]' : 'text-[var(--v3)]'"
                                 x-text="meta.desc"></div>
                        </button>
                    </template>
                </div>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-4 flex items-center justify-between">
                <div>
                    <div class="text-sm text-[var(--ng2)] tracking-wider">MATRIX_RAIN</div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Animated code rain background</div>
                </div>
                <button @click="toggleSetting('matrixRain')"
                        class="w-12 h-6 rounded-sm transition-all duration-200 relative cursor-pointer"
                        :class="settings.matrixRain ? 'bg-[var(--v)]' : 'bg-[var(--v-dim)]'">
                    <div class="w-5 h-5 rounded-sm absolute top-0.5 transition-all duration-200"
                         :class="settings.matrixRain ? 'left-[26px] bg-[var(--bg2)]' : 'left-0.5 bg-[var(--v3)]'"></div>
                </button>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-4 flex items-center justify-between">
                <div>
                    <div class="text-sm text-[var(--ng2)] tracking-wider">CRT_EFFECT</div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Scanlines, vignette + flicker</div>
                </div>
                <button @click="toggleSetting('crtEffect')"
                        class="w-12 h-6 rounded-sm transition-all duration-200 relative cursor-pointer"
                        :class="settings.crtEffect ? 'bg-[var(--v)]' : 'bg-[var(--v-dim)]'">
                    <div class="w-5 h-5 rounded-sm absolute top-0.5 transition-all duration-200"
                         :class="settings.crtEffect ? 'left-[26px] bg-[var(--bg2)]' : 'left-0.5 bg-[var(--v3)]'"></div>
                </button>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-4 flex items-center justify-between">
                <div>
                    <div class="text-sm text-[var(--ng2)] tracking-wider">CAT_COMPANION</div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Sidebar cat sprite with speech</div>
                </div>
                <button @click="toggleSetting('catCompanion')"
                        class="w-12 h-6 rounded-sm transition-all duration-200 relative cursor-pointer"
                        :class="settings.catCompanion ? 'bg-[var(--v)]' : 'bg-[var(--v-dim)]'">
                    <div class="w-5 h-5 rounded-sm absolute top-0.5 transition-all duration-200"
                         :class="settings.catCompanion ? 'left-[26px] bg-[var(--bg2)]' : 'left-0.5 bg-[var(--v3)]'"></div>
                </button>
            </div>
            <div class="pixel-border bg-[var(--bg2)] p-4 flex items-center justify-between">
                <div>
                    <div class="text-sm text-[var(--ng2)] tracking-wider">SHOW_THINKING</div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Show agent reasoning blocks in chat</div>
                </div>
                <button @click="toggleSetting('showThinking')"
                        class="w-12 h-6 rounded-sm transition-all duration-200 relative cursor-pointer"
                        :class="settings.showThinking ? 'bg-[var(--amber)]' : 'bg-[var(--v-dim)]'">
                    <div class="w-5 h-5 rounded-sm absolute top-0.5 transition-all duration-200"
                         :class="settings.showThinking ? 'left-[26px] bg-[var(--bg2)]' : 'left-0.5 bg-[var(--v3)]'"></div>
                </button>
            </div>

            <!-- Divider: Typography -->
            <div class="flex items-center gap-2 py-1">
                <div class="flex-1 border-t border-[var(--v-dim)]"></div>
                <span class="text-[0.5rem] tracking-[0.3em] text-[var(--v3)]">TYPOGRAPHY</span>
                <div class="flex-1 border-t border-[var(--v-dim)]"></div>
            </div>

            <!-- Font size slider -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <div class="text-sm text-[var(--ng2)] tracking-wider">FONT_SIZE</div>
                        <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Base text size for the interface</div>
                    </div>
                    <span class="text-sm text-[var(--v)] font-mono px-2 py-0.5 bg-[var(--bg)] border border-[var(--v-dim)]"
                          x-text="settings.fontSize + 'px'"></span>
                </div>
                <input type="range" min="10" max="22" step="1"
                       x-model.number="settings.fontSize"
                       @input="settings.fontSize = parseInt($event.target.value); localStorage.setItem('ar-settings', JSON.stringify(settings)); applySettings();"
                       class="w-full h-1.5 bg-[var(--v-dim)] rounded-sm appearance-none cursor-pointer"
                       style="accent-color: var(--v);">
                <div class="flex justify-between text-[0.5625rem] text-[var(--v3)] mt-1">
                    <span>10px</span>
                    <span>16px</span>
                    <span>22px</span>
                </div>
            </div>

            <!-- Chat density -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-sm text-[var(--ng2)] tracking-wider">CHAT_DENSITY</div>
                        <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Compact mode reduces message spacing</div>
                    </div>
                    <div class="flex gap-1">
                        <button @click="settings.chatDensity = 'comfortable'; localStorage.setItem('ar-settings', JSON.stringify(settings)); applySettings();"
                                class="px-3 py-1.5 text-[0.625rem] tracking-wider transition-all"
                                :class="settings.chatDensity === 'comfortable' ? 'bg-[var(--v)] text-[var(--bg)] border border-[var(--v)]' : 'bg-[var(--bg)] border border-[var(--v-dim)] text-[var(--v3)] hover:text-[var(--ng2)]'">
                            COMFORTABLE
                        </button>
                        <button @click="settings.chatDensity = 'compact'; localStorage.setItem('ar-settings', JSON.stringify(settings)); applySettings();"
                                class="px-3 py-1.5 text-[0.625rem] tracking-wider transition-all"
                                :class="settings.chatDensity === 'compact' ? 'bg-[var(--v)] text-[var(--bg)] border border-[var(--v)]' : 'bg-[var(--bg)] border border-[var(--v-dim)] text-[var(--v3)] hover:text-[var(--ng2)]'">
                            COMPACT
                        </button>
                    </div>
                </div>
            </div>

            <!-- Divider: Layout -->
            <div class="flex items-center gap-2 py-1">
                <div class="flex-1 border-t border-[var(--v-dim)]"></div>
                <span class="text-[0.5rem] tracking-[0.3em] text-[var(--v3)]">LAYOUT</span>
                <div class="flex-1 border-t border-[var(--v-dim)]"></div>
            </div>

            <!-- Compact sidebar -->
            <div class="pixel-border bg-[var(--bg2)] p-4 flex items-center justify-between">
                <div>
                    <div class="text-sm text-[var(--ng2)] tracking-wider">COMPACT_SIDEBAR</div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Icons-only sidebar (64px) instead of full (256px)</div>
                </div>
                <button @click="toggleSetting('compactSidebar')"
                        class="w-12 h-6 rounded-sm transition-all duration-200 relative cursor-pointer"
                        :class="settings.compactSidebar ? 'bg-[var(--v)]' : 'bg-[var(--v-dim)]'">
                    <div class="w-5 h-5 rounded-sm absolute top-0.5 transition-all duration-200"
                         :class="settings.compactSidebar ? 'left-[26px] bg-[var(--bg2)]' : 'left-0.5 bg-[var(--v3)]'"></div>
                </button>
            </div>

            <!-- Divider: Chat Budget -->
            <div class="flex items-center gap-2 py-1">
                <div class="flex-1 border-t border-[var(--v-dim)]"></div>
                <span class="text-[0.5rem] tracking-[0.3em] text-[var(--v3)]">CHAT_BUDGET</span>
                <div class="flex-1 border-t border-[var(--v-dim)]"></div>
            </div>

            <!-- Cost budget -->
            <div class="pixel-border bg-[var(--bg2)] p-4">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <div class="text-sm text-[var(--ng2)] tracking-wider">COST_BUDGET</div>
                        <div class="text-[0.625rem] text-[var(--v3)] mt-0.5">Maximum session cost before warnings (USD). Set 0 to disable.</div>
                    </div>
                    <span class="text-sm text-[var(--yellow)] font-mono px-2 py-0.5 bg-[var(--bg)] border border-[var(--v-dim)]"
                          x-text="'$' + (settings.costBudget || 0).toFixed(2)"></span>
                </div>
                <input type="range" min="0" max="50" step="0.50"
                       x-model.number="settings.costBudget"
                       @input="settings.costBudget = parseFloat($event.target.value); localStorage.setItem('ar-settings', JSON.stringify(settings));"
                       class="w-full h-1.5 bg-[var(--v-dim)] rounded-sm appearance-none cursor-pointer"
                       style="accent-color: var(--yellow);">
                <div class="flex justify-between text-[0.5625rem] text-[var(--v3)] mt-1">
                    <span>$0 (off)</span>
                    <span>$5</span>
                    <span>$10</span>
                    <span>$25</span>
                    <span>$50</span>
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">WARN_AT</span>
                    <span class="text-[0.5625rem] text-[var(--v3)]">50%</span>
                    <span class="text-[0.5625rem] text-[var(--amber)]">80%</span>
                    <span class="text-[0.5625rem] text-[var(--red)]">100%</span>
                </div>
            </div>
        </div>
    `;
})();
