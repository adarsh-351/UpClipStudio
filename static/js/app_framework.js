/**
 * UpClip Studio — Unified Application Framework (Phase 20)
 * Centralized Toasts, Modals, Command Palette Registry, Keyboard Shortcut Router,
 * Settings Client, Background Task State Synchronization, and Tooltip System.
 */

// =========================================================================
// 1. CENTRALIZED TOAST NOTIFICATION SYSTEM
// =========================================================================
class ToastManager {
    constructor() {
        this.container = null;
        this._initContainer();
    }

    _initContainer() {
        let el = document.getElementById('upclipToastContainer');
        if (!el) {
            el = document.createElement('div');
            el.id = 'upclipToastContainer';
            el.style.position = 'fixed';
            el.style.bottom = '20px';
            el.style.right = '20px';
            el.style.zIndex = '999999';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.gap = '8px';
            el.style.pointerEvents = 'none';
            document.body.appendChild(el);
        }
        this.container = el;
    }

    show(message, type = 'info', duration = 3500) {
        if (!this.container) this._initContainer();

        const toast = document.createElement('div');
        toast.className = `upclip-toast toast-${type}`;
        toast.style.pointerEvents = 'auto';
        toast.style.minWidth = '240px';
        toast.style.maxWidth = '380px';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = 'var(--radius-sm, 6px)';
        toast.style.fontSize = '12px';
        toast.style.fontWeight = '500';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.45)';
        toast.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';

        let bg = 'var(--surface-2, #1E1E2E)';
        let border = 'var(--border, #2E2E3E)';
        let icon = 'ℹ';
        let textCol = '#FFFFFF';

        if (type === 'success') {
            border = '#10B981';
            icon = '✓';
        } else if (type === 'error') {
            border = '#EF4444';
            icon = '✕';
        } else if (type === 'warning') {
            border = '#F59E0B';
            icon = '⚠';
        }

        toast.style.background = bg;
        toast.style.border = `1px solid ${border}`;
        toast.style.color = textCol;

        toast.innerHTML = `
            <span style="font-weight:700; color:${border};">${icon}</span>
            <span style="flex:1;">${message}</span>
        `;

        this.container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }

    success(msg) { this.show(msg, 'success'); }
    error(msg) { this.show(msg, 'error', 4500); }
    warning(msg) { this.show(msg, 'warning'); }
    info(msg) { this.show(msg, 'info'); }
}

window.UpClipToast = new ToastManager();


// =========================================================================
// 2. CENTRALIZED MODAL & DIALOG SYSTEM
// =========================================================================
class ModalManager {
    constructor() {
        this.activeModal = null;
        this._initEscHandler();
    }

    _initEscHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal-overlay:not([hidden]), .upclip-modal-layer');
                if (openModals.length > 0) {
                    const topModal = openModals[openModals.length - 1];
                    const cancelBtn = topModal.querySelector('#modalCancelBtn, #promptCancelBtn, .modal-close-btn, [data-modal-close]');
                    if (cancelBtn) cancelBtn.click();
                    else topModal.remove();
                }
            }
        });
    }

    confirm({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay upclip-modal-layer';
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'rgba(0,0,0,0.75)';
            overlay.style.backdropFilter = 'blur(4px)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '999990';

            const box = document.createElement('div');
            box.className = 'modal-content';
            box.style.background = 'var(--surface-1, #12121A)';
            box.style.border = '1px solid var(--border, #2E2E3E)';
            box.style.borderRadius = 'var(--radius-md, 10px)';
            box.style.padding = '20px';
            box.style.width = '100%';
            box.style.maxWidth = '400px';
            box.style.boxShadow = '0 12px 30px rgba(0,0,0,0.6)';

            box.innerHTML = `
                <div style="font-size:15px; font-weight:700; margin-bottom:8px; color:var(--text-primary, #FFF);">${title}</div>
                <div style="font-size:13px; color:var(--text-secondary, #A1A1AA); line-height:1.5; margin-bottom:20px;">${message}</div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-secondary btn-sm" id="modalCancelBtn">${cancelText}</button>
                    <button class="btn ${isDestructive ? 'btn-danger' : 'btn-primary'} btn-sm" id="modalConfirmBtn">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                overlay.remove();
                resolve(result);
            };

            box.querySelector('#modalCancelBtn').addEventListener('click', () => cleanup(false));
            box.querySelector('#modalConfirmBtn').addEventListener('click', () => cleanup(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
            box.querySelector('#modalConfirmBtn').focus();
        });
    }

    prompt({ title = "Enter Value", message = "", defaultValue = "", placeholder = "", confirmText = "Save" }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay upclip-modal-layer';
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'rgba(0,0,0,0.75)';
            overlay.style.backdropFilter = 'blur(4px)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '999990';

            const box = document.createElement('div');
            box.style.background = 'var(--surface-1, #12121A)';
            box.style.border = '1px solid var(--border, #2E2E3E)';
            box.style.borderRadius = 'var(--radius-md, 10px)';
            box.style.padding = '20px';
            box.style.width = '100%';
            box.style.maxWidth = '400px';

            box.innerHTML = `
                <div style="font-size:15px; font-weight:700; margin-bottom:8px; color:#FFF;">${title}</div>
                ${message ? `<div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">${message}</div>` : ''}
                <input type="text" id="modalPromptInput" class="input-field" value="${defaultValue}" placeholder="${placeholder}" style="width:100%; margin-bottom:16px; box-sizing:border-box;">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-secondary btn-sm" id="promptCancelBtn">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="promptConfirmBtn">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const input = box.querySelector('#modalPromptInput');
            input.focus();
            input.select();

            const cleanup = (val) => {
                overlay.remove();
                resolve(val);
            };

            box.querySelector('#promptCancelBtn').addEventListener('click', () => cleanup(null));
            box.querySelector('#promptConfirmBtn').addEventListener('click', () => cleanup(input.value.trim()));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') cleanup(input.value.trim());
                if (e.key === 'Escape') cleanup(null);
            });
        });
    }
}

window.UpClipModal = new ModalManager();


// =========================================================================
// 3. CENTRALIZED COMMAND PALETTE & SHORTCUT SYSTEM
// =========================================================================
class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.shortcutMap = new Map();
        this.isOpen = false;
        this._initGlobalShortcuts();
    }

    register(command) {
        // { id, label, category, shortcut, keywords: [], condition: () => true, action: () => {} }
        if (!command.id || !command.label) return;
        this.commands.set(command.id, command);

        if (command.shortcut) {
            const normalized = this._normalizeShortcut(command.shortcut);
            this.shortcutMap.set(normalized, command.id);
        }
    }

    _normalizeShortcut(shortcutStr) {
        return shortcutStr.toLowerCase().replace(/\s+/g, '').split('+').sort().join('+');
    }

    _initGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            // Allow Ctrl+K anywhere to trigger command palette
            if (isCtrl && key === 'k') {
                e.preventDefault();
                this.togglePalette();
                return;
            }

            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.closePalette();
                return;
            }

            // Skip shortcut dispatching if typing in input, textarea, or contentEditable
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            const isEditable = document.activeElement ? document.activeElement.isContentEditable : false;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || isEditable) {
                return;
            }

            // Build active key combo string
            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push('ctrl');
            if (e.shiftKey) parts.push('shift');
            if (e.altKey) parts.push('alt');
            if (key !== 'control' && key !== 'shift' && key !== 'alt') parts.push(key);

            const combo = parts.sort().join('+');
            const cmdId = this.shortcutMap.get(combo);
            if (cmdId) {
                const cmd = this.commands.get(cmdId);
                if (cmd && (!cmd.condition || cmd.condition())) {
                    e.preventDefault();
                    cmd.action();
                }
            }
        });
    }

    search(query = '') {
        const q = query.toLowerCase().trim();
        const available = [];

        this.commands.forEach(cmd => {
            const isCondValid = !cmd.condition || cmd.condition();
            if (!isCondValid) return;

            if (!q) {
                available.push(cmd);
                return;
            }

            const nameMatch = cmd.label.toLowerCase().includes(q);
            const catMatch = (cmd.category || '').toLowerCase().includes(q);
            const keywordMatch = (cmd.keywords || []).some(k => k.toLowerCase().includes(q));

            if (nameMatch || catMatch || keywordMatch) {
                available.push(cmd);
            }
        });

        return available;
    }

    togglePalette() {
        if (this.isOpen) this.closePalette();
        else this.openPalette();
    }

    openPalette() {
        if (this.isOpen) return;
        this.isOpen = true;

        const overlay = document.createElement('div');
        overlay.id = 'upclipCommandPaletteOverlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'flex-start';
        overlay.style.justifyContent = 'center';
        overlay.style.paddingTop = '12vh';
        overlay.style.zIndex = '999999';

        const palette = document.createElement('div');
        palette.className = 'command-palette-card';
        palette.style.background = 'var(--surface-1, #12121A)';
        palette.style.border = '1px solid var(--border, #2E2E3E)';
        palette.style.borderRadius = 'var(--radius-md, 10px)';
        palette.style.width = '100%';
        palette.style.maxWidth = '520px';
        palette.style.boxShadow = '0 16px 40px rgba(0,0,0,0.7)';
        palette.style.overflow = 'hidden';

        palette.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--border, #2E2E3E);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="paletteSearchInput" placeholder="Type a command or search keywords..." style="flex:1; background:transparent; border:none; outline:none; color:#FFF; font-size:13px; font-family:inherit;">
                <span style="font-size:10px; color:var(--text-muted); background:var(--surface-2); padding:2px 6px; border-radius:4px;">ESC to exit</span>
            </div>
            <div id="paletteResultsList" style="max-height:320px; overflow-y:auto; padding:6px 0;"></div>
        `;

        overlay.appendChild(palette);
        document.body.appendChild(overlay);

        const input = palette.querySelector('#paletteSearchInput');
        const resultsList = palette.querySelector('#paletteResultsList');

        const renderResults = (items) => {
            resultsList.innerHTML = '';
            if (items.length === 0) {
                resultsList.innerHTML = `<div style="padding:14px; text-align:center; font-size:12px; color:var(--text-muted);">No matching commands found.</div>`;
                return;
            }

            items.forEach((cmd, idx) => {
                const row = document.createElement('div');
                row.className = `palette-item-row ${idx === 0 ? 'selected' : ''}`;
                row.style.padding = '8px 16px';
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.cursor = 'pointer';
                row.style.fontSize = '12px';
                row.style.color = 'var(--text-primary, #FFF)';
                row.style.transition = 'background 0.1s';

                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:10px; color:var(--primary, #8B5CF6); font-weight:700; text-transform:uppercase; min-width:60px;">${cmd.category || 'General'}</span>
                        <span>${cmd.label}</span>
                    </div>
                    ${cmd.shortcut ? `<span style="font-size:10px; color:var(--text-muted); background:var(--surface-2, #1E1E2E); padding:2px 6px; border-radius:4px;">${cmd.shortcut}</span>` : ''}
                `;

                row.addEventListener('mouseenter', () => {
                    palette.querySelectorAll('.palette-item-row').forEach(r => r.style.background = 'transparent');
                    row.style.background = 'var(--surface-2, #1E1E2E)';
                });

                row.addEventListener('click', () => {
                    this.closePalette();
                    cmd.action();
                });

                resultsList.appendChild(row);
            });
        };

        renderResults(this.search(''));
        input.focus();

        input.addEventListener('input', () => {
            renderResults(this.search(input.value));
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closePalette();
        });
    }

    closePalette() {
        const el = document.getElementById('upclipCommandPaletteOverlay');
        if (el) el.remove();
        this.isOpen = false;
    }
}

window.UpClipCommands = new CommandRegistry();


// =========================================================================
// 4. REGISTER STANDARD CORE COMMANDS
// =========================================================================
window.UpClipCommands.register({
    id: "nav_studio_hub",
    label: "Go to Studio Hub",
    category: "Workspace",
    keywords: ["home", "hub", "dashboard"],
    action: () => { window.location.href = "/studio"; }
});

window.UpClipCommands.register({
    id: "nav_home",
    label: "Go to Home / Wizard",
    category: "Workspace",
    keywords: ["home", "start", "upload"],
    action: () => { window.location.href = "/"; }
});

window.UpClipCommands.register({
    id: "nav_editor",
    label: "Go to Multi-Track Editor",
    category: "Workspace",
    keywords: ["timeline", "cuts", "editing"],
    action: () => { window.location.href = "/editor"; }
});

window.UpClipCommands.register({
    id: "nav_caption_studio",
    label: "Go to Caption Studio 2.0",
    category: "Workspace",
    keywords: ["subtitles", "karaoke", "typography"],
    action: () => { window.location.href = "/caption-studio"; }
});

window.UpClipCommands.register({
    id: "nav_youtube_desk",
    label: "Go to YouTube Desk",
    category: "Workspace",
    keywords: ["youtube", "upload", "channel", "automation"],
    action: () => { window.location.href = "/youtube-desk"; }
});

window.UpClipCommands.register({
    id: "app_toggle_theme",
    label: "Toggle Dark / Light Theme",
    category: "View",
    keywords: ["appearance", "dark", "light", "colors"],
    action: () => {
        const curr = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = curr === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        window.UpClipToast.info(`Switched to ${next} theme`);
    }
});


// =========================================================================
// 5. GLOBAL SETTINGS CLIENT
// =========================================================================
class SettingsClient {
    constructor() {
        this.cache = null;
    }

    async getSettings() {
        if (this.cache) return this.cache;
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success) {
                this.cache = data.settings;
                return this.cache;
            }
        } catch (e) {
            console.warn("Could not fetch remote settings:", e);
        }
        return {};
    }

    async saveSettings(newSettings) {
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            const data = await res.json();
            if (data.success) {
                this.cache = data.settings;
                window.UpClipToast.success("Settings saved");
                return true;
            }
        } catch (e) {
            window.UpClipToast.error("Failed to save settings");
        }
        return false;
    }
}

window.UpClipSettings = new SettingsClient();


// =========================================================================
// 6. GLOBAL TOOLTIP SYSTEM
// =========================================================================
function initTooltips() {
    let tooltipEl = null;

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) {
            if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
            return;
        }

        const text = target.getAttribute('data-tooltip');
        if (!text) return;

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'upclip-tooltip';
            tooltipEl.style.position = 'fixed';
            tooltipEl.style.zIndex = '999999';
            tooltipEl.style.background = 'var(--surface-3, #1E1E2E)';
            tooltipEl.style.color = 'var(--text-primary, #FFF)';
            tooltipEl.style.border = '1px solid var(--border, #2E2E3E)';
            tooltipEl.style.padding = '4px 8px';
            tooltipEl.style.borderRadius = '4px';
            tooltipEl.style.fontSize = '11px';
            tooltipEl.style.fontWeight = '500';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            document.body.appendChild(tooltipEl);
        }

        tooltipEl.textContent = text;
        const rect = target.getBoundingClientRect();
        tooltipEl.style.left = `${Math.max(8, rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2)}px`;
        tooltipEl.style.top = `${rect.bottom + 6}px`;
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target && tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTooltips);
} else {
    initTooltips();
}
