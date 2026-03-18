// Template: Chat Section — loaded before Alpine initializes
(function() {
    const el = document.getElementById('chat-section-root');
    if (!el) return;
    el.innerHTML = `
        <!-- Chat Tab Bar -->
        <div class="flex items-center border-b-2 border-[var(--v-dim)] bg-[var(--bg2)] px-2 shrink-0">
            <!-- Tab buttons -->
            <div class="flex items-center overflow-x-auto flex-1">
                <template x-for="tab in chatTabs" :key="tab.tab_id">
                    <div class="flex items-center shrink-0 group">
                        <button @click="activateChatTab(tab.tab_id)"
                                class="flex items-center gap-2 px-3 py-2 text-xs tracking-wider transition-colors"
                                :class="activeChatTab === tab.tab_id ? 'text-[var(--v)] border-b-2 border-[var(--v)] -mb-[2px]' : 'text-[var(--v3)] hover:text-[var(--ng2)]'">
                            <span class="w-1.5 h-1.5 rounded-full" :class="tab.is_streaming ? 'bg-[var(--cyan)] animate-pulse' : tab.ws_state === 'connected' ? 'bg-[var(--ng)]' : tab.ws_state === 'connecting' ? 'bg-[var(--amber)] animate-pulse' : 'bg-[var(--v3)]'"></span>
                            <span class="truncate max-w-[100px]" x-text="tab.label"></span>
                            <span x-show="tab.messages.length > 0" class="text-[0.5rem] tabular-nums px-1 bg-[var(--v-dim)] text-[var(--v3)]" x-text="tab.messages.length"></span>
                        </button>
                        <button @click="closeChatTab(tab.tab_id)"
                                class="text-[var(--v3)] hover:text-[var(--red)] text-xs px-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">x</button>
                    </div>
                </template>
                <!-- Empty state -->
                <div x-show="chatTabs.length === 0" class="text-[0.625rem] text-[var(--v3)] tracking-widest px-3 py-2">
                    NO_ACTIVE_SESSIONS_
                </div>
            </div>
            <!-- New Tab + Resume buttons -->
            <div class="flex items-center gap-1 shrink-0 ml-2">
                <button @click="showSessionPicker()" class="px-2 py-1 text-[0.625rem] text-[var(--v3)] hover:text-[var(--cyan)] border border-[var(--v-dim)] hover:border-[var(--cyan)] tracking-wider transition-all" title="Resume previous session">RESUME</button>
                <button @click="openFileBrowserForTab()" class="px-2 py-1 text-[0.625rem] text-[var(--v)] border border-[var(--v2)] hover:bg-[rgba(180,74,255,0.1)] tracking-wider transition-all" title="Open new chat tab">+ NEW TAB</button>
            </div>
        </div>

        <!-- Chat Toolbar (shared across tabs) -->
        <div x-show="activeTab" class="chat-toolbar">
            <button class="chat-toolbar-btn" @click="clearActiveChat()" title="Clear chat messages">CLEAR</button>
            <button class="chat-toolbar-btn" @click="exportActiveChat()" title="Export chat as markdown">EXPORT</button>
            <div class="chat-toolbar-sep"></div>
            <button class="chat-toolbar-btn" :class="chatBottomPanel === 'rawlog' && 'active'" @click="toggleBottomPanel('rawlog')" title="Toggle raw tool logs">
                <span :style="'color:' + (chatBottomPanel === 'rawlog' ? 'var(--v)' : 'inherit')">&#x2328;</span> RAW LOG
            </button>
            <button class="chat-toolbar-btn" :class="chatBottomPanel === 'summary' && 'active'" @click="toggleBottomPanel('summary')" title="Toggle tools summary">
                <span :style="'color:' + (chatBottomPanel === 'summary' ? 'var(--cyan)' : 'inherit')">&#x2699;</span> TOOLS
            </button>
            <div class="chat-toolbar-sep"></div>
            <button class="chat-toolbar-btn" :class="settings.showThinking && 'active'" @click="toggleSetting('showThinking')" title="Toggle thinking blocks visibility">
                <span :style="'color:' + (settings.showThinking ? 'var(--amber)' : 'inherit')">&#x1f4ad;</span> THINK
            </button>
            <div class="chat-toolbar-sep"></div>
            <button class="chat-toolbar-btn" @click="collapseAllMessages()" title="Collapse all long messages">FOLD ALL</button>
            <button class="chat-toolbar-btn" @click="expandAllMessages()" title="Expand all folded messages">UNFOLD</button>
            <div class="chat-toolbar-sep"></div>
            <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider" x-show="activeTab" x-text="(activeTab?.messages?.length || 0) + ' MSGS'"></span>
            <div class="flex-1"></div>
            <button class="chat-toolbar-btn" @click="openChatSearch()" title="Search in chat (Ctrl+F)">&#x1f50d;</button>
            <button class="chat-toolbar-btn" @click="openCmdPalette()" title="Command Palette (Ctrl+K)" style="font-size:0.5rem;letter-spacing:0.1em">CTRL+K</button>
            <button x-show="chatBottomPanel !== 'closed'" class="chat-toolbar-btn" @click="chatBottomPanel = 'closed'" title="Close panel">[X] PANEL</button>
        </div>

        <!-- Chat Search Bar (Ctrl+F) -->
        <div x-show="chatSearch.show && activeTab" x-cloak x-transition.duration.150ms
             class="chat-search-bar">
            <span class="chat-search-icon">&#x1f50d;</span>
            <input id="chat-search-input"
                   x-model="chatSearch.query"
                   @input="executeChatSearch()"
                   @keydown="if($event.key==='Escape'){closeChatSearch();$event.preventDefault();}"
                   placeholder="Search in chat..."
                   class="chat-search-input"
                   autocomplete="off" spellcheck="false">
            <div class="chat-search-nav">
                <button @click="navigateChatMatch(-1)" class="chat-search-nav-btn" :disabled="chatSearch.total === 0" title="Previous (Shift+Enter)">&#x25B2;</button>
                <span class="chat-search-count" x-text="chatSearch.total > 0 ? chatSearch.current + '/' + chatSearch.total : '0/0'"></span>
                <button @click="navigateChatMatch(1)" class="chat-search-nav-btn" :disabled="chatSearch.total === 0" title="Next (Enter)">&#x25BC;</button>
            </div>
            <button @click="closeChatSearch()" class="chat-search-close" title="Close (Escape)">[X]</button>
        </div>

        <!-- Chat Tab Content -->
        <div class="flex-1 overflow-hidden relative">
            <template x-for="tab in chatTabs" :key="tab.tab_id">
                <div x-show="activeChatTab === tab.tab_id" class="absolute inset-0 flex flex-col">
                    <!-- Messages area -->
                    <div class="flex-1 overflow-y-auto p-4 space-y-3" :id="'chat-messages-' + tab.tab_id"
                         x-html="renderChatHTML(tab)"
                         @click="onChatClick($event)"
                         @scroll="onChatScroll(tab, $event)">
                    </div>
                    <!-- Scroll-to-bottom FAB -->
                    <button x-show="tab.scrolledUp" x-cloak
                            @click.stop="scrollToBottom(tab)"
                            class="absolute right-4 z-10 px-2.5 py-1.5 bg-[var(--bg2)] border border-[var(--v2)] text-[var(--v)] text-[0.625rem] tracking-wider hover:bg-[rgba(180,74,255,0.15)] transition-all shadow-lg"
                            :style="'bottom:' + (chatBottomPanel !== 'closed' ? (chatBottomPanelHeight + 28) : '80') + 'px'"
                            title="Scroll to bottom">&#x2193; BOTTOM</button>
                    <!-- Bottom Panel (collapsible) -->
                    <template x-if="chatBottomPanel !== 'closed'">
                        <div>
                            <!-- Resize handle -->
                            <div class="chat-resize-handle" @mousedown="startPanelResize($event)"></div>
                            <!-- Panel content -->
                            <div class="chat-bottom-panel" :style="'height:' + chatBottomPanelHeight + 'px'">
                                <div class="panel-tab-bar">
                                    <div class="panel-tab" :class="chatBottomPanel === 'rawlog' && 'active'" @click="chatBottomPanel = 'rawlog'">RAW LOG</div>
                                    <div class="panel-tab" :class="chatBottomPanel === 'summary' && 'active'" @click="chatBottomPanel = 'summary'">TOOLS SUMMARY</div>
                                    <div class="flex-1"></div>
                                    <button class="chat-toolbar-btn" @click="clearBottomPanelLog()" title="Clear log">CLEAR</button>
                                </div>
                                <!-- RAW LOG content -->
                                <div x-show="chatBottomPanel === 'rawlog'" class="panel-content">
                                    <template x-for="(entry, idx) in getBottomPanelLog()" :key="idx">
                                        <div class="log-entry">
                                            <span class="log-time" x-text="entry.time"></span>
                                            <span class="log-type" :style="'color:' + entry.color" x-text="'[' + entry.type + ']'"></span>
                                            <span class="log-detail" x-text="entry.detail"></span>
                                        </div>
                                    </template>
                                    <div x-show="getBottomPanelLog().length === 0" class="text-center py-4 text-[0.625rem] text-[var(--v3)] tracking-wider">NO_TOOL_ACTIVITY_YET_</div>
                                </div>
                                <!-- TOOLS SUMMARY content -->
                                <div x-show="chatBottomPanel === 'summary'" class="panel-content">
                                    <template x-for="(entry, idx) in getToolSummary()" :key="idx">
                                        <div class="log-entry flex items-center gap-2">
                                            <span style="font-size:0.75rem" x-text="entry.icon"></span>
                                            <span class="log-type" :style="'color:' + entry.color" x-text="entry.label + ' x' + entry.count"></span>
                                            <span class="log-detail flex-1" x-text="entry.detail"></span>
                                        </div>
                                    </template>
                                    <div x-show="getToolSummary().length === 0" class="text-center py-4 text-[0.625rem] text-[var(--v3)] tracking-wider">NO_TOOLS_USED_YET_</div>
                                </div>
                            </div>
                        </div>
                    </template>
                    <!-- Token indicator -->
                    <div x-show="tab.tokens.input > 0" class="border-t border-[var(--v-dim)] bg-[var(--bg)] px-3 py-1 flex items-center gap-3 shrink-0">
                        <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">TOKENS_</span>
                        <span class="text-[0.5625rem] tabular-nums" :class="tab.tokens.input > tab.tokens.threshold * 0.8 ? 'text-[var(--amber)]' : 'text-[var(--cyan)]'"
                              x-text="(tab.tokens.input/1000).toFixed(1)+'K / '+(tab.tokens.threshold/1000)+'K'"></span>
                        <span x-show="tab.tokens.output > 0" class="text-[0.5625rem] tabular-nums text-[var(--v3)]" x-text="'OUT '+(tab.tokens.output/1000).toFixed(1)+'K'"></span>
                        <div class="flex-1 h-1 bg-[var(--bg2)] overflow-hidden max-w-[160px]">
                            <div class="h-full transition-all duration-300"
                                 :class="tab.tokens.input > tab.tokens.threshold * 0.9 ? 'bg-[var(--red)]' : tab.tokens.input > tab.tokens.threshold * 0.7 ? 'bg-[var(--amber)]' : 'bg-[var(--cyan)]'"
                                 :style="'width:' + Math.min(100, (tab.tokens.input / tab.tokens.threshold) * 100) + '%'"></div>
                        </div>
                        <span class="text-[0.5625rem] tabular-nums" :class="tab.tokens.input > tab.tokens.threshold * 0.9 ? 'text-[var(--red)]' : tab.tokens.input > tab.tokens.threshold * 0.7 ? 'text-[var(--amber)]' : 'text-[var(--v3)]'"
                              x-text="Math.round((tab.tokens.input / tab.tokens.threshold) * 100) + '%'"></span>
                        <span x-show="tab.tokens.cost > 0" class="text-[0.5625rem] text-[var(--yellow)] tabular-nums" x-text="'$'+tab.tokens.cost.toFixed(4)"></span>
                        <span x-show="tab.tokens.input > tab.tokens.threshold * 0.9" class="text-[0.5625rem] text-[var(--red)] blink tracking-wider">HIGH_CTX</span>
                    </div>
                    <!-- Input area -->
                    <div class="border-t-2 border-[var(--v-dim)] bg-[var(--bg2)] p-3 shrink-0 relative"
                         @dragover.prevent="chatDragOver = true"
                         @dragleave.prevent="chatDragOver = false"
                         @drop.prevent="handleChatDrop(tab, $event)">
                        <!-- Drag & Drop overlay -->
                        <div x-show="chatDragOver" x-transition.opacity.duration.150ms
                             class="absolute inset-0 z-20 flex items-center justify-center"
                             style="background:rgba(180,74,255,0.08);border:2px dashed var(--v)">
                            <div class="text-center">
                                <div class="text-sm text-[var(--v)] tracking-widest" style="font-family:'Press Start 2P',monospace">DROP FILE</div>
                                <div class="text-[0.625rem] text-[var(--v3)] mt-2 tracking-wider">&#x0424;&#x0430;&#x0439;&#x043B; &#x0431;&#x0443;&#x0434;&#x0435;&#x0442; &#x0432;&#x0441;&#x0442;&#x0430;&#x0432;&#x043B;&#x0435;&#x043D; &#x0432; &#x043F;&#x043E;&#x043B;&#x0435; &#x0432;&#x0432;&#x043E;&#x0434;&#x0430;</div>
                            </div>
                        </div>
                        <div class="flex gap-2 items-end">
                            <div class="flex-1 relative">
                                <textarea x-model="tab.input_text"
                                          @keydown="handleChatKeydown(tab, $event)"
                                          @input="handleChatInput(tab, $event); autoResizeTextarea($event)"
                                          placeholder="Message_ (/ for commands, drag files here)"
                                          rows="1"
                                          class="chat-input-area w-full bg-[var(--bg)] border border-[var(--v-dim)] px-3 py-2 text-sm text-[var(--ng2)] tracking-wider resize-none editor"
                                          style="min-height:2.25rem;max-height:200px;overflow-y:hidden"
                                          :disabled="tab.is_streaming"></textarea>
                                <div class="flex items-center justify-between px-1 mt-0.5">
                                    <span class="chat-input-hint text-[0.5rem] text-[var(--v3)] tracking-wider">ENTER — send | SHIFT+ENTER — newline</span>
                                    <span class="text-[0.5rem] text-[var(--v3)] tabular-nums" x-show="(tab.input_text || '').length > 0" x-text="(tab.input_text || '').length + ' chars'"></span>
                                </div>
                                <!-- Slash command menu -->
                                <div x-show="slashMenu.show && slashMenu._tabId === tab.tab_id"
                                     x-transition.opacity.duration.100ms
                                     class="slash-menu absolute bottom-full left-0 mb-1 z-10"
                                     style="width:380px;max-height:320px;overflow-y:auto">
                                    <template x-for="(item, idx) in slashMenu.items" :key="item.cmd">
                                        <div>
                                            <!-- Category separator before first skill -->
                                            <template x-if="item.cat === 'skill' && (idx === 0 || slashMenu.items[idx-1]?.cat !== 'skill')">
                                                <div class="flex items-center gap-2 px-3 py-1 border-t border-[var(--v-dim)]" style="margin-top:2px">
                                                    <span style="font-size:0.4375rem;letter-spacing:0.2em;color:var(--cyan)">CLAUDE_CODE_SKILLS</span>
                                                    <span style="font-size:0.4375rem;color:var(--v3)">— отправляются агенту</span>
                                                </div>
                                            </template>
                                            <div class="slash-menu-item"
                                                 :class="idx === slashMenu.selected && 'selected'"
                                                 @mousedown.prevent="selectSlashCommand(item)">
                                                <span class="slash-cmd" x-text="item.cmd"
                                                      :style="item.cat === 'skill' ? 'color:var(--cyan)' : ''"></span>
                                                <span class="slash-desc" x-text="item.desc"></span>
                                                <span x-show="item.cat === 'skill'"
                                                      style="font-size:0.4375rem;color:var(--v3);letter-spacing:0.1em;margin-left:auto;white-space:nowrap;flex-shrink:0">SKILL</span>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>
                            <button @click="sendChatMessage(tab)" :disabled="tab.is_streaming || !tab.input_text?.trim()"
                                    class="px-4 py-2 border border-[var(--v)] text-[var(--v)] text-xs tracking-wider hover:bg-[rgba(180,74,255,0.1)] disabled:opacity-30 transition-all shrink-0">
                                [> SEND]
                            </button>
                            <button @click="cancelChatStream(tab)" x-show="tab.is_streaming"
                                    class="px-3 py-2 border border-[var(--red)] text-[var(--red)] text-xs tracking-wider hover:bg-[rgba(255,51,51,0.1)] transition-all shrink-0">
                                [X]
                            </button>
                        </div>
                    </div>
                </div>
            </template>

            <!-- No tab selected -->
            <div x-show="chatTabs.length === 0" class="flex items-center justify-center h-full">
                <div class="text-center">
                    <div class="text-[0.625rem] text-[var(--v3)] tracking-widest mb-6">CHAT_SESSIONS</div>
                    <button @click="openFileBrowserForTab()" class="start-session-btn px-12 py-5 mb-6 cursor-pointer" style="background: rgba(180,74,255,0.03)">
                        <div class="text-2xl tracking-widest text-[var(--v)]" style="font-family:'Press Start 2P',monospace">&#x2726; NEW SESSION &#x2726;</div>
                    </button>
                    <div class="text-[0.625rem] text-[var(--v3)] tracking-wider">or press [+ NEW TAB] above_</div>
                    <div class="text-[0.625rem] text-[var(--v3)] mt-3 tracking-wider">&#x2191; resume past session from sidebar</div>
                </div>
            </div>
        </div>

        <!-- IDE Status Bar -->
        <div x-show="activeTab" class="chat-status-bar">
            <div class="status-left">
                <span class="status-dot" :class="activeTab?.ws_state"></span>
                <span :style="'color:' + (activeTab?.ws_state === 'connected' ? 'var(--ng2)' : activeTab?.ws_state === 'connecting' ? 'var(--amber)' : 'var(--red)')"
                      x-text="activeTab?.ws_state === 'connected' ? 'CONNECTED' : activeTab?.ws_state === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'"></span>
                <span class="status-separator"></span>
                <span class="truncate max-w-[200px]" style="color:var(--ng3)" x-text="activeTab?.project_path"></span>
            </div>
            <div class="status-right">
                <span class="agent-state"
                      :class="activeTab?.is_streaming ? (activeTab?.is_thinking ? 'thinking' : 'streaming') : ''"
                      x-text="activeTab?.is_streaming ? (activeTab?.is_thinking ? 'THINKING...' : 'STREAMING...') : 'IDLE'"></span>
                <span class="status-separator"></span>
                <span x-text="(activeTab?.messages?.length || 0) + ' MSGS'"></span>
                <template x-if="activeTab && activeTab.tokens && activeTab.tokens.input > 0">
                    <span>
                        <span class="status-separator"></span>
                        <span :style="'color:' + (activeTab.tokens.input > activeTab.tokens.threshold * 0.9 ? 'var(--red)' : activeTab.tokens.input > activeTab.tokens.threshold * 0.7 ? 'var(--amber)' : 'var(--cyan)')"
                              x-text="'CTX ' + Math.round((activeTab.tokens.input / activeTab.tokens.threshold) * 100) + '%'"></span>
                        <span x-show="activeTab.tokens.output > 0" style="color:var(--v3)" x-text="' | OUT ' + (activeTab.tokens.output/1000).toFixed(1) + 'K'"></span>
                    </span>
                </template>
                <template x-if="activeTab && activeTab.tokens && activeTab.tokens.cost > 0">
                    <span>
                        <span class="status-separator"></span>
                        <span style="color:var(--yellow)" x-text="'$' + activeTab.tokens.cost.toFixed(4)"></span>
                    </span>
                </template>
            </div>
        </div>

        <!-- Soft limit warning modal -->
        <div x-show="showTabLimitWarning" x-cloak class="fixed inset-0 z-40 flex items-center justify-center bg-black/60" @click.self="showTabLimitWarning = false">
            <div class="bg-[var(--bg2)] border-2 border-[var(--amber)] p-6 max-w-md mx-4">
                <div class="text-sm text-[var(--amber)] tracking-widest mb-2">RESOURCE_WARNING</div>
                <p class="text-xs text-[var(--ng3)] mb-4">Active session limit reached. Multiple sessions consume significant resources. You can proceed, but performance may degrade.</p>
                <div class="flex gap-2">
                    <button @click="showTabLimitWarning = false" class="flex-1 px-3 py-1.5 text-xs text-[var(--v3)] border border-[var(--v-dim)] tracking-wider hover:text-[var(--ng2)]">CANCEL</button>
                    <button @click="showTabLimitWarning = false; openFileBrowserForTab()" class="flex-1 px-3 py-1.5 text-xs text-[var(--amber)] border border-[var(--amber)] tracking-wider hover:bg-[rgba(255,170,0,0.1)]">PROCEED_ANYWAY</button>
                </div>
            </div>
        </div>

        <!-- Session picker modal -->
        <div x-show="showSessionPickerModal" x-cloak class="fixed inset-0 z-40 flex items-center justify-center bg-black/60" @click.self="showSessionPickerModal = false">
            <div class="bg-[var(--bg2)] border-2 border-[var(--v-dim)] p-5 max-w-lg mx-4 w-full max-h-[80vh] flex flex-col">
                <div class="flex items-center justify-between mb-3">
                    <div class="text-sm text-[var(--v)] tracking-widest">RESUME_SESSION</div>
                    <button @click="showSessionPickerModal = false" class="text-[var(--v3)] hover:text-[var(--red)] text-xs">[X]</button>
                </div>
                <input x-model="sessionPickerSearch" type="text" placeholder="SEARCH_SESSIONS_"
                       class="w-full bg-[var(--bg)] border border-[var(--v-dim)] px-2 py-1.5 text-sm text-[var(--ng2)] mb-3 tracking-wider">
                <div class="flex-1 overflow-y-auto space-y-1">
                    <template x-for="s in filteredPastSessions" :key="s.session_id">
                        <button @click="resumeSession(s)"
                                class="w-full text-left px-3 py-2 bg-[var(--bg)] border border-[var(--v-dim)] hover:border-[var(--v)] transition-all">
                            <div class="text-xs text-[var(--ng2)] truncate" x-text="s.project_path"></div>
                            <div class="flex items-center gap-3 mt-0.5">
                                <span class="text-[0.5625rem] text-[var(--v3)]" x-text="s.last_active?.split('T')[0]"></span>
                                <span class="text-[0.5625rem] text-[var(--v3)]" x-text="s.message_count + ' msgs'"></span>
                                <span class="text-[0.5625rem] text-[var(--v-dim)] truncate flex-1" x-text="s.topic_preview"></span>
                            </div>
                        </button>
                    </template>
                    <div x-show="pastSessions.length === 0" class="text-center py-6 text-[0.625rem] text-[var(--v3)] tracking-widest">NO_PREVIOUS_SESSIONS_</div>
                </div>
            </div>
        </div>
    `;
})();
