/**
 * file-browser.js — Alpine.js directory browser component for new chat tab dialog.
 *
 * Provides a tree-style file system browser that fetches directory listings
 * from the server and allows the user to select a project directory.
 */

function fileBrowserComponent() {
    return {
        show: false,
        currentPath: '',
        entries: [],
        loading: false,
        error: '',
        selectedPath: '',

        async open(defaultPath) {
            this.show = true;
            this.error = '';
            this.selectedPath = '';
            this.currentPath = defaultPath || '';
            await this.loadDir(this.currentPath);
        },

        close() {
            this.show = false;
        },

        async loadDir(path) {
            if (!path) {
                // Show common starting points
                this.entries = [];
                this.currentPath = '';
                return;
            }
            this.loading = true;
            this.error = '';
            try {
                const resp = await fetch('/api/fs/list?path=' + encodeURIComponent(path));
                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    throw new Error(data.detail || 'Failed to load directory');
                }
                const data = await resp.json();
                this.entries = data.entries || [];
                this.currentPath = path;
            } catch (e) {
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async navigate(entry) {
            if (entry.is_directory) {
                await this.loadDir(entry.path);
            }
        },

        goUp() {
            const parent = this.currentPath.split(/[\\/]/).slice(0, -1).join('/');
            if (parent) {
                this.loadDir(parent);
            }
        },

        select(entry) {
            this.selectedPath = entry.is_directory ? entry.path : '';
        },

        confirm() {
            if (this.selectedPath) {
                this.$dispatch('path-selected', { path: this.selectedPath });
                this.close();
            }
        }
    };
}

// Register as Alpine component
document.addEventListener('alpine:init', () => {
    Alpine.data('fileBrowser', fileBrowserComponent);
});
