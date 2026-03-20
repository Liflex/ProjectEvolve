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
                    <div class="flex items-center shrink-0 group"
                         :class="_dragTabId === tab.tab_id && 'tab-dragging'"
                         :style="_dragOverTabId === tab.tab_id && _dragTabId !== tab.tab_id ? 'border-left: 2px solid var(--v);' : ''"
                         draggable="true"
                         @dragstart="onTabDragStart(tab.tab_id, $event)"
                         @dragover.prevent="onTabDragOver(tab.tab_id, $event)"
                         @dragend="onTabDragEnd()"
                         @drop.prevent="onTabDrop(tab.tab_id)"
                         @contextmenu="showTabContextMenu(tab, $event)">
                        <button @click="activateChatTab(tab.tab_id)"
                                @dblclick.stop="startRenameTab(tab.tab_id)"
                                class="flex items-center gap-2 px-3 py-2 text-xs tracking-wider transition-colors tab-btn"
                                :class="activeChatTab === tab.tab_id ? 'text-[var(--v)] border-b-2 border-[var(--v)] -mb-[2px]' : 'text-[var(--v3)] hover:text-[var(--ng2)]'"
                                :title="tab._unread > 0 ? tab._unread + ' new message' + (tab._unread > 1 ? 's' : '') + ' — ' + tab.label : tab.label + ' (' + tab.messages.length + ' messages)'">
                            <span class="w-1.5 h-1.5 rounded-full" :class="tab.is_streaming ? 'bg-[var(--cyan)] animate-pulse' : tab._agentDone && activeChatTab !== tab.tab_id ? 'tab-dot-done' : tab._restored ? 'bg-[var(--amber)]' : tab.ws_state === 'connected' ? 'bg-[var(--ng)]' : tab.ws_state === 'connecting' ? 'bg-[var(--amber)] animate-pulse' : 'bg-[var(--v3)]'"></span>
                            <template x-if="_renamingTabId === tab.tab_id">
                                <input id="tab-rename-input"
                                       x-model="_renameText"
                                       @keydown="onRenameKeydown($event)"
                                       @blur="finishRenameTab()"
                                       @click.stop
                                       class="tab-rename-input"
                                       maxlength="30">
                            </template>
                            <template x-if="_renamingTabId !== tab.tab_id">
                                <span class="truncate max-w-[100px]" :class="tab._unread > 0 && activeChatTab !== tab.tab_id && 'tab-label-unread'" x-text="tab.label"></span>
                            </template>
                            <!-- Unread badge (shown instead of total count when unread) -->
                            <span x-show="tab._unread > 0 && activeChatTab !== tab.tab_id && _renamingTabId !== tab.tab_id" class="tab-unread-badge" x-text="tab._unread"></span>
                            <!-- Total message count (shown when no unread or tab is active) -->
                            <span x-show="(tab._unread === 0 || activeChatTab === tab.tab_id) && tab.messages.length > 0 && _renamingTabId !== tab.tab_id" class="text-[0.5rem] tabular-nums px-1 bg-[var(--v-dim)] text-[var(--v3)]" x-text="tab.messages.length"></span>
                            <!-- Branch indicator badge -->
                            <span x-show="tab._branchedFrom && _renamingTabId !== tab.tab_id" class="tab-branch-badge" :title="'Branched from ' + (tab._branchedFrom?.label || '?') + ' at #' + (tab._branchedFrom?.msgIdx ?? '?')">BRANCH</span>
                            <!-- Session config indicator -->
                            <span x-show="tab.session_config && (tab.session_config.model || tab.session_config.has_system_prompt) && _renamingTabId !== tab.tab_id"
                                  class="tab-config-badge"
                                  :title="tab.session_config.model ? 'Model: ' + tab.session_config.model + (tab.session_config.has_system_prompt ? ' + custom prompt' : '') : 'Custom system prompt'"
                                  x-text="tab.session_config.model ? tab.session_config.model.replace('claude-', '').split('-')[0].toUpperCase() : 'PROMPT'"></span>
                        </button>
                        <button @click="closeChatTab(tab.tab_id)"
                                x-show="_renamingTabId !== tab.tab_id"
                                class="text-[var(--v3)] hover:text-[var(--red)] text-xs px-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">x</button>
                        <!-- Restored indicator + reconnect button -->
                        <template x-if="tab._restored && _renamingTabId !== tab.tab_id">
                            <button @click.stop="reconnectTab(tab.tab_id)"
                                    class="tab-reconnect-btn"
                                    title="Reconnect session (resume from where you left off)">&#x21bb; RECONNECT</button>
                        </template>
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
            <button class="chat-toolbar-btn" :class="settings.showThinking && 'active'" @click="toggleSetting('showThinking')" title="Toggle thinking blocks visibility">
                <span :style="'color:' + (settings.showThinking ? 'var(--amber)' : 'inherit')">&#x1f4ad;</span> THINK
            </button>
            <div class="chat-toolbar-sep"></div>
            <!-- PANEL group dropdown -->
            <div class="relative">
                <button class="chat-toolbar-btn" :class="chatBottomPanel !== 'closed' && 'active'" @click.stop="_tbPanelOpen = !_tbPanelOpen" title="Bottom panels">
                    <span :style="'color:' + (chatBottomPanel !== 'closed' ? 'var(--v)' : 'inherit')">&#x25BC;</span> PANEL
                </button>
                <div x-show="_tbPanelOpen" x-cloak x-transition.duration.150ms
                     @click.outside="_tbPanelOpen = false"
                     class="tb-dropdown-menu">
                    <button class="tb-dropdown-item" :class="chatBottomPanel === 'rawlog' && 'active'" @click.stop="_tbPanelOpen = false; toggleBottomPanel('rawlog')">
                        <span :style="'color:' + (chatBottomPanel === 'rawlog' ? 'var(--v)' : 'var(--v3)')">&#x2328;</span> RAW LOG
                    </button>
                    <button class="tb-dropdown-item" :class="chatBottomPanel === 'summary' && 'active'" @click.stop="_tbPanelOpen = false; toggleBottomPanel('summary')">
                        <span :style="'color:' + (chatBottomPanel === 'summary' ? 'var(--cyan)' : 'var(--v3)')">&#x2699;</span> TOOLS
                    </button>
                    <button class="tb-dropdown-item" :class="chatBottomPanel === 'filepreview' && 'active'" @click.stop="_tbPanelOpen = false; chatBottomPanel === 'filepreview' ? chatBottomPanel = 'closed' : (filePreview.path ? chatBottomPanel = 'filepreview' : null)">
                        <span :style="'color:' + (chatBottomPanel === 'filepreview' ? 'var(--ng)' : 'var(--v3)')">&#x1f4c4;</span> FILE PREVIEW
                    </button>
                    <button class="tb-dropdown-item" x-show="chatBottomPanel !== 'closed'" @click.stop="_tbPanelOpen = false; chatBottomPanel = 'closed'" style="color:var(--red)">
                        [X] CLOSE
                    </button>
                </div>
            </div>
            <!-- MSG group dropdown -->
            <div class="relative">
                <button class="chat-toolbar-btn" @click.stop="_tbMsgOpen = !_tbMsgOpen" title="Message folding & turns">
                    &#x25A0; MSG
                </button>
                <div x-show="_tbMsgOpen" x-cloak x-transition.duration.150ms
                     @click.outside="_tbMsgOpen = false"
                     class="tb-dropdown-menu">
                    <button class="tb-dropdown-item" @click.stop="_tbMsgOpen = false; collapseAllMessages()">
                        <span style="color:var(--amber)">&#x25B2;</span> FOLD ALL
                    </button>
                    <button class="tb-dropdown-item" @click.stop="_tbMsgOpen = false; expandAllMessages()">
                        <span style="color:var(--cyan)">&#x25BC;</span> UNFOLD ALL
                    </button>
                    <div class="tb-dropdown-sep"></div>
                    <button class="tb-dropdown-item" @click.stop="_tbMsgOpen = false; collapsePrevTurns()">
                        &#x25B2; COLLAPSE TURNS
                    </button>
                    <button class="tb-dropdown-item" @click.stop="_tbMsgOpen = false; expandAllTurns()">
                        &#x25BC; EXPAND TURNS
                    </button>
                </div>
            </div>
            <!-- FILTER group dropdown -->
            <div class="relative">
                <button class="chat-toolbar-btn" :class="(!chatFilters.user || !chatFilters.assistant || !chatFilters.tool || !chatFilters.thinking) && 'active'" @click.stop="_tbFilterOpen = !_tbFilterOpen" title="Message type filters">
                    <span :style="'color:' + ((!chatFilters.user || !chatFilters.assistant || !chatFilters.tool || !chatFilters.thinking) ? 'var(--v)' : 'inherit')">&#x25BC;</span> FILTER
                    <span x-show="!chatFilters.user || !chatFilters.assistant || !chatFilters.tool || !chatFilters.thinking" class="tb-filter-badge">ON</span>
                </button>
                <div x-show="_tbFilterOpen" x-cloak x-transition.duration.150ms
                     @click.outside="_tbFilterOpen = false"
                     class="tb-dropdown-menu">
                    <div class="tb-dropdown-header">SHOW_MESSAGE_TYPES</div>
                    <button class="tb-dropdown-item" :class="chatFilters.user && 'active'" @click.stop="toggleChatFilter('user')">
                        <span :style="'color:' + (chatFilters.user ? 'var(--v)' : 'var(--v3)')">&#x1f464;</span> USER
                        <span class="tb-dropdown-check" x-text="chatFilters.user ? '[x]' : '[ ]'"></span>
                    </button>
                    <button class="tb-dropdown-item" :class="chatFilters.assistant && 'active'" @click.stop="toggleChatFilter('assistant')">
                        <span :style="'color:' + (chatFilters.assistant ? 'var(--cyan)' : 'var(--v3)')">&#x2b50;</span> CLAUDE
                        <span class="tb-dropdown-check" x-text="chatFilters.assistant ? '[x]' : '[ ]'"></span>
                    </button>
                    <button class="tb-dropdown-item" :class="chatFilters.tool && 'active'" @click.stop="toggleChatFilter('tool')">
                        <span :style="'color:' + (chatFilters.tool ? 'var(--pink)' : 'var(--v3)')">&#x2699;</span> TOOLS
                        <span class="tb-dropdown-check" x-text="chatFilters.tool ? '[x]' : '[ ]'"></span>
                    </button>
                    <button class="tb-dropdown-item" :class="chatFilters.thinking && 'active'" @click.stop="toggleChatFilter('thinking')">
                        <span :style="'color:' + (chatFilters.thinking ? 'var(--amber)' : 'var(--v3)')">&#x1f4ad;</span> THINKING
                        <span class="tb-dropdown-check" x-text="chatFilters.thinking ? '[x]' : '[ ]'"></span>
                    </button>
                    <div class="tb-dropdown-sep"></div>
                    <button class="tb-dropdown-item" @click.stop="chatFilters.user=true;chatFilters.assistant=true;chatFilters.tool=true;chatFilters.thinking=true" style="color:var(--ng)">
                        SHOW ALL
                    </button>
                </div>
            </div>
            <div class="chat-toolbar-sep"></div>
            <!-- PINS -->
            <div class="relative">
                <button class="chat-toolbar-btn" :class="showPinsPanel && 'active'" @click="showPinsPanel = !showPinsPanel" title="Pinned messages">
                    &#x1F4CC; PINS
                    <span x-show="pinnedMessages.length > 0" x-cloak class="pins-count-badge" x-text="pinnedMessages.length"></span>
                </button>
                <!-- Pins panel dropdown -->
                <div x-show="showPinsPanel" x-cloak x-transition.duration.150ms
                     @click.outside="showPinsPanel = false"
                     class="pins-panel">
                    <div class="pins-panel-header">
                        <span>&#x1F4CC; PINNED_MESSAGES</span>
                        <div class="flex items-center gap-1">
                            <span x-show="pinnedMessages.length > 0" class="text-[0.5rem] text-[var(--v3)]" x-text="pinnedMessages.length + '/' + 20"></span>
                            <button x-show="pinnedMessages.length > 0" @click.stop="clearAllPins()" class="text-[0.5rem] text-[var(--red)] hover:text-[var(--ng2)] tracking-wider px-1">CLEAR ALL</button>
                        </div>
                    </div>
                    <div class="pins-panel-list">
                        <template x-for="(pin, idx) in pinnedMessages" :key="idx">
                            <div class="pin-item" @click="scrollToPin(pin)">
                                <div class="pin-item-header">
                                    <span class="pin-item-tab" x-text="pin.tabLabel"></span>
                                    <span class="pin-item-time" x-text="fmtTime(pin.ts)"></span>
                                    <button @click.stop="unpinMessage(idx)" class="pin-item-unpin" title="Unpin">&#x2715;</button>
                                </div>
                                <div class="pin-item-preview" x-text="pin.preview"></div>
                            </div>
                        </template>
                        <div x-show="pinnedMessages.length === 0" class="pins-panel-empty">
                            No pinned messages yet_
                            <div class="text-[0.5rem] text-[var(--v3)] mt-1">Hover assistant message → PIN</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="chat-toolbar-sep"></div>
            <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider" x-show="activeTab" x-text="getChatFilterCount(activeTab) + '/' + (activeTab?.messages?.length || 0) + ' MSGS'"></span>
            <!-- Streaming elapsed timer + word count + speed -->
            <span x-show="activeTab && activeTab.is_streaming && activeTab._msgStartTime"
                  class="text-[0.5625rem] text-[var(--cyan)] tracking-wider tabular-nums"
                  x-text="(_clockTick, 'ELAPSED ' + getStreamingElapsed(activeTab) + ' · ' + (getStreamingWordCount(activeTab) || 0) + 'w' + (getStreamingSpeed(activeTab) ? ' · ' + getStreamingSpeed(activeTab) + ' w/s' : ''))"></span>
            <span x-show="activeTab && activeTab.is_streaming && activeTab._msgStartTime"
                  class="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] animate-pulse ml-1"></span>
            <span class="text-[0.5rem] text-[var(--v)] tracking-wider blink" x-show="_chatNavIdx >= 0" x-text="'NAV #' + (_chatNavIdx + 1) + ' [c q e f p d t n m g]'"></span>
            <div class="flex-1"></div>
            <div class="relative">
                <button class="chat-toolbar-btn" :class="showExportMenu && 'active'" @click.stop="showExportMenu = !showExportMenu" title="Export session to Markdown">&#x1f4e4; EXPORT</button>
                <div x-show="showExportMenu" x-cloak x-transition.duration.150ms
                     @click.outside="showExportMenu = false"
                     class="export-menu">
                    <div class="export-menu-header"><span>&#x1f4e4; EXPORT_SESSION</span></div>
                    <button class="export-menu-item" @click.stop="showExportMenu = false; exportChatSession('full')">
                        <span class="export-menu-icon">&#x1f4c4;</span> Full Session
                        <span class="export-menu-desc" x-text="'(' + (activeTab?.messages?.length || 0) + ' messages)'"></span>
                    </button>
                    <button class="export-menu-item" @click.stop="showExportMenu = false; exportChatSession('pinned')">
                        <span class="export-menu-icon">&#x1f4cc;</span> Pinned Only
                        <span class="export-menu-desc" x-text="'(' + pinnedMessages.filter(p => p.tabId === activeChatTab).length + ' pinned)'"></span>
                    </button>
                    <button class="export-menu-item" @click.stop="showExportMenu = false; exportChatSession('last10')">
                        <span class="export-menu-icon">&#x1f4dd;</span> Last 10 Messages
                    </button>
                </div>
            </div>
            <button class="chat-toolbar-btn" :class="showStatsPanel && 'active'" @click="showStatsPanel = !showStatsPanel" title="Session statistics">&#x1f4ca; STATS</button>
            <button class="chat-toolbar-btn" :class="_fileSearch.show && 'active'" @click="toggleFileSearch()" title="Search project files">&#x1f4c2; FILES</button>
            <button class="chat-toolbar-btn" @click="openChatSearch()" title="Search in chat (Ctrl+F)">&#x1f50d;</button>
            <div class="relative">
                <button class="chat-toolbar-btn" :class="_globalSearch.show && 'active'" @click="toggleGlobalSearch()" title="Search all sessions (Ctrl+Alt+F)">&#x1f50e; ALL</button>
                <!-- Global search panel -->
                <div x-show="_globalSearch.show" x-cloak x-transition.duration.150ms
                     @click.outside="closeGlobalSearch()"
                     class="global-search-panel">
                    <div class="global-search-header">
                        <span>&#x1f50e; GLOBAL_SEARCH</span>
                        <span class="text-[0.5rem] text-[var(--v3)]" x-text="_globalSearch.results.length + ' results'"></span>
                    </div>
                    <div class="global-search-input-wrap">
                        <input id="global-search-input"
                               x-model="_globalSearch.query"
                               @input="executeGlobalSearch()"
                               @keydown="globalSearchKeyDown($event)"
                               placeholder="Search all sessions..."
                               class="global-search-input"
                               autocomplete="off" spellcheck="false">
                        <span x-show="_globalSearch.query.length < 2" class="global-search-hint">min 2 chars</span>
                    </div>
                    <div class="global-search-results">
                        <template x-for="(result, idx) in _globalSearch.results" :key="idx">
                            <div class="global-search-item"
                                 :class="idx === _globalSearch.selectedIdx && 'selected'"
                                 @click="goToGlobalResult(result)"
                                 @mouseenter="_globalSearch.selectedIdx = idx">
                                <div class="global-search-item-header">
                                    <span class="global-search-item-tab" x-text="result.tabLabel"></span>
                                    <span class="global-search-item-role"
                                          :class="'role-' + result.role"
                                          x-text="result.role === 'user' ? 'USER' : result.role === 'assistant' ? 'CLAUDE' : 'SYSTEM'"></span>
                                    <span class="global-search-item-time" x-text="relativeTime(result.ts)"></span>
                                </div>
                                <div class="global-search-item-snippet" x-text="result.snippet"></div>
                            </div>
                        </template>
                        <div x-show="_globalSearch.query.length >= 2 && _globalSearch.results.length === 0" class="global-search-empty">
                            No matches found_
                        </div>
                        <div x-show="_globalSearch.query.length < 2 && _globalSearch.results.length === 0" class="global-search-empty">
                            Type to search across all sessions_ <span class="text-[var(--v3)]">Ctrl+Alt+F</span>
                        </div>
                    </div>
                </div>
            </div>
            <button class="chat-toolbar-btn" @click="openCmdPalette()" title="Command Palette (Ctrl+K)" style="font-size:0.5rem;letter-spacing:0.1em">CTRL+K</button>
            <button class="chat-toolbar-btn" @click="openShortcuts()" title="Keyboard Shortcuts (?)">? KEYS</button>
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

        <!-- Go to Message (Ctrl+G) -->
        <div x-show="_gotoMsg.show && activeTab" x-cloak x-transition.duration.150ms
             class="goto-msg-bar">
            <span class="goto-msg-icon">&#x1f3af;</span>
            <span class="goto-msg-label">GOTO</span>
            <input id="goto-msg-input"
                   x-model="_gotoMsg.query"
                   @keydown="gotoMsgKeyDown($event)"
                   placeholder="Message # (e.g. 42, +5, -3)"
                   class="goto-msg-input"
                   autocomplete="off" spellcheck="false">
            <span class="goto-msg-hint" x-text="activeTab ? '0-' + (activeTab.messages.length - 1) : ''"></span>
            <button @click="closeGoToMsg()" class="goto-msg-close" title="Close (Escape)">[X]</button>
        </div>

        <!-- File Search Panel -->
        <div x-show="_fileSearch.show && activeTab" x-cloak x-transition.duration.150ms
             class="file-search-panel" @click.outside="closeFileSearch()">
            <div class="file-search-header">
                <span class="file-search-icon">&#x1f4c2;</span>
                <input id="file-search-input"
                       :value="_fileSearch.query"
                       @input="onFileSearchInput(activeTab, $event)"
                       @keydown="onFileSearchKeydown(activeTab, $event)"
                       placeholder="Search project files..."
                       class="file-search-input"
                       autocomplete="off" spellcheck="false">
                <span x-show="_fileSearch.loading" class="file-search-loading">&#x23f3;</span>
                <span x-show="!_fileSearch.loading && _fileSearch.results.length > 0"
                      class="file-search-count"
                      x-text="_fileSearch.results.length + ' hits'"></span>
                <button @click="closeFileSearch()" class="file-search-close" title="Close (Escape)">[X]</button>
            </div>
            <div class="file-search-results">
                <template x-for="(r, idx) in _fileSearch.results" :key="idx">
                    <div class="file-search-item"
                         @click="insertSearchResult(activeTab, r)"
                         @contextmenu.prevent="copySearchResult(r)"
                         :title="r.file + ':' + r.line + ' — click to insert ref, right-click to copy'">
                        <div class="file-search-item-path">
                            <span class="file-search-item-lang" x-text="'[' + (r.lang || '?') + ']'"></span>
                            <span class="file-search-item-file" x-text="r.file"></span>
                            <span class="file-search-item-line" x-text="':' + r.line"></span>
                        </div>
                        <div class="file-search-item-text" x-text="r.text"></div>
                    </div>
                </template>
                <div x-show="_fileSearch.error && !_fileSearch.loading" class="file-search-empty">
                    <span x-text="_fileSearch.error"></span>
                </div>
                <div x-show="!_fileSearch.loading && !_fileSearch.error && _fileSearch.query.length < 2" class="file-search-empty">
                    Type 2+ chars to search_
                </div>
            </div>
        </div>

        <!-- Chat Tab Content -->
        <div class="flex-1 overflow-hidden relative">
            <template x-for="tab in chatTabs" :key="tab.tab_id">
                <div x-show="activeChatTab === tab.tab_id" class="absolute inset-0 flex flex-col">
                    <!-- Restored session banner -->
                    <div x-show="tab._restored" class="chat-restored-banner">
                        <span>&#x1f504; SESSION_RESTORED — messages from previous session</span>
                        <button @click="reconnectTab(tab.tab_id)" class="chat-restored-reconnect-btn">&#x21bb; RECONNECT</button>
                        <button @click="tab._restored = false" class="chat-restored-dismiss-btn" title="Dismiss">&#x2715;</button>
                    </div>
                    <!-- Messages area with minimap -->
                    <div class="flex-1 overflow-hidden relative flex flex-col" style="min-height:0">
                        <!-- Branch watermark banner -->
                        <div x-show="tab._branchedFrom" class="branch-watermark shrink-0">
                            <span>&#x2693;</span>
                            <span>Branched from <span x-text="'#' + (tab._branchedFrom?.msgIdx ?? '?')" style="color:var(--v)"></span> in <span x-text="tab._branchedFrom?.label || '?'" style="color:var(--ng2)"></span> — <span x-text="tab.messages.length + ' messages'" style="color:var(--v3)"></span></span>
                            <button @click="startBranchSession(tab.tab_id)" class="branch-start-btn" title="Create a new Claude session for this branch">START SESSION</button>
                        </div>
                        <div class="absolute inset-0 overflow-y-auto p-4 space-y-3" :id="'chat-messages-' + tab.tab_id"
                             x-html="renderChatHTML(tab)"
                             @click="onChatClick($event)"
                             @mouseup="onChatMouseUp($event)"
                             @contextmenu="onChatContextMenu(tab, $event)"
                             @scroll="onChatScroll(tab, $event)">
                        </div>
                        <!-- Text selection floating toolbar -->
                        <div x-show="_selToolbar.show && _selToolbar.tabId === tab.tab_id" x-cloak
                             x-transition.duration.100ms
                             class="sel-floating-toolbar"
                             :style="'left:' + Math.min(_selToolbar.x, 350) + 'px;top:' + Math.max(4, _selToolbar.y) + 'px'">
                            <button class="sel-tb-btn" @mousedown.prevent="selToolbarCopy()" title="Copy selection">&#x1f4cb; COPY</button>
                            <button class="sel-tb-btn" @mousedown.prevent="selToolbarQuote()" title="Quote in reply">&#x275d; QUOTE</button>
                            <button class="sel-tb-btn" @mousedown.prevent="selToolbarSearch()" title="Search in chat">&#x1f50d; FIND</button>
                            <button class="sel-tb-btn" @mousedown.prevent="selToolbarWebSearch()" title="Search on Google">&#x1f310; WEB</button>
                            <span class="sel-tb-meta" x-text="_selToolbar.text.length + 'ch'"></span>
                        </div>
                        <!-- Minimap overlay -->
                        <div class="chat-minimap" x-show="tab.messages.length > 5"
                             @click="minimapClick(tab, $event)"
                             :title="tab.messages.length + ' messages \u2014 click to navigate'">
                            <div class="minimap-content" x-html="renderMinimap(tab)"></div>
                            <div class="minimap-viewport" :style="'top:' + (tab._mmTop||0) + '%;height:' + (tab._mmHeight||100) + '%'"></div>
                        </div>
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
                                    <div class="panel-tab" :class="chatBottomPanel === 'filepreview' && 'active'" @click="chatBottomPanel = 'filepreview'">FILE PREVIEW</div>
                                    <div class="flex-1"></div>
                                    <button x-show="chatBottomPanel === 'rawlog' || chatBottomPanel === 'summary'" class="chat-toolbar-btn" @click="clearBottomPanelLog()" title="Clear log">CLEAR</button>
                                    <button x-show="chatBottomPanel === 'filepreview'" class="chat-toolbar-btn" @click="closeFilePreview()" title="Close preview">CLOSE</button>
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
                                <!-- FILE PREVIEW content -->
                                <div x-show="chatBottomPanel === 'filepreview'" class="panel-content fp-preview-panel">
                                    <!-- Loading state -->
                                    <div x-show="filePreview.loading" class="flex items-center justify-center py-4">
                                        <span class="text-[0.625rem] text-[var(--v3)] tracking-wider animate-pulse">LOADING_</span>
                                    </div>
                                    <!-- Error state -->
                                    <div x-show="filePreview.error && !filePreview.loading" class="flex items-center gap-2 py-3 px-2">
                                        <span style="color:var(--red);font-size:0.75rem">&#x26A0;</span>
                                        <span class="text-[0.625rem] text-[var(--red)] tracking-wider" x-text="filePreview.error"></span>
                                    </div>
                                    <!-- No file selected -->
                                    <div x-show="!filePreview.path && !filePreview.loading && !filePreview.error" class="text-center py-4 text-[0.625rem] text-[var(--v3)] tracking-wider">
                                        CLICK_A_FILE_PATH_IN_CHAT_TO_PREVIEW_
                                    </div>
                                    <!-- File loaded -->
                                    <template x-if="filePreview.name && !filePreview.loading && !filePreview.error">
                                        <div>
                                            <!-- File header -->
                                            <div class="fp-header">
                                                <span class="fp-filename" x-text="filePreview.name"></span>
                                                <span class="fp-meta">
                                                    <span x-text="'[' + filePreview.lang.toUpperCase() + ']'" style="color:var(--cyan)"></span>
                                                    <span x-text="' · ' + $app._fmtFileSize(filePreview.size)"></span>
                                                    <span x-text="' · ' + filePreview.totalLines + ' lines'"></span>
                                                </span>
                                            </div>
                                            <!-- Pagination -->
                                            <div x-show="filePreview.totalLines > filePreview.limit" class="fp-pagination">
                                                <button class="fp-page-btn" :disabled="filePreview.offset === 0" @click="loadFilePreviewPage(0)">&#x23EE;</button>
                                                <button class="fp-page-btn" :disabled="filePreview.offset === 0" @click="loadFilePreviewPage(Math.max(0, filePreview.offset - filePreview.limit))">&#x25C0;</button>
                                                <span class="fp-page-info" x-text="'L' + (filePreview.offset + 1) + '-' + Math.min(filePreview.offset + filePreview.limit, filePreview.totalLines) + ' / ' + filePreview.totalLines"></span>
                                                <button class="fp-page-btn" :disabled="filePreview.offset + filePreview.limit >= filePreview.totalLines" @click="loadFilePreviewPage(filePreview.offset + filePreview.limit)">&#x25B6;</button>
                                                <button class="fp-page-btn" :disabled="filePreview.offset + filePreview.limit >= filePreview.totalLines" @click="loadFilePreviewPage(filePreview.totalLines - filePreview.limit)">&#x23ED;</button>
                                            </div>
                                            <!-- Line content -->
                                            <div class="fp-lines">
                                                <template x-for="(line, idx) in filePreview.lines" :key="filePreview.offset + idx">
                                                    <div class="fp-line">
                                                        <span class="fp-ln" x-text="String(filePreview.offset + idx + 1).padStart(4, ' ')" @click="navigator.clipboard.writeText(String(filePreview.offset + idx + 1)).then(function(){$app.showToast('Line ' + (filePreview.offset + idx + 1) + ' copied')})"></span>
                                                        <pre class="fp-code" x-text="line"></pre>
                                                    </div>
                                                </template>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </template>
                    <!-- Token + Budget indicator -->
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
                        <span x-show="tab.tokens.input > tab.tokens.threshold * 0.9" class="text-[0.5625rem] text-[var(--red)] blink tracking-wider">HIGH_CTX</span>
                        <!-- Budget indicator -->
                        <template x-if="settings.costBudget > 0">
                            <span class="flex items-center gap-2">
                                <span class="budget-sep"></span>
                                <span class="text-[0.5625rem] text-[var(--v3)] tracking-wider">BUDGET</span>
                                <span class="text-[0.5625rem] tabular-nums"
                                      :class="(tab.tokens.cost / settings.costBudget) >= 1 ? 'text-[var(--red)] blink' : (tab.tokens.cost / settings.costBudget) >= 0.8 ? 'text-[var(--amber)]' : (tab.tokens.cost / settings.costBudget) >= 0.5 ? 'text-[var(--yellow)]' : 'text-[var(--ng)]'"
                                      x-text="'$' + (tab.tokens.cost||0).toFixed(2) + ' / $' + settings.costBudget.toFixed(2)"></span>
                                <div class="h-1 bg-[var(--bg2)] overflow-hidden" style="width:60px">
                                    <div class="h-full transition-all duration-300"
                                         :class="(tab.tokens.cost / settings.costBudget) >= 1 ? 'bg-[var(--red)]' : (tab.tokens.cost / settings.costBudget) >= 0.8 ? 'bg-[var(--amber)]' : 'bg-[var(--ng)]'"
                                         :style="'width:' + Math.min(100, ((tab.tokens.cost||0) / settings.costBudget) * 100) + '%'"></div>
                                </div>
                                <span class="text-[0.5625rem] tabular-nums"
                                      :class="(tab.tokens.cost / settings.costBudget) >= 1 ? 'text-[var(--red)]' : (tab.tokens.cost / settings.costBudget) >= 0.8 ? 'text-[var(--amber)]' : 'text-[var(--v3)]'"
                                      x-text="Math.round(((tab.tokens.cost||0) / settings.costBudget) * 100) + '%'"></span>
                                <button class="text-[0.5rem] text-[var(--v3)] hover:text-[var(--red)] tracking-wider px-1 border border-[var(--v-dim)] hover:border-[var(--red)] transition-all"
                                        @click="resetCost(tab.tab_id)" title="Reset cost counter">RESET</button>
                            </span>
                        </template>
                    </div>
                    <!-- Agent Activity Status Bar -->
                    <div x-show="tab._agentActivity && tab._agentActivity.type !== 'idle'" x-cloak
                         x-transition:enter="transition ease-out duration-200"
                         x-transition:enter-start="opacity-0 -translate-y-1"
                         x-transition:enter-end="opacity-100 translate-y-0"
                         x-transition:leave="transition ease-in duration-150"
                         x-transition:leave-start="opacity-100"
                         x-transition:leave-end="opacity-0"
                         class="agent-activity-bar">
                        <span class="agent-activity-icon" x-html="tab._agentActivity.icon"></span>
                        <span class="agent-activity-text" :style="'color:' + (tab._agentActivity.color || 'var(--v)')" x-text="tab._agentActivity.text"></span>
                        <span x-show="tab._agentActivity.type === 'thinking'" class="agent-activity-dots">
                            <span></span><span></span><span></span>
                        </span>
                        <span x-show="tab._agentActivity.type === 'streaming'" class="agent-activity-cursor"></span>
                        <span x-show="tab._agentActivity.toolCount > 1" class="agent-activity-toolcount"
                              x-text="tab._agentActivity.toolCount + ' tools'"></span>
                    </div>
                    <!-- Input area -->
                    <div class="border-t-2 bg-[var(--bg2)] p-3 shrink-0 relative"
                         :class="tab._editMode ? 'border-t-2 border-[var(--yellow)]' : 'border-t-2 border-[var(--v-dim)]'"
                         @dragover.prevent="chatDragOver = true"
                         @dragleave.prevent="chatDragOver = false"
                         @drop.prevent="handleChatDrop(tab, $event)">
                        <!-- Edit mode banner -->
                        <div x-show="tab._editMode" x-transition.duration.150ms
                             class="edit-mode-banner">
                            <span class="edit-mode-icon">&#x270f;</span>
                            <span class="edit-mode-label">EDITING MESSAGE</span>
                            <span class="edit-mode-hint">— subsequent messages will be discarded. ESC to cancel.</span>
                            <template x-if="editDiffStats(tab)?.changed">
                                <button @click="toggleEditDiff(tab.tab_id)" class="edit-mode-diff-toggle" :title="tab._editDiffOpen ? 'Hide diff' : 'Show diff'">
                                    &#x25BC; DIFF
                                    <span class="edit-diff-badge-del" x-text="'-' + editDiffStats(tab).removed"></span>
                                    <span class="edit-diff-badge-ins" x-text="'+' + editDiffStats(tab).added"></span>
                                </button>
                            </template>
                            <template x-if="!editDiffStats(tab)?.changed">
                                <span class="edit-diff-unchanged" title="No changes">&#x2713; UNCHANGED</span>
                            </template>
                            <button @click="cancelEditMode(tab.tab_id)" class="edit-mode-cancel" title="Cancel edit (ESC)">[X] CANCEL</button>
                        </div>
                        <!-- Edit diff preview panel -->
                        <div x-show="tab._editMode && tab._editDiffOpen && editDiffStats(tab)?.changed" x-cloak x-transition.duration.150ms
                             class="edit-diff-panel">
                            <div class="edit-diff-panel-header">
                                <span class="edit-diff-panel-title">ORIGINAL &#x2192; EDITED</span>
                                <button @click="toggleEditDiff(tab.tab_id)" class="edit-diff-panel-close" title="Close diff">[X]</button>
                            </div>
                            <div class="edit-diff-panel-body" x-html="renderEditDiff(tab)"></div>
                        </div>
                        <!-- Quote panel -->
                        <div x-show="tab._quotedMsg" x-transition.duration.150ms
                             class="quote-panel">
                            <div class="quote-panel-header">
                                <span class="quote-panel-icon">&#x275d;</span>
                                <span class="quote-panel-role" x-text="'REPLYING TO ' + (tab._quotedMsg?.role || '')"></span>
                                <button @click="clearQuote(tab.tab_id)" class="quote-panel-close" title="Cancel quote">[X]</button>
                            </div>
                            <div class="quote-panel-text" x-text="tab._quotedMsg?.text || ''"></div>
                        </div>
                        <!-- Drag & Drop overlay -->
                        <div x-show="chatDragOver" x-transition.opacity.duration.150ms
                             class="absolute inset-0 z-20 flex items-center justify-center"
                             style="background:rgba(180,74,255,0.08);border:2px dashed var(--v)">
                            <div class="text-center">
                                <div class="text-sm text-[var(--v)] tracking-widest" style="font-family:'Press Start 2P',monospace">DROP FILE</div>
                                <div class="text-[0.625rem] text-[var(--v3)] mt-2 tracking-wider">&#x0424;&#x0430;&#x0439;&#x043B; &#x0431;&#x0443;&#x0434;&#x0435;&#x0442; &#x0432;&#x0441;&#x0442;&#x0430;&#x0432;&#x043B;&#x0435;&#x043D; &#x0432; &#x043F;&#x043E;&#x043B;&#x0435; &#x0432;&#x0432;&#x043E;&#x0434;&#x0430;</div>
                            </div>
                        </div>
                        <!-- Hidden file input -->
                        <input id="chat-file-input" type="file" multiple class="hidden" @change="handleFileInput($event)">
                        <!-- Attachment preview bar -->
                        <div x-show="tab._attachments && tab._attachments.length > 0" x-cloak x-transition.duration.150ms
                             class="attachment-bar">
                            <template x-for="(att, aidx) in (tab._attachments || [])" :key="aidx">
                                <div class="attachment-item">
                                    <div class="attachment-thumb" x-show="att.type?.startsWith('image/')">
                                        <img :src="att.dataUrl" :alt="att.name" class="attachment-img">
                                    </div>
                                    <div class="attachment-info" x-show="!att.type?.startsWith('image/')">
                                        <span class="attachment-icon">&#x1f4ce;</span>
                                        <span class="attachment-name" x-text="att.name"></span>
                                        <span class="attachment-size" x-text="formatFileSize(att.size)"></span>
                                    </div>
                                    <div class="attachment-meta" x-show="att.type?.startsWith('image/')">
                                        <span class="attachment-name" x-text="att.name"></span>
                                        <span class="attachment-size" x-text="formatFileSize(att.size)"></span>
                                    </div>
                                    <button class="attachment-remove" @click.stop="removeAttachment(tab.tab_id, aidx)" title="Remove">&#x2715;</button>
                                </div>
                            </template>
                            <button class="attachment-clear-all" @click.stop="clearAttachments(tab.tab_id)" title="Remove all">&#x2715; CLEAR ALL</button>
                        </div>
                        <div class="flex gap-2 items-end">
                            <div class="flex-1 relative">
                                <!-- Quick action chips -->
                                <div x-show="_showPromptTemplates" x-transition.duration.150ms class="prompt-templates-bar">
                                    <div class="flex items-center gap-1 flex-wrap">
                                        <template x-for="tpl in promptTemplates" :key="tpl.id">
                                            <button class="prompt-chip"
                                                    :class="'prompt-chip-' + (tpl.cat || 'default')"
                                                    @mousedown.prevent="insertPromptTemplate(tab, tpl)"
                                                    :title="tpl.text.trim()">
                                                <span class="prompt-chip-cat"></span>
                                                <span x-text="tpl.label"></span>
                                            </button>
                                        </template>
                                        <button class="prompt-chip-toggle" @click.stop="_showPromptTemplates = false" title="Hide">&laquo;</button>
                                    </div>
                                </div>
                                <div x-show="!_showPromptTemplates" class="prompt-templates-hidden">
                                    <button class="prompt-chip-toggle" @click.stop="_showPromptTemplates = true" title="Quick actions">&#x2726; QUICK</button>
                                </div>
                                <!-- Markdown format toolbar -->
                                <div class="md-format-bar">
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '**', '**')" title="Bold (Ctrl+B)">B</button>
                                    <button class="md-format-btn" style="font-style:italic;font-weight:normal" @mousedown.prevent="insertMarkdown(tab, '*', '*')" title="Italic (Ctrl+I)">I</button>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '\`', '\`')" title="Inline code"><span class="fmt-icon">&lt;/&gt;</span></button>
                                    <div class="md-format-sep"></div>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '${'`' + '``\\n'}', '${'\\n' + '```'}')" title="Code block"><span class="fmt-icon">{ }</span></button>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '[', '](url)')" title="Link"><span class="fmt-icon">&#x1f517;</span></button>
                                    <div class="md-format-sep"></div>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '- ', '')" title="Unordered list"><span class="fmt-icon">&#x2022;</span></button>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '1. ', '')" title="Ordered list"><span class="fmt-icon">1.</span></button>
                                    <div class="md-format-sep"></div>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '> ', '')" title="Blockquote"><span class="fmt-icon">&gt;</span></button>
                                    <button class="md-format-btn" @mousedown.prevent="insertMarkdown(tab, '---\n', '')" title="Horizontal rule"><span class="fmt-icon">&#x2500;</span></button>
                                </div>
                                <textarea x-model="tab.input_text"
                                          @keydown="handleChatKeydown(tab, $event)"
                                          @input="handleChatInput(tab, $event); autoResizeTextarea($event)"
                                          @focus="chatNavClear()"
                                          @paste="handleChatPaste(tab, $event)"
                                          placeholder="Message_ (/ commands, @ file mention, paste images, drag files, Ctrl+Shift+F search files)"
                                          rows="1"
                                          class="chat-input-area w-full bg-[var(--bg)] border px-3 py-2 text-sm text-[var(--ng2)] tracking-wider resize-none editor"
                                          :class="tab._editMode ? 'border-[var(--yellow)]' : 'border-[var(--v-dim)]'"
                                          style="min-height:2.25rem;max-height:200px;overflow-y:hidden"
                                          :disabled="tab.is_streaming"></textarea>
                                <div class="flex items-center justify-between px-1 mt-0.5">
                                    <span class="chat-input-hint text-[0.5rem] text-[var(--v3)] tracking-wider"
                                          x-text="tab._editMode ? 'ENTER — send edited | ESC — cancel'
                                               : tab._msgHistoryIdx >= 0 ? 'HISTORY ' + (tab._msgHistoryIdx + 1) + '/' + tab._msgHistory.length + ' — UP/DOWN navigate | ESC — exit | ENTER — send'
                                               : 'ENTER — send | SHIFT+ENTER — newline | UP/DOWN — history | ALT+UP/DOWN — turns | CTRL+SHIFT+B/I/K/C — format'"></span>
                                    <span class="text-[0.5rem] text-[var(--v3)] tabular-nums" x-show="(tab.input_text || '').length > 0" x-text="(tab.input_text || '').length + 'ch · ' + (tab.input_text || '').trim().split(/\s+/).filter(Boolean).length + 'w'"></span>
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
                                <!-- @-mention file autocomplete -->
                                <div x-show="mentionMenu.show && mentionMenu._tabId === tab.tab_id && mentionMenu.items.length > 0"
                                     x-transition.opacity.duration.100ms
                                     class="mention-menu absolute bottom-full left-0 mb-1 z-10"
                                     style="width:420px;max-height:280px;overflow-y:auto">
                                    <div class="mention-menu-header">
                                        <span style="font-size:0.4375rem;letter-spacing:0.2em;color:var(--cyan)">FILE_MENTION</span>
                                        <span style="font-size:0.4375rem;color:var(--v3)">— TAB/ENTER select · ESC close</span>
                                    </div>
                                    <template x-for="(item, idx) in mentionMenu.items" :key="item.file + ':' + item.line">
                                        <div class="mention-menu-item"
                                             :class="idx === mentionMenu.selected && 'selected'"
                                             @mousedown.prevent="selectFileMention(item)">
                                            <span class="mention-file-icon">&#x1f4c4;</span>
                                            <span class="mention-file-path" x-text="item.file"></span>
                                            <span class="mention-file-line" x-text="':' + item.line"></span>
                                            <span class="mention-file-snippet" x-text="item.snippet ? item.snippet.slice(0, 50) : ''"></span>
                                        </div>
                                    </template>
                                </div>
                            </div>
                            <button @click="sendChatMessage(tab)" :disabled="tab.is_streaming"
                                    class="px-4 py-2 border border-[var(--v)] text-[var(--v)] text-xs tracking-wider hover:bg-[rgba(180,74,255,0.1)] disabled:opacity-30 transition-all shrink-0 relative"
                                    :title="tab._pendingFeedback?.length ? tab._pendingFeedback.length + ' reaction(s) queued — will be sent with next message' : 'Send message'">
                                [> SEND]
                                <span x-show="tab._pendingFeedback?.length > 0"
                                      x-text="tab._pendingFeedback.length"
                                      class="absolute -top-1.5 -right-1.5 bg-[var(--v)] text-[var(--bg)] rounded-full w-4 h-4 flex items-center justify-center text-[0.6rem] font-bold leading-none"></span>
                            </button>
                            <button @click="triggerFileAttach(tab)" :disabled="tab.is_streaming"
                                    class="px-2 py-2 border border-[var(--v-dim)] text-[var(--v3)] text-xs hover:text-[var(--v)] hover:border-[var(--v2)] disabled:opacity-30 transition-all shrink-0" title="Attach file (or paste / drop)">
                                &#x1f4ce;
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
                    <div class="chat-empty-shortcuts">
                        <div class="text-[0.5rem] text-[var(--v3)] tracking-widest mt-6 mb-3">KEYBOARD_SHORTCUTS</div>
                        <div class="chat-shortcut-row"><kbd>Ctrl+K</kbd><span>Command Palette</span></div>
                        <div class="chat-shortcut-row"><kbd>Ctrl+F</kbd><span>Search in chat</span></div>
                        <div class="chat-shortcut-row"><kbd>/</kbd><span>Skill autocomplete</span></div>
                        <div class="chat-shortcut-row"><kbd>Up/Down</kbd><span>Message history</span></div>
                        <div class="chat-shortcut-row"><kbd>Alt+Up/Down</kbd><span>Jump between turns</span></div>
                        <div class="chat-shortcut-row"><kbd>Shift+Enter</kbd><span>New line</span></div>
                        <div class="chat-shortcut-row"><kbd>ESC</kbd><span>Cancel edit / exit history</span></div>
                    </div>
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
                <span class="status-separator"></span>
                <span style="color:var(--v3)" x-text="(_clockTick, getSessionDuration(activeTab))"></span>
            </div>
            <div class="status-right">
                <span class="agent-state"
                      :class="activeTab?.is_streaming ? (activeTab?.is_thinking ? 'thinking' : 'streaming') : ''"
                      x-text="activeTab?.is_streaming ? (activeTab?.is_thinking ? 'THINKING...' : 'STREAMING...') : 'IDLE'"></span>
                <span class="status-separator"></span>
                <span x-text="getChatFilterCount(activeTab) + '/' + (activeTab?.messages?.length || 0) + ' MSGS'"></span>
                <template x-if="activeTab?.session_config?.model">
                    <span>
                        <span class="status-separator"></span>
                        <span style="color:var(--cyan)" x-text="activeTab.session_config.model.replace('claude-', '').split('-')[0].toUpperCase()"></span>
                    </span>
                </template>
                <template x-if="activeTab?.session_config?.has_system_prompt">
                    <span>
                        <span class="status-separator"></span>
                        <span style="color:var(--amber)" x-text="'PROMPT+'"></span>
                    </span>
                </template>
                <template x-if="getTotalTurns(activeTab) > 1">
                    <span>
                        <span class="status-separator"></span>
                        <span style="color:var(--v3)" x-text="'TURN ' + getTotalTurns(activeTab)"></span>
                    </span>
                </template>
                <template x-if="getToolCount(activeTab) > 0">
                    <span>
                        <span class="status-separator"></span>
                        <span style="color:var(--pink)" x-text="getToolCount(activeTab) + ' TOOLS'"></span>
                    </span>
                </template>
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
                <!-- Activity sparkline: token output per response -->
                <span x-show="activeTab && renderActivitySparkline(activeTab)" x-cloak>
                    <span class="status-separator"></span>
                    <span x-html="renderActivitySparkline(activeTab)"></span>
                </span>
            </div>
        </div>

        <!-- Session Stats Panel -->
        <div x-show="showStatsPanel && activeTab" x-cloak x-transition.duration.150ms
             @click.outside="showStatsPanel = false"
             class="stats-panel">
            <div class="stats-panel-header">
                <span>&#x1f4ca; <span x-text="statsView === 'all' ? 'ALL_SESSIONS' : 'SESSION_STATS'"></span></span>
                <div class="stats-view-toggle">
                    <button class="stats-view-btn" :class="statsView === 'session' && 'active'" @click="statsView = 'session'" title="This session only">THIS</button>
                    <button class="stats-view-btn" :class="statsView === 'all' && 'active'" @click="statsView = 'all'" title="All sessions combined">ALL</button>
                </div>
                <button @click="showStatsPanel = false" class="stats-panel-close" title="Close">[X]</button>
            </div>

            <!-- ALL SESSIONS VIEW -->
            <div class="stats-panel-body" x-show="statsView === 'all' && getAllSessionsStats()">
                <template x-if="statsView === 'all' && getAllSessionsStats()">
                    <div>
                        <!-- Aggregate overview -->
                        <div class="stats-row">
                            <div class="stats-card">
                                <div class="stats-card-label">SESSIONS</div>
                                <div class="stats-card-value" x-text="getAllSessionsStats().totalSessions"></div>
                            </div>
                            <div class="stats-card">
                                <div class="stats-card-label">MESSAGES</div>
                                <div class="stats-card-value" x-text="getAllSessionsStats().totalMessages"></div>
                            </div>
                            <div class="stats-card">
                                <div class="stats-card-label">TOOLS</div>
                                <div class="stats-card-value" style="color:var(--pink)" x-text="getAllSessionsStats().totalTools"></div>
                            </div>
                            <div class="stats-card">
                                <div class="stats-card-label">TOTAL COST</div>
                                <div class="stats-card-value stats-card-value-sm" style="color:var(--yellow)" x-text="'$' + getAllSessionsStats().totalCost.toFixed(4)"></div>
                            </div>
                        </div>
                        <!-- Aggregate tokens -->
                        <div class="stats-section">
                            <div class="stats-section-title">AGGREGATE_TOKENS</div>
                            <div class="stats-tokens-row">
                                <span class="stats-token-label">INPUT</span>
                                <span class="stats-token-value" style="color:var(--cyan)" x-text="(getAllSessionsStats().totalInputTokens / 1000).toFixed(1) + 'K'"></span>
                                <span class="stats-token-label">OUTPUT</span>
                                <span class="stats-token-value" style="color:var(--ng2)" x-text="(getAllSessionsStats().totalOutputTokens / 1000).toFixed(1) + 'K'"></span>
                                <span class="stats-token-label">TURNS</span>
                                <span class="stats-token-value" style="color:var(--v)" x-text="getAllSessionsStats().totalTurns"></span>
                            </div>
                        </div>
                        <!-- Per-session cards -->
                        <div class="stats-section">
                            <div class="stats-section-title">SESSION_BREAKDOWN</div>
                            <div class="dashboard-session-list">
                                <template x-for="(sess, idx) in getAllSessionsStats().sessions" :key="sess.tabId">
                                    <div class="dashboard-session-card" :class="sess.active && 'dashboard-session-active'" @click="activateChatTab(sess.tabId); statsView = 'session'">
                                        <div class="dsc-header">
                                            <span class="dsc-dot" :class="sess.active ? 'dsc-dot-active' : 'dsc-dot-idle'"></span>
                                            <span class="dsc-label" x-text="sess.label"></span>
                                            <span x-show="sess.active" class="dsc-badge-streaming">STREAMING</span>
                                            <span class="dsc-rank" x-text="'#' + (idx + 1)"></span>
                                        </div>
                                        <div class="dsc-metrics">
                                            <span class="dsc-metric" title="Messages">&#x1f4ac; <span x-text="sess.messages"></span></span>
                                            <span class="dsc-metric" title="Turns">&#x21a9; <span x-text="sess.turns"></span></span>
                                            <span class="dsc-metric" title="Tools">&#x2328; <span x-text="sess.tools"></span></span>
                                            <span class="dsc-metric" title="Duration">&#x23f1; <span x-text="sess.duration"></span></span>
                                        </div>
                                        <div class="dsc-cost-bar">
                                            <span class="dsc-cost-label" x-text="'$' + sess.cost.toFixed(4)"></span>
                                            <div class="dsc-cost-track">
                                                <div class="dsc-cost-fill" :style="'width:' + (getAllSessionsStats().totalCost > 0 ? Math.max(2, (sess.cost / getAllSessionsStats().totalCost) * 100) : 0) + '%'"></div>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                        <!-- Activity feed -->
                        <div class="stats-section">
                            <div class="stats-section-title">RECENT_ACTIVITY</div>
                            <div class="dashboard-activity-feed">
                                <template x-for="(evt, idx) in getActivityFeed(25)" :key="idx">
                                    <div class="dash-activity-item" :class="evt.isError && 'dash-activity-error'">
                                        <span class="dai-icon" x-text="evt.role === 'user' ? '&#x1f464;' : evt.isError ? '&#x26a0;' : '&#x2b50;'"></span>
                                        <span class="dai-tab" x-text="evt.tabLabel" :style="'color:' + (evt.tabId === activeChatTab ? 'var(--v)' : 'var(--v3)')"></span>
                                        <span class="dai-content" x-text="evt.content"></span>
                                        <span class="dai-meta">
                                            <span x-show="evt.duration > 0" x-text="fmtDuration(evt.duration)"></span>
                                            <span x-show="evt.cost > 0" style="color:var(--yellow)" x-text="'$' + evt.cost.toFixed(4)"></span>
                                        </span>
                                        <span class="dai-time" x-text="fmtTime(evt.ts)"></span>
                                    </div>
                                </template>
                                <div x-show="getActivityFeed(25).length === 0" class="text-center py-3 text-[0.625rem] text-[var(--v3)] tracking-wider">NO_ACTIVITY_YET_</div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- THIS SESSION VIEW (original stats) -->
            <div class="stats-panel-body" x-show="statsView === 'session'">
                <div x-show="!getSessionStats(activeTab)" class="stats-panel-empty">
                    NO_DATA_YET_ — Send a message to start tracking_
                </div>
                <template x-if="statsView === 'session' && getSessionStats(activeTab)">
                    <div>
                        <!-- Overview row -->
                        <div class="stats-row">
                            <div class="stats-card">
                                <div class="stats-card-label">TURNS</div>
                                <div class="stats-card-value" x-text="getSessionStats(activeTab).turns"></div>
                            </div>
                            <div class="stats-card">
                                <div class="stats-card-label">MESSAGES</div>
                                <div class="stats-card-value" x-text="getSessionStats(activeTab).total"></div>
                            </div>
                            <div class="stats-card">
                                <div class="stats-card-label">TOOLS</div>
                                <div class="stats-card-value" style="color:var(--pink)" x-text="getSessionStats(activeTab).toolCount"></div>
                            </div>
                            <div class="stats-card">
                                <div class="stats-card-label">DURATION</div>
                                <div class="stats-card-value stats-card-value-sm" x-text="getSessionStats(activeTab).duration"></div>
                            </div>
                        </div>
                        <!-- Message breakdown -->
                        <div class="stats-section">
                            <div class="stats-section-title">MESSAGE_BREAKDOWN</div>
                            <div class="stats-bar-row">
                                <span class="stats-bar-label">USER</span>
                                <div class="stats-bar-track">
                                    <div class="stats-bar-fill" style="background:var(--v)" :style="'width:' + Math.round((getSessionStats(activeTab).userCount / getSessionStats(activeTab).total) * 100) + '%'"></div>
                                </div>
                                <span class="stats-bar-count" x-text="getSessionStats(activeTab).userCount"></span>
                            </div>
                            <div class="stats-bar-row">
                                <span class="stats-bar-label">ASSISTANT</span>
                                <div class="stats-bar-track">
                                    <div class="stats-bar-fill" style="background:var(--cyan)" :style="'width:' + Math.round((getSessionStats(activeTab).asstCount / getSessionStats(activeTab).total) * 100) + '%'"></div>
                                </div>
                                <span class="stats-bar-count" x-text="getSessionStats(activeTab).asstCount"></span>
                            </div>
                            <div class="stats-bar-row">
                                <span class="stats-bar-label">TOOL</span>
                                <div class="stats-bar-track">
                                    <div class="stats-bar-fill" style="background:var(--pink)" :style="'width:' + Math.round((getSessionStats(activeTab).toolCount / getSessionStats(activeTab).total) * 100) + '%'"></div>
                                </div>
                                <span class="stats-bar-count" x-text="getSessionStats(activeTab).toolCount"></span>
                            </div>
                        </div>
                        <!-- Tool usage breakdown -->
                        <div class="stats-section" x-show="getSessionStats(activeTab).toolEntries.length > 0">
                            <div class="stats-section-title">TOOL_USAGE</div>
                            <template x-for="(tool, idx) in getSessionStats(activeTab).toolEntries" :key="idx">
                                <div class="stats-bar-row">
                                    <span class="stats-bar-label" :style="'color:' + tool.color" x-text="tool.label"></span>
                                    <div class="stats-bar-track">
                                        <div class="stats-bar-fill" :style="'background:' + tool.color + ';width:' + tool.pct + '%'"></div>
                                    </div>
                                    <span class="stats-bar-count" x-text="'x' + tool.count"></span>
                                </div>
                            </template>
                        </div>
                        <!-- Tokens & Cost -->
                        <div class="stats-section">
                            <div class="stats-section-title">TOKENS_&_COST</div>
                            <div class="stats-tokens-row">
                                <span class="stats-token-label">INPUT</span>
                                <span class="stats-token-value" :style="'color:' + (getSessionStats(activeTab).tokens.input > getSessionStats(activeTab).tokens.threshold * 0.8 ? 'var(--amber)' : 'var(--cyan)')"
                                      x-text="(getSessionStats(activeTab).tokens.input / 1000).toFixed(1) + 'K'"></span>
                                <span class="stats-token-label">OUTPUT</span>
                                <span class="stats-token-value" style="color:var(--ng2)" x-text="(getSessionStats(activeTab).tokens.output / 1000).toFixed(1) + 'K'"></span>
                                <span class="stats-token-label">COST</span>
                                <span class="stats-token-value" style="color:var(--yellow)" x-text="'$' + getSessionStats(activeTab).tokens.cost.toFixed(4)"></span>
                            </div>
                            <!-- Context window bar -->
                            <div class="stats-ctx-bar">
                                <div class="stats-ctx-track">
                                    <div class="stats-ctx-fill" :style="'width:' + Math.min(100, (getSessionStats(activeTab).tokens.input / getSessionStats(activeTab).tokens.threshold) * 100) + '%;' +
                                        'background:' + (getSessionStats(activeTab).tokens.input > getSessionStats(activeTab).tokens.threshold * 0.9 ? 'var(--red)' : getSessionStats(activeTab).tokens.input > getSessionStats(activeTab).tokens.threshold * 0.7 ? 'var(--amber)' : 'var(--cyan)')"></div>
                                </div>
                                <span class="stats-ctx-label" x-text="'CTX ' + Math.round((getSessionStats(activeTab).tokens.input / getSessionStats(activeTab).tokens.threshold) * 100) + '%'"></span>
                            </div>
                        </div>
                        <!-- Response times -->
                        <div class="stats-section" x-show="getSessionStats(activeTab).responseTimes > 0">
                            <div class="stats-section-title">RESPONSE_TIMES</div>
                            <div class="stats-timing-grid">
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">AVG</span>
                                    <span class="stats-timing-value" x-text="fmtDuration(Math.round(getSessionStats(activeTab).avgResponse))"></span>
                                </div>
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">MIN</span>
                                    <span class="stats-timing-value" style="color:var(--ng)" x-text="fmtDuration(Math.round(getSessionStats(activeTab).minResponse))"></span>
                                </div>
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">MAX</span>
                                    <span class="stats-timing-value" style="color:var(--red)" x-text="fmtDuration(Math.round(getSessionStats(activeTab).maxResponse))"></span>
                                </div>
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">SAMPLES</span>
                                    <span class="stats-timing-value" x-text="getSessionStats(activeTab).responseTimes"></span>
                                </div>
                            </div>
                            <!-- Response time sparkline -->
                            <div x-show="getSessionStats(activeTab).recentTurns.length >= 2" class="stats-sparkline-wrap">
                                <span class="stats-sparkline-label">LATENCY_TREND</span>
                                <span class="stats-sparkline-hint" x-text="'last ' + getSessionStats(activeTab).recentTurns.length + ' of ' + getSessionStats(activeTab).totalTurns + ' turns'"></span>
                                <div x-html="renderResponseSparkline(getSessionStats(activeTab).recentTurns, 260, 32)"></div>
                            </div>
                        </div>
                        <!-- Token per-turn visualization -->
                        <div class="stats-section" x-show="getSessionStats(activeTab).recentTurns.length > 0">
                            <div class="stats-section-title">TOKEN_PER_TURN</div>
                            <div x-html="renderTokenMiniBars(getSessionStats(activeTab).recentTurns)"></div>
                            <div class="token-mini-legend">
                                <span class="token-mini-legend-item"><span class="token-mini-legend-dot" style="background:var(--cyan)"></span>INPUT</span>
                                <span class="token-mini-legend-item"><span class="token-mini-legend-dot" style="background:var(--ng2)"></span>OUTPUT</span>
                            </div>
                        </div>
                        <!-- Cost trend sparkline -->
                        <div class="stats-section" x-show="getSessionStats(activeTab).recentTurns.length >= 2 && getSessionStats(activeTab).tokens.cost > 0">
                            <div class="stats-section-title">COST_TREND</div>
                            <div class="stats-sparkline-wrap">
                                <span class="stats-sparkline-label">CUMULATIVE_COST</span>
                                <span class="stats-sparkline-hint" x-text="'$' + getSessionStats(activeTab).tokens.cost.toFixed(4) + ' total'"></span>
                                <div x-html="renderCostSparkline(getSessionStats(activeTab).recentTurns, 260, 32)"></div>
                            </div>
                        </div>
                        <!-- Footer stats -->
                        <div class="stats-footer">
                            <span x-show="getSessionStats(activeTab).errorCount > 0" style="color:var(--red)">
                                &#x26a0; <span x-text="getSessionStats(activeTab).errorCount + ' ERRORS'"></span>
                            </span>
                            <span x-show="getSessionStats(activeTab).pinnedCount > 0" style="color:var(--amber)">
                                &#x1f4cc; <span x-text="getSessionStats(activeTab).pinnedCount + ' PINNED'"></span>
                            </span>
                            <span x-show="getSessionStats(activeTab).upCount > 0 || getSessionStats(activeTab).downCount > 0">
                                <span x-show="getSessionStats(activeTab).upCount > 0" style="color:var(--ng)">&#x1f44d;<span x-text="getSessionStats(activeTab).upCount"></span></span>
                                <span x-show="getSessionStats(activeTab).downCount > 0" style="color:var(--red);margin-left:4px">&#x1f44e;<span x-text="getSessionStats(activeTab).downCount"></span></span>
                            </span>
                        </div>
                        <!-- Message length & session info -->
                        <div class="stats-section">
                            <div class="stats-section-title">CONTENT_METRICS</div>
                            <div class="stats-timing-grid">
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">AVG USER</span>
                                    <span class="stats-timing-value" style="color:var(--v)" x-text="getSessionStats(activeTab).avgUserLen + 'ch'"></span>
                                </div>
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">AVG CLAUDE</span>
                                    <span class="stats-timing-value" style="color:var(--cyan)" x-text="getSessionStats(activeTab).avgAsstLen + 'ch'"></span>
                                </div>
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">SESSION START</span>
                                    <span class="stats-timing-value" style="color:var(--v3)" x-text="getSessionStats(activeTab).sessionStartStr"></span>
                                </div>
                                <div class="stats-timing-item">
                                    <span class="stats-timing-label">THROUGHPUT</span>
                                    <span class="stats-timing-value" x-text="getThroughput(activeTab)"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- Context Menu (right-click on messages) -->
        <div x-show="ctxMenu.show" x-cloak
             class="ctx-menu"
             :style="'left:' + ctxMenu.x + 'px;top:' + ctxMenu.y + 'px'"
             @click.stop>
            <template x-for="(item, idx) in ctxMenu.items" :key="idx">
                <template x-if="item.sep">
                    <div class="ctx-menu-sep"></div>
                </template>
                <template x-if="!item.sep">
                    <div class="ctx-menu-item"
                         :class="item.danger && 'ctx-menu-danger'"
                         @click="executeContextAction(item)">
                        <span class="ctx-menu-icon" x-html="item.icon || ''"></span>
                        <span x-text="item.label"></span>
                    </div>
                </template>
            </template>
        </div>

        <!-- Keyboard Shortcuts Panel -->
        <div x-show="showShortcuts" x-cloak x-transition.duration.150ms
             class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
             @click.self="closeShortcuts()"
             @keydown.escape.window="closeShortcuts()">
            <div class="shortcuts-panel">
                <div class="shortcuts-panel-header">
                    <span class="shortcuts-panel-title">&#x2328; KEYBOARD_SHORTCUTS</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[0.5rem] text-[var(--v3)] tracking-wider">press ? to toggle</span>
                        <button @click="closeShortcuts()" class="shortcuts-panel-close" title="Close (ESC)">[X]</button>
                    </div>
                </div>
                <div class="shortcuts-panel-search">
                    <span class="shortcuts-search-icon">&#x1f50d;</span>
                    <input id="shortcuts-filter-input"
                           x-model="shortcutsFilter"
                           placeholder="Filter shortcuts..."
                           class="shortcuts-search-input"
                           autocomplete="off" spellcheck="false">
                </div>
                <div class="shortcuts-panel-body">
                    <template x-for="cat in filteredShortcuts" :key="cat.category">
                        <div class="shortcuts-category">
                            <div class="shortcuts-category-title" x-text="cat.category"></div>
                            <template x-for="item in cat.items" :key="item.keys">
                                <div class="shortcuts-item">
                                    <kbd class="shortcuts-key" x-text="item.keys"></kbd>
                                    <span class="shortcuts-desc" x-text="item.desc"></span>
                                </div>
                            </template>
                        </div>
                    </template>
                    <div x-show="filteredShortcuts.length === 0" class="shortcuts-empty">
                        No shortcuts match your filter_
                    </div>
                </div>
                <div class="shortcuts-panel-footer">
                    <span class="text-[0.5rem] text-[var(--v3)]">Shortcuts work when input is not focused_</span>
                    <span class="text-[0.5rem] text-[var(--v3)]">Ctrl+K for Command Palette</span>
                </div>
            </div>
        </div>

        <!-- Image Lightbox -->
        <div x-show="lightbox.show" x-cloak
             class="lightbox-overlay"
             @click.self="closeLightbox()"
             @keydown.escape.window="closeLightbox()">
            <div class="lightbox-container">
                <div class="lightbox-header">
                    <span class="lightbox-alt" x-text="lightbox.alt"></span>
                    <button class="lightbox-close" @click="closeLightbox()" title="Close (ESC)">[X]</button>
                </div>
                <div class="lightbox-body">
                    <img :src="lightbox.src" :alt="lightbox.alt" class="lightbox-img">
                </div>
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

        <!-- Tab Context Menu (right-click on tab) -->
        <div x-show="tabCtxMenu.show" x-cloak x-transition.duration.100ms
             class="ctx-menu"
             :style="'left:' + tabCtxMenu.x + 'px;top:' + tabCtxMenu.y + 'px'"
             @click.stop
             @click.outside="tabCtxMenu.show = false">
            <div class="ctx-menu-item" @click="tabCtxAction('rename')">
                <span class="ctx-menu-icon">&#x270f;</span>
                <span>RENAME</span>
                <span class="ctx-menu-shortcut">DBL-CLICK</span>
            </div>
            <div class="ctx-menu-item ctx-menu-hint" style="pointer-events:none">
                <span style="font-size:0.4375rem;color:var(--v3)">DRAG TAB TO REORDER</span>
            </div>
            <div class="ctx-menu-sep"></div>
            <div class="ctx-menu-item" x-show="chatTabs.length > 1" @click="tabCtxAction('move-left')">
                <span class="ctx-menu-icon">&#x25C0;</span>
                <span>MOVE LEFT</span>
            </div>
            <div class="ctx-menu-item" x-show="chatTabs.length > 1" @click="tabCtxAction('move-right')">
                <span class="ctx-menu-icon">&#x25B6;</span>
                <span>MOVE RIGHT</span>
            </div>
            <div class="ctx-menu-sep"></div>
            <div class="ctx-menu-item" @click="tabCtxAction('close')">
                <span class="ctx-menu-icon">&#x2715;</span>
                <span>CLOSE TAB</span>
            </div>
            <div class="ctx-menu-item" x-show="chatTabs.length > 1" @click="tabCtxAction('close-others')">
                <span class="ctx-menu-icon">&#x2261;</span>
                <span>CLOSE OTHERS</span>
            </div>
            <div class="ctx-menu-item ctx-menu-danger" x-show="chatTabs.length > 0" @click="tabCtxAction('close-all')">
                <span class="ctx-menu-icon">&#x2715;</span>
                <span>CLOSE ALL</span>
            </div>
        </div>
    `;
})();
