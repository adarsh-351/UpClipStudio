// ============================================
// YouTube Desk - Frontend Logic
// ============================================

(function() {
    'use strict';

    // ---------- State ----------
    const state = {
        currentView: 'desk',
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
        tags: [],
        pollInterval: null,
    };

    // ---------- DOM Cache ----------
    const views = document.querySelectorAll('.yt-view');
    const navItems = document.querySelectorAll('.yt-nav-item[data-view]');
    const toastEl = document.getElementById('ytToast');
    const queueBadge = document.getElementById('queueBadge');
    const errorBadge = document.getElementById('errorBadge');
    const confirmModal = document.getElementById('ytConfirmModal');
    const confirmTitle = document.getElementById('ytConfirmTitle');
    const confirmText = document.getElementById('ytConfirmText');
    const confirmOk = document.getElementById('ytConfirmOk');
    const confirmCancel = document.getElementById('ytConfirmCancel');

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

    function formatDuration(seconds) {
        if (!seconds) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    /**
     * Fetch wrapper that does NOT force Content-Type: application/json.
     * When `body` is a FormData, the browser sets the multipart boundary.
     * When `body` is a string (JSON), Content-Type: application/json is set automatically.
     */
    async function api(url, options = {}) {
        const res = await fetch(url, options);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    }

    function showView(viewName) {
        state.currentView = viewName;

        views.forEach(v => {
            v.hidden = !v.id.startsWith('view-' + viewName);
        });

        navItems.forEach(n => {
            n.classList.toggle('active', n.dataset.view === viewName);
        });

        const viewLabels = {
            desk: 'YouTube Desk',
            connect: 'Connect YouTube',
            queue: 'Upload Queue',
            history: 'Upload History',
            errors: 'Error Center',
            settings: 'Settings',
        };
        const h1El = document.querySelector('.yt-topbar h1');
        if (h1El) {
            const label = viewLabels[viewName] || 'YouTube Desk';
            h1El.innerHTML = viewName === 'desk'
                ? '<span class="yt-icon">📺</span> YouTube Desk'
                : `<span class="yt-icon">${viewLabels[viewName] === 'YouTube Desk' ? '📺' : '•'}</span> ${label}`;
        }

        // Refresh view data
        switch (viewName) {
            case 'desk': loadDashboard(); break;
            case 'connect': loadConnectStatus(); break;
            case 'queue': loadQueue(); break;
            case 'history': loadHistory(); break;
            case 'errors': loadErrors(); break;
            case 'settings': loadSettings(); break;
        }
    }

    // ---------- Navigation ----------
    navItems.forEach(item => {
        item.addEventListener('click', () => showView(item.dataset.view));
    });

    document.getElementById('ytSettingsBtn').addEventListener('click', () => {
        showView('settings');
    });

    // ---------- Dashboard (Desk) ----------
    async function loadDashboard() {
        try {
            const [statusData, queueData, historyData, errorsData] = await Promise.all([
                fetch('/youtube/status').then(r => r.json()),
                fetch('/youtube/upload-queue').then(r => r.json()),
                fetch('/youtube/history').then(r => r.json()),
                fetch('/youtube/errors').then(r => r.json()),
            ]);

            state.queue = queueData.items || [];
            state.history = historyData.history || [];
            state.errors = errorsData.errors || [];

            document.getElementById('statTotal').textContent =
                state.history.filter(h => h.status === 'published').length;
            document.getElementById('statScheduled').textContent =
                await fetch('/youtube/schedules').then(r => r.json()).then(d => d.schedules.length).catch(() => 0);
            document.getElementById('statProcessing').textContent =
                state.queue.filter(q => q.status === 'uploading' || q.status === 'processing').length;
            document.getElementById('statFailed').textContent = state.errors.length;

            // Queue list
            const dashQueueList = document.getElementById('dashQueueList');
            if (state.queue.length) {
                dashQueueList.innerHTML = state.queue.slice(0, 5).map(q => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${q.title || 'Untitled'}</div>
                            <div style="font-size:12px;color:var(--text-muted);">Status: ${q.status}</div>
                        </div>
                        <span class="yt-badge ${q.status}">${q.status}</span>
                    </div>
                `).join('');
            } else {
                dashQueueList.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">📭</div><h3>Queue empty</h3><p>Your upload queue is empty.</p></div>`;
            }

            // Schedule list
            const schedRes = await fetch('/youtube/schedules').then(r => r.json()).catch(() => ({ schedules: [] }));
            const schedules = schedRes.schedules || [];
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
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const todayTs = Math.floor(today.getTime() / 1000);
            const todayItems = state.history.filter(h => h.published_at && h.published_at >= todayTs);
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
            const qLen = state.queue.length;
            queueBadge.hidden = qLen === 0;
            queueBadge.textContent = qLen;
            const eLen = state.errors.length;
            errorBadge.hidden = eLen === 0;
            errorBadge.textContent = eLen;

            // Show stats section
            document.getElementById('deskStats').style.display = '';
        } catch (e) {
            console.error('Dashboard load failed:', e);
        }
    }

    // ---------- Connect YouTube ----------
    async function loadConnectStatus() {
        try {
            const data = await fetch('/youtube/status').then(r => r.json());
            state.connected = data.connected || false;
            document.getElementById('ytChannelName').textContent = data.channel_name || 'Not connected';
            document.getElementById('ytConnectDot').classList.toggle('offline', !state.connected);
            document.getElementById('ytChannelAvatar').hidden = !state.connected;
            if (data.channel_avatar) {
                document.getElementById('ytChannelAvatar').src = data.channel_avatar;
            }
            const badge = document.getElementById('ytChannelBadge');
            badge.classList.toggle('connected', state.connected);
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

    // ---------- Drag & Drop + Video Import ----------

    function setupDropzone(dropzoneId, inputId, onFile) {
        const dropzone = document.getElementById(dropzoneId);
        const input = document.getElementById(inputId);
        if (!dropzone || !input) return;

        dropzone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                input.click();
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                onFile(e.dataTransfer.files[0]);
            }
        });

        input.addEventListener('change', (e) => {
            if (e.target.files.length) {
                onFile(e.target.files[0]);
            }
        });
    }

    async function handleVideoFile(file) {
        const formData = new FormData();
        formData.append('video', file);

        const progressEl = document.getElementById('ytImportProgress');
        const progressFill = document.getElementById('ytImportProgressFill');
        const progressText = document.getElementById('ytImportProgressText');
        progressEl.hidden = false;
        progressFill.style.width = '0%';
        progressText.textContent = 'Importing video...';

        try {
            // Use fetch directly with progress tracking
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    progressFill.style.width = pct + '%';
                    progressText.textContent = `Importing... ${pct}%`;
                }
            });

            xhr.open('POST', '/youtube/import');
            xhr.responseType = 'json';

            xhr.onload = function() {
                progressEl.hidden = true;
                if (xhr.status === 200 || xhr.status === 201) {
                    const data = xhr.response;
                    setActiveVideo(data);
                    showToast('Video imported successfully.', 'success');
                } else {
                    const data = xhr.response;
                    showToast(data?.error || 'Import failed.', 'error');
                }
            };

            xhr.onerror = function() {
                progressEl.hidden = true;
                showToast('Network error during import.', 'error');
            };

            xhr.send(formData);
        } catch (e) {
            progressEl.hidden = true;
            showToast('Import failed: ' + e.message, 'error');
        }
    }

    function setActiveVideo(videoData) {
        state.currentVideo = videoData;
        const meta = videoData.metadata || {};
        const thumbEl = document.getElementById('ytActiveVideoThumb');
        const nameEl = document.getElementById('ytActiveVideoName');
        const metaEl = document.getElementById('ytActiveVideoMeta');
        const sourceEl = document.getElementById('ytActiveVideoSource');
        const clearBtn = document.getElementById('ytClearVideo');
        const infoBar = document.getElementById('ytActiveVideoInfo');
        const placeholder = document.querySelector('.yt-video-placeholder');
        const videoEl = document.querySelector('#ytVideoPreview video');

        // Update video preview
        if (videoData.video_url) {
            if (videoEl) {
                videoEl.src = videoData.video_url;
                videoEl.hidden = false;
            }
            if (placeholder) placeholder.hidden = true;
        }

        // Update active video info bar
        if (infoBar) infoBar.hidden = false;
        if (nameEl) nameEl.textContent = videoData.filename || 'Unknown video';
        if (metaEl) metaEl.textContent = `${formatBytes(meta.size_bytes || 0)} • ${formatDuration(meta.duration)} • ${meta.width || '?'}x${meta.height || '?'}`;
        if (sourceEl) sourceEl.textContent = videoData.source || 'local';
        if (clearBtn) clearBtn.hidden = false;

        if (videoData.thumbnail) {
            thumbEl.src = videoData.thumbnail;
            thumbEl.hidden = false;
        }

        // Populate the Video tab info
        document.getElementById('ytVideoFilename').textContent = videoData.filename || '-';
        document.getElementById('ytVideoResolution').textContent = meta.width ? `${meta.width}x${meta.height}` : '-';
        document.getElementById('ytVideoDuration').textContent = meta.duration ? formatDuration(meta.duration) : '-';
        document.getElementById('ytVideoSize').textContent = formatBytes(meta.size_bytes || 0);
        document.getElementById('ytVideoSource').textContent = videoData.source || 'local';

        // Set default title from filename
        const titleInput = document.getElementById('ytTitle');
        if (titleInput && !titleInput.value) {
            titleInput.value = (videoData.filename || '').replace(/\.[^.]+$/, '');
            updateTitleCount();
        }
    }

    setupDropzone('ytDropzone', 'ytVideoInput', handleVideoFile);

    document.getElementById('ytBrowseBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('ytVideoInput').click();
    });

    document.getElementById('ytClearVideo').addEventListener('click', () => {
        state.currentVideo = null;
        document.getElementById('ytActiveVideoInfo').hidden = true;
        document.getElementById('ytClearVideo').hidden = true;
        const placeholder = document.querySelector('.yt-video-placeholder');
        const videoEl = document.querySelector('#ytVideoPreview video');
        if (placeholder) placeholder.hidden = false;
        if (videoEl) {
            videoEl.src = '';
            videoEl.hidden = true;
        }
        // Clear video tab info
        document.getElementById('ytVideoFilename').textContent = '-';
        document.getElementById('ytVideoResolution').textContent = '-';
        document.getElementById('ytVideoDuration').textContent = '-';
        document.getElementById('ytVideoSize').textContent = '-';
        document.getElementById('ytVideoSource').textContent = '-';
    });

    // ---------- Existing Videos (from /youtube/scan) ----------
    async function loadExistingFiles() {
        try {
            const data = await fetch('/youtube/scan').then(r => r.json());
            const videos = data.videos || [];
            const container = document.getElementById('ytExistingFiles');

            if (!videos.length) {
                container.innerHTML = `<div class="yt-empty"><div class="yt-empty-icon">🎬</div><h3>No videos found</h3><p>Upload a video above or download one using the YT Downloader.</p></div>`;
                return;
            }

            container.innerHTML = '<div class="yt-video-grid">' + videos.map(v => `
                <div class="yt-video-item" data-filename="${v.filename}">
                    ${v.thumbnail ? `<img class="yt-video-thumb" src="${v.thumbnail}" alt="${v.filename}">` : '<div class="yt-video-thumb-placeholder">🎬</div>'}
                    <div class="yt-video-filename" title="${v.filename}">${v.filename}</div>
                    <div class="yt-video-meta-row">${v.size_formatted || ''} • ${v.extension}</div>
                </div>
            `).join('') + '</div>';

            container.querySelectorAll('.yt-video-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const filename = item.dataset.filename;
                    if (!filename) return;
                    try {
                        const data = await api('/youtube/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: filename }),
                        });
                        if (data.success) {
                            data.source = item.querySelector('.yt-video-meta-row').textContent;
                            setActiveVideo(data);
                            showToast(`"${filename}" loaded.`, 'success');
                        }
                    } catch (e) {
                        showToast('Failed to load video: ' + e.message, 'error');
                    }
                });
            });
        } catch (e) {
            console.error('Failed to load existing files:', e);
        }
    }

    // ---------- Upload Button ----------
    document.getElementById('ytUploadBtn').addEventListener('click', async () => {
        if (!state.currentVideo) {
            showToast('Select a video first.', 'error');
            return;
        }

        // Check YouTube connection
        const statusData = await fetch('/youtube/status').then(r => r.json());
        if (!statusData.connected) {
            showToast('Connect your YouTube channel first.', 'error');
            return;
        }

        // Save metadata first via /youtube/videos POST
        const metadataPayload = collectMetadata();
        try {
            const metaRes = await api('/youtube/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metadataPayload),
            });

            const video_id = metaRes.video_id || state.currentVideo.video_id;
            if (!video_id) {
                showToast('Could not resolve video ID.', 'error');
                return;
            }

            // Check if scheduled
            const visibility = document.getElementById('ytVisibility').value;
            if (visibility === 'scheduled') {
                const scheduledAt = document.getElementById('ytScheduleAt').value;
                if (!scheduledAt) {
                    showToast('Please select a schedule date and time.', 'error');
                    return;
                }
                const payload = {
                    video_id: video_id,
                    scheduled_at: new Date(scheduledAt).toISOString(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    title: metadataPayload.title,
                    description: metadataPayload.description,
                    tags: metadataPayload.tags,
                    category_id: metadataPayload.category_id,
                    visibility: visibility,
                };
                try {
                    await api('/youtube/schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    showToast('Video scheduled successfully.', 'success');
                    showView('queue');
                    loadQueue();
                } catch (e) {
                    showToast('Scheduling failed: ' + e.message, 'error');
                }
                return;
            }

            // Normal upload — execute in background
            const uploadRes = await api('/youtube/upload/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: video_id, title: metadataPayload.title }),
            });

            if (uploadRes.success) {
                showToast('Upload started!', 'success');
                startUploadProgressPolling(video_id);
                showView('queue');
                loadQueue();
            }
        } catch (e) {
            showToast('Upload failed: ' + e.message, 'error');
        }
    });

    // ---------- Upload Progress Polling ----------
    let progressPollTimer = null;

    function startUploadProgressPolling(videoId) {
        if (progressPollTimer) clearInterval(progressPollTimer);
        const progressEl = document.getElementById('ytUploadProgress');
        const progressFill = document.getElementById('ytUploadProgressFill');
        const progressText = document.getElementById('ytUploadProgressText');

        progressEl.hidden = false;
        progressFill.style.width = '0%';
        progressText.textContent = 'Starting upload...';

        progressPollTimer = setInterval(async () => {
            try {
                const data = await fetch(`/youtube/upload/progress/${videoId}`).then(r => r.json());
                const pct = data.progress || 0;
                const status = data.status || 'unknown';

                progressFill.style.width = pct + '%';
                progressFill.className = 'yt-progress-fill ' + (status === 'failed' ? 'error' : '');
                progressText.textContent = `Status: ${status} (${pct}%)`;

                if (status === 'done' || status === 'uploaded') {
                    clearInterval(progressPollTimer);
                    progressText.textContent = 'Upload complete!';
                    showToast('Upload completed successfully!', 'success');
                } else if (status === 'failed') {
                    clearInterval(progressPollTimer);
                    progressText.textContent = `Upload failed: ${data.error_message || 'Unknown error'}`;
                    showToast('Upload failed. Check the Error Center.', 'error');
                }
            } catch (e) {
                clearInterval(progressPollTimer);
                progressText.textContent = 'Lost connection to server.';
            }
        }, 2000);
    }

    // ---------- Metadata Editor ----------
    function collectMetadata() {
        const visibility = document.getElementById('ytVisibility').value;
        const scheduleAt = document.getElementById('ytScheduleAt').value;
        return {
            filename: state.currentVideo ? state.currentVideo.filename : '',
            title: document.getElementById('ytTitle').value,
            description: document.getElementById('ytDescription').value,
            tags: state.tags,
            category_id: document.getElementById('ytCategory').value,
            language: document.getElementById('ytLanguage') ? document.getElementById('ytLanguage').value : '',
            recording_date: document.getElementById('ytRecordDate') ? document.getElementById('ytRecordDate').value : '',
            visibility: visibility,
            scheduled_at: visibility === 'scheduled' && scheduleAt ? new Date(scheduleAt).toISOString() : null,
            playlist_id: document.getElementById('ytPlaylist').value,
        };
    }

    function loadMetadataDefaults() {
        if (!state.currentVideo) return;
        const meta = state.currentVideo.metadata || {};
        const titleInput = document.getElementById('ytTitle');
        if (!titleInput.value) {
            titleInput.value = (state.currentVideo.filename || '').replace(/\.[^.]+$/, '');
        }
        updateTitleCount();
        state.tags = [];
        renderTags();
    }

    function updateTitleCount() {
        const el = document.getElementById('ytTitle');
        if (!el) return;
        const count = el.value.length;
        const counter = document.getElementById('titleCount');
        if (counter) {
            counter.textContent = count + '/100';
            counter.className = 'yt-char-count' + (count > 90 ? ' error' : count > 70 ? ' warn' : '');
        }
    }

    document.getElementById('ytTitle').addEventListener('input', updateTitleCount);

    document.getElementById('ytDescription').addEventListener('input', function() {
        const count = this.value.length;
        const counter = document.getElementById('descCount');
        if (counter) {
            counter.textContent = count + '/5000';
            counter.className = 'yt-char-count' + (count > 4500 ? ' error' : count > 4000 ? ' warn' : '');
        }
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (data.success) {
                showToast('Draft saved.', 'success');
            }
        } catch (e) {
            showToast('Save failed: ' + e.message, 'error');
        }
    });

    // ---------- Tabs ----------
    document.querySelectorAll('.yt-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.yt-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.yt-tab-panel').forEach(p => p.hidden = true);
            tab.classList.add('active');
            const panel = document.getElementById('ytTab-' + tab.dataset.tab);
            if (panel) panel.hidden = false;
        });
    });

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
            select.innerHTML = '<option value="">Select video...</option>' + videos.map(v => `<option value="${v}">${v}</option>`).join('');
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
                headers: { 'Content-Type': 'application/json' },
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
        try {
            const data = await api('/youtube/playlists');
            state.playlists = data.playlists || [];
            const select = document.getElementById('ytPlaylist');
            if (state.playlists.length) {
                select.innerHTML = '<option value="">None</option>' + state.playlists.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
            } else {
                select.innerHTML = '<option value="">None</option>';
            }
        } catch (e) {
            console.error('Failed to load playlists:', e);
        }
    }

    document.getElementById('ytRefreshPlaylists').addEventListener('click', loadPlaylists);

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
            container.innerHTML = '<div class="yt-table-wrap"><table class="yt-table"><thead><tr><th>Title</th><th>Status</th><th>Progress</th><th>Error</th><th>Actions</th></tr></thead><tbody>' +
                state.queue.map(q => `
                    <tr>
                        <td>${q.title || 'Untitled'}</td>
                        <td><span class="yt-badge ${q.status}">${q.status}</span></td>
                        <td>${q.progress || 0}%</td>
                        <td>${q.error_message || '-'}</td>
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
                    try {
                        await api(`/youtube/upload-queue/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Item removed from queue.', 'success');
                        loadQueue();
                    } catch (e) {
                        showToast('Remove failed: ' + e.message, 'error');
                    }
                });
            });
        } catch (e) {
            console.error('Queue load failed:', e);
        }
    }

    // ---------- History ----------
    async function loadHistory() {
        try {
            const query = (document.getElementById('ytHistorySearch')?.value || '').toLowerCase();
            const url = query ? `/youtube/history/search?q=${encodeURIComponent(query)}` : '/youtube/history';
            const data = await api(url);
            state.history = data.history || [];
            const container = document.getElementById('ytHistoryList');
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
                        <td><button class="btn-sm" data-id="${e.id}" data-action="retry">Retry</button></td>
                    </tr>
                `).join('') + '</tbody></table></div>';

            container.querySelectorAll('[data-action="retry"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await api(`/youtube/upload-queue/${btn.dataset.id}/retry`, { method: 'POST' });
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
                const visEl = document.getElementById('ytSetVisibility');
                const catEl = document.getElementById('ytSetCategory');
                const langEl = document.getElementById('ytSetLanguage');
                if (visEl && data.settings.default_visibility) visEl.value = data.settings.default_visibility;
                if (catEl && data.settings.default_category) catEl.value = data.settings.default_category;
                if (langEl && data.settings.default_language) langEl.value = data.settings.default_language;
            }
        } catch (e) {
            console.error('Settings load failed:', e);
        }
    }

    const saveSettingsBtn = document.getElementById('ytSaveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            try {
                const payload = {
                    default_visibility: document.getElementById('ytSetVisibility').value,
                    default_category: document.getElementById('ytSetCategory').value,
                    default_language: document.getElementById('ytSetLanguage') ? document.getElementById('ytSetLanguage').value : '',
                };
                await api('/youtube/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                showToast('Settings saved.', 'success');
            } catch (e) {
                showToast('Save failed: ' + e.message, 'error');
            }
        });
    }

    const clearDataBtn = document.getElementById('ytClearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async () => {
            const ok = await showConfirm('Clear Data', 'This will delete all local YouTube automation data. Continue?');
            if (!ok) return;
            try {
                await api('/youtube/data/clear', { method: 'POST' });
                showToast('Local data cleared.', 'success');
            } catch (e) {
                showToast('Clear failed: ' + e.message, 'error');
            }
        });
    }

    const exportDataBtn = document.getElementById('ytExportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async () => {
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
    }

    // ---------- Polling ----------
    function startPolling() {
        if (state.pollInterval) clearInterval(state.pollInterval);
        state.pollInterval = setInterval(async () => {
            if (state.currentView === 'queue') loadQueue();
            if (state.currentView === 'desk') {
                const dash = document.getElementById('view-desk');
                if (!dash.hidden) loadDashboard();
            }
        }, 5000);
    }

    // ---------- Init ----------
    showView('desk');
    loadDashboard();
    loadConnectStatus();
    loadExistingFiles();
    loadPlaylists();
    loadThumbVideoSelect();
    startPolling();

    // Handle file query param (from Clip Cutter "Send to YouTube")
    const urlParams = new URLSearchParams(window.location.search);
    const ytFile = urlParams.get('file');
    if (ytFile) {
        setTimeout(async () => {
            try {
                const data = await api('/youtube/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: ytFile }),
                });
                if (data.success) {
                    data.source = 'clip_cutter';
                    setActiveVideo(data);
                    showToast(`Clip "${ytFile}" loaded from library.`, 'success');
                }
            } catch (e) {
                showToast('Could not load clip: ' + e.message, 'error');
            }
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
