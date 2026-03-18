/**
 * terminal.js — xterm.js initialization and management for chat tabs.
 *
 * Creates and manages Terminal instances per chat tab.
 * Handles CRT theme, WebGL renderer, and tab switching re-fit.
 */

const XTERM_THEME = {
    background: '#1a0a2e',
    foreground: '#e0b0ff',
    cursor: '#b44aff',
    cursorAccent: '#1a0a2e',
    selectionBackground: '#4a2080',
    selectionForeground: '#ffffff',
    black: '#1a0a2e',
    red: '#ff3366',
    green: '#39ff14',
    yellow: '#ffe033',
    blue: '#7c4dff',
    magenta: '#ff00aa',
    cyan: '#00e5ff',
    white: '#e0b0ff',
    brightBlack: '#3a2060',
    brightRed: '#ff6688',
    brightGreen: '#80ff80',
    brightYellow: '#ffff80',
    brightBlue: '#b44aff',
    brightMagenta: '#ff66cc',
    brightCyan: '#80ffff',
    brightWhite: '#ffffff',
};

// Track terminal instances per tab
const _terminals = {};

function createTerminal(container) {
    if (!window.Terminal) {
        console.warn('xterm.js not loaded — falling back to DOM output');
        return null;
    }

    const term = new Terminal({
        theme: XTERM_THEME,
        allowTransparency: true,
        fontFamily: '"Cascadia Code", "Fira Code", "VT323", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        scrollback: 10000,
        convertEol: true,
        cursorBlink: false,
        cursorStyle: 'bar',
    });

    // Load addons if available
    try {
        if (window.FitAddon) {
            const fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term._fitAddon = fitAddon;
        }
        if (window.WebglAddon) {
            term.loadAddon(new WebglAddon.WebglAddon());
        }
    } catch (e) {
        console.warn('xterm.js addon load failed:', e.message);
    }

    term.open(container);

    // Apply fit after a frame to ensure container is rendered
    requestAnimationFrame(() => {
        if (term._fitAddon) {
            try {
                term._fitAddon.fit();
            } catch (e) { /* ignore during init */ }
        }
    });

    return term;
}

function destroyTerminal(tabId) {
    const entry = _terminals[tabId];
    if (entry) {
        if (entry.term) {
            entry.term.dispose();
        }
        delete _terminals[tabId];
    }
}

function getTerminal(tabId) {
    return _terminals[tabId]?.term || null;
}

function refitTerminal(tabId) {
    const entry = _terminals[tabId];
    if (entry?.term?._fitAddon) {
        requestAnimationFrame(() => {
            try {
                entry.term._fitAddon.fit();
            } catch (e) { /* ignore if container hidden */ }
        });
    }
}

function writeTerminal(tabId, data) {
    const term = getTerminal(tabId);
    if (term) {
        term.write(data);
    }
}

function registerTerminal(tabId, term) {
    _terminals[tabId] = { term, created: Date.now() };
}
