// === AppChat — Chat sessions, WebSocket, messages, slash commands, search, render, bottom panel ===
// Loaded before app.js, spread into Alpine data object
window.AppChat = (function() {
    return {
        // ========== CHAT: SESSIONS ==========
        async openFileBrowserForTab() {
            if (this.chatTabs.length >= 5) { this.showTabLimitWarning = true; return; }
            this.newSessionPath = '.';
            this.showNewSessionModal = true;
            this.$nextTick(() => {
                const input = this.$refs.newSessionInput;
                if (input) { input.focus(); input.select(); }
            });
        },

        async createSessionFromModal() {
            const path = (this.newSessionPath || '.').trim();
            if (!path) return;
            this.showNewSessionModal = false;
            await this.createChatTab(path);
        },

        async createChatTab(projectPath, resumeId) {
            console.log('[chat] createChatTab:', projectPath, 'resume:', resumeId);
            try {
                const res = await this.api('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cwd: projectPath, resume: resumeId || null }),
                });
                console.log('[chat] session created:', JSON.stringify(res));
                if (res.warning) this.showToast(res.warning, 'error');
                if (!res.session_id) { console.error('[chat] no session_id in response'); return; }
                const label = projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath;
                const tab = {
                    tab_id: 'tab-' + Date.now(),
                    session_id: res.session_id,
                    project_path: projectPath,
                    label: label,
                    messages: [],
                    is_active: true,
                    is_streaming: false,
                    is_thinking: false,
                    ws_state: 'connecting',
                    input_text: '',
                    scrolledUp: false,
                    created_at: new Date().toISOString(),
                    tokens: { input: 0, output: 0, cost: 0, threshold: 180000 },
                    _msgHistory: [],
                    _msgHistoryIdx: -1,
                    _msgDraft: '',
                    _attachments: [],
                    _pendingFeedback: [],  // queued reaction feedback: [{msgIdx, reaction, snippet}]
                    _unread: 0,
                    _agentDone: false,
                };
                this.chatTabs.push(tab);
                this.activeChatTab = tab.tab_id;
                this._setupScrollPreservation(tab);
                this.connectChatWebSocket(tab);
                this._scheduleChatSave();
                this.showToast('SESSION STARTED', 'success');
            } catch (e) {
                console.error('[chat] createChatTab failed:', e);
                this.showToast('SESSION FAILED: ' + e.message, 'error');
            }
        },

        activateChatTab(tabId) {
            this.activeChatTab = tabId;
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (tab) {
                this.page = '';
                tab._unread = 0;
                tab._agentDone = false;
                this._updateDocTitle();
            }
            if (window.refitTerminal) refitTerminal(tabId);
            this.resizeInputForTab(tab);
            // Clear keyboard navigation focus when switching tabs
            this.chatNavClear();
        },

        async closeChatTab(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab) return;
            const ws = this.chatWs[tabId];
            if (ws) { try { ws.close(); } catch (e) { } delete this.chatWs[tabId]; }
            if (window.destroyTerminal) destroyTerminal(tabId);
            try { await this.api('/api/sessions/' + tab.session_id, { method: 'DELETE' }); } catch (e) { }
            this.chatTabs = this.chatTabs.filter(t => t.tab_id !== tabId);
            this._scheduleChatSave();
            if (this.activeChatTab === tabId) {
                this.activeChatTab = this.chatTabs.length > 0 ? this.chatTabs[this.chatTabs.length - 1].tab_id : null;
            }
        },

        // ========== CHAT: TAB RENAME ==========
        startRenameTab(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab) return;
            this._renamingTabId = tabId;
            this._renameText = tab.label;
            this.$nextTick(() => {
                const input = document.getElementById('tab-rename-input');
                if (input) { input.focus(); input.select(); }
            });
        },
        finishRenameTab() {
            if (!this._renamingTabId) return;
            const tab = this.chatTabs.find(t => t.tab_id === this._renamingTabId);
            if (tab && this._renameText.trim()) {
                tab.label = this._renameText.trim().slice(0, 30);
            }
            this._renamingTabId = null;
            this._renameText = '';
        },
        cancelRenameTab() {
            this._renamingTabId = null;
            this._renameText = '';
        },
        onRenameKeydown(e) {
            if (e.key === 'Enter') { e.preventDefault(); this.finishRenameTab(); }
            else if (e.key === 'Escape') { e.preventDefault(); this.cancelRenameTab(); }
            e.stopPropagation();
        },

        // ========== CHAT: TAB CONTEXT MENU ==========
        showTabContextMenu(tab, e) {
            e.preventDefault();
            e.stopPropagation();
            this.tabCtxMenu = { show: true, tabId: tab.tab_id, x: e.clientX, y: e.clientY };
        },
        tabCtxAction(action) {
            const tabId = this.tabCtxMenu.tabId;
            this.tabCtxMenu.show = false;
            if (!tabId) return;
            if (action === 'rename') { this.startRenameTab(tabId); }
            else if (action === 'close') { this.closeChatTab(tabId); }
            else if (action === 'close-others') {
                const others = this.chatTabs.filter(t => t.tab_id !== tabId);
                for (const t of others) { this.closeChatTab(t.tab_id); }
            }
            else if (action === 'close-all') {
                const all = [...this.chatTabs];
                for (const t of all) { this.closeChatTab(t.tab_id); }
            }
        },

        // ========== CHAT: WEBSOCKET ==========
        _incrementUnread(tab) {
            if (this.activeChatTab !== tab.tab_id) {
                tab._unread = (tab._unread || 0) + 1;
                this._updateDocTitle();
            }
        },
        _updateDocTitle() {
            const total = this.chatTabs.reduce((sum, t) => sum + (t._unread || 0), 0);
            const base = 'AutoResearch';
            document.title = total > 0 ? '(' + total + ') ' + base : base;
        },
        connectChatWebSocket(tab) {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const url = `${protocol}//${location.host}/ws/chat/${tab.session_id}`;
            console.log('[ws] connecting to:', url);
            const ws = new WebSocket(url);
            this.chatWs[tab.tab_id] = ws;
            const _app = this;

            ws.onopen = () => { tab.ws_state = 'connected'; _app.chatTick++; console.log('[ws] connected:', tab.session_id); };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('[ws]', msg.type, msg.event_type || '', '- data keys:', Object.keys(msg.data || {}).slice(0, 5).join(','));
                    if (msg.type === 'claude_event') {
                        const data = msg.data || {};
                        const etype = data.type || msg.event_type;
                        if (etype === 'text') {
                            const text = data.text || '';
                            if (text) {
                                tab.is_thinking = false;
                                if (tab._catThinking && window.CatModule && CatModule.isActive()) {
                                    tab._catThinking = false;
                                    CatModule.setExpression('neutral');
                                }
                                // Remove regenerating placeholder if present
                                const lastMsg = tab.messages[tab.messages.length - 1];
                                if (lastMsg && lastMsg.is_regenerating) {
                                    tab.messages.pop();
                                    tab._editMode = null;
                                }
                                const newLast = tab.messages[tab.messages.length - 1];
                                if (newLast && newLast.role === 'assistant' && newLast.is_streaming) {
                                    newLast.content += text;
                                } else {
                                    const thinkingContent = tab._thinkingBuffer || '';
                                    tab.messages.push({ role: 'assistant', content: text, thinking: thinkingContent || undefined, is_streaming: true, ts: Date.now() });
                                    tab._thinkingBuffer = '';
                                    _app._incrementUnread(tab);
                                }
                                tab.is_streaming = true;
                                _app.chatTick++;
                            }
                        } else if (etype === 'thinking') {
                            tab.is_thinking = true;
                            tab.is_streaming = true;
                            const thinkingText = data.text || data.thinking || data.content || '';
                            if (thinkingText) {
                                tab._thinkingBuffer = (tab._thinkingBuffer || '') + thinkingText;
                            }
                            if (window.CatModule && CatModule.isActive() && !tab._catThinking) {
                                tab._catThinking = true;
                                CatModule.setExpression('thinking');
                                if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                            }
                            _app.chatTick++;
                        } else if (etype === 'assistant') {
                            const content = data.content;
                            let text = '';
                            let thinkingText = tab._thinkingBuffer || '';
                            let hasThinking = false;
                            if (Array.isArray(content)) {
                                for (const block of content) {
                                    if (block.text) text += block.text;
                                    if (block.thinking) { hasThinking = true; thinkingText += (thinkingText ? '\n---\n' : '') + block.thinking; }
                                }
                            } else if (typeof content === 'string') {
                                text = content;
                            }
                            if (hasThinking && !text) tab.is_thinking = true;
                            console.log('[ws] assistant extracted text:', JSON.stringify(text).slice(0, 200), 'len:', text.length, 'msgs before:', tab.messages.length);
                            if (text) {
                                tab.is_thinking = false;
                                // Remove regenerating placeholder if present
                                const lastMsg = tab.messages[tab.messages.length - 1];
                                if (lastMsg && lastMsg.is_regenerating) {
                                    tab.messages.pop();
                                    tab._editMode = null;
                                }
                                const realLast = tab.messages[tab.messages.length - 1];
                                if (realLast && realLast.role === 'assistant' && realLast.is_streaming) {
                                    realLast.content += text;
                                    if (thinkingText) realLast.thinking = (realLast.thinking ? realLast.thinking + '\n---\n' : '') + thinkingText;
                                } else {
                                    tab.messages.push({ role: 'assistant', content: text, thinking: thinkingText || undefined, is_streaming: true, ts: Date.now() });
                                    _app._incrementUnread(tab);
                                }
                                tab._thinkingBuffer = '';
                                tab.is_streaming = true;
                                _app.chatTick++;
                            }
                        } else if (etype === 'tool') {
                            const name = data.name || (data.tool_name ? data.tool_name : 'tool_call');
                            const toolInput = data.input || data.tool_input || {};
                            const toolUse = data.tool_use || {};
                            const input = toolInput.input || toolUse.input || toolInput || {};
                            let toolType = 'other';
                            let toolDetail = '';
                            let toolPath = '';
                            const nameLower = (name || '').toLowerCase();
                            if (nameLower.includes('read') || nameLower.includes('read_file')) {
                                toolType = 'read';
                                const fp = input.file_path || input.path || '';
                                toolPath = fp;
                                toolDetail = fp.split(/[\\/]/).pop() || name;
                            } else if (nameLower.includes('edit') || nameLower.includes('write') || nameLower.includes('create_file')) {
                                toolType = nameLower.includes('edit') ? 'edit' : 'write';
                                const fp = input.file_path || input.path || '';
                                toolPath = fp;
                                toolDetail = fp.split(/[\\/]/).pop() || name;
                                var _toolEditOld = '', _toolEditNew = '', _toolWriteContent = '';
                                if (toolType === 'edit') {
                                    _toolEditOld = input.old_string || '';
                                    _toolEditNew = input.new_string || '';
                                } else {
                                    _toolWriteContent = input.content || '';
                                }
                            } else if (nameLower.includes('bash') || nameLower.includes('command') || nameLower.includes('shell')) {
                                toolType = 'bash';
                                const cmd = (input.command || input.cmd || '');
                                toolDetail = cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
                            } else if (nameLower.includes('glob') || nameLower.includes('search') || nameLower.includes('grep')) {
                                toolType = 'search';
                                toolDetail = input.pattern || input.query || name;
                                if (input.path) toolPath = input.path;
                            } else {
                                toolDetail = name;
                            }
                            tab.messages.push({ role: 'tool', content: name, toolType, toolDetail, toolPath, toolEditOld: _toolEditOld || '', toolEditNew: _toolEditNew || '', toolWriteContent: _toolWriteContent || '' });
                            _app.chatTick++;
                        } else if (etype === 'result') {
                            const usage = data.usage || {};
                            if (usage.input_tokens) tab.tokens.input = usage.input_tokens;
                            if (usage.output_tokens) tab.tokens.output += usage.output_tokens;
                            if (data.total_cost_usd) tab.tokens.cost += data.total_cost_usd;
                            // Store per-message token info for display
                            tab._msgTokens = { input: usage.input_tokens || 0, output: usage.output_tokens || 0, cost: data.total_cost_usd || 0 };
                            _app.chatTick++;
                        }
                    } else if (msg.type === 'stream_end') {
                        tab.is_streaming = false;
                        tab._catThinking = false;
                        // Mark agent done for background tabs
                        if (_app.activeChatTab !== tab.tab_id) {
                            tab._agentDone = true;
                        }
                        const lastMsg = tab.messages[tab.messages.length - 1];
                        if (lastMsg) {
                            lastMsg.is_streaming = false;
                            // Attach timing info to the last assistant message
                            if (tab._msgStartTime) {
                                lastMsg.duration = Date.now() - tab._msgStartTime;
                                tab._msgStartTime = null;
                            }
                            // Attach per-message token info
                            if (tab._msgTokens) {
                                lastMsg.msgTokens = tab._msgTokens;
                                tab._msgTokens = null;
                            }
                        }
                        if (window.CatModule && CatModule.isActive()) {
                            // Cat: analyze agent response for contextual comment
                            if (CatModule.analyzeAgentResponse && lastMsg && lastMsg.content) {
                                CatModule.analyzeAgentResponse(lastMsg.content);
                            } else {
                                CatModule.setExpression('happy');
                            }
                            setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 2000);
                        }
                        _app.chatTick++;
                        _app._scheduleChatSave();
                    } else if (msg.type === 'error') {
                        // Remove regenerating placeholder on error
                        const errLast = tab.messages[tab.messages.length - 1];
                        if (errLast && errLast.is_regenerating) {
                            tab.messages.pop();
                            tab._editMode = null;
                        }
                        tab.messages.push({ role: 'assistant', content: '[ERROR] ' + (msg.message || 'Unknown error'), ts: Date.now() });
                        tab.is_streaming = false;
                        _app._incrementUnread(tab);
                        if (window.CatModule && CatModule.isActive()) {
                            CatModule.setExpression('surprised');
                            if (CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                            CatModule.setSpeechText('Мяу?! Ошибка!', 3000);
                            setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 3000);
                        }
                        _app.chatTick++;
                    }
                    setTimeout(() => _app.smartScroll(tab), 50);
                } catch (e) {
                    console.error('[ws parse]', e);
                }
            };

            ws.onclose = (e) => {
                console.log('[ws] closed:', tab.session_id, 'code:', e.code, 'reason:', e.reason);
                tab.is_streaming = false;
                tab.ws_state = 'disconnected';
                _app.chatTick++;
            };

            ws.onerror = (e) => {
                console.error('[ws] error:', tab.session_id, e);
                tab.messages.push({ role: 'assistant', content: '[ERROR] WebSocket connection failed', ts: Date.now() });
                tab.is_streaming = false;
                tab.ws_state = 'disconnected';
                _app.chatTick++;
            };
        },

        async sendChatMessage(tab) {
            if ((!tab.input_text?.trim() && (!tab._attachments || tab._attachments.length === 0)) || tab.is_streaming) return;
            let content = tab.input_text.trim();
            // Append attached images as markdown
            if (tab._attachments && tab._attachments.length > 0) {
                for (const att of tab._attachments) {
                    content += (content ? '\n\n' : '') + '![' + att.name + '](' + att.dataUrl + ')';
                }
                tab._attachments = [];
            }
            if (!content) return;
            // Push to message history BEFORE adding prefixes (shell-style Up/Down navigation)
            if (tab._msgHistory.length === 0 || tab._msgHistory[tab._msgHistory.length - 1] !== content) {
                tab._msgHistory.push(content);
                if (tab._msgHistory.length > 100) tab._msgHistory.shift();
            }
            // Prepend queued reaction feedback (invisible to user, sent to agent)
            const feedbackPrefix = this._buildFeedbackPrefix(tab);
            if (feedbackPrefix) {
                content = feedbackPrefix + content;
            }
            // Prepend quoted message if present
            if (tab._quotedMsg) {
                const quotePrefix = '> [' + tab._quotedMsg.role + ']: ' + tab._quotedMsg.text.split('\n').join('\n> ') + '\n\n';
                content = quotePrefix + content;
                tab._quotedMsg = null;
            }
            tab._msgHistoryIdx = -1;
            tab._msgDraft = '';
            tab.input_text = '';
            tab._editMode = null; // clear edit mode on send
            this.resizeInputForTab(tab);
            tab.scrolledUp = false;
            tab.messages.push({ role: 'user', content: content, id: 'msg-' + Date.now(), ts: Date.now() });
            tab._msgStartTime = Date.now();
            this.chatNavClear();
            tab._msgTokens = null;
            this.chatTick++;
            this._scheduleChatSave();
            // Cat: analyze user message for contextual skill tips
            if (window.CatModule && CatModule.isActive() && CatModule.analyzeChatContext) {
                CatModule.analyzeChatContext(content);
            }
            setTimeout(() => {
                const el = document.getElementById('chat-messages-' + tab.tab_id);
                if (el) el.scrollTop = el.scrollHeight;
            }, 50);
            const ws = this.chatWs[tab.tab_id];
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'message', content: content }));
            } else if (tab._restored) {
                // Auto-reconnect restored tab before sending
                this.showToast('RECONNECTING...', 'info');
                await this.reconnectTab(tab.tab_id);
                // Retry send after reconnect
                const newWs = this.chatWs[tab.tab_id];
                if (newWs && newWs.readyState === WebSocket.OPEN) {
                    // Re-send: push the user message again (it was already pushed above)
                    newWs.send(JSON.stringify({ type: 'message', content: content }));
                } else {
                    tab.messages.push({ role: 'assistant', content: '[ERROR] Reconnect failed. Click RECONNECT on tab.', ts: Date.now() });
                    this.chatTick++;
                }
            } else {
                tab.messages.push({ role: 'assistant', content: '[ERROR] Not connected. Session may have ended.', ts: Date.now() });
                this.chatTick++;
            }
        },

        cancelChatStream(tab) {
            const ws = this.chatWs[tab.tab_id];
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'cancel' }));
            }
            tab.is_streaming = false;
        },

        // ========== CHAT: TEXTAREA AUTO-RESIZE ==========
        autoResizeTextarea(e) {
            const ta = e.target;
            if (!ta) return;
            ta.style.height = 'auto';
            const newH = Math.min(ta.scrollHeight, 200);
            ta.style.height = newH + 'px';
            ta.style.overflowY = ta.scrollHeight > 200 ? 'auto' : 'hidden';
        },
        resizeInputForTab(tab) {
            if (!tab) return;
            this.$nextTick(() => {
                const container = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col');
                if (!container) return;
                const ta = container.querySelector('textarea');
                if (!ta) return;
                ta.style.height = 'auto';
                const newH = Math.min(ta.scrollHeight, 200);
                ta.style.height = newH + 'px';
                ta.style.overflowY = ta.scrollHeight > 200 ? 'auto' : 'hidden';
            });
        },

        // ========== CHAT: MARKDOWN FORMAT TOOLBAR ==========
        insertMarkdown(tab, before, after) {
            // Find the textarea for this tab
            const container = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col');
            if (!container) return;
            const ta = container.querySelector('textarea');
            if (!ta || ta.disabled) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const text = tab.input_text || '';
            const selected = text.substring(start, end);
            const hasSelection = selected.length > 0;
            // Build new text
            let newText;
            if (hasSelection) {
                newText = text.substring(0, start) + before + selected + after + text.substring(end);
            } else {
                newText = text.substring(0, start) + before + after + text.substring(end);
            }
            tab.input_text = newText;
            // Position cursor after formatting
            this.$nextTick(() => {
                ta.focus();
                if (hasSelection) {
                    // Select the wrapped content
                    ta.selectionStart = start + before.length;
                    ta.selectionEnd = start + before.length + selected.length;
                } else {
                    // Place cursor between before/after
                    ta.selectionStart = ta.selectionEnd = start + before.length;
                }
            });
        },

        // ========== CHAT: SLASH COMMANDS ==========
        handleChatInput(tab, e) {
            // Reset history navigation when user types (stop browsing history)
            if (tab._msgHistoryIdx >= 0) {
                tab._msgHistoryIdx = -1;
                tab._msgDraft = '';
            }
            const text = (tab.input_text || '');
            if (text.startsWith('/')) {
                const query = text.slice(1).toLowerCase().split(' ')[0];
                if (query.length < 25) {
                    // Sort: local commands first, then skills
                    const local = this.slashCommands.filter(c =>
                        (c.cat !== 'skill') &&
                        (c.cmd.slice(1).startsWith(query) || c.desc.toLowerCase().includes(query))
                    );
                    const skills = this.slashCommands.filter(c =>
                        (c.cat === 'skill') &&
                        (c.cmd.slice(1).startsWith(query) || c.desc.toLowerCase().includes(query))
                    );
                    this.slashMenu.items = [...local, ...skills];
                    this.slashMenu.selected = 0;
                    this.slashMenu.show = this.slashMenu.items.length > 0;
                    this.slashMenu._tabId = tab.tab_id;
                    // Cat: react when slash menu opens with skills
                    if (skills.length > 0 && window.CatModule && CatModule.isActive() && !CatModule.getSpeech()) {
                        const slashCatTips = [
                            'Выбирай скилл! =^_^=',
                            '*уши навострил* Скиллы!',
                            'Мурр... /help покажет все_',
                            'Специальные команды! =^.^=',
                        ];
                        CatModule.setSpeechText(slashCatTips[Math.floor(Math.random() * slashCatTips.length)], 3000);
                        if (Math.random() < 0.5 && CatModule.triggerEarTwitch) CatModule.triggerEarTwitch();
                    }
                    return;
                }
            }
            this.slashMenu.show = false;
        },

        handleChatKeydown(tab, e) {
            if (this.slashMenu.show && this.slashMenu._tabId === tab.tab_id) {
                if (e.key === 'ArrowDown') { e.preventDefault(); this.slashMenu.selected = Math.min(this.slashMenu.selected + 1, this.slashMenu.items.length - 1); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); this.slashMenu.selected = Math.max(this.slashMenu.selected - 1, 0); return; }
                if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); this.selectSlashCommand(this.slashMenu.items[this.slashMenu.selected]); return; }
                if (e.key === 'Escape') { e.preventDefault(); this.slashMenu.show = false; return; }
            }
            // Markdown formatting shortcuts (Ctrl+Shift)
            if (e.ctrlKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === 'b') { e.preventDefault(); this.insertMarkdown(tab, '**', '**'); return; }
                if (key === 'i') { e.preventDefault(); this.insertMarkdown(tab, '*', '*'); return; }
                if (key === 'k') { e.preventDefault(); this.insertMarkdown(tab, '[', '](url)'); return; }
                if (key === 'c') { e.preventDefault(); this.insertMarkdown(tab, '```\n', '\n```'); return; }
            }
            // ESC cancels edit mode
            if (e.key === 'Escape' && tab._editMode) {
                e.preventDefault();
                this.cancelEditMode(tab.tab_id);
                return;
            }
            // ESC also exits history browsing
            if (e.key === 'Escape' && tab._msgHistoryIdx >= 0) {
                e.preventDefault();
                tab.input_text = tab._msgDraft;
                tab._msgHistoryIdx = -1;
                tab._msgDraft = '';
                return;
            }
            // Message history navigation (shell-style Up/Down)
            if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                if (e.key === 'ArrowUp' && tab._msgHistory.length > 0) {
                    const ta = e.target;
                    const cursorAtStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
                    const inputEmpty = !(tab.input_text || '').trim();
                    if (inputEmpty || cursorAtStart) {
                        e.preventDefault();
                        // Save current draft on first navigation
                        if (tab._msgHistoryIdx < 0) {
                            tab._msgDraft = tab.input_text || '';
                        }
                        // Move backward in history
                        const newIdx = tab._msgHistoryIdx < 0
                            ? tab._msgHistory.length - 1
                            : Math.max(0, tab._msgHistoryIdx - 1);
                        tab._msgHistoryIdx = newIdx;
                        tab.input_text = tab._msgHistory[newIdx];
                        this.$nextTick(() => this.resizeInputForTab(tab));
                        return;
                    }
                }
                if (e.key === 'ArrowDown' && tab._msgHistoryIdx >= 0) {
                    e.preventDefault();
                    if (tab._msgHistoryIdx < tab._msgHistory.length - 1) {
                        tab._msgHistoryIdx++;
                        tab.input_text = tab._msgHistory[tab._msgHistoryIdx];
                    } else {
                        // End of history — restore draft
                        tab._msgHistoryIdx = -1;
                        tab.input_text = tab._msgDraft;
                        tab._msgDraft = '';
                    }
                    this.$nextTick(() => this.resizeInputForTab(tab));
                    return;
                }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage(tab);
            }
        },

        selectSlashCommand(cmd) {
            if (!cmd) return;
            const tab = this.activeTab;
            if (!tab) return;
            this.slashMenu.show = false;
            // Skill commands: insert into input and send to agent
            if (cmd.cat === 'skill') {
                tab.input_text = cmd.cmd;
                this.$nextTick(() => { this.sendChatMessage(tab); });
                return;
            }
            // Local commands
            tab.input_text = '';
            switch (cmd.action) {
                case 'clear': this.clearActiveChat(); break;
                case 'export': this.exportActiveChat(); break;
                case 'cancel': this.cancelChatStream(tab); break;
                case 'compact':
                    this.settings.chatDensity = this.settings.chatDensity === 'compact' ? 'comfortable' : 'compact';
                    localStorage.setItem('ar-settings', JSON.stringify(this.settings));
                    this.applySettings();
                    this.showToast('CHAT DENSITY: ' + this.settings.chatDensity.toUpperCase());
                    break;
                case 'help': {
                    const locals = this.slashCommands.filter(c => c.cat !== 'skill').map(c => '`' + c.cmd + '` — ' + c.desc).join('\n');
                    const skills = this.slashCommands.filter(c => c.cat === 'skill').map(c => '`' + c.cmd + '` — ' + c.desc).join('\n');
                    const helpMsg = '**Локальные команды:**\n\n' + locals + '\n\n**Claude Code скиллы:**\n\n' + skills + '\n\n_Выберите скилл из списка или введите / для autocomplete_';
                    tab.messages.push({ role: 'assistant', content: helpMsg, ts: Date.now() });
                    this.chatTick++;
                    break;
                }
            }
            this.$nextTick(() => {
                const ta = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (ta) ta.focus();
            });
        },

        // ========== CHAT: FILE DRAG & DROP ==========
        async handleChatDrop(tab, e) {
            this.chatDragOver = false;
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            await this._attachFiles(tab, files);
        },

        // ========== CHAT: PASTE IMAGE ==========
        async handleChatPaste(tab, e) {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files = [];
            for (const item of items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
            if (files.length === 0) return; // text paste — do nothing
            e.preventDefault();
            await this._attachFiles(tab, files);
        },

        // ========== CHAT: FILE ATTACHMENT BUTTON ==========
        triggerFileAttach(tab) {
            const input = document.getElementById('chat-file-input');
            if (input) {
                input._tabId = tab.tab_id;
                input.click();
            }
        },
        async handleFileInput(e) {
            const input = e.target;
            const tabId = input._tabId;
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !input.files || input.files.length === 0) return;
            await this._attachFiles(tab, input.files);
            input.value = ''; // reset for re-use
        },

        // ========== CHAT: ATTACHMENTS ==========
        async _attachFiles(tab, fileList) {
            if (!tab) return;
            for (const file of fileList) {
                if (file.size > 5 * 1024 * 1024) {
                    this.showToast('FILE TOO LARGE: ' + file.name + ' (max 5MB)', 'error');
                    continue;
                }
                const isImage = file.type.startsWith('image/');
                try {
                    if (isImage) {
                        // Convert image to base64 data URL
                        const dataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                        if (!tab._attachments) tab._attachments = [];
                        tab._attachments.push({ name: file.name, size: file.size, type: file.type, dataUrl });
                    } else {
                        // Read text content and insert directly into input
                        const text = await file.text();
                        const ext = file.name.split('.').pop().toLowerCase();
                        const langMap = { py: 'python', js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx', sh: 'bash', json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown', html: 'html', css: 'css', sql: 'sql', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c', rb: 'ruby', php: 'php' };
                        const lang = langMap[ext] || '';
                        const header = '**' + file.name + '** (' + this.formatFileSize(file.size) + '):\n';
                        const codeBlock = '```' + lang + '\n' + text + '\n```\n';
                        tab.input_text += (tab.input_text ? '\n' : '') + header + codeBlock;
                    }
                } catch (err) {
                    this.showToast('FAILED TO READ: ' + file.name, 'error');
                }
            }
            this.chatTick++;
            this.$nextTick(() => {
                const ta = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (ta) ta.focus();
                this.resizeInputForTab(tab);
            });
        },
        removeAttachment(tabId, idx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab._attachments) return;
            tab._attachments.splice(idx, 1);
            this.chatTick++;
        },
        clearAttachments(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (tab) { tab._attachments = []; this.chatTick++; }
        },

        // ========== CHAT: PROMPT QUICK ACTIONS ==========
        insertPromptTemplate(tab, template) {
            if (!tab) return;
            const cmd = template.text;
            // Slash commands: insert at beginning (or replace current empty input), cursor at end
            if (cmd.startsWith('/')) {
                tab.input_text = cmd;
            } else {
                tab.input_text = tab.input_text ? tab.input_text + '\n' + cmd : cmd;
            }
            this.chatTick++;
            this.$nextTick(() => {
                const ta = document.querySelector('#chat-messages-' + tab.tab_id)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (ta) { ta.focus(); this.autoResizeTextarea({ target: ta }); }
            });
        },

        // ========== CHAT: INLINE DIFF ==========
        /**
         * Simple line-level diff: returns array of {type:'eq'|'del'|'ins', text}
         * Uses LCS-based approach for minimal diff.
         */
        simpleLineDiff(oldLines, newLines) {
            const m = oldLines.length, n = newLines.length;
            // For large diffs, fall back to simple side-by-side
            if (m > 200 || n > 200) {
                const result = [];
                for (const l of oldLines) result.push({ type: 'del', text: l });
                for (const l of newLines) result.push({ type: 'ins', text: l });
                return result;
            }
            // Build LCS table
            const dp = [];
            for (let i = 0; i <= m; i++) {
                dp[i] = [];
                for (let j = 0; j <= n; j++) {
                    if (i === 0 || j === 0) dp[i][j] = 0;
                    else if (oldLines[i - 1] === newLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
                    else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
            // Backtrack to produce diff
            const result = [];
            let i = m, j = n;
            while (i > 0 || j > 0) {
                if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                    result.push({ type: 'eq', text: oldLines[i - 1] });
                    i--; j--;
                } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                    result.push({ type: 'ins', text: newLines[j - 1] });
                    j--;
                } else {
                    result.push({ type: 'del', text: oldLines[i - 1] });
                    i--;
                }
            }
            result.reverse();
            return result;
        },

        /**
         * Render inline diff HTML for edit tool messages.
         * Shows old_string (red) → new_string (green) with line numbers.
         */
        renderInlineDiff(oldStr, newStr) {
            if (!oldStr && !newStr) return '';
            const oldLines = (oldStr || '').split('\n');
            const newLines = (newStr || '').split('\n');
            const diff = this.simpleLineDiff(oldLines, newLines);
            // Count changes
            let added = 0, removed = 0;
            for (const d of diff) {
                if (d.type === 'ins') added++;
                if (d.type === 'del') removed++;
            }
            // Truncate if too many lines
            const MAX_LINES = 40;
            const truncated = diff.length > MAX_LINES;
            const displayDiff = truncated ? diff.slice(0, MAX_LINES) : diff;
            let html = '<div class="tool-inline-diff">';
            // Header
            html += '<div class="diff-header">';
            html += '<span class="diff-stats-del">-' + removed + '</span>';
            html += '<span class="diff-stats-ins">+' + added + '</span>';
            html += '<span style="color:var(--v3);margin-left:auto;font-size:0.5rem">INLINE_DIFF</span>';
            html += '</div>';
            // Lines
            for (const d of displayDiff) {
                if (d.type === 'del') {
                    html += '<div class="diff-del diff-line diff-line-del"><span class="diff-line-sign" style="color:var(--red)">-</span>' + this.escHtml(d.text) + '</div>';
                } else if (d.type === 'ins') {
                    html += '<div class="diff-add diff-line diff-line-ins"><span class="diff-line-sign" style="color:var(--ng)">+</span>' + this.escHtml(d.text) + '</div>';
                } else {
                    html += '<div class="diff-line diff-line-eq"><span class="diff-line-sign"> </span>' + this.escHtml(d.text) + '</div>';
                }
            }
            if (truncated) {
                html += '<div class="diff-truncated">... ' + (diff.length - MAX_LINES) + ' more lines</div>';
            }
            html += '</div>';
            return html;
        },

        /**
         * Render write tool content preview (first N lines of new file).
         */
        renderWritePreview(content) {
            if (!content) return '';
            const lines = content.split('\n');
            const MAX_PREVIEW = 15;
            const truncated = lines.length > MAX_PREVIEW;
            const display = lines.slice(0, MAX_PREVIEW);
            let html = '<div class="tool-write-preview">';
            html += '<div class="write-header">';
            html += '<span style="color:var(--ng);letter-spacing:0.1em">NEW FILE</span>';
            html += '<span style="color:var(--v3);margin-left:auto;font-size:0.5rem">' + lines.length + ' lines</span>';
            html += '</div>';
            html += '<div class="write-body">';
            for (const line of display) {
                html += '<div style="white-space:pre-wrap;word-break:break-all;line-height:1.5;color:var(--ng2)">' + this.escHtml(line) + '</div>';
            }
            if (truncated) {
                html += '<div class="diff-truncated">... ' + (lines.length - MAX_PREVIEW) + ' more lines</div>';
            }
            html += '</div></div>';
            return html;
        },

        // ========== CHAT: WELCOME SCREEN ==========
        _renderWelcomeScreen(tab) {
            const projectPath = this.escHtml(tab?.project_path || '.');
            const projectName = projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath;
            const sessionId = this.escHtml(tab?.session_id || '').slice(0, 8);
            const connState = tab?.ws_state || 'connecting';
            const connColor = connState === 'connected' ? 'var(--ng)' : (connState === 'connecting' || connState === 'restored') ? 'var(--amber)' : 'var(--red)';
            const connLabel = connState.toUpperCase();

            // Quick actions
            const actions = [
                { label: 'FOCUS INPUT', icon: '&#x270d;', hint: 'Начать ввод', action: "window._app.focusChatInput('" + tab.tab_id + "')" },
                { label: '/ COMMANDS', icon: '&#x2699;', hint: 'Slash меню', action: "window._app.focusChatInput('" + tab.tab_id + "', '/')" },
                { label: 'CTRL+K', icon: '&#x2318;', hint: 'Command Palette', action: "window._app.openCmdPalette()" },
                { label: 'CTRL+F', icon: '&#x1f50d;', hint: 'Поиск', action: "window._app.openChatSearch()" },
                { label: 'RESUME', icon: '&#x21bb;', hint: 'Предыдущая сессия', action: "window._app.showSessionPicker()" },
                { label: '? KEYS', icon: '&#x2328;', hint: 'Горячие клавиши', action: "window._app.openShortcuts()" },
            ];

            // Tips — rotate based on time
            const tips = [
                'Введите <kbd>/</kbd> для автодополнения команд и скиллов Claude Code',
                'Вставьте изображение из буфера обмена прямо в поле ввода',
                'Перетащите файлы в чат для вложений (drag & drop)',
                'Используйте <kbd>Ctrl+K</kbd> для быстрого доступа ко всем командам',
                'Нажмите <kbd>?</kbd> чтобы увидеть все горячие клавиши',
                'Правый клик по сообщению — контекстное меню с действиями',
                'Зажмите и выделите текст — цитирование ответа агента',
                'PIN — закрепите важные сообщения для быстрого доступа',
            ];
            const tipIdx = Math.floor(Date.now() / 30000) % tips.length;

            let html = '<div class="welcome-screen">'
                // Header
                + '<div class="ws-header">'
                + '<div class="ws-logo">'
                + '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
                + '</div>'
                + '<div class="ws-title">CLAUDE_CODE_SESSION</div>'
                + '<div class="ws-project"><span class="ws-project-icon">&#x1f4c1;</span> ' + projectName + '</div>'
                + '<div class="ws-path">' + projectPath + '</div>'
                + '<div class="ws-meta">'
                + '<span class="ws-conn" style="color:' + connColor + '">&#x25cf; ' + connLabel + '</span>'
                + (sessionId ? '<span class="ws-session-id">ID: ' + sessionId + '</span>' : '')
                + '</div>'
                + '</div>'

                // Quick actions grid
                + '<div class="ws-actions">'
                + actions.map(a =>
                    '<button class="ws-action-btn" onclick="event.stopPropagation();(' + a.action + ')()" title="' + a.hint + '">'
                    + '<span class="ws-action-icon">' + a.icon + '</span>'
                    + '<span class="ws-action-label">' + a.label + '</span>'
                    + '</button>'
                ).join('')
                + '</div>'

                // Tip of the session
                + '<div class="ws-tip">'
                + '<span class="ws-tip-icon">&#x1f4a1;</span>'
                + '<span class="ws-tip-text">' + tips[tipIdx] + '</span>'
                + '</div>'

                // Feature hints
                + '<div class="ws-features">'
                + '<div class="ws-feature"><span class="ws-feature-icon">&#x1f4f7;</span> Paste images</div>'
                + '<div class="ws-feature"><span class="ws-feature-icon">&#x1f4ce;</span> Drag files</div>'
                + '<div class="ws-feature"><span class="ws-feature-icon">&#x1f4cc;</span> Pin messages</div>'
                + '<div class="ws-feature"><span class="ws-feature-icon">&#x1f504;</span> Regen response</div>'
                + '</div>'

                + '</div>';
            return html;
        },

        // Focus chat input for this tab, optionally prepend text
        focusChatInput(tabId, prefix) {
            if (this.activeChatTab !== tabId) this.activateChatTab(tabId);
            this.$nextTick(() => {
                const container = document.querySelector('#chat-messages-' + tabId)?.closest('.flex.flex-col');
                if (!container) return;
                const ta = container.querySelector('textarea');
                if (!ta) return;
                ta.focus();
                if (prefix) {
                    ta.value = prefix;
                    ta.dispatchEvent(new Event('input'));
                }
            });
        },

        // ========== CHAT: RENDER ==========
        renderChatHTML(tab) {
            const _ = this.chatTick;
            if (!tab || !tab.messages || tab.messages.length === 0) {
                return this._renderWelcomeScreen(tab);
            }
            let html = '';
            const icons = { read: '&#x1f4d6;', edit: '&#x270f;', write: '&#x1f4be;', bash: '&#x2328;', search: '&#x1f50d;', other: '&#x2699;' };
            const colors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            const labels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'TOOL' };
            const avatarUser = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
            const avatarAsst = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
            const avatarTool = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
            const msgs = tab.messages;
            let i = 0;
            let turnCount = 0;
            // Helper: render a single assistant message (extracted for grouping)
            const renderAssistantMsg = (msg, idx, tab) => {
                if (msg.is_regenerating) {
                    return '<div class="msg-wrap chat-msg-fadein chat-msg-row">'
                        + '<div class="chat-avatar chat-avatar-asst">' + avatarAsst + '</div>'
                        + '<div class="chat-body">'
                        + '<div class="chat-role chat-role-assistant">CLAUDE_</div>'
                        + '<div class="chat-bubble-asst msg-regenerating" style="padding:var(--chat-msg-padding,8px 12px)">'
                        + '<span style="margin-right:6px">&#x21bb;</span> Regenerating response...'
                        + '<span class="streaming-cursor"></span>'
                        + '</div></div></div>';
                }
                const cursorHtml = msg.is_streaming ? '<span class="streaming-cursor"></span>' : '';
                const contentHtml = msg.is_streaming
                    ? '<div class="md">' + this.linkFilePaths(this.renderMarkdown(msg.content)) + cursorHtml + '</div>'
                    : '<div class="md">' + this.linkFilePaths(this.renderMarkdown(msg.content)) + '</div>';
                const aTime = this.fmtTime(msg.ts);
                const isLastAssistant = !msg.is_streaming && !tab.is_streaming && msgs.slice(idx + 1).filter(m => m.role === 'assistant').length === 0;
                let thinkingHtml = '';
                if (msg.thinking && msg.thinking.trim().length > 0) {
                    const showThinking = this.settings.showThinking !== false;
                    const thinkingPreview = msg.thinking.length > 120 ? msg.thinking.slice(0, 120) + '...' : msg.thinking;
                    const escapedPreview = this.escHtml(thinkingPreview).replace(/\n/g, '<br>');
                    const escapedFull = this.escHtml(msg.thinking).replace(/\n/g, '<br>');
                    const thinkId = 'think-' + tab.tab_id + '-' + idx;
                    thinkingHtml = '<div class="thinking-block" style="margin-bottom:4px">'
                        + '<div class="thinking-toggle" onclick="var b=document.getElementById(\'' + thinkId + '\');var a=this.querySelector(\'[data-tarrow]\');if(b.style.display===\'none\'){b.style.display=\'block\';a.textContent=\'\\u25BC\';this.classList.add(\'open\');}else{b.style.display=\'none\';a.textContent=\'\\u25B6\';this.classList.remove(\'open\');}" '
                        + 'style="display:flex;align-items:center;gap:6px;padding:3px 8px;cursor:pointer;border:1px solid var(--v-dim);background:var(--thinking-bg);user-select:none;font-size:0.625rem;letter-spacing:0.1em;color:var(--v3);transition:background 0.15s" '
                        + 'onmouseenter="this.style.background=\'var(--thinking-bg-hover)\'" onmouseleave="this.style.background=\'var(--thinking-bg)\'">'
                        + '<span data-tarrow style="font-size:0.4375rem;min-width:8px;color:var(--v3)">' + (showThinking ? '&#x25BC;' : '&#x25B6;') + '</span>'
                        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--amber);flex-shrink:0"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5.1 7.5l.9-1.8A6 6 0 0 1 6 10a6 6 0 1 1 12 0c0 1.5-.5 2.8-1.4 3.9l-1.4-1.4c.6-.7.8-1.5.8-2.5 0-2.2-1.8-4-4-4S8 7.8 8 10s1.8 4 4 4c.7 0 1.3-.2 1.9-.5l1.2 1.5A5.8 5.8 0 0 1 12 16a6 6 0 0 1-6-6 8 8 0 0 0 6 8z"/></svg>'
                        + '<span style="color:var(--amber);font-weight:bold;letter-spacing:0.12em">THINKING</span>'
                        + '<span style="color:var(--v3);opacity:0.6;font-size:0.5625rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50ch">' + escapedPreview + '</span>'
                        + '</div>'
                        + '<div id="' + thinkId + '" style="display:' + (showThinking ? 'block' : 'none') + ';border:1px solid var(--v-dim);border-top:none;background:var(--thinking-content-bg);padding:6px 10px;font-size:0.75rem;color:var(--ng3);line-height:1.6;font-style:italic;max-height:200px;overflow-y:auto">'
                        + escapedFull
                        + '</div></div>';
                }
                const aFold = !msg.is_streaming && msg.content && msg.content.length > 500;
                const aCollapsed = msg.collapsed && aFold;
                const aChars = (msg.content || '').length;
                const aLines = (msg.content || '').split('\n').length;
                let aMetaHtml = '';
                const reaction = msg.reaction || '';
                if (!msg.is_streaming) {
                    const metaParts = [];
                    if (msg.duration) metaParts.push(this.fmtDuration(msg.duration));
                    if (msg.msgTokens) {
                        if (msg.msgTokens.output) metaParts.push((msg.msgTokens.output / 1000).toFixed(1) + 'K out');
                        if (msg.msgTokens.cost > 0) metaParts.push('$' + msg.msgTokens.cost.toFixed(4));
                    }
                    if (metaParts.length) {
                        aMetaHtml = ' <span class="msg-meta-badge">' + metaParts.join(' · ') + '</span>';
                    }
                }
                let reactionHtml = '';
                if (!msg.is_streaming && msg.content && !msg.content.startsWith('[ERROR]')) {
                    reactionHtml = '<span class="msg-reactions">'
                        + '<button class="msg-reaction-btn' + (reaction === 'up' ? ' active-up' : '') + '" onclick="event.stopPropagation();window._app.toggleReaction(\'' + tab.tab_id + '\',' + idx + ',\'up\')" title="Полезный ответ">&#x1F44D;</button>'
                        + '<button class="msg-reaction-btn' + (reaction === 'down' ? ' active-down' : '') + '" onclick="event.stopPropagation();window._app.toggleReaction(\'' + tab.tab_id + '\',' + idx + ',\'down\')" title="Не помогло">&#x1F44E;</button>'
                        + '</span>';
                }
                let thinkingIndicatorHtml = '';
                if (msg.is_streaming && tab.is_thinking && !msg.content) {
                    thinkingIndicatorHtml = '<div class="thinking-streaming-indicator">'
                        + '<span class="tsi-label">THINKING</span>'
                        + '<span class="tsi-dots"><span></span><span></span><span></span></span>'
                        + '</div>';
                }
                const isPinned = this.pinnedMessages.some(p => p.tabId === tab.tab_id && p.msgIdx === idx);
                return '<div class="msg-wrap chat-msg-fadein chat-msg-row' + (isPinned ? ' msg-pinned' : '') + '" data-msg-idx="' + idx + '">'
                    + '<div class="chat-avatar chat-avatar-asst">' + avatarAsst + '</div>'
                    + '<div class="chat-body">'
                    + '<div class="msg-actions">'
                    + '<button class="act-copy" onclick="event.stopPropagation();window._app.copyChatMsg(\'' + tab.tab_id + '\',' + idx + ')" title="Copy">COPY</button>'
                    + '<button class="act-quote" onclick="event.stopPropagation();window._app.quoteMessage(\'' + tab.tab_id + '\',' + idx + ')" title="Quote in reply">QUOTE</button>'
                    + (isLastAssistant ? '<button class="act-regen" onclick="event.stopPropagation();window._app.regenerateResponse(\'' + tab.tab_id + '\')" title="Regenerate">REGEN</button>' : '')
                    + '<button class="act-pin' + (isPinned ? ' pinned' : '') + '" onclick="event.stopPropagation();window._app.togglePinMessage(\'' + tab.tab_id + '\',' + idx + ')" title="' + (isPinned ? 'Unpin' : 'Pin') + ' message">' + (isPinned ? 'UNPIN' : 'PIN') + '</button>'
                    + (aFold ? '<button class="act-fold" onclick="event.stopPropagation();window._app.toggleMsgCollapse(\'' + tab.tab_id + '\',' + idx + ')" title="Fold/Unfold">' + (msg.collapsed ? 'UNFOLD' : 'FOLD') + '</button>' : '')
                    + (!msg.is_streaming ? '<button class="act-like' + (msg.reaction === 'up' ? ' reacted' : '') + '" onclick="event.stopPropagation();window._app.reactToMessage(\'' + tab.tab_id + '\',' + idx + ',\'up\')" title="Helpful">&#x1F44D;</button>'
                    + '<button class="act-dislike' + (msg.reaction === 'down' ? ' reacted' : '') + '" onclick="event.stopPropagation();window._app.reactToMessage(\'' + tab.tab_id + '\',' + idx + ',\'down\')" title="Not helpful">&#x1F44E;</button>' : '')
                    + '<button class="act-del" onclick="event.stopPropagation();window._app.deleteChatMsg(\'' + tab.tab_id + '\',' + idx + ')" title="Delete">DEL</button>'
                    + '</div>'
                    + '<div class="chat-role chat-role-assistant">CLAUDE_' + (isPinned ? ' <span class="pin-indicator" title="Pinned message">&#x1F4CC;</span>' : '') + (msg.reaction === 'up' ? ' <span style="color:var(--ng);font-size:0.625rem" title="Helpful">&#x1F44D;</span>' : '') + (msg.reaction === 'down' ? ' <span style="color:var(--red);font-size:0.625rem" title="Not helpful">&#x1F44E;</span>' : '') + (aTime ? ' <span style="color:var(--v3);font-weight:normal">' + aTime + '</span>' : '') + (aFold ? ' <span style="color:var(--v3);font-weight:normal;font-size:0.5rem">' + aChars + 'ch · ' + aLines + 'ln</span>' : '') + aMetaHtml + reactionHtml + '</div>'
                    + thinkingHtml
                    + thinkingIndicatorHtml
                    + '<div class="chat-bubble-asst" style="max-width:100%;padding:var(--chat-msg-padding,8px 12px);font-size:inherit">'
                    + (aCollapsed
                        ? '<div class="chat-collapsed-preview"><div class="md">' + this.linkFilePaths(this.renderMarkdown(msg.content.slice(0, 300))) + '</div></div>'
                          + '<div class="chat-expand-btn" onclick="event.stopPropagation();window._app.toggleMsgCollapse(\'' + tab.tab_id + '\',' + idx + ')">&#x25BC; EXPAND (' + aChars + ' chars)</div>'
                        : contentHtml)
                    + '</div></div></div>';
            };
            // Helper: render a tool group (extracted for grouping)
            const renderToolGroup = (toolGroup, startIdx) => {
                const isLastGroup = (startIdx + toolGroup.length >= msgs.length);
                const collapsed = !isLastGroup;
                const counts = {};
                for (const t of toolGroup) { const k = labels[t.toolType || 'other'] || 'TOOL'; counts[k] = (counts[k] || 0) + 1; }
                const summaryParts = Object.entries(counts).map(([k, v]) => k + (v > 1 ? ' x' + v : ''));
                const primaryTarget = toolGroup[0]?.toolPath || toolGroup[0]?.toolDetail || '';
                const summaryText = toolGroup.length === 1
                    ? (toolGroup[0].toolDetail || toolGroup[0].content || summaryParts[0])
                    : summaryParts.join(', ');
                const countLabel = toolGroup.length === 1 ? '1 TOOL' : toolGroup.length + ' TOOLS';
                let detailHtml = '';
                for (const t of toolGroup) {
                    const tt = t.toolType || 'other';
                    const td = t.toolDetail || t.content || '';
                    const tp = t.toolPath || '';
                    if (tp && (tt === 'read' || tt === 'edit' || tt === 'write')) {
                        detailHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 18px">'
                            + '<span style="font-size:0.625rem">' + (icons[tt] || icons.other) + '</span>'
                            + '<span style="font-size:0.5rem;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px">[' + (labels[tt] || 'TOOL') + ']</span>'
                            + '<span class="fp-link" style="font-size:0.625rem" title="' + this.escHtml(tp) + ' — click to copy" onclick="event.stopPropagation();navigator.clipboard.writeText(\'' + this.escHtml(tp).replace(/'/g, "\\'") + '\').then(function(){window._app&&window._app.showToast(\'Путь скопирован\')})">' + this.escHtml(tp.split(/[\\/]/).pop()) + '</span>'
                            + '<span style="font-size:0.5625rem;color:var(--v3);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="' + this.escHtml(tp) + '">' + this.escHtml(tp) + '</span>'
                            + '</div>';
                        if (tt === 'edit' && (t.toolEditOld || t.toolEditNew)) {
                            detailHtml += '<div style="margin-left:18px">' + this.renderInlineDiff(t.toolEditOld, t.toolEditNew) + '</div>';
                        }
                        if (tt === 'write' && t.toolWriteContent) {
                            detailHtml += '<div style="margin-left:18px">' + this.renderWritePreview(t.toolWriteContent) + '</div>';
                        }
                    } else if (tt === 'bash') {
                        detailHtml += '<div style="display:flex;align-items:flex-start;gap:6px;padding:2px 0 2px 18px">'
                            + '<span style="font-size:0.625rem;margin-top:1px">' + (icons[tt] || icons.other) + '</span>'
                            + '<span style="font-size:0.5rem;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px;margin-top:1px">[' + (labels[tt] || 'TOOL') + ']</span>'
                            + '<code style="font-size:0.625rem;color:var(--tok-str, var(--ng2));background:var(--code-bg, var(--bg));padding:1px 6px;border:1px solid var(--v-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60ch;display:inline-block" title="' + this.escHtml(td) + '">$ ' + this.escHtml(td) + '</code>'
                            + '</div>';
                    } else if (tt === 'search') {
                        detailHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 18px">'
                            + '<span style="font-size:0.625rem">' + (icons[tt] || icons.other) + '</span>'
                            + '<span style="font-size:0.5rem;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px">[' + (labels[tt] || 'TOOL') + ']</span>'
                            + '<code style="font-size:0.625rem;color:var(--yellow);padding:1px 4px">' + this.escHtml(td) + '</code>'
                            + (tp ? '<span style="font-size:0.5625rem;color:var(--v3);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40ch" title="' + this.escHtml(tp) + '">in ' + this.escHtml(tp) + '</span>' : '')
                            + '</div>';
                    } else {
                        detailHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 18px">'
                            + '<span style="font-size:0.625rem">' + (icons[tt] || icons.other) + '</span>'
                            + '<span style="font-size:0.5rem;color:' + (colors[tt] || colors.other) + ';letter-spacing:0.12em;font-weight:bold;min-width:36px">[' + (labels[tt] || 'TOOL') + ']</span>'
                            + '<span style="font-size:0.625rem;color:var(--ng3);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55ch" title="' + this.escHtml(td) + '">' + this.escHtml(td) + '</span>'
                            + '</div>';
                    }
                }
                const arrowChar = collapsed ? '&#x25B6;' : '&#x25BC;';
                const detailDisplay = collapsed ? 'none' : 'block';
                const typeIcons = [...new Set(toolGroup.map(t => icons[t.toolType || 'other'] || icons.other))].join(' ');
                let diffBadge = '';
                for (const t of toolGroup) {
                    if (t.toolType === 'edit' && (t.toolEditOld || t.toolEditNew)) {
                        const oldL = (t.toolEditOld || '').split('\n').length;
                        const newL = (t.toolEditNew || '').split('\n').length;
                        diffBadge = '<span style="font-size:0.5rem;margin-left:4px"><span style="color:var(--red)">-' + oldL + '</span><span style="color:var(--v3)">/</span><span style="color:var(--ng)">+' + newL + '</span></span>';
                        break;
                    } else if (t.toolType === 'write' && t.toolWriteContent) {
                        const wc = (t.toolWriteContent || '').split('\n').length;
                        diffBadge = '<span style="font-size:0.5rem;margin-left:4px;color:var(--ng)">+' + wc + ' lines</span>';
                        break;
                    }
                }
                const headerTarget = primaryTarget
                    ? '<span class="fp-link" style="font-size:0.625rem" title="' + this.escHtml(primaryTarget) + ' — click to copy" onclick="event.stopPropagation();navigator.clipboard.writeText(\'' + this.escHtml(primaryTarget).replace(/'/g, "\\'") + '\').then(function(){window._app&&window._app.showToast(\'Путь скопирован\')})">' + this.escHtml(primaryTarget.split(/[\\/]/).pop()) + '</span>'
                    + '<span style="font-size:0.5rem;color:var(--v3);font-family:monospace;margin-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:30ch" title="' + this.escHtml(primaryTarget) + '">' + this.escHtml(primaryTarget) + '</span>'
                    + diffBadge
                    : '<span style="font-size:0.5625rem;color:var(--ng3);letter-spacing:0.08em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50ch" title="' + this.escHtml(summaryText) + '">' + this.escHtml(summaryText) + '</span>';
                return '<div class="chat-msg-row" style="padding:2px 0" data-msg-idx="' + startIdx + '"><div class="chat-avatar chat-avatar-tool">' + avatarTool + '</div><div style="flex:1;min-width:0">'
                    + '<div onclick="var d=this.nextElementSibling,a=this.querySelector(\'[data-arrow]\');if(d.style.display===\'none\'){d.style.display=\'block\';a.textContent=\'\\u25BC\';}else{d.style.display=\'none\';a.textContent=\'\\u25B6\';}" '
                    + 'style="display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border:1px solid var(--v-dim);background:var(--tool-header-bg);user-select:none" '
                    + 'onmouseenter="this.style.borderColor=\'var(--v2)\'" onmouseleave="this.style.borderColor=\'var(--v-dim)\'">'
                    + '<span data-arrow style="font-size:0.5rem;color:var(--v3);min-width:10px">' + arrowChar + '</span>'
                    + '<span style="font-size:0.625rem">' + typeIcons + '</span>'
                    + '<span style="font-size:0.5625rem;color:var(--v);letter-spacing:0.12em;font-weight:bold">' + countLabel + '</span>'
                    + headerTarget
                    + '</div>'
                    + '<div style="display:' + detailDisplay + ';border:1px solid var(--v-dim);border-top:none;background:var(--tool-detail-bg);padding:4px 6px">'
                    + detailHtml
                    + '</div></div></div>';
            };

            // Main render loop with message grouping
            let _lastDateGroup = '';
            while (i < msgs.length) {
                const msg = msgs[i];
                if (msg.role === 'user') {
                    turnCount++;
                    // Date group separator — new heading when day changes
                    const dateLabel = this.dateGroupLabel(msg.ts);
                    if (dateLabel && dateLabel !== _lastDateGroup) {
                        _lastDateGroup = dateLabel;
                        html += '<div class="chat-date-sep"><div class="chat-date-sep-line"></div>'
                            + '<span class="chat-date-sep-label">' + this.escHtml(dateLabel) + '</span>'
                            + '<div class="chat-date-sep-line"></div></div>';
                    }
                    // Turn separator before each user message (except the first turn)
                    if (turnCount > 1) {
                        const uTimeSep = this.fmtTime(msg.ts);
                        const relTime = this.relativeTime(msg.ts);
                        html += '<div class="chat-turn-sep"><div class="chat-turn-sep-line"></div>'
                            + '<span class="chat-turn-sep-time">' + uTimeSep + '</span>'
                            + (relTime !== uTimeSep ? '<span class="chat-turn-sep-label">' + relTime + '</span>' : '')
                            + '<div class="chat-turn-sep-line"></div></div>';
                    }
                    const uTime = this.fmtTime(msg.ts);
                    const uFold = msg.content && msg.content.length > 500 && !msg.is_streaming;
                    const uCollapsed = msg.collapsed && uFold;
                    const uChars = (msg.content || '').length;
                    const uLines = (msg.content || '').split('\n').length;
                    html += '<div class="msg-wrap chat-msg-fadein chat-msg-row chat-msg-row-user" data-msg-idx="' + i + '">'
                        + '<div class="chat-avatar chat-avatar-user">' + avatarUser + '</div>'
                        + '<div class="chat-body">'
                        + '<div class="msg-actions">'
                        + '<button class="act-copy" onclick="event.stopPropagation();window._app.copyChatMsg(\'' + tab.tab_id + '\',' + i + ')" title="Copy">COPY</button>'
                        + '<button class="act-quote" onclick="event.stopPropagation();window._app.quoteMessage(\'' + tab.tab_id + '\',' + i + ')" title="Quote in reply">QUOTE</button>'
                        + '<button class="act-edit" onclick="event.stopPropagation();window._app.editUserMsg(\'' + tab.tab_id + '\',' + i + ')" title="Edit & resend">EDIT</button>'
                        + (uFold ? '<button class="act-fold" onclick="event.stopPropagation();window._app.toggleMsgCollapse(\'' + tab.tab_id + '\',' + i + ')" title="Fold/Unfold">' + (msg.collapsed ? 'UNFOLD' : 'FOLD') + '</button>' : '')
                        + '<button class="act-del" onclick="event.stopPropagation();window._app.deleteChatMsg(\'' + tab.tab_id + '\',' + i + ')" title="Delete">DEL</button>'
                        + '</div>'
                        + '<div class="chat-role chat-role-user">USER_' + (uTime ? ' <span style="color:var(--v3);font-weight:normal">' + uTime + '</span>' : '') + (uFold ? ' <span style="color:var(--v3);font-weight:normal;font-size:0.5rem">' + uChars + 'ch · ' + uLines + 'ln</span>' : '') + '</div>'
                        + '<div class="chat-bubble-user" style="max-width:100%;padding:var(--chat-msg-padding,8px 12px);font-size:inherit;color:var(--ng2)">'
                        + (uCollapsed
                            ? '<div class="chat-collapsed-preview">' + this.renderUserContent(msg.content.slice(0, 200)) + '</div>'
                              + '<div class="chat-expand-btn" onclick="event.stopPropagation();window._app.toggleMsgCollapse(\'' + tab.tab_id + '\',' + i + ')">&#x25BC; EXPAND (' + uChars + ' chars)</div>'
                            : this.renderUserContent(msg.content || ''))
                        + '</div></div></div>';
                    i++;
                } else if (msg.role === 'assistant' || msg.role === 'tool') {
                    // Collect all consecutive assistant/tool messages into a group
                    const groupStart = i;
                    const groupParts = []; // { type: 'assistant'|'tool', msg, idx, toolGroup? }
                    while (i < msgs.length && (msgs[i].role === 'assistant' || msgs[i].role === 'tool')) {
                        if (msgs[i].role === 'assistant') {
                            groupParts.push({ type: 'assistant', msg: msgs[i], idx: i });
                            i++;
                        } else {
                            const toolGroup = [];
                            const toolStart = i;
                            while (i < msgs.length && msgs[i].role === 'tool') { toolGroup.push(msgs[i]); i++; }
                            groupParts.push({ type: 'tool', toolGroup, idx: toolStart });
                        }
                    }
                    // Render group parts
                    let groupHtml = '';
                    for (const part of groupParts) {
                        if (part.type === 'assistant') {
                            groupHtml += renderAssistantMsg(part.msg, part.idx, tab);
                        } else {
                            groupHtml += renderToolGroup(part.toolGroup, part.idx);
                        }
                    }
                    // Wrap in .msg-group if multiple parts
                    if (groupParts.length > 1) {
                        html += '<div class="msg-group">' + groupHtml + '</div>';
                    } else {
                        html += groupHtml;
                    }
                } else {
                    i++;
                }
            }
            if (tab.is_streaming) {
                const lastMsg = msgs[msgs.length - 1];
                const hasContent = lastMsg && lastMsg.role === 'assistant' && lastMsg.content && lastMsg.content.trim().length > 0;
                if (!hasContent) {
                    // Show thinking buffer if available, otherwise show typing indicator
                    const thinkingBuf = tab._thinkingBuffer || '';
                    const showThinking = this.settings.showThinking !== false;
                    let thinkingIndicatorHtml = '';
                    if (thinkingBuf.trim()) {
                        const thinkPreview = thinkingBuf.length > 200 ? thinkingBuf.slice(-200) : thinkingBuf;
                        thinkingIndicatorHtml = '<div class="thinking-block" style="margin-bottom:4px">'
                            + '<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid var(--v-dim);background:var(--thinking-bg);font-size:0.625rem;letter-spacing:0.1em;color:var(--v3)">'
                            + '<span class="thinking-spinner" style="width:10px;height:10px"></span>'
                            + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--amber);flex-shrink:0"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5.1 7.5l.9-1.8A6 6 0 0 1 6 10a6 6 0 1 1 12 0c0 1.5-.5 2.8-1.4 3.9l-1.4-1.4c.6-.7.8-1.5.8-2.5 0-2.2-1.8-4-4-4S8 7.8 8 10s1.8 4 4 4c.7 0 1.3-.2 1.9-.5l1.2 1.5A5.8 5.8 0 0 1 12 16a6 6 0 0 1-6-6 8 8 0 0 0 6 8z"/></svg>'
                            + '<span style="color:var(--amber);font-weight:bold;letter-spacing:0.12em">THINKING</span>'
                            + '<span style="color:var(--v3);opacity:0.6;font-size:0.5625rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + this.escHtml(thinkPreview.slice(-80)) + '</span>'
                            + '</div>'
                            + (showThinking ? '<div style="border:1px solid var(--v-dim);border-top:none;background:var(--thinking-content-bg);padding:6px 10px;font-size:0.75rem;color:var(--ng3);line-height:1.6;font-style:italic;max-height:200px;overflow-y:auto">' + this.escHtml(thinkPreview).replace(/\n/g, '<br>') + '</div>' : '')
                            + '</div>';
                    }
                    html += '<div class="chat-msg-fadein chat-msg-row">'
                        + '<div class="chat-avatar chat-avatar-asst">' + avatarAsst + '</div>'
                        + '<div class="chat-body">'
                        + '<div class="chat-role chat-role-assistant">CLAUDE_</div>'
                        + thinkingIndicatorHtml
                        + (!thinkingBuf.trim() ? '<div class="thinking-streaming-indicator">'
                        + '<span class="tsi-label">THINKING</span>'
                        + '<span class="tsi-dots"><span></span><span></span><span></span></span>'
                        + '</div>' : '')
                        + '</div></div>';
                } else {
                    html += '<div class="chat-msg-row" style="opacity:0.6">'
                        + '<div class="chat-avatar chat-avatar-asst" style="opacity:0.3">' + avatarAsst + '</div>'
                        + '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">'
                        + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--cyan);animation:breathe 1.2s ease-in-out infinite"></span>'
                        + '<span style="font-size:0.5625rem;color:var(--cyan);letter-spacing:0.1em">STREAMING_</span>'
                        + '<span class="typing-dots" style="opacity:0.5"><span></span><span></span><span></span></span>'
                        + '</div></div>';
                }
            }
            return html;
        },

        // ========== CHAT: KEYBOARD NAVIGATION (j/k) ==========
        chatNavFocus(direction) {
            const tab = this.activeTab;
            if (!tab) return;
            const tabId = tab.tab_id;
            // If switching tabs, reset
            if (this._chatNavTabId !== tabId) {
                this._chatNavTabId = tabId;
                this._chatNavIdx = -1;
            }
            const container = document.getElementById('chat-messages-' + tabId);
            if (!container) return;
            const msgs = container.querySelectorAll('.msg-wrap');
            if (msgs.length === 0) return;
            // Remove current focus
            if (this._chatNavIdx >= 0 && this._chatNavIdx < msgs.length) {
                msgs[this._chatNavIdx].classList.remove('msg-focused');
            }
            if (direction === 0) {
                // Clear focus
                this._chatNavIdx = -1;
                return;
            }
            // Find next/prev
            let newIdx = this._chatNavIdx + direction;
            // Clamp
            if (newIdx < 0) newIdx = 0;
            if (newIdx >= msgs.length) newIdx = msgs.length - 1;
            this._chatNavIdx = newIdx;
            msgs[newIdx].classList.add('msg-focused');
            msgs[newIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        },

        chatNavClear() {
            if (this._chatNavIdx >= 0) {
                const container = document.getElementById('chat-messages-' + this._chatNavTabId);
                if (container) {
                    const msgs = container.querySelectorAll('.msg-wrap');
                    if (this._chatNavIdx < msgs.length) {
                        msgs[this._chatNavIdx].classList.remove('msg-focused');
                    }
                }
            }
            this._chatNavIdx = -1;
        },

        chatNavAction(action) {
            const idx = this._chatNavIdx;
            const tabId = this._chatNavTabId;
            if (idx < 0 || !tabId) return;
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab) return;
            switch (action) {
                case 'copy': this.copyChatMsg(tabId, idx); break;
                case 'quote': this.quoteMessage(tabId, idx); break;
                case 'fold': this.toggleMsgCollapse(tabId, idx); break;
                case 'del': this.deleteChatMsg(tabId, idx); break;
                case 'pin': this.togglePinMessage(tabId, idx); break;
                case 'edit': this.editUserMsg(tabId, idx); break;
            }
        },

        // ========== CHAT: SEARCH (Ctrl+F) ==========
        openChatSearch() {
            this.chatSearch.show = true;
            this.chatSearch.query = '';
            this.chatSearch.total = 0;
            this.chatSearch.current = 0;
            this.chatSearch._elements = [];
            this.$nextTick(() => {
                const inp = document.getElementById('chat-search-input');
                if (inp) inp.focus();
            });
        },
        closeChatSearch() {
            this.chatSearch.show = false;
            this.chatSearch.query = '';
            this.chatSearch.total = 0;
            this.chatSearch.current = 0;
            this.chatSearch._elements = [];
            document.querySelectorAll('.chat-search-hl').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            });
        },
        executeChatSearch() {
            const tab = this.activeTab;
            if (!tab || !this.chatSearch.query.trim()) {
                this.chatSearch.total = 0; this.chatSearch.current = 0; this.chatSearch._elements = [];
                document.querySelectorAll('.chat-search-hl').forEach(el => {
                    const parent = el.parentNode;
                    parent.replaceChild(document.createTextNode(el.textContent), el);
                    parent.normalize();
                });
                return;
            }
            document.querySelectorAll('.chat-search-hl').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            });
            const query = this.chatSearch.query.trim();
            const flags = 'gi';
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escaped, flags);
            const container = document.getElementById('chat-messages-' + tab.tab_id);
            if (!container) return;
            const matches = [];
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (node.parentElement.closest('.chat-search-bar, .msg-actions, button, textarea, input')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (re.test(node.textContent)) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            });
            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);
            for (const node of textNodes) {
                const text = node.textContent;
                const newRe = new RegExp(escaped, flags);
                let match;
                let lastIndex = 0;
                const fragment = document.createDocumentFragment();
                let hasMatch = false;
                while ((match = newRe.exec(text)) !== null) {
                    hasMatch = true;
                    if (match.index > lastIndex) { fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index))); }
                    const span = document.createElement('span');
                    span.className = 'chat-search-hl';
                    span.textContent = match[0];
                    matches.push(span);
                    fragment.appendChild(span);
                    lastIndex = newRe.lastIndex;
                    if (match[0].length === 0) newRe.lastIndex++;
                }
                if (hasMatch) {
                    if (lastIndex < text.length) { fragment.appendChild(document.createTextNode(text.slice(lastIndex))); }
                    node.parentNode.replaceChild(fragment, node);
                }
            }
            this.chatSearch._elements = matches;
            this.chatSearch.total = matches.length;
            this.chatSearch.current = matches.length > 0 ? 1 : 0;
            if (matches.length > 0) this.scrollToChatMatch(0);
        },
        navigateChatMatch(dir) {
            const els = this.chatSearch._elements;
            if (els.length === 0) return;
            els.forEach(el => el.classList.remove('chat-search-hl-current'));
            let idx = this.chatSearch.current - 1 + dir;
            if (idx >= els.length) idx = 0;
            if (idx < 0) idx = els.length - 1;
            this.chatSearch.current = idx + 1;
            els[idx].classList.add('chat-search-hl-current');
            this.scrollToChatMatch(idx);
        },
        scrollToChatMatch(idx) {
            const el = this.chatSearch._elements[idx];
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },

        // ========== CHAT: SCROLL PRESERVATION ==========
        _setupScrollPreservation(tab) {
            this.$nextTick(() => {
                const el = document.getElementById('chat-messages-' + tab.tab_id);
                if (!el || tab._scrollPreservationSetup) return;
                tab._scrollPreservationSetup = true;
                let lastHeight = el.scrollHeight;
                const observer = new MutationObserver(() => {
                    if (el.scrollHeight === lastHeight) return;
                    lastHeight = el.scrollHeight;
                    if (tab.scrolledUp && tab._distFromBottom > 50) {
                        const target = el.scrollHeight - tab._distFromBottom - el.clientHeight;
                        if (target > 0) el.scrollTop = target;
                    }
                });
                observer.observe(el, { childList: true, subtree: true });
                tab._scrollObserver = observer;
            });
        },
        // ========== CHAT: SCROLL & CLICK ==========
        // ========== CHAT: USER CONTENT RENDERING (images) ==========
        renderUserContent(text) {
            if (!text) return '';
            // Escape HTML first
            const escaped = this.escHtml(text);
            // Convert image markdown ![name](url) to <img> tags with lightbox
            return escaped.replace(
                /!\[([^\]]*)\]\((data:[^)]+|https?:\/\/[^)]+)\)/g,
                (match, alt, src) => {
                    const safeSrc = this.escHtml(src);
                    const safeAlt = this.escHtml(alt || 'image');
                    return '<div class="chat-embed-img" onclick="event.stopPropagation();window._app.openLightbox(\'' + safeSrc.replace(/'/g, "\\'") + '\',\'' + safeAlt.replace(/'/g, "\\'") + '\')">'
                        + '<img src="' + safeSrc + '" alt="' + safeAlt + '" class="chat-user-img" loading="lazy">'
                        + '<div class="chat-img-overlay"><span>&#x1f50d; VIEW</span></div>'
                        + '</div>';
                }
            );
        },

        openLightbox(src, alt) {
            this.lightbox = { show: true, src: src || '', alt: alt || '' };
        },
        closeLightbox() {
            this.lightbox = { show: false, src: '', alt: '' };
        },

        onChatClick(event) {
            if (event.target.tagName === 'A') { event.target.target = '_blank'; }
        },
        onChatContextMenu(tab, event) {
            const msgWrap = event.target.closest('[data-msg-idx]');
            if (!msgWrap) return;
            const msgIdx = parseInt(msgWrap.getAttribute('data-msg-idx'), 10);
            if (isNaN(msgIdx) || msgIdx < 0 || msgIdx >= tab.messages.length) return;
            this.openContextMenu(tab, event, msgIdx);
        },
        onChatScroll(tab, event) {
            const el = event.target;
            tab._distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            tab.scrolledUp = tab._distFromBottom > 100;
        },
        smartScroll(tab) {
            if (!tab.scrolledUp) {
                const el = document.getElementById('chat-messages-' + tab.tab_id);
                if (el) el.scrollTop = el.scrollHeight;
            }
        },
        scrollToBottom(tab) {
            const el = document.getElementById('chat-messages-' + tab.tab_id);
            if (el) el.scrollTop = el.scrollHeight;
            tab.scrolledUp = false;
            tab._distFromBottom = 0;
        },

        // ========== CHAT: MESSAGE ACTIONS ==========
        copyChatMsg(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            const content = tab.messages[msgIdx].content || '';
            navigator.clipboard.writeText(content).then(() => { this.showToast('Copied to clipboard'); }).catch(() => { });
        },
        editUserMsg(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || tab.is_streaming) return;
            const msg = tab.messages[msgIdx];
            if (!msg || msg.role !== 'user') return;
            const content = msg.content || '';
            // Save original messages for cancel
            tab._editMode = {
                msgIdx: msgIdx,
                originalMessages: tab.messages.slice(),
                originalContent: content,
            };
            tab.messages = tab.messages.slice(0, msgIdx);
            tab.input_text = content;
            this.chatTick++;
            this.$nextTick(() => {
                const textarea = document.querySelector('#chat-messages-' + tabId)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (textarea) { textarea.focus(); textarea.setSelectionRange(content.length, content.length); }
                this.resizeInputForTab(tab);
            });
        },

        cancelEditMode(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab._editMode) return;
            // Restore original messages
            tab.messages = tab._editMode.originalMessages;
            tab.input_text = '';
            tab._editMode = null;
            this.chatTick++;
            this.$nextTick(() => this.resizeInputForTab(tab));
        },

        isInEditMode(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            return tab && !!tab._editMode;
        },
        regenerateResponse(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || tab.is_streaming) return;
            let lastUserIdx = -1;
            for (let j = tab.messages.length - 1; j >= 0; j--) {
                if (tab.messages[j].role === 'user') { lastUserIdx = j; break; }
            }
            if (lastUserIdx === -1) {
                this.showToast('No user message to regenerate from', 'error');
                return;
            }
            // Save for undo
            tab._editMode = {
                msgIdx: lastUserIdx,
                originalMessages: tab.messages.slice(),
                originalContent: tab.messages[lastUserIdx].content,
            };
            tab.messages = tab.messages.slice(0, lastUserIdx + 1);
            // Show regenerating indicator
            tab.messages.push({ role: 'assistant', content: '_Regenerating..._', ts: Date.now(), is_regenerating: true });
            tab.is_streaming = true;
            this.chatTick++;
            const ws = this.chatWs[tabId];
            if (ws && ws.readyState === WebSocket.OPEN) {
                const regenContent = this._buildFeedbackPrefix(tab) + tab.messages[lastUserIdx].content;
                ws.send(JSON.stringify({ type: 'message', content: regenContent }));
                this.showToast('Regenerating response...', 'success');
            } else {
                // Remove regenerating indicator and restore
                tab.messages = tab._editMode.originalMessages;
                tab._editMode = null;
                tab.is_streaming = false;
                this.chatTick++;
                this.showToast('Cannot regenerate: session not connected', 'error');
            }
        },
        deleteChatMsg(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            tab.messages.splice(msgIdx, 1);
            this.chatTick++;
        },
        quoteMessage(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            const msg = tab.messages[msgIdx];
            if (!msg.content) return;
            // Take first 3 lines or 300 chars for quote
            const lines = msg.content.split('\n').slice(0, 3);
            let quote = lines.join('\n');
            if (quote.length > 300) quote = quote.slice(0, 300) + '...';
            const role = msg.role === 'user' ? 'USER' : msg.role === 'assistant' ? 'CLAUDE' : 'TOOL';
            tab._quotedMsg = { role: role, text: quote };
            tab.input_text = '';
            this.chatTick++;
            this.$nextTick(() => {
                const textarea = document.querySelector('#chat-messages-' + tabId)?.closest('.flex.flex-col')?.querySelector('textarea');
                if (textarea) textarea.focus();
                this.resizeInputForTab(tab);
            });
        },
        clearQuote(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (tab) { tab._quotedMsg = null; this.chatTick++; }
        },
        toggleReaction(tabId, msgIdx, type) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            const msg = tab.messages[msgIdx];
            // Toggle: if same reaction, remove it; otherwise set new
            const wasReaction = msg.reaction;
            msg.reaction = (wasReaction === type) ? '' : type;
            // Queue feedback for agent context (only when setting, not clearing)
            if (msg.reaction && !wasReaction) {
                this._queueReactionFeedback(tab, msgIdx, msg.reaction, msg.content);
            } else if (!msg.reaction && wasReaction) {
                // Remove from pending queue
                tab._pendingFeedback = tab._pendingFeedback.filter(f => f.msgIdx !== msgIdx);
            }
            this.chatTick++;
            // Cat reaction to user feedback
            if (window.CatModule && CatModule.isActive()) {
                if (type === 'up') {
                    CatModule.setExpression('happy');
                    CatModule.setSpeechText('Рад, что помогло! =^_^=', 3000);
                    setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 3000);
                } else if (type === 'down') {
                    CatModule.setExpression('angry');
                    CatModule.setSpeechText('Попробуй REGEN или переформулируй_ Мяу!', 4000);
                    setTimeout(() => { if (CatModule.isActive()) CatModule.setExpression('neutral'); }, 4000);
                }
            }
        },
        _queueReactionFeedback(tab, msgIdx, reaction, content) {
            if (!tab._pendingFeedback) tab._pendingFeedback = [];
            // Don't duplicate if same msgIdx already queued
            if (tab._pendingFeedback.some(f => f.msgIdx === msgIdx)) return;
            const snippet = (content || '').replace(/\n/g, ' ').slice(0, 80);
            tab._pendingFeedback.push({ msgIdx, reaction, snippet });
            this.showToast(reaction === 'up' ? 'FEEDBACK QUEUED: helpful' : 'FEEDBACK QUEUED: not helpful', 'info');
        },
        _buildFeedbackPrefix(tab) {
            if (!tab._pendingFeedback || tab._pendingFeedback.length === 0) return '';
            const lines = tab._pendingFeedback.map(f => {
                const label = f.reaction === 'up' ? 'helpful' : 'not helpful — please adjust your approach';
                return `[User feedback on a previous response (${label})]`;
            });
            tab._pendingFeedback = [];
            return lines.join('\n') + '\n\n';
        },
        toggleMsgCollapse(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            tab.messages[msgIdx].collapsed = !tab.messages[msgIdx].collapsed;
            this.chatTick++;
        },

        // ========== CHAT: PIN MESSAGES ==========
        togglePinMessage(tabId, msgIdx) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            const msg = tab.messages[msgIdx];
            const existingIdx = this.pinnedMessages.findIndex(p => p.tabId === tabId && p.msgIdx === msgIdx);
            if (existingIdx >= 0) {
                this.pinnedMessages.splice(existingIdx, 1);
                this.showToast('UNPINNED');
            } else {
                // Limit to 20 pins total
                if (this.pinnedMessages.length >= 20) {
                    this.pinnedMessages.shift();
                }
                const content = msg.content || '';
                const preview = content.length > 120 ? content.slice(0, 120) + '...' : content;
                this.pinnedMessages.push({
                    tabId: tabId,
                    tabLabel: tab.label || tab.project_path,
                    msgIdx: msgIdx,
                    role: msg.role,
                    preview: preview,
                    ts: msg.ts || Date.now(),
                });
                this.showToast('PINNED');
            }
            this.chatTick++;
            this._scheduleChatSave();
        },
        unpinMessage(idx) {
            if (idx >= 0 && idx < this.pinnedMessages.length) {
                this.pinnedMessages.splice(idx, 1);
                this.chatTick++;
                this._scheduleChatSave();
            }
        },
        reactToMessage(tabId, msgIdx, reaction) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab.messages[msgIdx]) return;
            const msg = tab.messages[msgIdx];
            const wasReaction = msg.reaction;
            // Toggle: if same reaction, clear it
            if (wasReaction === reaction) {
                msg.reaction = null;
                // Remove from pending queue
                tab._pendingFeedback = tab._pendingFeedback.filter(f => f.msgIdx !== msgIdx);
            } else {
                msg.reaction = reaction;
                // Queue feedback for agent context
                this._queueReactionFeedback(tab, msgIdx, reaction, msg.content);
            }
            this.chatTick++;
            this._scheduleChatSave();
        },
        scrollToPin(pin) {
            // Switch to the correct tab first
            if (pin.tabId !== this.activeChatTab) {
                this.activateChatTab(pin.tabId);
            }
            this.$nextTick(() => {
                const el = document.getElementById('chat-messages-' + pin.tabId);
                if (!el) return;
                // Find the message element by index — messages are rendered in order
                const msgWraps = el.querySelectorAll('.msg-wrap.chat-msg-row');
                if (msgWraps[pin.msgIdx]) {
                    msgWraps[pin.msgIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Brief highlight
                    msgWraps[pin.msgIdx].classList.add('pin-highlight');
                    setTimeout(() => msgWraps[pin.msgIdx].classList.remove('pin-highlight'), 1500);
                }
            });
        },
        clearAllPins() {
            this.pinnedMessages = [];
            this.chatTick++;
            this.showToast('ALL PINS CLEARED');
        },
        getActiveTabPins() {
            const tabId = this.activeChatTab;
            if (!tabId) return [];
            return this.pinnedMessages.filter(p => p.tabId === tabId);
        },
        collapseAllMessages() {
            const tab = this.activeTab;
            if (!tab) return;
            for (const msg of tab.messages) {
                if (msg.content && msg.content.length > 500 && msg.role !== 'tool' && !msg.is_streaming) {
                    msg.collapsed = true;
                }
            }
            this.chatTick++;
        },
        expandAllMessages() {
            const tab = this.activeTab;
            if (!tab) return;
            for (const msg of tab.messages) { msg.collapsed = false; }
            this.chatTick++;
        },

        // ========== CHAT: BOTTOM PANEL ==========
        toggleBottomPanel(panel) {
            this.chatBottomPanel = this.chatBottomPanel === panel ? 'closed' : panel;
            this.chatTick++;
        },
        getBottomPanelLog() {
            const tab = this.activeTab;
            if (!tab || !tab.messages) return [];
            const log = [];
            const icons = { read: '📖', edit: '✏️', write: '💾', bash: '⌨️', search: '🔍', other: '⚙️' };
            const colors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            const labels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'TOOL' };
            for (const msg of tab.messages) {
                if (msg.role === 'tool') {
                    const tt = msg.toolType || 'other';
                    log.push({ time: this.fmtTime(msg.ts) || '--:--', type: labels[tt] || 'TOOL', color: colors[tt] || colors.other, detail: msg.toolDetail || msg.content || '(no output)' });
                }
            }
            return log;
        },
        getToolSummary() {
            const tab = this.activeTab;
            if (!tab || !tab.messages) return [];
            const icons = { read: '📖', edit: '✏️', write: '💾', bash: '⌨️', search: '🔍', other: '⚙️' };
            const colors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            const labels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'TOOL' };
            const counts = {};
            const details = {};
            for (const msg of tab.messages) {
                if (msg.role === 'tool') {
                    const tt = msg.toolType || 'other';
                    const k = labels[tt] || 'TOOL';
                    counts[k] = (counts[k] || 0) + 1;
                    if (!details[k]) details[k] = [];
                    const d = msg.toolDetail || msg.content || '';
                    if (d && details[k].length < 3) details[k].push(d);
                }
            }
            return Object.entries(counts).map(([k, count]) => ({
                icon: icons[Object.keys(labels).find(l => labels[l] === k) || 'other'] || icons.other,
                label: k, count,
                color: colors[Object.keys(labels).find(l => labels[l] === k) || 'other'] || colors.other,
                detail: (details[k] || []).join(' | '),
            })).sort((a, b) => b.count - a.count);
        },
        clearBottomPanelLog() {
            const tab = this.activeTab;
            if (!tab) return;
            tab.messages = tab.messages.filter(m => m.role !== 'tool');
            this.chatTick++;
            this.showToast('TOOL_LOG_CLEARED');
        },
        clearActiveChat() {
            const tab = this.activeTab;
            if (!tab) return;
            tab.messages = [];
            this.chatTick++;
            this._scheduleChatSave();
            this.showToast('CHAT_CLEARED');
        },
        exportActiveChat() {
            const tab = this.activeTab;
            if (!tab || !tab.messages.length) { this.showToast('NOTHING_TO_EXPORT', 'error'); return; }
            let md = '# Chat Export: ' + (tab.label || tab.project_path || 'session') + '\n\n';
            md += '_Exported: ' + new Date().toISOString() + '_\n\n---\n\n';
            for (const msg of tab.messages) {
                if (msg.role === 'user') { md += '## User\n\n' + (msg.content || '') + '\n\n'; }
                else if (msg.role === 'assistant') {
                    let meta = '';
                    if (msg.duration) meta += ' ⏱ ' + this.fmtDuration(msg.duration);
                    if (msg.msgTokens?.cost > 0) meta += ' 💰 $' + msg.msgTokens.cost.toFixed(4);
                    if (msg.reaction === 'up') meta += ' 👍';
                    else if (msg.reaction === 'down') meta += ' 👎';
                    md += '## Claude' + meta + '\n\n' + (msg.content || '') + '\n\n';
                }
                else if (msg.role === 'tool') {
                    const label = { read: 'Read', edit: 'Edit', write: 'Write', bash: 'Bash', search: 'Search', other: 'Tool' }[msg.toolType || 'other'] || 'Tool';
                    md += '> **[' + label + ']** ' + (msg.toolDetail || msg.content || '') + '\n>\n';
                }
            }
            const blob = new Blob([md], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat-export-' + (tab.label || 'session').replace(/[^a-z0-9]/gi, '-') + '.md';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('CHAT_EXPORTED');
        },
        startPanelResize(e) {
            e.preventDefault();
            this._panelResizing = true;
            const startY = e.clientY;
            const startH = this.chatBottomPanelHeight;
            const onMove = (ev) => { this.chatBottomPanelHeight = Math.max(80, Math.min(400, startH + (startY - ev.clientY))); };
            const onUp = () => {
                this._panelResizing = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        },

        // ========== SESSION PICKER ==========
        async showSessionPicker() {
            this.sessionPickerSearch = '';
            this.showSessionPickerModal = true;
            try {
                const data = await this.api('/api/sessions/history');
                this.pastSessions = data.sessions || [];
            } catch (e) { this.showToast('FAILED TO LOAD SESSIONS', 'error'); }
        },
        async resumeSession(session) {
            this.showSessionPickerModal = false;
            await this.createChatTab(session.project_path, session.session_id);
        },

        // ========== CHAT: DURATION FORMATTER ==========
        fmtDuration(ms) {
            if (!ms || ms < 0) return '';
            if (ms < 1000) return ms + 'ms';
            const sec = ms / 1000;
            if (sec < 60) return sec.toFixed(1) + 's';
            const min = Math.floor(sec / 60);
            const rem = (sec % 60).toFixed(0);
            return min + 'm ' + rem + 's';
        },

        // ========== CHAT: CONTEXT MENU (Right-click) ==========
        openContextMenu(tab, event, msgIdx) {
            event.preventDefault();
            event.stopPropagation();
            const msg = tab.messages[msgIdx];
            if (!msg) return;
            const items = [];
            if (msg.role === 'user') {
                items.push({ label: 'COPY', icon: '&#x1f4cb;', action: () => this.copyChatMsg(tab.tab_id, msgIdx) });
                items.push({ label: 'QUOTE', icon: '&#x275d;', action: () => this.quoteMessage(tab.tab_id, msgIdx) });
                if (!tab.is_streaming) {
                    items.push({ label: 'EDIT & RESEND', icon: '&#x270f;', action: () => this.editUserMsg(tab.tab_id, msgIdx) });
                }
                items.push({ sep: true });
                items.push({ label: 'DELETE', icon: '&#x1f5d1;', action: () => this.deleteChatMsg(tab.tab_id, msgIdx), danger: true });
            } else if (msg.role === 'assistant') {
                items.push({ label: 'COPY', icon: '&#x1f4cb;', action: () => this.copyChatMsg(tab.tab_id, msgIdx) });
                items.push({ label: 'QUOTE', icon: '&#x275d;', action: () => this.quoteMessage(tab.tab_id, msgIdx) });
                // Check if this is the last assistant message
                const isLastAsst = !msg.is_streaming && !tab.is_streaming && tab.messages.slice(msgIdx + 1).filter(m => m.role === 'assistant').length === 0;
                if (isLastAsst && !tab.is_streaming) {
                    items.push({ label: 'REGEN', icon: '&#x21bb;', action: () => this.regenerateResponse(tab.tab_id) });
                }
                if (!msg.content?.startsWith('[ERROR]')) {
                    items.push({ label: this.pinnedMessages.some(p => p.tabId === tab.tab_id && p.msgIdx === msgIdx) ? 'UNPIN' : 'PIN', icon: '&#x1f4cc;', action: () => this.togglePinMessage(tab.tab_id, msgIdx) });
                }
                const aFold = !msg.is_streaming && msg.content && msg.content.length > 500;
                if (aFold) {
                    items.push({ label: msg.collapsed ? 'UNFOLD' : 'FOLD', icon: '&#x25BC;', action: () => this.toggleMsgCollapse(tab.tab_id, msgIdx) });
                }
                if (!msg.is_streaming) {
                    items.push({ label: msg.reaction === 'up' ? 'UNDO HELPFUL' : 'HELPFUL', icon: '&#x1f44d;', action: () => this.reactToMessage(tab.tab_id, msgIdx, 'up') });
                    items.push({ label: msg.reaction === 'down' ? 'UNDO UNHELPFUL' : 'NOT HELPFUL', icon: '&#x1f44e;', action: () => this.reactToMessage(tab.tab_id, msgIdx, 'down') });
                }
                items.push({ sep: true });
                items.push({ label: 'DELETE', icon: '&#x1f5d1;', action: () => this.deleteChatMsg(tab.tab_id, msgIdx), danger: true });
            } else if (msg.role === 'tool') {
                const tt = msg.toolType || 'other';
                const fp = msg.toolPath || '';
                if (fp) {
                    items.push({ label: 'COPY PATH', icon: '&#x1f4c1;', action: () => { navigator.clipboard.writeText(fp).then(() => this.showToast('Path copied')); } });
                }
                items.push({ label: 'COPY DETAIL', icon: '&#x1f4cb;', action: () => { navigator.clipboard.writeText(msg.toolDetail || msg.content || '').then(() => this.showToast('Copied')); } });
            }
            if (items.length === 0) return;
            // Position: near cursor, but keep within viewport
            const x = Math.min(event.clientX, window.innerWidth - 220);
            const y = Math.min(event.clientY, window.innerHeight - items.length * 28 - 10);
            this.ctxMenu = { show: true, items, x, y };
            // Close on any click outside
            this.$nextTick(() => {
                const close = (e) => {
                    this.ctxMenu = { show: false, items: [], x: 0, y: 0 };
                    document.removeEventListener('click', close);
                    document.removeEventListener('contextmenu', close);
                };
                setTimeout(() => {
                    document.addEventListener('click', close);
                    document.addEventListener('contextmenu', close);
                }, 10);
            });
        },
        executeContextAction(item) {
            if (item && item.action) item.action();
            this.ctxMenu = { show: false, items: [], x: 0, y: 0 };
        },
        closeContextMenu() {
            this.ctxMenu = { show: false, items: [], x: 0, y: 0 };
        },

        // ========== CHAT: SESSION METRICS ==========
        getSessionDuration(tab) {
            if (!tab || !tab.created_at) return '';
            const ms = Date.now() - new Date(tab.created_at).getTime();
            return this.fmtDuration(ms);
        },
        getToolCount(tab) {
            if (!tab || !tab.messages) return 0;
            return tab.messages.filter(m => m.role === 'tool').length;
        },
        /** Live elapsed time while agent is streaming (updates via _clockTick). */
        getStreamingElapsed(tab) {
            if (!tab || !tab._msgStartTime) return '';
            const ms = Date.now() - tab._msgStartTime;
            return this.fmtDuration(ms);
        },
        /** Format token info for a single message. */
        getMsgTokenMeta(msg) {
            if (!msg || !msg.msgTokens) return '';
            const t = msg.msgTokens;
            let parts = [];
            if (t.output > 0) parts.push((t.output / 1000).toFixed(1) + 'K out');
            if (t.cost > 0) parts.push('$' + t.cost.toFixed(4));
            return parts.join(' · ');
        },
        /** Turns per minute throughput for a tab. */
        getThroughput(tab) {
            if (!tab || !tab.created_at) return '0 t/min';
            const ms = Date.now() - new Date(tab.created_at).getTime();
            const minutes = ms / 60000;
            if (minutes < 0.5) return '— t/min';
            const turns = (tab.messages || []).filter(m => m.role === 'user').length;
            return turns > 0 ? (turns / minutes).toFixed(1) + ' t/min' : '0 t/min';
        },

        // ========== CHAT: SESSION STATS PANEL ==========
        getSessionStats(tab) {
            if (!tab || !tab.messages || tab.messages.length === 0) return null;
            const msgs = tab.messages;
            // Message counts
            const userCount = msgs.filter(m => m.role === 'user').length;
            const asstCount = msgs.filter(m => m.role === 'assistant').length;
            const toolCount = msgs.filter(m => m.role === 'tool').length;
            // Turns (user messages = turns)
            const turns = userCount;
            // Tool breakdown
            const toolBreakdown = {};
            const toolLabels = { read: 'READ', edit: 'EDIT', write: 'WRITE', bash: 'BASH', search: 'SEARCH', other: 'OTHER' };
            const toolColors = { read: 'var(--cyan)', edit: 'var(--yellow)', write: 'var(--ng)', bash: 'var(--pink)', search: 'var(--amber)', other: 'var(--v3)' };
            for (const m of msgs) {
                if (m.role === 'tool') {
                    const tt = toolLabels[m.toolType || 'other'] || 'OTHER';
                    toolBreakdown[tt] = (toolBreakdown[tt] || 0) + 1;
                }
            }
            const toolMax = Math.max(1, ...Object.values(toolBreakdown));
            const toolEntries = Object.entries(toolBreakdown).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({
                label, count,
                color: toolColors[Object.keys(toolLabels).find(k => toolLabels[k] === label) || 'other'] || 'var(--v3)',
                pct: Math.round((count / toolMax) * 100),
            }));
            // Response times
            const responseTimesArr = msgs.filter(m => m.role === 'assistant' && m.duration && m.duration > 0).map(m => m.duration);
            const avgResponse = responseTimesArr.length > 0 ? responseTimesArr.reduce((a, b) => a + b, 0) / responseTimesArr.length : 0;
            const maxResponse = responseTimesArr.length > 0 ? Math.max(...responseTimesArr) : 0;
            const minResponse = responseTimesArr.length > 0 ? Math.min(...responseTimesArr) : 0;
            // Token usage
            const totalOutput = msgs.filter(m => m.msgTokens?.output).reduce((s, m) => s + m.msgTokens.output, 0);
            // Per-turn data for sparklines (up to last 20 turns)
            const turnData = [];
            let turnIdx = 0;
            for (const m of msgs) {
                if (m.role === 'user') turnIdx++;
                if (m.role === 'assistant' && (m.duration || m.msgTokens)) {
                    turnData.push({
                        turn: turnIdx,
                        duration: m.duration || 0,
                        tokIn: m.msgTokens?.input || 0,
                        tokOut: m.msgTokens?.output || 0,
                        cost: m.msgTokens?.cost || 0,
                    });
                }
            }
            const recentTurns = turnData.slice(-20);
            // Errors
            const errorCount = msgs.filter(m => m.role === 'assistant' && m.content?.startsWith('[ERROR]')).length;
            // Pinned
            const pinnedCount = this.pinnedMessages.filter(p => p.tabId === tab.tab_id).length;
            // Reactions
            const upCount = msgs.filter(m => m.reaction === 'up').length;
            const downCount = msgs.filter(m => m.reaction === 'down').length;
            // Avg message length (user vs assistant)
            const userMsgs = msgs.filter(m => m.role === 'user');
            const asstMsgs = msgs.filter(m => m.role === 'assistant');
            const avgUserLen = userMsgs.length > 0 ? Math.round(userMsgs.reduce((s, m) => s + (m.content?.length || 0), 0) / userMsgs.length) : 0;
            const avgAsstLen = asstMsgs.length > 0 ? Math.round(asstMsgs.reduce((s, m) => s + (m.content?.length || 0), 0) / asstMsgs.length) : 0;
            // Session start time
            const sessionStart = tab.created_at ? new Date(tab.created_at) : null;
            const sessionStartStr = sessionStart ? String(sessionStart.getHours()).padStart(2, '0') + ':' + String(sessionStart.getMinutes()).padStart(2, '0') : '';
            return {
                total: msgs.length,
                userCount, asstCount, toolCount, turns,
                toolEntries,
                avgResponse, maxResponse, minResponse, responseTimes: responseTimesArr.length,
                tokens: { input: tab.tokens?.input || 0, output: tab.tokens?.output || 0, cost: tab.tokens?.cost || 0, threshold: tab.tokens?.threshold || 180000 },
                totalOutputTokens: totalOutput,
                errorCount, pinnedCount, upCount, downCount,
                duration: this.getSessionDuration(tab),
                avgUserLen, avgAsstLen, sessionStartStr,
                recentTurns, totalTurns: turnData.length,
            };
        },

        // ========== CHAT: SPARKLINE & MINI-CHARTS ==========
        renderResponseSparkline(turns, w, h) {
            if (!turns || turns.length < 2) return '';
            const dur = turns.map(t => t.duration).filter(d => d > 0);
            if (dur.length < 2) return '';
            const maxD = Math.max(...dur);
            const minD = Math.min(...dur);
            const range = maxD - minD || 1;
            const step = w / (dur.length - 1);
            const pad = 2;
            const innerH = h - pad * 2;
            const points = dur.map((d, i) => {
                const x = i * step;
                const y = pad + innerH - ((d - minD) / range) * innerH;
                return x + ',' + y;
            }).join(' ');
            // Area fill
            const areaPoints = '0,' + h + ' ' + points + ' ' + w + ',' + h;
            // Average line
            const avg = dur.reduce((a, b) => a + b, 0) / dur.length;
            const avgY = pad + innerH - ((avg - minD) / range) * innerH;
            return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" class="sparkline-svg">'
                + '<polygon points="' + areaPoints + '" fill="rgba(0,255,255,0.08)" />'
                + '<polyline points="' + points + '" fill="none" stroke="var(--cyan)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
                + '<line x1="0" y1="' + avgY + '" x2="' + w + '" y2="' + avgY + '" stroke="var(--amber)" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6" />'
                + '</svg>';
        },
        renderTokenMiniBars(turns) {
            if (!turns || turns.length === 0) return '';
            const maxTok = Math.max(1, ...turns.map(t => Math.max(t.tokIn, t.tokOut)));
            const barH = 6;
            const gap = 3;
            let html = '<div class="token-mini-chart">';
            for (const t of turns) {
                const inW = Math.max(2, (t.tokIn / maxTok) * 100);
                const outW = Math.max(2, (t.tokOut / maxTok) * 100);
                html += '<div class="token-mini-turn" title="Turn ' + t.turn + ': ' + (t.tokIn / 1000).toFixed(1) + 'K in / ' + (t.tokOut / 1000).toFixed(1) + 'K out">';
                html += '<div class="token-mini-bar token-mini-in" style="height:' + barH + 'px;width:' + inW + '%"></div>';
                html += '<div class="token-mini-bar token-mini-out" style="height:' + barH + 'px;width:' + outW + '%"></div>';
                html += '</div>';
            }
            html += '</div>';
            return html;
        },
        renderCostSparkline(turns, w, h) {
            if (!turns || turns.length < 2) return '';
            const costs = turns.map(t => t.cost).filter(c => c > 0);
            if (costs.length < 2) return '';
            const maxC = Math.max(...costs);
            const minC = Math.min(...costs);
            const range = maxC - minC || 0.0001;
            const step = w / (costs.length - 1);
            const pad = 2;
            const innerH = h - pad * 2;
            const points = costs.map((c, i) => {
                const x = i * step;
                const y = pad + innerH - ((c - minC) / range) * innerH;
                return x + ',' + y;
            }).join(' ');
            const areaPoints = '0,' + h + ' ' + points + ' ' + w + ',' + h;
            return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" class="sparkline-svg">'
                + '<polygon points="' + areaPoints + '" fill="rgba(255,255,0,0.06)" />'
                + '<polyline points="' + points + '" fill="none" stroke="var(--yellow)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
                + '</svg>';
        },

        // ========== CHAT: EXPORT ==========
        exportChatSession(mode) {
            const tab = this.activeTab;
            if (!tab || !tab.messages || tab.messages.length === 0) {
                this.showToast('Нет сообщений для экспорта', 'error');
                return;
            }
            let msgs;
            if (mode === 'pinned') {
                const pinned = this.pinnedMessages.filter(p => p.tabId === tab.tab_id).sort((a, b) => a.msgIdx - b.msgIdx);
                msgs = pinned.map(p => tab.messages[p.msgIdx]).filter(Boolean);
                if (msgs.length === 0) { this.showToast('Нет закреплённых сообщений', 'error'); return; }
            } else if (mode === 'last10') {
                msgs = tab.messages.slice(-10);
            } else {
                msgs = tab.messages;
            }
            const stats = this.getSessionStats(tab);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toTimeString().slice(0, 8);
            let md = '# Chat Export: ' + (tab.label || 'Session') + '\n\n';
            md += '- **Date:** ' + dateStr + ' ' + timeStr + '\n';
            md += '- **Project:** `' + (tab.project_path || 'N/A') + '`\n';
            if (stats) {
                md += '- **Messages:** ' + stats.total + ' (' + stats.userCount + ' user, ' + stats.asstCount + ' assistant)\n';
                md += '- **Duration:** ' + (stats.duration || 'N/A') + '\n';
                if (stats.tokens?.input > 0) {
                    md += '- **Tokens:** ' + (stats.tokens.input / 1000).toFixed(1) + 'K in / ' + (stats.tokens.output / 1000).toFixed(1) + 'K out';
                    if (stats.tokens.cost > 0) md += ' ($' + stats.tokens.cost.toFixed(4) + ')';
                    md += '\n';
                }
            }
            md += '- **Mode:** ' + ({ full: 'Full Session', pinned: 'Pinned Only', last10: 'Last 10 Messages' }[mode] || mode) + '\n\n---\n\n';
            for (const msg of msgs) {
                if (msg.role === 'tool') continue;
                const role = msg.role === 'user' ? '**User**' : '**Claude**';
                const ts = msg.ts ? new Date(msg.ts).toLocaleString('ru-RU') : '';
                md += '### ' + role;
                if (ts) md += ' _' + ts + '_';
                if (msg.reaction) md += ' ' + (msg.reaction === 'up' ? ':thumbsup:' : ':thumbsdown:');
                md += '\n\n';
                md += (msg.content || '').trim() + '\n\n';
            }
            const filename = 'chat-' + (tab.label || 'session') + '-' + dateStr + '.md';
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Экспорт: ' + filename + ' (' + msgs.length + ' msg)');
        },

        // ========== CHAT: LOCALSTORAGE PERSISTENCE ==========
        _CHAT_STORAGE_KEY: 'ar-chat-state',
        _CHAT_STORAGE_VERSION: 1,
        _chatPersistTimer: null,

        _scheduleChatSave() {
            if (this._chatPersistTimer) clearTimeout(this._chatPersistTimer);
            this._chatPersistTimer = setTimeout(() => { this.saveChatState(); }, 1500);
        },

        saveChatState() {
            try {
                const MAX_MSGS_PER_TAB = 150;
                const MAX_CONTENT_LEN = 20000;
                const MAX_TABS = 5;
                const tabs = this.chatTabs.slice(-MAX_TABS).map(tab => {
                    // Save messages (skip tool messages, strip thinking, truncate content)
                    const msgs = tab.messages
                        .filter(m => m.role !== 'tool')
                        .slice(-MAX_MSGS_PER_TAB)
                        .map(m => {
                            const out = {
                                role: m.role,
                                content: (m.content || '').slice(0, MAX_CONTENT_LEN),
                                ts: m.ts,
                                reaction: m.reaction || null,
                                duration: m.duration || null,
                                msgTokens: m.msgTokens ? { input: m.msgTokens.input, output: m.msgTokens.output, cost: m.msgTokens.cost } : null,
                            };
                            return out;
                        });
                    return {
                        tab_id: tab.tab_id,
                        session_id: tab.session_id,
                        project_path: tab.project_path,
                        label: tab.label,
                        created_at: tab.created_at,
                        tokens: tab.tokens ? { input: tab.tokens.input || 0, output: tab.tokens.output || 0, cost: tab.tokens.cost || 0 } : null,
                        messages: msgs,
                    };
                });
                const pinned = this.pinnedMessages.map(p => ({
                    tabId: p.tabId, msgIdx: p.msgIdx, role: p.role,
                    preview: (p.preview || '').slice(0, 200), ts: p.ts, content: (p.content || '').slice(0, 5000),
                }));
                const data = {
                    v: this._CHAT_STORAGE_VERSION,
                    ts: Date.now(),
                    activeTabId: this.activeChatTab,
                    tabs: tabs,
                    pinned: pinned,
                };
                localStorage.setItem(this._CHAT_STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
                // localStorage full or unavailable — silently ignore
                if (e.name === 'QuotaExceededError') {
                    console.warn('[chat] localStorage quota exceeded, clearing old chat state');
                    try { localStorage.removeItem(this._CHAT_STORAGE_KEY); } catch (_) {}
                }
            }
        },

        restoreChatState() {
            try {
                const raw = localStorage.getItem(this._CHAT_STORAGE_KEY);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (!data || data.v !== this._CHAT_STORAGE_VERSION) {
                    localStorage.removeItem(this._CHAT_STORAGE_KEY);
                    return;
                }
                // Don't restore if older than 24 hours
                if (Date.now() - data.ts > 24 * 60 * 60 * 1000) {
                    localStorage.removeItem(this._CHAT_STORAGE_KEY);
                    return;
                }
                if (!data.tabs || data.tabs.length === 0) return;
                // Restore tabs as "restored" (disconnected, messages visible)
                for (const saved of data.tabs) {
                    const tab = {
                        tab_id: saved.tab_id,
                        session_id: saved.session_id,
                        project_path: saved.project_path,
                        label: saved.label || 'Session',
                        messages: (saved.messages || []).map(m => ({
                            ...m,
                            is_streaming: false,
                        })),
                        is_active: false,
                        is_streaming: false,
                        is_thinking: false,
                        ws_state: 'restored',
                        input_text: '',
                        scrolledUp: false,
                        created_at: saved.created_at || new Date().toISOString(),
                        tokens: saved.tokens || { input: 0, output: 0, cost: 0, threshold: 180000 },
                        _msgHistory: [],
                        _msgHistoryIdx: -1,
                        _msgDraft: '',
                        _attachments: [],
                        _pendingFeedback: [],
                        _unread: 0,
                        _agentDone: false,
                        _restored: true,
                        _restoredSessionId: saved.session_id,
                    };
                    this.chatTabs.push(tab);
                }
                // Restore pinned messages (adjust tabId references)
                if (data.pinned) {
                    const tabIds = new Set(this.chatTabs.map(t => t.tab_id));
                    this.pinnedMessages = data.pinned.filter(p => tabIds.has(p.tabId));
                }
                // Activate last active tab or the first restored one
                if (data.activeTabId && this.chatTabs.find(t => t.tab_id === data.activeTabId)) {
                    this.activeChatTab = data.activeTabId;
                } else if (this.chatTabs.length > 0) {
                    this.activeChatTab = this.chatTabs[this.chatTabs.length - 1].tab_id;
                }
                this.showToast('SESSIONS_RESTORED (' + this.chatTabs.length + ')', 'success');
                console.log('[chat] restored', this.chatTabs.length, 'tabs from localStorage');
            } catch (e) {
                console.error('[chat] restoreChatState failed:', e);
                localStorage.removeItem(this._CHAT_STORAGE_KEY);
            }
        },

        async reconnectTab(tabId) {
            const tab = this.chatTabs.find(t => t.tab_id === tabId);
            if (!tab || !tab._restored) return;
            const projectPath = tab.project_path;
            const resumeId = tab._restoredSessionId || tab.session_id;
            console.log('[chat] reconnecting tab', tabId, 'path:', projectPath, 'resume:', resumeId);
            try {
                const res = await this.api('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cwd: projectPath, resume: resumeId || null }),
                });
                if (res.warning) this.showToast(res.warning, 'error');
                if (!res.session_id) { this.showToast('RECONNECT_FAILED', 'error'); return; }
                // Update tab with new session info
                tab.session_id = res.session_id;
                tab.ws_state = 'connecting';
                tab._restored = false;
                tab._restoredSessionId = null;
                this.connectChatWebSocket(tab);
                this._scheduleChatSave();
                this.showToast('SESSION_RECONNECTED', 'success');
            } catch (e) {
                console.error('[chat] reconnectTab failed:', e);
                this.showToast('RECONNECT_FAILED: ' + e.message, 'error');
            }
        },
    };
})();
