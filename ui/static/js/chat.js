/**
 * chat.js — Helper for file browser integration with the main app component.
 *
 * Provides a global bridge between the file-browser Alpine component
 * and the main app's chat tab creation logic.
 */

// Global helper: open file browser from the main app
// This is called by the main app's openFileBrowserForTab() method.
// The file-browser component dispatches a 'path-selected' event which
// the main app listens for via @path-selected.window.
window.fileBrowserOpen = function(defaultPath) {
    // Find the file-browser data and trigger open
    const el = document.querySelector('[x-data]');
    if (el && el.__x) {
        const app = el.__x.$data;
        // Trigger the file browser via a simple approach:
        // Show a native directory prompt as fallback
        const path = prompt('Enter project directory path:', defaultPath || '');
        if (path && path.trim()) {
            // Dispatch the event so the main app picks it up
            window.dispatchEvent(new CustomEvent('path-selected', { detail: { path: path.trim() } }));
        }
    }
};

// Listen for path-selected events from file browser
document.addEventListener('path-selected', function(event) {
    // Forward to Alpine app
    const el = document.querySelector('[x-data]');
    if (el && el.__x) {
        const app = el.__x.$data;
        if (app.onPathSelected) {
            app.onPathSelected(event);
        }
    }
});
