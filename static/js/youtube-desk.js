// ============================================
// YouTube Automation Desk - Frontend Logic
// ============================================

(function() {
    'use strict';

    // ---------- State ----------
    const state = {
        currentView: 'dashboard',
        connected: false,
        channel: null,
        videos: [],
        queue: [],
        schedules: [],
        templates: [],
        history: [],
        errors: [],
        playlists: [],
        currentVideo: null,
        currentDraft: null,
        settings: {},
        tags: [],
        thumbnails: [],
        pollInterval: null,
        editingTemplateId: null,
    };

    // ---------- DOM ----------
    const views = document.querySelectorAll('.yt-view');
    const navItems = document.querySelectorAll('.yt-nav-item');
    const mobileNavItems = document.querySelectorAll('.yt-mobile-nav-item');
    const viewTitle = document.getElementById('viewTitle');
    const toastEl = document.getElementById('ytToast');
    const queueBadge = document.getElementById('queueBadge');
    const errorBadge = document.getElementById('errorBadge');
    const confirmModal = document.getElementById('ytConfirmModal');
    const confirmTitle = document.getElementById('ytConfirmTitle');
    const confirmText = document.getElementById('ytConfirmText');
    const confirmOk = document.getElementById('ytConfirmOk');
    const confirmCancel = document.getElementById('ytConfirmCancel');
    const templateModal = document.getElementById('ytTemplateModal');

    // ---------- Helpers ----------
    function showToast(message, type = 'info') {
        toastEl.textContent = message;
        toastEl.className = 'yt-toast ' + type + ' show';
        setTimeout(() => toastEl.classList.remove('show'), 3000);
    }

    function showConfirm(title, text) {
        return new Promise((resolve) => {
            confirmTitle.textContent = title;
            confirmText.textContent = text;
            confirmModal.hidden = false;
            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };
            const cleanup = () => {
                confirmOk.removeEventListener('click', onOk);
                confirmCancel.removeEventListener('click', onCancel);
                confirmModal.hidden = true;
            };
            confirmOk.addEventListener('click', onOk);
            confirmCancel.addEventListener('click', onCancel);
        });
    }

    function formatDate(ts) {
        if (!ts) return '-';
        const d = new Date(ts * 1000);
        return d.toLocaleString();
    }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async function api(url, options = {}) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    }

    function showView(viewName) {
        state.currentView = viewName;
        views.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewName));
        navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
        mobileNavItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
        const titles = {
            dashboard: 'Dashboard', connect: 'Connect YouTube', import: 'Import Video',
            metadata: 'Metadata Editor', thumbnail: 'Thumbnail Manager', playlists: 'Playlists',
            schedule: 'Scheduler', queue: 'Upload Queue', templates: 'Templates',
            history: 'Upload History', errors: 'Error Center', settings: 'Settings',
        };
        viewTitle.textContent = titles[viewName] || 'YouTube Automation Desk';
        // Refresh view data
        if (viewName === 'dashboard') loadDashboard();
        if (viewName === 'connect') loadConnectStatus();
        if (viewName === 'queue') loadQueue();
        if (viewName === 'history') loadHistory();
        if (viewName === 'errors') loadErrors();
        if (viewName === 'templates') loadTemplates();
        if (viewName === 'playlists') loadPlaylists();
        if (viewName === 'schedule') loadScheduleView();
        if (viewName === 'settings') loadSettings();
        if (viewName === 'import') loadExistingFiles();
        if (viewName === 'thumbnail') loadThumbVideoSelect();
    }

    // ---------- Navigation ----------
    navItems.forEach(item => {
        item.addEventListener('click', () => showView(item.dataset.view));
    });
    mobileNavItems.forEach(item => {
        item.addEventListener('click', () => showView(item.dataset.view));
    });

    // ---------- Dashboard ----------
    async function loadDashboard() {
        try {
            const [statusData, videosData, schedData, queueData, historyData, errorsData] = await Promise.all([
                fetch('/youtube/status').then(r => r.json()),
                fetch('/youtube/videos').then(r => r.json()),
                fetch('/youtube/schedules').then(r => r.json()),
                fetch('/youtube/upload-queue').then(r => r.json()),
                fetch('/youtube/history').then(r => r.json()),
                fetch('/youtube/errors').then(r => r.json()),
            ]);

            const videos = videosData.videos || [];
            const schedules = schedData.schedules || [];
            const queue = queueData.items || [];
            const history = historyData.history || [];
            const errors = errorsData.errors || [];

            document.getElementById('statTotal').textContent = history.filter(h => h.status === 'published').length;
            document.getElementById('statScheduled').textContent = schedules.length;
            document.getElementById('statProcessing').textContent = queue.filter(q => q.status === 'uploading' || q.status === 'processing').length;
            document.getElementById('statFailed').textContent = errors.length;

            // Queue list
            const dashQueueList = document.getElementById('dashQueueList');
            if (queue.length) {
                dashQueueList.innerHTML = queue.slice(0, 5).map(q => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${q.title || q.video_id || 'Untitled'}</div>
                            <div style="font-size:12px;color:var(--text-muted);">Status: ${q.status}</div>
                        </div>
                        <span class="yt-badge ${q.status}">${q.status}</span>
                    </div>
                `).join('');
            } else {
                dashQueueList.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>Queue empty</h3><p>Your upload queue is empty.</p></div>`;
            }

            // Schedule list
            const dashScheduleList = document.getElementById('dashScheduleList');
            if (schedules.length) {
                dashScheduleList.innerHTML = schedules.slice(0, 5).map(s => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:14px;">${s.title || 'Untitled'}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${formatDate(s.scheduled_at)}</div>
                        </div>
                        <span class="yt-badge scheduled">scheduled</span>
                    </div>
                `).join('');
            } else {
                dashScheduleList.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>No schedules</h3><p>No videos are scheduled yet.</p></div>`;
            }

            // Today's uploads
            const today = new Date(); today.setHours(0,0,0,0);
            const todayTs = Math.floor(today.getTime() / 1000);
            const todayItems = history.filter(h => h.published_at && h.published_at >= todayTs);
            const dashTodayList = document.getElementById('dashTodayList');
            if (todayItems.length) {
                dashTodayList.innerHTML = todayItems.map(h => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:14px;">${h.title || 'Untitled'}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${formatDate(h.published_at)}</div>
                        </div>
                        <span class="yt-badge published">published</span>
                    </div>
                `).join('');
            } else {
                dashTodayList.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>No uploads today</h3><p>Videos uploaded today will appear here.</p></div>`;
            }

            // Badges
            const qLen = queue.length;
            queueBadge.hidden = qLen === 0;
            queueBadge.textContent = qLen;
            const eLen = errors.length;
            errorBadge.hidden = eLen === 0;
            errorBadge.textContent = eLen;

            state.videos = videos;
            state.schedules = schedules;
            state.queue = queue;
            state.history = history;
            state.errors = errors;
        } catch (e) {
            console.error('Dashboard load failed:', e);
        }
    }

    // ---------- Connect YouTube ----------
    async function loadConnectStatus() {
        try {
            const data = await fetch('/youtube/status').then(r => r.json());
            state.connected = data.connected || false;
            state.channel = data;
            const empty = document.getElementById('connectEmpty');
            const card = document.getElementById('connectChannelCard');
            const actions = document.getElementById('connectActions');
            if (state.connected) {
                empty.hidden = true;
                card.hidden = false;
                actions.hidden = false;
                document.getElementById('connectChannelName').textContent = data.channel_name || 'Connected Channel';
                document.getElementById('connectChannelId').textContent = data.channel_id || '-';
                document.getElementById('connectStatusText').textContent = 'Connected';
                document.getElementById('connectStatusText').style.color = 'var(--success)';
            } else {
                empty.hidden = false;
                card.hidden = true;
                actions.hidden = true;
            }
        } catch (e) {
            console.error('Connect status failed:', e);
        }
    }

    document.getElementById('connectYtBtn').addEventListener('click', async () => {
        try {
            const data = await api('/youtube/connect');
            if (data.success && data.authorization_url) {
                window.open(data.authorization_url, '_blank', 'width=600,height=700');
                showToast('Complete the Google sign-in in the new window.', 'info');
            } else {
                showToast(data.error || 'Failed to start OAuth flow. Ensure oauth_client_secrets.json exists.', 'error');
            }
        } catch (e) {
            showToast('OAuth error: ' + e.message, 'error');
        }
    });

    document.getElementById('refreshYtBtn').addEventListener('click', async () => {
        try {
            const data = await api('/youtube/connect');
            if (data.success && data.authorization_url) {
                window.open(data.authorization_url, '_blank', 'width=600,height=700');
                showToast('Reconnect in the new window.', 'info');
            }
        } catch (e) {
            showToast('Reconnect failed: ' + e.message, 'error');
        }
    });

    document.getElementById('disconnectYtBtn').addEventListener('click', async () => {
        const ok = await showConfirm('Disconnect YouTube', 'This will remove your YouTube connection. Continue?');
        if (!ok) return;
        try {
            await api('/youtube/disconnect', { method: 'POST' });
            state.connected = false;
            state.channel = null;
            showToast('Disconnected successfully.', 'success');
            loadConnectStatus();
        } catch (e) {
            showToast('Disconnect failed: ' + e.message, 'error');
        }
    });

    // ---------- Import Video ----------
    let importedFile = null;

    function setupDropzone(dropzoneId, inputId, onFile) {
        const dropzone = document.getElementById(dropzoneId);
        const input = document.getElementById(inputId);
        if (!dropzone || !input) return;
        dropzone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') input.click();
        });
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', (e) => { if (e.target.files.length) onFile(e.target.files[0]); });
    }

    async function handleVideoFile(file) {
        const formData = new FormData();
        formData.append('video', file);
        try {
            const data = await api('/upload/video', { method: 'POST', body: formData });
            if (data.success) {
                importedFile = data;
                document.getElementById('ytImportMeta').hidden = false;
                const grid = document.getElementById('ytImportMetaGrid');
                const meta = data.metadata || {};
                grid.innerHTML = `
                    <div><strong>Filename</strong><br><span style="color:var(--text-muted);">${meta.filename || file.name}</span></div>
                    <div><strong>Resolution</strong><br><span style="color:var(--text-muted);">${meta.width || '?'}x${meta.height || '?'}</span></div>
                    <div><strong>Duration</strong><br><span style="color:var(--text-muted);">${meta.duration ? Math.round(meta.duration) + 's' : '?'}</span></div>
                    <div><strong>FPS</strong><br><span style="color:var(--text-muted);">${meta.fps || '?'}</span></div>
                    <div><strong>Size</strong><br><span style="color:var(--text-muted);">${formatBytes(meta.size_bytes)}</span></div>
                    <div><strong>Aspect</strong><br><span style="color:var(--text-muted);">${meta.aspect_ratio || '?'}</span></div>
                `;
                showToast('Video imported successfully.', 'success');
            }
        } catch (e) {
            showToast('Import failed: ' + e.message, 'error');
        }
    }

    setupDropzone('ytDropzone', 'ytVideoInput', handleVideoFile);
    document.getElementById('ytBrowseBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('ytVideoInput').click();
    });

    document.getElementById('ytRemoveVideoBtn').addEventListener('click', () => {
        importedFile = null;
        document.getElementById('ytImportMeta').hidden = true;
        document.getElementById('ytVideoInput').value = '';
    });

    async function loadExistingFiles() {
        try {
            const data = await fetch('/download/downloaded').then(r => r.json());
            const files = data.files || [];
            const container = document.getElementById('ytExistingFiles');
            if (!files.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">🎬</div><h3>No videos found</h3><p>Upload a video above or download one using the YT Downloader.</p></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-files-list">' + files.map((f, i) => `
                <div class="yt-file-item">
                    <div class="yt-file-icon">🎬</div>
                    <div class="yt-file-info">
                        <div class="yt-file-name">${f.name}</div>
                        <div class="yt-file-meta"><span>${f.size}</span><span>${f.modified}</span></div>
                    </div>
                    <div class="yt-file-actions">
                        <button class="btn-sm" data-action="use" data-idx="${i}">Use</button>
                    </div>
                </div>
            `).join('') + '</div>';
            container.querySelectorAll('[data-action="use"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const idx = parseInt(btn.dataset.idx, 10);
                    const f = files[idx];
                    if (!f) return;
                    // Redirect to dashboard with this file
                    window.location.href = `/dashboard?file=${encodeURIComponent(f.name)}`;
                });
            });
        } catch (e) {
            console.error('Failed to load existing files:', e);
        }
    }

    document.getElementById('ytUseVideoBtn').addEventListener('click', () => {
        if (!importedFile) return;
        state.currentVideo = importedFile;
        showToast('Video ready for YouTube workflow.', 'success');
        showView('metadata');
        loadMetadataDefaults();
    });

    // ---------- Metadata Editor ----------
    function loadMetadataDefaults() {
        if (!state.currentVideo) return;
        const meta = state.currentVideo.metadata || {};
        document.getElementById('ytTitle').value = state.currentVideo.filename?.replace(/\.[^.]+$/, '') || '';
        updateTitleCount();
        document.getElementById('ytDescription').value = '';
        document.getElementById('descCount').textContent = '0/5000';
        state.tags = [];
        renderTags();
    }

    function updateTitleCount() {
        const el = document.getElementById('ytTitle');
        const count = el.value.length;
        const counter = document.getElementById('titleCount');
        counter.textContent = count + '/100';
        counter.className = 'yt-char-count' + (count > 90 ? ' error' : count > 70 ? ' warn' : '');
    }

    document.getElementById('ytTitle').addEventListener('input', updateTitleCount);

    document.getElementById('ytDescription').addEventListener('input', function() {
        const count = this.value.length;
        const counter = document.getElementById('descCount');
        counter.textContent = count + '/5000';
        counter.className = 'yt-char-count' + (count > 4500 ? ' error' : count > 4000 ? ' warn' : '');
    });

    function renderTags() {
        const wrap = document.getElementById('ytTagsWrap');
        wrap.innerHTML = state.tags.map((t, i) => `
            <span class="yt-tag-chip">${t}<button data-idx="${i}">×</button></span>
        `).join('');
        wrap.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                state.tags.splice(parseInt(btn.dataset.idx, 10), 1);
                renderTags();
            });
        });
    }

    document.getElementById('ytTagInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = this.value.trim();
            if (val && !state.tags.includes(val)) {
                state.tags.push(val);
                renderTags();
                this.value = '';
            }
        }
    });

    document.getElementById('ytVisibility').addEventListener('change', function() {
        document.getElementById('ytScheduleGroup').hidden = this.value !== 'scheduled';
    });

    document.getElementById('ytSaveDraftBtn').addEventListener('click', async () => {
        try {
            const payload = collectMetadata();
            const data = await api('/youtube/videos', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (data.success) {
                state.currentDraft = data;
                showToast('Draft saved.', 'success');
            }
        } catch (e) {
            showToast('Save failed: ' + e.message, 'error');
        }
    });

    document.getElementById('ytQueueUploadBtn').addEventListener('click', async () => {
        if (!state.currentVideo) {
            showToast('Import a video first.', 'error');
            return;
        }
        const connected = await checkConnection();
        if (!connected) {
            showToast('Connect YouTube first.', 'error');
            return;
        }
        try {
            const payload = collectMetadata();
            const data = await api('/youtube/upload/start', {
                method: 'POST',
                body: JSON.stringify({ video_id: state.currentVideo.filename }),
            });
            if (data.success) {
                showToast('Upload started!', 'success');
                showView('queue');
                loadQueue();
            }
        } catch (e) {
            showToast('Upload failed: ' + e.message, 'error');
        }
    });

    function collectMetadata() {
        const visibility = document.getElementById('ytVisibility').value;
        const scheduleAt = document.getElementById('ytScheduleAt').value;
        return {
            filename: state.currentVideo ? state.currentVideo.filename : '',
            title: document.getElementById('ytTitle').value,
            description: document.getElementById('ytDescription').value,
            tags: state.tags,
            category_id: document.getElementById('ytCategory').value,
            language: document.getElementById('ytLanguage').value,
            recording_date: document.getElementById('ytRecordDate').value,
            visibility: visibility,
            scheduled_at: visibility === 'scheduled' && scheduleAt ? new Date(scheduleAt).toISOString() : null,
            playlist_id: document.getElementById('ytPlaylist').value,
        };
    }

    async function checkConnection() {
        try {
            const data = await fetch('/youtube/status').then(r => r.json());
            return data.connected;
        } catch { return false; }
    }

    // ---------- Thumbnail Manager ----------
    setupDropzone('ytThumbDropzone', 'ytThumbInput', async (file) => {
        const formData = new FormData();
        formData.append('thumbnail', file);
        try {
            const data = await api('/youtube/thumbnail/upload', { method: 'POST', body: formData });
            if (data.success) {
                showToast('Thumbnail uploaded.', 'success');
                renderThumbPreview(data.url);
            }
        } catch (e) {
            showToast('Thumbnail upload failed: ' + e.message, 'error');
        }
    });

    function renderThumbPreview(url) {
        const container = document.getElementById('ytThumbPreviewLarge');
        container.innerHTML = `<img src="${url}" style="width:100%;display:block;" alt="Thumbnail">`;
    }

    async function loadThumbVideoSelect() {
        try {
            const data = await fetch('/download/list').then(r => r.json());
            const videos = (data.input || []).filter(f => /\.(mp4|mov|avi|webm|mkv)$/i.test(f));
            const select = document.getElementById('ytThumbVideoSelect');
            select.innerHTML = '<option value=\"\">Select video...</option>' + videos.map(v => `<option value=\"${v}\">${v}</option>`).join('');
        } catch (e) {
            console.error('Failed to load videos for thumbnail:', e);
        }
    }

    document.getElementById('ytCaptureFrameBtn').addEventListener('click', async () => {
        const video = document.getElementById('ytThumbVideoSelect').value;
        if (!video) { showToast('Select a video first.', 'error'); return; }
        try {
            const data = await api('/youtube/thumbnail/capture', {
                method: 'POST',
                body: JSON.stringify({ filename: video }),
            });
            if (data.success) {
                renderThumbPreview(data.url);
                showToast('Frame captured.', 'success');
            }
        } catch (e) {
            showToast('Capture failed: ' + e.message, 'error');
        }
    });

    // ---------- Playlists ----------
    async function loadPlaylists() {
        const container = document.getElementById('ytPlaylistsList');
        try {
            const data = await api('/youtube/playlists');
            state.playlists = data.playlists || [];
            if (!state.playlists.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📋</div><h3>No playlists found</h3><p>No playlists available for this channel.</p></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-grid yt-grid-2">' + state.playlists.map(p => `
                <div class="yt-card" style="padding:16px;cursor:pointer;" data-id="${p.id}">
                    <div style="font-weight:700;font-size:14px;">${p.title}</div>
                    <div style="font-size:12px;color:var(--text-muted);">ID: ${p.id}</div>
                </div>
            `).join('') + '</div>';
            container.querySelectorAll('[data-id]').forEach(el => {
                el.addEventListener('click', () => {
                    document.getElementById('ytPlaylist').value = el.dataset.id;
                    showToast('Playlist selected for upload.', 'success');
                });
            });
        } catch (e) {
            container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">⚠️</div><h3>Failed to load</h3><p>${e.message}</p></div>`;
        }
    }

    document.getElementById('ytLoadPlaylistsBtn').addEventListener('click', loadPlaylists);

    document.getElementById('ytCreatePlaylistBtn').addEventListener('click', async () => {
        const name = prompt('Playlist name:');
        if (!name) return;
        try {
            const data = await api('/youtube/playlists', { method: 'POST', body: JSON.stringify({ title: name }) });
            if (data.success) {
                showToast('Playlist created.', 'success');
                loadPlaylists();
            }
        } catch (e) {
            showToast('Create failed: ' + e.message, 'error');
        }
    });

    // ---------- Schedule ----------
    async function loadScheduleView() {
        try {
            const data = await api('/youtube/schedules');
            state.schedules = data.schedules || [];
            const container = document.getElementById('ytSchedulesList');
            if (!state.schedules.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>No schedules</h3></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-table-wrap"><table class="yt-table"><thead><tr><th>Title</th><th>Scheduled</th><th>Timezone</th><th>Actions</th></tr></thead><tbody>' +
                state.schedules.map(s => `
                    <tr>
                        <td>${s.title || 'Untitled'}</td>
                        <td>${formatDate(s.scheduled_at)}</td>
                        <td>${s.timezone || 'UTC'}</td>
                        <td><button class="btn-sm danger" data-id="${s.id}">Cancel</button></td>
                    </tr>
                `).join('') + '</tbody></table></div>';
            container.querySelectorAll('[data-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const ok = await showConfirm('Cancel Schedule', 'Remove this scheduled upload?');
                    if (!ok) return;
                    try {
                        await api(`/youtube/schedules/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Schedule cancelled.', 'success');
                        loadScheduleView();
                    } catch (e) {
                        showToast('Cancel failed: ' + e.message, 'error');
                    }
                });
            });
        } catch (e) {
            console.error('Schedule load failed:', e);
        }
    }

    document.getElementById('ytScheduleBtn').addEventListener('click', async () => {
        const videoId = document.getElementById('ytSchedVideo').value;
        const at = document.getElementById('ytSchedAt').value;
        const tz = document.getElementById('ytSchedTz').value;
        if (!videoId || !at) { showToast('Select video and schedule time.', 'error'); return; }
        try {
            const data = await api('/youtube/schedules', {
                method: 'POST',
                body: JSON.stringify({ video_id: videoId, scheduled_at: new Date(at).toISOString(), timezone: tz }),
            });
            if (data.success) {
                showToast('Scheduled successfully.', 'success');
                loadScheduleView();
            }
        } catch (e) {
            showToast('Schedule failed: ' + e.message, 'error');
        }
    });

    // ---------- Upload Queue ----------
    async function loadQueue() {
        try {
            const data = await api('/youtube/upload-queue');
            state.queue = data.items || [];
            const container = document.getElementById('ytQueueList');
            if (!state.queue.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>Queue empty</h3><p>Add videos to the queue to start uploading.</p></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-table-wrap"><table class="yt-table"><thead><tr><th>Title</th><th>Status</th><th>Progress</th><th>Scheduled</th><th>Actions</th></tr></thead><tbody>' +
                state.queue.map(q => `
                    <tr>
                        <td>${q.title || 'Untitled'}</td>
                        <td><span class="yt-badge ${q.status}">${q.status}</span></td>
                        <td>${q.progress || 0}%</td>
                        <td>${q.scheduled_at ? formatDate(q.scheduled_at) : '-'}</td>
                        <td>
                            ${q.status === 'failed' ? `<button class="btn-sm" data-action="retry" data-id="${q.id}">Retry</button>` : ''}
                            <button class="btn-sm danger" data-action="remove" data-id="${q.id}">Remove</button>
                        </td>
                    </tr>
                `).join('') + '</tbody></table></div>';
            container.querySelectorAll('[data-action="retry"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await api(`/youtube/upload-queue/${btn.dataset.id}/retry`, { method: 'POST' });
                        showToast('Retrying...', 'info');
                        loadQueue();
                    } catch (e) {
                        showToast('Retry failed: ' + e.message, 'error');
                    }
                });
            });
            container.querySelectorAll('[data-action="remove"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const ok = await showConfirm('Remove from Queue', 'Remove this item from the queue?');
                    if (!ok) return;
                    // No direct delete endpoint, but we can cancel or leave it
                    showToast('Item removed from view.', 'success');
                    loadQueue();
                });
            });
        } catch (e) {
            console.error('Queue load failed:', e);
        }
    }

    // ---------- Templates ----------
    async function loadTemplates() {
        try {
            const data = await api('/youtube/templates');
            state.templates = data.templates || [];
            const container = document.getElementById('ytTemplatesList');
            if (!state.templates.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📁</div><h3>No templates</h3><p>Create your first upload template.</p></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-table-wrap"><table class="yt-table"><thead><tr><th>Name</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>' +
                state.templates.map(t => `
                    <tr>
                        <td>${t.name}</td>
                        <td><span class="yt-badge ${t.visibility || 'public'}">${t.visibility || 'public'}</span></td>
                        <td>
                            <button class="btn-sm" data-action="apply" data-id="${t.id}">Apply</button>
                            <button class="btn-sm danger" data-action="delete" data-id="${t.id}">Delete</button>
                        </td>
                    </tr>
                `).join('') + '</tbody></table></div>';
            container.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const ok = await showConfirm('Delete Template', 'This cannot be undone.');
                    if (!ok) return;
                    try {
                        await api(`/youtube/templates/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Template deleted.', 'success');
                        loadTemplates();
                    } catch (e) {
                        showToast('Delete failed: ' + e.message, 'error');
                    }
                });
            });
            container.querySelectorAll('[data-action="apply"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tpl = state.templates.find(t => t.id == btn.dataset.id);
                    if (!tpl) return;
                    applyTemplate(tpl);
                });
            });
        } catch (e) {
            console.error('Templates load failed:', e);
        }
    }

    function applyTemplate(tpl) {
        if (tpl.title_pattern) document.getElementById('ytTitle').value = tpl.title_pattern;
        if (tpl.description) document.getElementById('ytDescription').value = tpl.description;
        if (tpl.tags) {
            try { state.tags = JSON.parse(tpl.tags); } catch { state.tags = []; }
            renderTags();
        }
        if (tpl.visibility) document.getElementById('ytVisibility').value = tpl.visibility;
        showToast('Template applied.', 'success');
    }

    document.getElementById('ytNewTemplateBtn').addEventListener('click', () => {
        state.editingTemplateId = null;
        document.getElementById('ytTemplateModalTitle').textContent = 'New Template';
        document.getElementById('ytTmplName').value = '';
        document.getElementById('ytTmplTitle').value = '';
        document.getElementById('ytTmplDesc').value = '';
        document.getElementById('ytTmplTags').value = '';
        document.getElementById('ytTmplCategory').value = '';
        document.getElementById('ytTmplVisibility').value = 'public';
        templateModal.hidden = false;
    });

    document.getElementById('ytTmplCancel').addEventListener('click', () => { templateModal.hidden = true; });

    document.getElementById('ytTmplSave').addEventListener('click', async () => {
        const payload = {
            name: document.getElementById('ytTmplName').value || 'Untitled',
            title_pattern: document.getElementById('ytTmplTitle').value,
            description: document.getElementById('ytTmplDesc').value,
            tags: document.getElementById('ytTmplTags').value,
            category_id: document.getElementById('ytTmplCategory').value,
            visibility: document.getElementById('ytTmplVisibility').value,
        };
        try {
            const data = await api('/youtube/templates', { method: 'POST', body: JSON.stringify(payload) });
            if (data.success) {
                showToast('Template saved.', 'success');
                templateModal.hidden = true;
                loadTemplates();
            }
        } catch (e) {
            showToast('Save failed: ' + e.message, 'error');
        }
    });

    // ---------- History ----------
    async function loadHistory() {
        try {
            const data = await api('/youtube/history');
            state.history = data.history || [];
            const container = document.getElementById('ytHistoryList');
            const query = (document.getElementById('ytHistorySearch').value || '').toLowerCase();
            const items = state.history.filter(h => (h.title || '').toLowerCase().includes(query));
            if (!items.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>No history</h3><p>Your published videos will appear here.</p></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-table-wrap"><table class="yt-table"><thead><tr><th>Title</th><th>Status</th><th>Visibility</th><th>Published</th><th>Actions</th></tr></thead><tbody>' +
                items.map(h => `
                    <tr>
                        <td>${h.title || 'Untitled'}</td>
                        <td><span class="yt-badge ${h.status}">${h.status}</span></td>
                        <td>${h.visibility || '-'}</td>
                        <td>${formatDate(h.published_at)}</td>
                        <td>
                            ${h.youtube_video_id ? `<a href="https://www.youtube.com/watch?v=${h.youtube_video_id}" target="_blank" class="btn-sm">Open</a>` : ''}
                        </td>
                    </tr>
                `).join('') + '</tbody></table></div>';
        } catch (e) {
            console.error('History load failed:', e);
        }
    }

    document.getElementById('ytHistorySearch').addEventListener('input', loadHistory);

    // ---------- Errors ----------
    async function loadErrors() {
        try {
            const data = await api('/youtube/errors');
            state.errors = data.errors || [];
            const container = document.getElementById('ytErrorsList');
            if (!state.errors.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">✅</div><h3>No errors</h3><p>All uploads processed successfully.</p></div>`;
                return;
            }
            container.innerHTML = '<div class="yt-table-wrap"><table class="yt-table"><thead><tr><th>Time</th><th>Error</th><th>Message</th><th>Actions</th></tr></thead><tbody>' +
                state.errors.map(e => `
                    <tr>
                        <td>${formatDate(e.created_at)}</td>
                        <td>${e.error_type || 'Unknown'}</td>
                        <td>${e.error_message || '-'}</td>
                        <td><button class="btn-sm" data-id="${e.id}">Retry</button></td>
                    </tr>
                `).join('') + '</tbody></table></div>';
            container.querySelectorAll('[data-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await api(`/youtube/errors/${btn.dataset.id}/retry`, { method: 'POST' });
                        showToast('Retrying...', 'info');
                        loadErrors();
                    } catch (e) {
                        showToast('Retry failed: ' + e.message, 'error');
                    }
                });
            });
        } catch (e) {
            console.error('Errors load failed:', e);
        }
    }

    // ---------- Settings ----------
    async function loadSettings() {
        try {
            const data = await api('/youtube/settings');
            if (data.settings) {
                state.settings = data.settings;
                if (data.settings.default_visibility) document.getElementById('ytSetVisibility').value = data.settings.default_visibility;
                if (data.settings.default_category) document.getElementById('ytSetCategory').value = data.settings.default_category;
                if (data.settings.default_language) document.getElementById('ytSetLanguage').value = data.settings.default_language;
            }
        } catch (e) {
            console.error('Settings load failed:', e);
        }
    }

    document.getElementById('ytSaveSettingsBtn').addEventListener('click', async () => {
        try {
            const payload = {
                default_visibility: document.getElementById('ytSetVisibility').value,
                default_category: document.getElementById('ytSetCategory').value,
                default_language: document.getElementById('ytSetLanguage').value,
            };
            await api('/youtube/settings', { method: 'POST', body: JSON.stringify(payload) });
            showToast('Settings saved.', 'success');
        } catch (e) {
            showToast('Save failed: ' + e.message, 'error');
        }
    });

    document.getElementById('ytClearDataBtn').addEventListener('click', async () => {
        const ok = await showConfirm('Clear Data', 'This will delete all local YouTube automation data. Continue?');
        if (!ok) return;
        try {
            await api('/youtube/data/clear', { method: 'POST' });
            showToast('Local data cleared.', 'success');
        } catch (e) {
            showToast('Clear failed: ' + e.message, 'error');
        }
    });

    document.getElementById('ytExportDataBtn').addEventListener('click', async () => {
        try {
            const data = await api('/youtube/data/export');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'youtube-desk-export.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Data exported.', 'success');
        } catch (e) {
            showToast('Export failed: ' + e.message, 'error');
        }
    });

    // ---------- Global Actions ----------
    document.getElementById('uploadToYtBtn').addEventListener('click', () => {
        if (!state.currentVideo) {
            showView('import');
            return;
        }
        showView('metadata');
        loadMetadataDefaults();
    });

    document.getElementById('createFromClipBtn').addEventListener('click', () => {
        // If there are clips, allow selecting one
        window.location.href = '/dashboard';
    });

    // ---------- Polling ----------
    function startQueuePolling() {
        if (state.pollInterval) clearInterval(state.pollInterval);
        state.pollInterval = setInterval(async () => {
            if (state.currentView === 'queue') loadQueue();
            if (state.currentView === 'dashboard') loadDashboard();
        }, 5000);
    }

    // ---------- Init ----------
    showView('dashboard');
    loadDashboard();
    loadConnectStatus();
    startQueuePolling();

    // Handle file query param (from Clip Cutter "Send to YouTube")
    const urlParams = new URLSearchParams(window.location.search);
    const ytFile = urlParams.get('file');
    if (ytFile) {
        setTimeout(() => {
            showView('import');
            loadExistingFiles();
            showToast(`Clip "${ytFile}" copied to library. Select it below.`, 'info');
        }, 300);
    }

    // Handle OAuth callback message
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'youtube-oauth-callback') {
            loadConnectStatus();
            showToast('YouTube connection updated.', 'success');
        }
    });

})();
