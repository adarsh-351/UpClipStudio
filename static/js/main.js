// ============================================
// AI Shorts Studio - Frontend Logic (v2 Wizard)
// ============================================

// ---------- Theme Toggle ----------
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved);
}
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        applyTheme(next);
    });
}
initTheme();

// ---------- Account Menu / Mobile Menu / Logout ----------
const accountBtn = document.getElementById('accountBtn');
const accountDropdown = document.getElementById('accountDropdown');
if (accountBtn && accountDropdown) {
    accountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        accountDropdown.hidden = !accountDropdown.hidden;
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.account-menu')) accountDropdown.hidden = true;
    });
}

const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        mobileMenu.hidden = !mobileMenu.hidden;
    });
}

async function logout() {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/';
}
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtnMobile = document.getElementById('logoutBtnMobile');
if (logoutBtn) logoutBtn.addEventListener('click', logout);
if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', logout);

// ---------- Pipeline Timer ----------
let timerInterval = null;
let timerStart = null;
const timerEl = document.getElementById('pipelineTimer');
function startTimer() {
    timerStart = Date.now();
    stopTimer();
    timerInterval = setInterval(() => {
        if (!timerEl) return;
        const secs = Math.floor((Date.now() - timerStart) / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 250);
}
function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

const state = {
    currentFile: null,
    currentMetadata: null,
    jobId: null,
    pollInterval: null,
    result: null,
    currentStep: 1,
    totalSteps: 9,
    clips: [],
};

// ---------- DOM References ----------
const uploadZone = document.getElementById('uploadZone');
const videoInput = document.getElementById('videoInput');
const browseBtn = document.getElementById('browseBtn');
const uploadProgress = document.getElementById('uploadProgress');
const uploadFill = document.getElementById('uploadFill');
const uploadStatus = document.getElementById('uploadStatus');
const metaPreview = document.getElementById('metaPreview');
const ffmpegBadge = document.getElementById('ffmpegBadge');

const wizNext = document.getElementById('wizNext');
const wizPrev = document.getElementById('wizPrev');

const pipelineWrap = document.getElementById('pipelineWrap');
const pipelineFill = document.getElementById('pipelineFill');
const pipelinePercent = document.getElementById('pipelinePercent');
const stepsContainer = document.getElementById('stepsContainer');
const logBody = document.getElementById('logBody');

const reviewGrid = document.getElementById('reviewGrid');
const countConflict = document.getElementById('countConflict');

const confirmModal = document.getElementById('confirmModal');
const confirmText = document.getElementById('confirmText');

// ---------- Helpers ----------
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(sec) {
    if (sec === undefined || sec === null) return '-';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function addLog(message, type = '') {
    const div = document.createElement('div');
    div.className = 'log-line' + (type ? ' ' + type : '');
    div.textContent = message;
    logBody.appendChild(div);
    logBody.scrollTop = logBody.scrollHeight;
}

function setStepState(step, className) {
    const el = document.querySelector(`.step[data-step="${step}"]`);
    if (el) {
        el.classList.remove('active', 'done', 'error');
        if (className) el.classList.add(className);
    }
}
function resetSteps() {
    for (let i = 1; i <= 9; i++) setStepState(i, '');
}

// ---------- Wizard Navigation ----------
function nextStep() {
    const step = state.currentStep;
    if (step === 1) {
        if (!state.currentFile) {
            alert('Please upload a video first.');
            return;
        }
    }
    if (step === 7) {
        startPipeline();
        return;
    }
    if (step === 8) {
        showStep(9);
        return;
    }
    showStep(step + 1);
}

wizNext.addEventListener('click', nextStep);
wizPrev.addEventListener('click', () => {
    if (state.currentStep === 9) {
        showStep(8);
    } else {
        showStep(Math.max(1, state.currentStep - 1));
    }
});

// ---------- Conditional question logic ----------
document.querySelectorAll('input[name="clipmode"]').forEach(r => {
    r.addEventListener('change', updateClippingOptions);
});
document.getElementById('clipCountMode').addEventListener('change', () => {
    const v = document.getElementById('clipCountMode').value;
    document.getElementById('customCountWrap').hidden = v !== 'custom';
});

function updateClippingOptions() {
    const mode = document.querySelector('input[name="clipmode"]:checked').value;
    document.getElementById('durationSettings').hidden = mode !== 'duration';
    document.getElementById('countSettings').hidden = mode !== 'count';
}

// ---------- Caption Options Toggle ----------
function updateCaptionOptions() {
    const enabled = document.getElementById('captionEnabled') ?
        document.getElementById('captionEnabled').checked : false;
    const wrap = document.getElementById('captionOptions');
    if (wrap) wrap.hidden = !enabled;
}
const captionEnabled = document.getElementById('captionEnabled');
if (captionEnabled) {
    captionEnabled.addEventListener('change', updateCaptionOptions);
}
updateCaptionOptions();

// ---------- FFmpeg Check ----------
async function checkFfmpeg() {
    if (!ffmpegBadge) return;
    try {
        const res = await fetch('/process/ffmpeg');
        const data = await res.json();
        if (data.success && data.installed) {
            ffmpegBadge.textContent = 'FFmpeg Ready';
            ffmpegBadge.className = 'ffmpeg-badge ok';
        } else {
            ffmpegBadge.textContent = 'FFmpeg Missing';
            ffmpegBadge.className = 'ffmpeg-badge error';
        }
    } catch (e) {
        ffmpegBadge.textContent = 'FFmpeg Check Failed';
        ffmpegBadge.className = 'ffmpeg-badge error';
    }
}

// ---------- Upload ----------
if (browseBtn && videoInput && uploadZone) {
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Browse button clicked');
        videoInput.click();
    });
    uploadZone.addEventListener('click', () => {
        console.log('Upload zone clicked');
        videoInput.click();
    });

    let dragCounter = 0;
    ['dragenter', 'dragover'].forEach(evt => {
        uploadZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            uploadZone.classList.add('dragover');
        });
    });
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            uploadZone.classList.remove('dragover');
        }
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) uploadVideo(files[0]);
    });
    videoInput.addEventListener('change', (e) => {
        console.log('File input changed, files:', e.target.files.length);
        if (e.target.files.length) uploadVideo(e.target.files[0]);
    });
} else {
    console.warn('Upload elements not found:', {
        browseBtn: !!browseBtn,
        videoInput: !!videoInput,
        uploadZone: !!uploadZone
    });
}

async function uploadVideo(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('video', file);

    uploadProgress.hidden = false;
    uploadStatus.textContent = `Uploading ${file.name}...`;

    try {
        const res = await fetch('/upload/video', { method: 'POST', body: formData });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await res.json();
            if (!data.success) {
                uploadStatus.textContent = 'Error: ' + (data.error || 'Upload failed');
                console.error('Upload error:', data.error);
                return;
            }
            handleUploadSuccess(data);
        } else {
            const text = await res.text();
            uploadStatus.textContent = `Server error (${res.status}): Upload failed`;
            console.error('Upload non-JSON response:', res.status, text.slice(0, 200));
        }
    } catch (err) {
        uploadStatus.textContent = 'Upload failed: ' + err.message;
        console.error('Upload exception:', err);
    } finally {
        uploadFill.style.width = '100%';
        setTimeout(() => {
            uploadProgress.hidden = true;
            uploadFill.style.width = '0%';
        }, 1500);
    }
}

function handleUploadSuccess(data) {
    state.currentFile = data.filename;
    state.currentMetadata = data.metadata;
    uploadStatus.textContent = 'Upload complete!';

    // Show metadata preview
    metaPreview.hidden = false;
    metaPreview.innerHTML = `
        <div><strong>Filename</strong><br><span>${data.metadata.filename}</span></div>
        <div><strong>Resolution</strong><br><span>${data.metadata.width}×${data.metadata.height}</span></div>
        <div><strong>Duration</strong><br><span>${formatTime(data.metadata.duration)}</span></div>
        <div><strong>FPS</strong><br><span>${data.metadata.fps}</span></div>
    `;

    // Auto-advance to language step
    showStep(2);
}

// ---------- Build summary ----------
function buildSummary() {
    const lang = document.getElementById('langTranscript').selectedOptions[0].textContent;
    const langSub = document.getElementById('langSubtitle').value;
    const subLabel = langSub === 'auto' ? 'Same as transcript' :
        document.getElementById('langSubtitle').selectedOptions[0].textContent;
    const aspect = document.querySelector('input[name="aspect"]:checked').value;
    const mode = document.querySelector('input[name="clipmode"]:checked').value;
    const naming = document.querySelector('input[name="naming"]:checked').value;

    const modeLabels = { ai: 'AI decides', duration: 'Duration', count: 'Count' };
    const namingLabels = { content: 'Content-based', sequential: 'Sequential' };

    let clipsInfo = '';
    if (mode === 'duration') {
        const dur = document.getElementById('clipDuration').value;
        const how = document.getElementById('clipCountMode').value;
        clipsInfo = `${dur}s per clip, ${how === 'all' ? 'all possible' : document.getElementById('customCount').value + ' clips'}`;
    } else if (mode === 'count') {
        clipsInfo = `${document.getElementById('clipCount').value} clips`;
    } else {
        clipsInfo = 'AI decides';
    }

    let captionStyleInfo = '';
    const captionStylePreset = document.getElementById('captionStylePreset');
    if (captionStylePreset && captionStylePreset.value) {
        const presetLabel = captionStylePreset.options[captionStylePreset.selectedIndex]?.text || captionStylePreset.value;
        captionStyleInfo = presetLabel;
    }

    document.getElementById('settingsSummary').innerHTML = `
        <div class="summary-row"><span class="summary-label">Video</span><span class="summary-value">${state.currentFile}</span></div>
        <div class="summary-row"><span class="summary-label">Transcript Language</span><span class="summary-value">${lang}</span></div>
        <div class="summary-row"><span class="summary-label">Subtitle Language</span><span class="summary-value">${subLabel}</span></div>
        <div class="summary-row"><span class="summary-label">Aspect Ratio</span><span class="summary-value">${aspect}</span></div>
        <div class="summary-row"><span class="summary-label">Clipping</span><span class="summary-value">${modeLabels[mode]} — ${clipsInfo}</span></div>
        <div class="summary-row"><span class="summary-label">Naming</span><span class="summary-value">${namingLabels[naming]}</span></div>
        ${captionStyleInfo ? `<div class="summary-row"><span class="summary-label">Caption Style</span><span class="summary-value">${captionStyleInfo}</span></div>` : ''}
    `;
}

// ---------- Start Pipeline ----------
async function startPipeline() {
    const settings = collectSettings();

    wizNext.disabled = true;
    wizNext.innerHTML = '<span class="spinner"></span> Processing...';
    pipelineWrap.hidden = false;
    resetSteps();
    logBody.innerHTML = '<div class="log-line muted">Starting pipeline...</div>';
    pipelineFill.style.width = '0%';
    pipelinePercent.textContent = '0%';
    startTimer();

    try {
        const res = await fetch('/process/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: state.currentFile, settings }),
        });
        const data = await res.json();
        if (!data.success) {
            addLog('Failed to start: ' + data.error, 'error-line');
            resetPipelineBtn();
            return;
        }
        state.jobId = data.job_id;
        addLog(`Job started: ${data.job_id}`, 'success');
        startPolling(data.job_id);
    } catch (err) {
        addLog('Error: ' + err.message, 'error-line');
        resetPipelineBtn();
    }
}

function collectSettings() {
    const mode = document.querySelector('input[name="clipmode"]:checked').value;
    const captionStylePreset = document.getElementById('captionStylePreset')?.value || '';
    let captionStyleData = null;
    if (captionStylePreset) {
        const presetMap = {
            'tiktok_pop': { id: 'tiktok_pop', name: 'TikTok Pop', font_family: 'Arial Black', font_size: 42, font_weight: 800, text_color: '#FFFFFF', active_word_color: '#fbbf24', background_color: '#000000', background_opacity: 0.0, outline_color: '#000000', outline_width: 3, shadow_color: '#000000', shadow_blur: 4, shadow_offset_y: 2, position: 'bottom', animation: 'pop', letter_spacing: 0, line_height: 1.2, max_lines: 2 },
            'youtube': { id: 'youtube', name: 'YouTube', font_family: 'Arial', font_size: 22, font_weight: 700, text_color: '#FFFFFF', active_word_color: '#FFFFFF', background_color: '#000000', background_opacity: 0.0, outline_color: '#000000', outline_width: 2, shadow_color: '#000000', shadow_blur: 1, shadow_offset_y: 0, position: 'bottom', animation: 'none', letter_spacing: 0, line_height: 1.4, max_lines: 2 },
            'minimal': { id: 'minimal', name: 'Minimal', font_family: 'Inter', font_size: 32, font_weight: 400, text_color: '#FFFFFF', active_word_color: '#FFFFFF', background_color: '#000000', background_opacity: 0.0, outline_color: '#000000', outline_width: 0, shadow_color: '#000000', shadow_blur: 0, shadow_offset_y: 0, position: 'bottom', animation: 'none', letter_spacing: 1, line_height: 1.4, max_lines: 2 },
            'bold': { id: 'bold', name: 'Bold', font_family: 'Arial Black', font_size: 48, font_weight: 900, text_color: '#FFFFFF', active_word_color: '#fbbf24', background_color: '#000000', background_opacity: 0.6, outline_color: '#000000', outline_width: 4, shadow_color: '#000000', shadow_blur: 8, shadow_offset_y: 2, position: 'bottom', animation: 'pop', letter_spacing: 0, line_height: 1.1, max_lines: 1 },
        };
        const presetSize = parseInt(document.getElementById('presetCaptionSize')?.value || '34', 10);
        const presetPosition = document.getElementById('presetCaptionPosition')?.value || 'bottom';
        const base = presetMap[captionStylePreset] || {};
        captionStyleData = { ...base, font_size: presetSize, position: presetPosition };
    }
    const settings = {
        language: document.getElementById('langTranscript').value,
        subtitle_language: document.getElementById('langSubtitle').value,
        subtitle_enabled: document.getElementById('subtitleEnabled').checked,
        aspect: document.querySelector('input[name="aspect"]:checked').value,
        clipping_mode: mode,
        naming: document.querySelector('input[name="naming"]:checked').value,
        quality: document.getElementById('exportQuality') ? document.getElementById('exportQuality').value : 'original',
        caption_enabled: document.getElementById('captionEnabled') ? document.getElementById('captionEnabled').checked : false,
        caption_template: document.getElementById('captionTemplate') ? document.getElementById('captionTemplate').value : 'classic',
        caption_animation: document.getElementById('captionAnimation') ? document.getElementById('captionAnimation').value : 'pop',
        caption_position: document.getElementById('captionPosition') ? document.getElementById('captionPosition').value : 'bottom',
        caption_font: document.getElementById('captionFont') ? document.getElementById('captionFont').value : 'Arial',
        caption_color: document.getElementById('captionColor') ? document.getElementById('captionColor').value : '#FFFFFF',
        caption_size: document.getElementById('captionSize') ? parseInt(document.getElementById('captionSize').value, 10) || 22 : 22,
        caption_outline: document.getElementById('captionOutline') ? parseInt(document.getElementById('captionOutline').value, 10) || 2 : 2,
        caption_margin_v: document.getElementById('captionMarginV') ? parseInt(document.getElementById('captionMarginV').value, 10) || 60 : 60,
        caption_background: document.getElementById('captionBackground') ? document.getElementById('captionBackground').value : 'none',
        caption_style: captionStyleData,
    };

    if (mode === 'duration') {
        settings.clip_duration = parseInt(document.getElementById('clipDuration').value, 10) || 30;
        if (document.getElementById('clipCountMode').value === 'custom') {
            settings.clip_count = parseInt(document.getElementById('customCount').value, 10) || 5;
        }
    }
    if (mode === 'count') {
        settings.clip_count = parseInt(document.getElementById('clipCount').value, 10) || 5;
    }

    return settings;
}

function resetPipelineBtn() {
    wizNext.disabled = false;
    wizNext.innerHTML = '<span class="spinner" hidden></span> Generate Clips';
}

// ---------- Polling ----------
function startPolling(jobId) {
    state.pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/process/status/${jobId}`);
            const data = await res.json();
            if (!data.success) return;
            updateProgressUI(data);
        } catch (err) {
            addLog('Polling error: ' + err.message, 'error-line');
        }
    }, 1500);
}

function updateProgressUI(data) {
    const percent = Math.round((data.steps_completed / data.total_steps) * 100);
    pipelineFill.style.width = `${percent}%`;
    pipelinePercent.textContent = `${percent}%`;

    for (let i = 1; i <= 9; i++) {
        if (data.status === 'error') {
            setStepState(i, i === data.steps_completed ? 'error' : (i < data.steps_completed ? 'done' : ''));
        } else if (i < data.steps_completed) {
            setStepState(i, 'done');
        } else if (i === data.steps_completed) {
            setStepState(i, 'active');
} else {
            setStepState(i, '');
        }
    }

    if (data.logs && Array.isArray(data.logs)) {
        const currentCount = logBody.querySelectorAll('.log-line').length;
        for (let i = currentCount; i < data.logs.length; i++) {
            const msg = data.logs[i];
            const cls = msg.startsWith('ERROR') ? 'error-line'
                       : msg.includes('✅') ? 'success' : '';
            addLog(msg, cls);
        }
    }

    if (data.finished) {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
        resetPipelineBtn();
        stopTimer();

        if (data.status === 'done') {
            addLog('✅ Pipeline completed successfully!', 'success');
            handlePipelineDone(data.result);
        } else if (data.status === 'error') {
            addLog('❌ Pipeline failed: ' + data.error, 'error-line');
        }
    }
}

function handlePipelineDone(result) {
    if (!result) return;
    state.result = result;
    state.clips = result.clips_meta || (result.clips || []).map(n => ({ name: n, url: `/download/clip/${n}` }));

    // Handle clip count conflict
    if (result.clip_count_conflict) {
        showClipConflict(result.clip_count_conflict);
    }

    // Populate review grid
    renderReviewGrid();

    // Go to review step
    showStep(8);
}

// ---------- Clip Count Conflict Modal ----------
function showClipConflict(conflict) {
    confirmText.textContent = `You requested ${conflict.requested} clips, but only ${conflict.available} good clips are available. Continue with ${conflict.available}?`;
    confirmModal.hidden = false;
}

if (document.getElementById('confirmYes')) {
    document.getElementById('confirmYes').addEventListener('click', () => {
        confirmModal.hidden = true;
    });
}
if (document.getElementById('confirmNo')) {
    document.getElementById('confirmNo').addEventListener('click', () => {
        confirmModal.hidden = true;
        showStep(4); // back to clipping settings
    });
}
if (document.getElementById('confirmClose')) {
    document.getElementById('confirmClose').addEventListener('click', () => {
        confirmModal.hidden = true;
    });
}
if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.hidden = true;
        }
    });
}

// Auth Required Modal
const authRequiredModal = document.getElementById('authRequiredModal');
const authRequiredClose = document.getElementById('authRequiredClose');
if (authRequiredClose) {
    authRequiredClose.addEventListener('click', () => {
        if (authRequiredModal) authRequiredModal.hidden = true;
        window.location.href = '/';
    });
}
if (authRequiredModal) {
    authRequiredModal.addEventListener('click', (e) => {
        if (e.target === authRequiredModal) {
            authRequiredModal.hidden = true;
            window.location.href = '/';
        }
    });
}

// ---------- Logo Navigation ----------
const brandEl = document.querySelector('.brand');
if (brandEl) {
    brandEl.style.cursor = 'pointer';
    brandEl.addEventListener('click', () => {
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
    });
}

// ---------- Review Grid ----------
function renderReviewGrid() {
    reviewGrid.innerHTML = '';
    countConflict.hidden = true;

    if (!state.clips.length) {
        reviewGrid.innerHTML = '<p class="muted">No clips generated.</p>';
        return;
    }

    state.clips.forEach((clip, idx) => {
        const card = document.createElement('div');
        card.className = 'review-clip';
        const projectId = state.result?.project_id || '';
        card.innerHTML = `
            <video preload="metadata" controls src="/download/clip/stream/${clip.name}"></video>
            <input class="clip-name-input" value="${clip.name}" data-idx="${idx}">
            <div class="clip-actions">
                <button class="btn-sm" data-action="save" data-idx="${idx}">💾 Rename</button>
                <button class="btn-sm" data-action="download" data-idx="${idx}">⬇ Download</button>
                <button class="btn-sm accent" data-action="open-caption" data-idx="${idx}" title="Open in Caption Studio">💬 Captions</button>
                <button class="btn-sm" data-action="send-youtube" data-idx="${idx}" title="Send to YouTube">📺 YouTube</button>
                <button class="btn-sm danger" data-action="delete" data-idx="${idx}">🗑 Delete</button>
            </div>
        `;
        reviewGrid.appendChild(card);
    });
}

reviewGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const clip = state.clips[idx];
    if (!clip) return;

    const action = btn.dataset.action;

    if (action === 'download') {
        window.open(`/download/clip/${clip.name}`, '_blank');
    } else if (action === 'open-caption') {
        const projectId = state.result?.project_id || '';
        const clipSubtitleMap = state.result?.clip_subtitle_map || {};
        const clipSrt = clipSubtitleMap[clip.name]?.srt || state.result?.srt || '';
        const clipVtt = clipSubtitleMap[clip.name]?.vtt || state.result?.vtt || '';
        const captionStyle = state.result?.caption_style || null;
        const navUrl = `/open-caption-studio?video=${encodeURIComponent(clip.name)}&project_id=${encodeURIComponent(projectId)}&srt=${encodeURIComponent(clipSrt)}&vtt=${encodeURIComponent(clipVtt)}&style=${encodeURIComponent(captionStyle ? JSON.stringify(captionStyle) : '')}`;
        window.location.href = navUrl;
    } else if (action === 'send-youtube') {
        const projectId = state.result?.project_id || '';
        try {
            await fetch('/process/clip/send-to-input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: clip.name }),
            });
        } catch (e) { /* best-effort copy */ }
        const params = new URLSearchParams();
        params.set('file', clip.name);
        if (projectId) params.set('project_id', projectId);
        window.location.href = `/youtube-desk?${params.toString()}`;
    } else if (action === 'delete') {
        const confirmed = confirm(`Delete ${clip.name}?`);
        if (!confirmed) return;
        const res = await fetch('/process/clip/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: clip.name }),
        });
        const data = await res.json();
        if (data.success) {
            state.clips.splice(idx, 1);
            renderReviewGrid();
        } else {
            alert('Delete failed: ' + data.error);
        }
    } else if (action === 'save') {
        const input = document.querySelector(`.clip-name-input[data-idx="${idx}"]`);
        const newName = input.value.trim();
        if (!newName || newName === clip.name) return;
        const res = await fetch('/process/clip/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_name: clip.name, new_name: newName }),
        });
        const data = await res.json();
        if (data.success) {
            clip.name = newName;
            clip.url = `/download/clip/${newName}`;
            renderReviewGrid();
        } else {
            alert('Rename failed: ' + data.error);
        }
    }
});

// ---------- Export (Step 8) ----------
function renderExport() {
    const result = state.result;
    if (!result) return;

    const finalVideo = document.getElementById('finalVideo');
    if (finalVideo) {
        finalVideo.hidden = true;
        finalVideo.src = '';
    }

    const finalDownloadBtn = document.getElementById('downloadFinalBtn');
    if (finalDownloadBtn) {
        finalDownloadBtn.hidden = true;
        finalDownloadBtn.onclick = null;
    }

    const subtitleList = document.getElementById('subtitleList');
    if (subtitleList) {
        subtitleList.innerHTML = '';
        const items = [
            { name: 'SRT File', url: result.srt },
            { name: 'VTT File', url: result.vtt },
        ];
        items.forEach(item => {
            if (item.url && item.url !== 'null') {
                const div = document.createElement('div');
                div.className = 'download-item';
                div.innerHTML = `
                    <div><div class="file-name">${item.name}</div><div class="file-size">Subtitle file</div></div>
                    <a class="download-link" href="${item.url}">⬇ Download</a>
                `;
                subtitleList.appendChild(div);
            }
        });
    }

    const transcriptList = document.getElementById('transcriptList');
    if (transcriptList && result.transcript_file) {
        transcriptList.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'download-item';
        div.innerHTML = `
            <div><div class="file-name">Transcript JSON</div><div class="file-size">${result.transcript ? result.transcript.length + ' segments' : ''}</div></div>
            <a class="download-link" href="${result.transcript_file}">⬇ Download</a>
        `;
        transcriptList.appendChild(div);
    }

    const transcriptView = document.getElementById('transcriptView');
    if (transcriptView) {
        transcriptView.innerHTML = '';
        const t = result.subtitle_transcript || result.transcript;
        if (t && t.length) {
            t.forEach(seg => {
                const line = document.createElement('div');
                line.className = 'transcript-line';
                line.innerHTML = `
                    <span class="transcript-time">${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
                    <span class="transcript-text">${seg.text}</span>
                `;
                transcriptView.appendChild(line);
            });
        } else {
            transcriptView.innerHTML = '<p class="muted">No transcript available.</p>';
        }
    }

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.textContent = '⬇ Download All Clips (ZIP)';
        downloadAllBtn.onclick = () => {
            window.open('/download/all', '_blank');
        };
    }

    const exportQualityBtn = document.getElementById('exportQualityBtn');
    if (exportQualityBtn) {
        exportQualityBtn.onclick = () => {
            const quality = document.getElementById('exportQuality').value;
            const firstClip = (state.clips && state.clips[0] && state.clips[0].name) || (result.clips && result.clips[0]);
            if (!firstClip) return;
            window.open(`/download/export/${encodeURIComponent(firstClip)}?quality=${quality}`, '_blank');
        };
    }

    const clipCaptionsCard = document.getElementById('clipCaptionsCard');
    if (clipCaptionsCard) clipCaptionsCard.hidden = true;
}

function showStep(step) {
    state.currentStep = step;

    document.querySelectorAll('.wiz-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.wiz-panel[data-panel="${step}"]`).classList.add('active');

    document.querySelectorAll('.wiz-step').forEach(s => {
        const n = parseInt(s.dataset.wiz);
        s.classList.remove('active', 'done');
        if (n < step) s.classList.add('done');
        if (n === step) s.classList.add('active');
    });

wizPrev.hidden = step === 1;
    wizNext.hidden = false;

    if (step === 7) {
        wizNext.innerHTML = '<span class="spinner" hidden></span> Generate Clips';
        wizNext.disabled = !state.currentFile;
    } else if (step === 8) {
        wizNext.innerHTML = 'Export →';
        wizNext.disabled = false;
    } else if (step === 9) {
        wizNext.hidden = true;
        wizPrev.hidden = false;
        renderExport();
    } else {
        wizNext.innerHTML = 'Continue →';
        wizNext.disabled = false;
    }

    if (step === 7) buildSummary();
}

// ---------- Load file from query param (from YT Downloader) ----------
async function loadFileFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file');
    if (!filename) return;

    // Check if the file exists in the input directory
    try {
        const res = await fetch(`/download/input/${encodeURIComponent(filename)}`, { method: 'HEAD' });
        if (!res.ok) return;

        // Set the current file
        state.currentFile = filename;

        // Try to get metadata
        try {
            const metaRes = await fetch(`/process/metadata/${encodeURIComponent(filename)}`);
            const metaData = await metaRes.json();
            if (metaData.success) {
                state.currentMetadata = metaData.metadata;
                metaPreview.hidden = false;
                metaPreview.innerHTML = `
                    <div><strong>Filename</strong><br><span>${metaData.metadata.filename}</span></div>
                    <div><strong>Resolution</strong><br><span>${metaData.metadata.width}×${metaData.metadata.height}</span></div>
                    <div><strong>Duration</strong><br><span>${formatTime(metaData.metadata.duration)}</span></div>
                    <div><strong>FPS</strong><br><span>${metaData.metadata.fps}</span></div>
                `;
            }
        } catch (e) {
            // Metadata fetch failed, just set the file name
            metaPreview.hidden = false;
            metaPreview.innerHTML = `
                <div><strong>Filename</strong><br><span>${filename}</span></div>
                <div><strong>Source</strong><br><span>YouTube Downloader</span></div>
            `;
        }

        uploadStatus.textContent = `Loaded: ${filename}`;
        uploadStatus.style.color = 'var(--success)';

        // Auto-advance to language step
        showStep(2);

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
        console.error('Failed to load file from query:', e);
    }
}

// ---------- Studio Loader ----------
const studioLoader = document.getElementById('studioLoader');
function showStudioLoader() {
    if (studioLoader) studioLoader.hidden = false;
}
function hideStudioLoader() {
    if (studioLoader) studioLoader.hidden = true;
}

// ---------- Large File Warning ----------
const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500MB
let pendingPipelineStart = null;
const largeFileModal = document.getElementById('largeFileModal');
const largeFileClose = document.getElementById('largeFileClose');
const largeFileContinue = document.getElementById('largeFileContinue');
const largeFileCancel = document.getElementById('largeFileCancel');
const largeFileMessage = document.getElementById('largeFileMessage');

function showLargeFileWarning(sizeBytes) {
    if (!largeFileModal || !largeFileMessage) return;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    largeFileMessage.textContent = `This video is ${sizeMB} MB. Analysis, scene detection, framing, and clip generation may take longer than usual. Do you want to continue?`;
    largeFileModal.hidden = false;
}

function hideLargeFileWarning() {
    if (largeFileModal) largeFileModal.hidden = true;
}

if (largeFileClose) largeFileClose.addEventListener('click', hideLargeFileWarning);
if (largeFileCancel) largeFileCancel.addEventListener('click', hideLargeFileWarning);
if (largeFileContinue) {
    largeFileContinue.addEventListener('click', () => {
        hideLargeFileWarning();
        if (pendingPipelineStart) {
            pendingPipelineStart();
            pendingPipelineStart = null;
        }
    });
}
if (largeFileModal) {
    largeFileModal.addEventListener('click', (e) => {
        if (e.target === largeFileModal) {
            hideLargeFileWarning();
        }
    });
}

// Override startPipeline to check file size
const originalStartPipeline = startPipeline;
startPipeline = async function() {
    if (state.currentMetadata && state.currentMetadata.size_bytes > LARGE_FILE_THRESHOLD) {
        pendingPipelineStart = originalStartPipeline;
        showLargeFileWarning(state.currentMetadata.size_bytes);
        return;
    }
    await originalStartPipeline();
};

// ---------- Global Active Jobs Indicator ----------
const jobsIndicator = document.getElementById('jobsIndicator');
const jobsPopup = document.getElementById('jobsPopup');
const jobsCount = document.getElementById('jobsCount');
const jobsList = document.getElementById('jobsList');
let jobsPollInterval = null;

function updateJobsUI(data) {
    if (!jobsIndicator || !jobsCount || !jobsList) return;
    const count = data.count || 0;
    if (count > 0) {
        jobsIndicator.hidden = false;
        jobsCount.textContent = `${count} task${count !== 1 ? 's' : ''}`;
        jobsList.innerHTML = '';
        data.jobs.forEach(job => {
            const pct = job.total_steps ? Math.round((job.steps_completed / job.total_steps) * 100) : 0;
            const item = document.createElement('div');
            item.className = 'jobs-popup-item';
            item.innerHTML = `
                <div class="jobs-popup-item-header">
                    <span class="jobs-popup-item-name">${job.filename || job.job_id}</span>
                    <span class="jobs-popup-item-pct">${pct}%</span>
                </div>
                <div class="jobs-popup-item-step">${job.step || 'Processing...'}</div>
                <div class="jobs-popup-bar">
                    <div class="jobs-popup-bar-fill" style="width:${pct}%"></div>
                </div>
            `;
            jobsList.appendChild(item);
        });
    } else {
        jobsIndicator.hidden = true;
        jobsPopup.hidden = true;
    }
}

async function pollActiveJobs() {
    try {
        const res = await fetch('/process/active-jobs');
        const data = await res.json();
        if (data.success) updateJobsUI(data);
    } catch (e) {
        // Silently ignore polling errors
    }
}

if (jobsIndicator) {
    jobsIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        jobsPopup.hidden = !jobsPopup.hidden;
        if (!jobsPopup.hidden) pollActiveJobs();
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.jobs-indicator') && !e.target.closest('.jobs-popup')) {
            jobsPopup.hidden = true;
        }
    });
    jobsPollInterval = setInterval(pollActiveJobs, 3000);
    pollActiveJobs();
}

// ---------- Init ----------
checkFfmpeg();
showStep(1);
loadFileFromQuery();

// Show studio loader briefly on dashboard load if user is logged in
if (window.location.pathname === '/dashboard') {
    showStudioLoader();
    setTimeout(hideStudioLoader, 800);
}

const previewLink = document.querySelector('.preview-link');
if (previewLink) {
    previewLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.result) showStep(9);
    });
}
