/**
 * Caption Studio 2.0 Engine — UpClip Studio Phase 18
 * Advanced Typography, Word-by-Word Karaoke Highlighting, Drag & Drop Preview,
 * Direct Timeline Editing, Custom Style Presets & FFmpeg ASS Subtitle Integration.
 */

class CaptionStudioApp {
    constructor() {
        this.project = null;
        this.preload = null;
        this.videoFile = '';
        this.captions = [];
        this.selectedCaptionId = null;
        this.playheadTime = 0.0;
        this.zoom = 40; // px per second
        this.snapping = true;
        this.safeAreaVisible = true;
        this.isDirty = false;

        // Active Caption Style
        this.style = {
            font_family: "Inter",
            font_size: 34,
            font_weight: 800,
            scale: 100,
            text_color: "#FFFFFF",
            active_word_color: "#FBBF24",
            highlight_style: "text_color",
            background_color: "#000000",
            background_opacity: 0.0,
            corner_radius: 8,
            outline_color: "#000000",
            outline_width: 3,
            shadow_color: "#000000",
            shadow_blur: 4,
            alignment: "center",
            position: "bottom",
            position_y: 0,
            animation: "pop",
        };

        // Standard System Presets
        this.presets = [
            {
                id: "cap_clean",
                name: "Clean",
                category: "Clean",
                font_family: "Inter",
                font_size: 32,
                font_weight: 700,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#38BDF8",
                highlight_style: "text_color",
                outline_color: "#000000",
                outline_width: 1,
                shadow_color: "#000000",
                shadow_blur: 2,
                background_color: "#000000",
                background_opacity: 0.0,
                corner_radius: 6,
                position: "bottom",
                animation: "fade_in"
            },
            {
                id: "cap_bold",
                name: "Bold",
                category: "Bold",
                font_family: "Anton",
                font_size: 44,
                font_weight: 800,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#F43F5E",
                highlight_style: "text_color",
                outline_color: "#000000",
                outline_width: 4,
                shadow_color: "#000000",
                shadow_blur: 6,
                background_color: "#000000",
                background_opacity: 0.0,
                corner_radius: 8,
                position: "bottom",
                animation: "bounce"
            },
            {
                id: "cap_minimal",
                name: "Minimal",
                category: "Clean",
                font_family: "DM Sans",
                font_size: 28,
                font_weight: 600,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#FFFFFF",
                highlight_style: "text_color",
                outline_color: "#000000",
                outline_width: 0,
                shadow_color: "#000000",
                shadow_blur: 2,
                background_color: "#000000",
                background_opacity: 0.0,
                corner_radius: 4,
                position: "bottom",
                animation: "none"
            },
            {
                id: "cap_creator",
                name: "Creator",
                category: "Short-Form",
                font_family: "Poppins",
                font_size: 36,
                font_weight: 800,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#22D3EE",
                highlight_style: "background",
                outline_color: "#000000",
                outline_width: 2,
                shadow_color: "#000000",
                shadow_blur: 4,
                background_color: "#0F172A",
                background_opacity: 0.5,
                corner_radius: 8,
                position: "bottom",
                animation: "pop"
            },
            {
                id: "cap_podcast",
                name: "Podcast",
                category: "Speech",
                font_family: "Montserrat",
                font_size: 34,
                font_weight: 800,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#FBBF24",
                highlight_style: "text_color",
                outline_color: "#000000",
                outline_width: 0,
                shadow_color: "#000000",
                shadow_blur: 3,
                background_color: "#000000",
                background_opacity: 0.7,
                corner_radius: 8,
                position: "lower_third",
                animation: "fade_in"
            },
            {
                id: "cap_news",
                name: "News",
                category: "Editorial",
                font_family: "Arial Black",
                font_size: 36,
                font_weight: 900,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#EF4444",
                highlight_style: "accent",
                outline_color: "#000000",
                outline_width: 2,
                shadow_color: "#000000",
                shadow_blur: 4,
                background_color: "#1E293B",
                background_opacity: 0.85,
                corner_radius: 6,
                position: "bottom",
                animation: "slide_up"
            },
            {
                id: "cap_gaming",
                name: "Gaming",
                category: "High Energy",
                font_family: "Bebas Neue",
                font_size: 48,
                font_weight: 900,
                scale: 100,
                text_color: "#00FF66",
                active_word_color: "#FF0055",
                highlight_style: "scale",
                outline_color: "#000000",
                outline_width: 4,
                shadow_color: "#000000",
                shadow_blur: 8,
                background_color: "#000000",
                background_opacity: 0.0,
                corner_radius: 8,
                position: "bottom",
                animation: "pop"
            },
            {
                id: "cap_dynamic",
                name: "Dynamic",
                category: "Modern",
                font_family: "Plus Jakarta Sans",
                font_size: 38,
                font_weight: 800,
                scale: 100,
                text_color: "#FFFFFF",
                active_word_color: "#A855F7",
                highlight_style: "text_color",
                outline_color: "#000000",
                outline_width: 3,
                shadow_color: "#000000",
                shadow_blur: 5,
                background_color: "#000000",
                background_opacity: 0.0,
                corner_radius: 8,
                position: "bottom",
                animation: "pop"
            }
        ];

        this.customStyles = [];

        // History Stack
        this.history = [];
        this.historyIndex = -1;
        this.autosaveTimeout = null;

        // DOM References
        this.video = document.getElementById('captionVideoPlayer');
        this.playBtn = document.getElementById('playBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
        this.currentTimeDisplay = document.getElementById('currentTimeDisplay');
        this.durationDisplay = document.getElementById('durationDisplay');
        this.aspectRatioSelect = document.getElementById('aspectRatioSelect');
        this.toggleSafeGuide = document.getElementById('toggleSafeGuide');
        this.canvasSafeGuides = document.getElementById('canvasSafeGuides');
        this.previewCanvas = document.getElementById('previewCanvas');
        
        this.liveCaptionOverlay = document.getElementById('liveCaptionOverlay');
        this.captionDragHandle = document.getElementById('captionDragHandle');
        this.captionTextContent = document.getElementById('captionTextContent');

        // Timeline References
        this.rulerCanvas = document.getElementById('rulerCanvas');
        this.timelineTracksArea = document.getElementById('timelineTracksArea');
        this.timelinePlayhead = document.getElementById('timelinePlayhead');
        this.captionTrackLane = document.getElementById('captionTrackLane');
        this.timelineZoom = document.getElementById('timelineZoom');
        this.snapToggle = document.getElementById('snapToggle');
        this.timelineTimeReadout = document.getElementById('timelineTimeReadout');
        this.wordBreakdownBar = document.getElementById('wordBreakdownBar');

        this.init();
    }

    async init() {
        // Parse context injection
        const contextEl = document.getElementById('captionContextData');
        if (contextEl) {
            try {
                this.project = JSON.parse(contextEl.getAttribute('data-project') || 'null');
                this.preload = JSON.parse(contextEl.getAttribute('data-preload') || 'null');
                this.videoFile = contextEl.getAttribute('data-source-file') || '';
            } catch (e) {
                console.error("Caption Context parsing error:", e);
            }
        }

        if (this.project) {
            const titleEl = document.getElementById('projectNameText');
            if (titleEl) titleEl.textContent = this.project.name || 'Project';
        }

        // Initialize UI systems
        this.initTabs();
        this.initPresets();
        this.initCustomStyles();
        this.initPlayer();
        this.initLivePreview();
        this.initCaptionDragging();
        this.initInspector();
        this.initTimeline();
        this.initCaptionsList();
        this.initHotkeys();
        this.initContextMenus();
        this.initExport();
        this.initCommandPalette();

        // Load project video source and saved captions
        await this.loadInitialMediaAndCaptions();

        // Save first snapshot into history
        this.saveHistoryState();
    }

    // ---------- Tab Switching ----------
    initTabs() {
        const tabCaptions = document.getElementById('tabBtnCaptions');
        const tabStyles = document.getElementById('tabBtnStyles');
        const tabCustom = document.getElementById('tabBtnCustomStyles');
        const contentCaptions = document.getElementById('tabContentCaptions');
        const contentStyles = document.getElementById('tabContentStyles');
        const contentCustom = document.getElementById('tabContentCustomStyles');

        const selectTab = (activeBtn, activeContent) => {
            [tabCaptions, tabStyles, tabCustom].forEach(b => { if (b) b.classList.remove('active'); });
            [contentCaptions, contentStyles, contentCustom].forEach(c => { if (c) c.style.display = 'none'; });

            if (activeBtn) activeBtn.classList.add('active');
            if (activeContent) activeContent.style.display = 'block';
        };

        if (tabCaptions) tabCaptions.addEventListener('click', () => selectTab(tabCaptions, contentCaptions));
        if (tabStyles) tabStyles.addEventListener('click', () => selectTab(tabStyles, contentStyles));
        if (tabCustom) tabCustom.addEventListener('click', () => selectTab(tabCustom, contentCustom));
    }

    // ---------- Load Initial State ----------
    async loadInitialMediaAndCaptions() {
        let videoSrc = '';
        if (this.preload && this.preload.video_url) {
            videoSrc = this.preload.video_url;
            this.videoFile = this.preload.filename;
        } else if (this.videoFile) {
            videoSrc = this.videoFile.includes('clip') ? `/download/clip/${this.videoFile}` : `/download/input/${this.videoFile}`;
        }

        if (this.video && videoSrc) {
            this.video.src = videoSrc;
            this.video.load();
        }

        // Check if database project has saved captions & style
        let hasSavedCaptions = false;
        if (this.project && this.project.editor_state) {
            try {
                const parsed = JSON.parse(this.project.editor_state);
                if (parsed.captions && parsed.captions.length > 0) {
                    this.captions = parsed.captions;
                    hasSavedCaptions = true;
                }
                if (parsed.caption_style) {
                    this.style = Object.assign({}, this.style, parsed.caption_style);
                    this.updateInspectorFromStyle();
                }
            } catch (e) {
                console.warn("Could not parse project editor state:", e);
            }
        }

        // If no captions are present, check studio project clips
        if (!hasSavedCaptions && this.project) {
            try {
                const res = await fetch(`/studio/project/proj_${this.project.id}`);
                const data = await res.json();
                if (data.success && data.project && data.project.captions && data.project.captions.length > 0) {
                    this.captions = data.project.captions;
                }
            } catch (e) {
                console.warn("No pre-existing captions found in studio project:", e);
            }
        }

        // Load custom styles
        await this.fetchCustomStyles();

        // Render initial UI
        if (this.captions.length > 0) {
            this.renderCaptionsList();
            this.renderTimeline();
            this.drawRuler();
        } else {
            this.renderEmptyState();
        }

        this.applyStyleToPreview();
    }

    // ---------- Style Presets Grid ----------
    initPresets() {
        const grid = document.getElementById('presetsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        this.presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.dataset.presetId = preset.id;

            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-name">${preset.name}</span>
                    <span class="preset-badge">${preset.category}</span>
                </div>
                <div class="preset-preview-box" style="font-family:'${preset.font_family}', sans-serif; font-weight:${preset.font_weight};">
                    <span style="color:${preset.text_color}; -webkit-text-stroke: ${preset.outline_width > 0 ? '1px ' + preset.outline_color : 'none'};">Sample </span>
                    <span style="color:${preset.active_word_color}; -webkit-text-stroke: ${preset.outline_width > 0 ? '1px ' + preset.outline_color : 'none'}; text-shadow: 0 0 6px ${preset.shadow_color};">Caption</span>
                </div>
            `;

            card.addEventListener('click', () => {
                this.applyPreset(preset.id);
            });

            grid.appendChild(card);
        });
    }

    applyPreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return;

        this.style = Object.assign({}, this.style, preset);
        this.updateInspectorFromStyle();
        this.applyStyleToPreview();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Applied "${preset.name}" preset`, 'success');
    }

    // ---------- Custom Saved Styles ----------
    initCustomStyles() {
        const saveBtn = document.getElementById('saveCustomStyleBtn');
        const nameInput = document.getElementById('customStyleNameInput');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim() || 'My Custom Style';
                try {
                    const res = await fetch('/api/caption-studio/style/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_id: this.project ? this.project.id : '',
                            name: name,
                            style: this.style
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showToast(`Saved "${name}" style preset`, 'success');
                        nameInput.value = '';
                        await this.fetchCustomStyles();
                    }
                } catch (e) {
                    console.error("Save custom style error:", e);
                }
            });
        }
    }

    async fetchCustomStyles() {
        try {
            const res = await fetch(`/api/caption-studio/styles?project_id=${this.project ? this.project.id : ''}`);
            const data = await res.json();
            if (data.success && data.styles) {
                const userStyles = data.styles.filter(s => s.id && s.id.startsWith('cstyle_'));
                this.customStyles = userStyles;
                this.renderCustomStylesGrid();
            }
        } catch (e) {
            console.warn("Could not fetch custom styles:", e);
        }
    }

    renderCustomStylesGrid() {
        const grid = document.getElementById('customStylesGrid');
        if (!grid) return;
        grid.innerHTML = '';

        if (this.customStyles.length === 0) {
            grid.innerHTML = `<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:12px;">No saved styles yet. Customize in the Inspector and click "Save Current".</div>`;
            return;
        }

        this.customStyles.forEach(item => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            const st = item.style || {};

            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-name">${item.name}</span>
                    <span class="preset-badge">Custom</span>
                </div>
                <div class="preset-preview-box" style="font-family:'${st.font_family || 'Inter'}', sans-serif; font-weight:${st.font_weight || 700};">
                    <span style="color:${st.text_color || '#FFF'};">Sample </span>
                    <span style="color:${st.active_word_color || '#FBBF24'};">Text</span>
                </div>
            `;

            card.addEventListener('click', () => {
                this.style = Object.assign({}, this.style, st);
                this.updateInspectorFromStyle();
                this.applyStyleToPreview();
                this.markDirty();
                this.saveHistoryState();
                this.showToast(`Applied "${item.name}"`, 'success');
            });

            grid.appendChild(card);
        });
    }

    // ---------- Player & Controls ----------
    initPlayer() {
        if (!this.video) return;

        this.playBtn.addEventListener('click', () => this.togglePlayback());

        this.video.addEventListener('play', () => {
            this.playBtn.querySelector('.play-icon').style.display = 'none';
            this.playBtn.querySelector('.pause-icon').style.display = 'block';
            this.startPlayheadTicker();
        });

        this.video.addEventListener('pause', () => {
            this.playBtn.querySelector('.play-icon').style.display = 'block';
            this.playBtn.querySelector('.pause-icon').style.display = 'none';
            this.stopPlayheadTicker();
        });

        this.video.addEventListener('timeupdate', () => {
            this.playheadTime = this.video.currentTime;
            this.updateLiveCaptionDisplay();
            this.updateTimeDisplays();
            this.updatePlayheadVisual();
        });

        this.video.addEventListener('loadedmetadata', () => {
            this.updateTimeDisplays();
            this.drawRuler();
            this.renderTimeline();
        });

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => {
                this.video.muted = !this.video.muted;
                this.muteBtn.querySelector('.vol-icon').style.display = this.video.muted ? 'none' : 'block';
                this.muteBtn.querySelector('.mute-icon').style.display = this.video.muted ? 'block' : 'none';
            });
        }

        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', () => {
                this.video.volume = this.volumeSlider.value / 100;
                this.video.muted = this.video.volume === 0;
            });
        }

        if (this.playbackSpeedSelect) {
            this.playbackSpeedSelect.addEventListener('change', () => {
                this.video.playbackRate = parseFloat(this.playbackSpeedSelect.value);
            });
        }

        if (this.aspectRatioSelect) {
            this.aspectRatioSelect.addEventListener('change', () => {
                const ratio = this.aspectRatioSelect.value;
                this.previewCanvas.className = 'preview-canvas aspect-' + ratio.replace(':', '-');
            });
        }

        if (this.toggleSafeGuide) {
            this.toggleSafeGuide.addEventListener('click', () => {
                this.safeAreaVisible = !this.safeAreaVisible;
                this.canvasSafeGuides.hidden = !this.safeAreaVisible;
                this.toggleSafeGuide.classList.toggle('active', this.safeAreaVisible);
            });
        }
    }

    togglePlayback() {
        if (!this.video.src) return;
        if (this.video.paused) {
            this.video.play().catch(e => console.error("Playback error:", e));
        } else {
            this.video.pause();
        }
    }

    startPlayheadTicker() {
        this.ticker = requestAnimationFrame(() => this.tick());
    }

    stopPlayheadTicker() {
        if (this.ticker) cancelAnimationFrame(this.ticker);
    }

    tick() {
        if (!this.video.paused) {
            this.playheadTime = this.video.currentTime;
            this.updateLiveCaptionDisplay();
            this.updatePlayheadVisual();
            this.ticker = requestAnimationFrame(() => this.tick());
        }
    }

    updateTimeDisplays() {
        if (this.currentTimeDisplay) this.currentTimeDisplay.textContent = this.formatTime(this.playheadTime);
        if (this.durationDisplay && this.video) {
            const dur = this.video.duration || 0;
            this.durationDisplay.textContent = this.formatTime(dur);
        }
    }

    formatTime(secs) {
        if (isNaN(secs) || secs === undefined) secs = 0;
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        const ms = Math.floor((secs % 1) * 100).toString().padStart(2, '0');
        return `${m}:${s}.${ms}`;
    }

    // ---------- Live Draggable Video Preview with Word Karaoke ----------
    initLivePreview() {
        this.applyStyleToPreview();
    }

    updateLiveCaptionDisplay() {
        if (!this.captionTextContent) return;

        // Find active caption segment matching playheadTime
        const activeCap = this.captions.find(c => this.playheadTime >= c.start && this.playheadTime <= c.end);

        if (!activeCap) {
            if (this.captions.length === 0) {
                this.captionTextContent.innerHTML = '<span class="placeholder-caption-text">Your Caption Appears Here</span>';
            } else {
                this.captionTextContent.innerHTML = '';
            }
            return;
        }

        // Build word-level karaoke spans
        const words = activeCap.words && activeCap.words.length > 0 ? activeCap.words : null;
        const hlMode = this.style.highlight_style || "text_color";

        if (words) {
            const spans = words.map(w => {
                const isWordActive = this.playheadTime >= w.start && this.playheadTime <= w.end;
                const isPast = this.playheadTime > w.end;
                let wordClass = 'caption-word';
                let inlineStyle = '';

                if (isWordActive) {
                    wordClass += ' active-word';
                    if (hlMode === 'background') {
                        inlineStyle = `background:${this.style.active_word_color || '#FBBF24'}; color:#000000; padding:2px 6px; border-radius:4px;`;
                    } else if (hlMode === 'scale') {
                        inlineStyle = `transform:scale(1.15); display:inline-block; color:${this.style.active_word_color || '#FBBF24'};`;
                    } else if (hlMode === 'accent') {
                        inlineStyle = `color:${this.style.active_word_color || '#FBBF24'}; text-shadow:0 0 10px ${this.style.active_word_color || '#FBBF24'};`;
                    } else {
                        inlineStyle = `color:${this.style.active_word_color || '#FBBF24'};`;
                    }
                } else if (isPast) {
                    wordClass += ' past-word';
                }

                return `<span class="${wordClass}" style="${inlineStyle}" data-start="${w.start}" data-end="${w.end}">${w.text}</span>`;
            });
            this.captionTextContent.innerHTML = spans.join(' ');
        } else {
            this.captionTextContent.textContent = activeCap.text;
        }

        // Auto-select active segment in list if not actively typing
        if (activeCap.id !== this.selectedCaptionId && document.activeElement.tagName !== 'TEXTAREA') {
            this.highlightActiveSegmentInList(activeCap.id);
        }
    }

    applyStyleToPreview() {
        const handle = this.captionDragHandle;
        const overlay = this.liveCaptionOverlay;
        if (!handle || !overlay) return;

        const s = this.style;

        // Set Position
        overlay.className = 'live-caption-overlay pos-' + (s.position || 'bottom');
        if (s.position === 'custom') {
            overlay.style.top = (s.position_y || 0) + 'px';
        } else {
            overlay.style.top = '';
        }

        // Typography & Scale
        const scaleVal = (s.scale || 100) / 100.0;
        const baseFontSize = (s.font_size || 34) * scaleVal;

        handle.style.fontFamily = `"${s.font_family}", sans-serif`;
        handle.style.fontSize = baseFontSize + 'px';
        handle.style.fontWeight = s.font_weight || 800;
        handle.style.textAlign = s.alignment || 'center';
        handle.style.color = s.text_color || '#FFFFFF';

        // Background Box & Opacity
        const bgHex = s.background_color || '#000000';
        const bgOp = parseFloat(s.background_opacity || 0.0);
        const radius = s.corner_radius || 8;
        if (bgOp > 0.05) {
            handle.style.backgroundColor = this.hexToRgba(bgHex, bgOp);
            handle.style.padding = '8px 16px';
            handle.style.borderRadius = radius + 'px';
        } else {
            handle.style.backgroundColor = 'transparent';
            handle.style.padding = '2px 8px';
            handle.style.borderRadius = '0';
        }

        // Text Stroke / Outline
        const strokeW = parseInt(s.outline_width || 0);
        const strokeCol = s.outline_color || '#000000';
        if (strokeW > 0) {
            handle.style.webkitTextStroke = `${strokeW}px ${strokeCol}`;
        } else {
            handle.style.webkitTextStroke = 'none';
        }

        // Text Shadow
        const shadowBlur = parseInt(s.shadow_blur || 0);
        const shadowCol = s.shadow_color || '#000000';
        if (shadowBlur > 0) {
            handle.style.textShadow = `0 2px ${shadowBlur}px ${shadowCol}, 0 0 ${shadowBlur * 2}px ${shadowCol}`;
        } else {
            handle.style.textShadow = 'none';
        }

        // Animation Class
        handle.className = 'caption-drag-handle anim-' + (s.animation || 'pop');

        // Dynamic CSS Variable for Active Word Color
        document.documentElement.style.setProperty('--caption-active-word-color', s.active_word_color || '#FBBF24');
    }

    hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // ---------- Direct Caption Dragging on Video Canvas ----------
    initCaptionDragging() {
        let isDragging = false;
        let startY = 0;
        let initialTop = 0;
        const handle = this.captionDragHandle;
        const overlay = this.liveCaptionOverlay;
        if (!handle || !overlay) return;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('caption-resize-handle')) return;
            isDragging = true;
            startY = e.clientY;
            initialTop = handle.offsetTop;
            handle.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dy = e.clientY - startY;
            const newY = initialTop + dy;
            
            this.style.position = 'custom';
            this.style.position_y = newY;
            overlay.className = 'live-caption-overlay pos-custom';
            overlay.style.top = newY + 'px';

            document.querySelectorAll('.pos-preset-btn').forEach(b => b.classList.remove('active'));
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                handle.classList.remove('dragging');
                this.markDirty();
                this.saveHistoryState();
            }
        });
    }

    // ---------- Inspector & Two-Way Binding ----------
    initInspector() {
        const fontSelect = document.getElementById('fontFamilySelect');
        const sizeRange = document.getElementById('fontSizeRange');
        const sizeNum = document.getElementById('fontSizeNum');
        const sizeDisplay = document.getElementById('fontSizeDisplay');
        const sizeDecBtn = document.getElementById('fontSizeDecBtn');
        const sizeIncBtn = document.getElementById('fontSizeIncBtn');

        const scaleRange = document.getElementById('captionScaleRange');
        const scaleDisplay = document.getElementById('captionScaleDisplay');
        const scaleDecBtn = document.getElementById('scaleDecBtn');
        const scaleIncBtn = document.getElementById('scaleIncBtn');

        const weightSelect = document.getElementById('fontWeightSelect');
        const alignBtns = document.querySelectorAll('.segment-btn');

        if (fontSelect) {
            fontSelect.addEventListener('change', () => {
                this.style.font_family = fontSelect.value;
                this.applyStyleToPreview();
                this.markDirty();
                this.saveHistoryState();
            });
        }

        const updateSize = (val) => {
            val = Math.max(14, Math.min(90, parseInt(val) || 34));
            this.style.font_size = val;
            if (sizeRange) sizeRange.value = val;
            if (sizeNum) sizeNum.value = val;
            if (sizeDisplay) sizeDisplay.textContent = val;
            this.applyStyleToPreview();
            this.markDirty();
        };

        if (sizeRange) sizeRange.addEventListener('input', (e) => updateSize(e.target.value));
        if (sizeNum) sizeNum.addEventListener('input', (e) => updateSize(e.target.value));
        if (sizeDecBtn) sizeDecBtn.addEventListener('click', () => { updateSize((this.style.font_size || 34) - 2); this.saveHistoryState(); });
        if (sizeIncBtn) sizeIncBtn.addEventListener('click', () => { updateSize((this.style.font_size || 34) + 2); this.saveHistoryState(); });

        const updateScale = (val) => {
            val = Math.max(50, Math.min(200, parseInt(val) || 100));
            this.style.scale = val;
            if (scaleRange) scaleRange.value = val;
            if (scaleDisplay) scaleDisplay.textContent = val;
            this.applyStyleToPreview();
            this.markDirty();
        };

        if (scaleRange) scaleRange.addEventListener('input', (e) => updateScale(e.target.value));
        if (scaleDecBtn) scaleDecBtn.addEventListener('click', () => { updateScale((this.style.scale || 100) - 10); this.saveHistoryState(); });
        if (scaleIncBtn) scaleIncBtn.addEventListener('click', () => { updateScale((this.style.scale || 100) + 10); this.saveHistoryState(); });

        if (weightSelect) {
            weightSelect.addEventListener('change', () => {
                this.style.font_weight = parseInt(weightSelect.value);
                this.applyStyleToPreview();
                this.markDirty();
                this.saveHistoryState();
            });
        }

        alignBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                alignBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.style.alignment = btn.dataset.align;
                this.applyStyleToPreview();
                this.markDirty();
                this.saveHistoryState();
            });
        });

        // Colors
        const textColorPicker = document.getElementById('textColorPicker');
        const textColorHex = document.getElementById('textColorHex');
        const highlightColorPicker = document.getElementById('highlightColorPicker');
        const highlightColorHex = document.getElementById('highlightColorHex');
        const highlightStyleSelect = document.getElementById('highlightStyleSelect');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const bgColorHex = document.getElementById('bgColorHex');
        const bgOpacityRange = document.getElementById('bgOpacityRange');
        const bgOpacityDisplay = document.getElementById('bgOpacityDisplay');
        const bgRadiusRange = document.getElementById('bgRadiusRange');
        const bgRadiusDisplay = document.getElementById('bgRadiusDisplay');

        const bindColor = (picker, hexInput, styleProp) => {
            if (!picker || !hexInput) return;
            picker.addEventListener('input', () => {
                hexInput.value = picker.value.toUpperCase();
                this.style[styleProp] = picker.value;
                this.applyStyleToPreview();
                this.markDirty();
            });
            hexInput.addEventListener('input', () => {
                let val = hexInput.value;
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    picker.value = val;
                    this.style[styleProp] = val;
                    this.applyStyleToPreview();
                    this.markDirty();
                }
            });
            picker.addEventListener('change', () => this.saveHistoryState());
            hexInput.addEventListener('change', () => this.saveHistoryState());
        };

        bindColor(textColorPicker, textColorHex, 'text_color');
        bindColor(highlightColorPicker, highlightColorHex, 'active_word_color');
        bindColor(bgColorPicker, bgColorHex, 'background_color');

        if (highlightStyleSelect) {
            highlightStyleSelect.addEventListener('change', () => {
                this.style.highlight_style = highlightStyleSelect.value;
                this.updateLiveCaptionDisplay();
                this.markDirty();
                this.saveHistoryState();
            });
        }

        if (bgOpacityRange) {
            bgOpacityRange.addEventListener('input', (e) => {
                const op = parseInt(e.target.value);
                this.style.background_opacity = op / 100;
                if (bgOpacityDisplay) bgOpacityDisplay.textContent = op;
                this.applyStyleToPreview();
                this.markDirty();
            });
            bgOpacityRange.addEventListener('change', () => this.saveHistoryState());
        }

        if (bgRadiusRange) {
            bgRadiusRange.addEventListener('input', (e) => {
                const r = parseInt(e.target.value);
                this.style.corner_radius = r;
                if (bgRadiusDisplay) bgRadiusDisplay.textContent = r;
                this.applyStyleToPreview();
                this.markDirty();
            });
            bgRadiusRange.addEventListener('change', () => this.saveHistoryState());
        }

        // Stroke & Shadow
        const strokeRange = document.getElementById('strokeWidthRange');
        const strokeDisplay = document.getElementById('strokeWidthDisplay');
        const strokeColorPicker = document.getElementById('strokeColorPicker');
        const shadowRange = document.getElementById('shadowBlurRange');
        const shadowDisplay = document.getElementById('shadowBlurDisplay');
        const shadowColorPicker = document.getElementById('shadowColorPicker');

        if (strokeRange) {
            strokeRange.addEventListener('input', (e) => {
                const w = parseInt(e.target.value);
                this.style.outline_width = w;
                if (strokeDisplay) strokeDisplay.textContent = w;
                this.applyStyleToPreview();
                this.markDirty();
            });
            strokeRange.addEventListener('change', () => this.saveHistoryState());
        }

        if (strokeColorPicker) {
            strokeColorPicker.addEventListener('input', (e) => {
                this.style.outline_color = e.target.value;
                this.applyStyleToPreview();
                this.markDirty();
            });
            strokeColorPicker.addEventListener('change', () => this.saveHistoryState());
        }

        if (shadowRange) {
            shadowRange.addEventListener('input', (e) => {
                const b = parseInt(e.target.value);
                this.style.shadow_blur = b;
                if (shadowDisplay) shadowDisplay.textContent = b;
                this.applyStyleToPreview();
                this.markDirty();
            });
            shadowRange.addEventListener('change', () => this.saveHistoryState());
        }

        if (shadowColorPicker) {
            shadowColorPicker.addEventListener('input', (e) => {
                this.style.shadow_color = e.target.value;
                this.applyStyleToPreview();
                this.markDirty();
            });
            shadowColorPicker.addEventListener('change', () => this.saveHistoryState());
        }

        // Position Presets
        const posBtns = document.querySelectorAll('.pos-preset-btn');
        posBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                posBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.style.position = btn.dataset.pos;
                this.applyStyleToPreview();
                this.markDirty();
                this.saveHistoryState();
            });
        });

        // Animation Style
        const animSelect = document.getElementById('animationSelect');
        if (animSelect) {
            animSelect.addEventListener('change', () => {
                this.style.animation = animSelect.value;
                this.applyStyleToPreview();
                this.markDirty();
                this.saveHistoryState();
            });
        }

        // Reset Style
        const resetBtn = document.getElementById('resetStyleBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.applyPreset('cap_clean');
            });
        }

        // Apply To All Track Button
        const applyToTrackBtn = document.getElementById('applyToTrackBtn');
        if (applyToTrackBtn) {
            applyToTrackBtn.addEventListener('click', async () => {
                if (this.captions.length === 0) return;
                try {
                    const res = await fetch('/api/caption-studio/style/apply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            captions: this.captions,
                            style: this.style,
                            scope: 'all'
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showToast(`Applied style to all ${this.captions.length} captions`, 'success');
                        this.markDirty();
                    }
                } catch (e) {
                    console.error("Apply to track error:", e);
                }
            });
        }
    }

    updateInspectorFromStyle() {
        const s = this.style;
        const fontSelect = document.getElementById('fontFamilySelect');
        const sizeRange = document.getElementById('fontSizeRange');
        const sizeNum = document.getElementById('fontSizeNum');
        const sizeDisplay = document.getElementById('fontSizeDisplay');
        const scaleRange = document.getElementById('captionScaleRange');
        const scaleDisplay = document.getElementById('captionScaleDisplay');
        const weightSelect = document.getElementById('fontWeightSelect');
        const textColorPicker = document.getElementById('textColorPicker');
        const textColorHex = document.getElementById('textColorHex');
        const highlightColorPicker = document.getElementById('highlightColorPicker');
        const highlightColorHex = document.getElementById('highlightColorHex');
        const highlightStyleSelect = document.getElementById('highlightStyleSelect');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const bgColorHex = document.getElementById('bgColorHex');
        const bgOpacityRange = document.getElementById('bgOpacityRange');
        const bgOpacityDisplay = document.getElementById('bgOpacityDisplay');
        const bgRadiusRange = document.getElementById('bgRadiusRange');
        const bgRadiusDisplay = document.getElementById('bgRadiusDisplay');
        const strokeRange = document.getElementById('strokeWidthRange');
        const strokeDisplay = document.getElementById('strokeWidthDisplay');
        const strokeColorPicker = document.getElementById('strokeColorPicker');
        const shadowRange = document.getElementById('shadowBlurRange');
        const shadowDisplay = document.getElementById('shadowBlurDisplay');
        const shadowColorPicker = document.getElementById('shadowColorPicker');
        const animSelect = document.getElementById('animationSelect');

        if (fontSelect) fontSelect.value = s.font_family || 'Inter';
        if (sizeRange) sizeRange.value = s.font_size || 34;
        if (sizeNum) sizeNum.value = s.font_size || 34;
        if (sizeDisplay) sizeDisplay.textContent = s.font_size || 34;

        if (scaleRange) scaleRange.value = s.scale || 100;
        if (scaleDisplay) scaleDisplay.textContent = s.scale || 100;

        if (weightSelect) weightSelect.value = s.font_weight || 800;

        if (textColorPicker) textColorPicker.value = s.text_color || '#FFFFFF';
        if (textColorHex) textColorHex.value = (s.text_color || '#FFFFFF').toUpperCase();
        if (highlightColorPicker) highlightColorPicker.value = s.active_word_color || '#FBBF24';
        if (highlightColorHex) highlightColorHex.value = (s.active_word_color || '#FBBF24').toUpperCase();
        if (highlightStyleSelect) highlightStyleSelect.value = s.highlight_style || 'text_color';
        if (bgColorPicker) bgColorPicker.value = s.background_color || '#000000';
        if (bgColorHex) bgColorHex.value = (s.background_color || '#000000').toUpperCase();

        const opVal = Math.round((s.background_opacity || 0) * 100);
        if (bgOpacityRange) bgOpacityRange.value = opVal;
        if (bgOpacityDisplay) bgOpacityDisplay.textContent = opVal;

        if (bgRadiusRange) bgRadiusRange.value = s.corner_radius !== undefined ? s.corner_radius : 8;
        if (bgRadiusDisplay) bgRadiusDisplay.textContent = s.corner_radius !== undefined ? s.corner_radius : 8;

        if (strokeRange) strokeRange.value = s.outline_width !== undefined ? s.outline_width : 3;
        if (strokeDisplay) strokeDisplay.textContent = s.outline_width !== undefined ? s.outline_width : 3;
        if (strokeColorPicker) strokeColorPicker.value = s.outline_color || '#000000';

        if (shadowRange) shadowRange.value = s.shadow_blur !== undefined ? s.shadow_blur : 4;
        if (shadowDisplay) shadowDisplay.textContent = s.shadow_blur !== undefined ? s.shadow_blur : 4;
        if (shadowColorPicker) shadowColorPicker.value = s.shadow_color || '#000000';

        if (animSelect) animSelect.value = s.animation || 'pop';

        document.querySelectorAll('.pos-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pos === (s.position || 'bottom'));
        });

        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === (s.alignment || 'center'));
        });
    }

    // ---------- Caption List & Editor Panel ----------
    initCaptionsList() {
        const searchInput = document.getElementById('captionSearchInput');
        const searchReplaceToggle = document.getElementById('searchReplaceToggle');
        const replaceDrawer = document.getElementById('replaceDrawer');
        const executeReplaceBtn = document.getElementById('executeReplaceBtn');
        const autoSplitBtn = document.getElementById('autoSplitBtn');
        const addCaptionBtn = document.getElementById('addCaptionBtn');
        const autoCaptionBtn = document.getElementById('autoCaptionBtn');

        if (searchReplaceToggle && replaceDrawer) {
            searchReplaceToggle.addEventListener('click', () => {
                replaceDrawer.style.display = replaceDrawer.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase().trim();
                document.querySelectorAll('.caption-segment-card').forEach(card => {
                    const text = (card.querySelector('.caption-segment-textarea')?.value || '').toLowerCase();
                    card.style.display = (!query || text.includes(query)) ? 'flex' : 'none';
                });
            });
        }

        if (executeReplaceBtn) {
            executeReplaceBtn.addEventListener('click', async () => {
                const search = searchInput.value;
                const replace = document.getElementById('captionReplaceInput').value;
                const caseSensitive = document.getElementById('caseSensitiveCheck').checked;

                if (!search) return;

                try {
                    const res = await fetch('/api/caption-studio/search-replace', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            captions: this.captions,
                            search: search,
                            replace: replace,
                            case_sensitive: caseSensitive,
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.captions = data.captions;
                        this.renderCaptionsList();
                        this.renderTimeline();
                        this.markDirty();
                        this.saveHistoryState();
                        this.showToast(`Replaced ${data.replaceCount} occurrences`, 'success');
                    }
                } catch (e) {
                    console.error("Search replace error:", e);
                }
            });
        }

        if (autoSplitBtn) {
            autoSplitBtn.addEventListener('click', async () => {
                if (this.captions.length === 0) return;
                autoSplitBtn.disabled = true;
                autoSplitBtn.textContent = 'Splitting...';

                try {
                    const res = await fetch('/api/caption-studio/auto-split', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            captions: this.captions,
                            max_words: 5,
                            max_chars: 32,
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.captions = data.captions;
                        this.renderCaptionsList();
                        this.renderTimeline();
                        this.markDirty();
                        this.saveHistoryState();
                        this.showToast('Captions auto-split into short-form chunks', 'success');
                    }
                } catch (e) {
                    console.error("Auto-split error:", e);
                } finally {
                    autoSplitBtn.disabled = false;
                    autoSplitBtn.textContent = '✂ Auto-Split (1-5 Words)';
                }
            });
        }

        if (addCaptionBtn) {
            addCaptionBtn.addEventListener('click', () => {
                const lastCap = this.captions[this.captions.length - 1];
                const start = lastCap ? lastCap.end + 0.2 : this.playheadTime;
                const end = start + 3.0;

                const newCap = {
                    id: 'cap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    text: 'New Caption',
                    start: parseFloat(start.toFixed(2)),
                    end: parseFloat(end.toFixed(2)),
                    words: [
                        { text: 'New', start: start, end: start + 1.5 },
                        { text: 'Caption', start: start + 1.5, end: end },
                    ]
                };

                this.captions.push(newCap);
                this.captions.sort((a, b) => a.start - b.start);
                this.renderCaptionsList();
                this.renderTimeline();
                this.selectCaption(newCap.id);
                this.markDirty();
                this.saveHistoryState();
                this.showToast('Added new caption segment', 'success');
            });
        }

        if (autoCaptionBtn) {
            autoCaptionBtn.addEventListener('click', async () => {
                autoCaptionBtn.disabled = true;
                autoCaptionBtn.innerHTML = `<span>Transcribing...</span>`;

                try {
                    const res = await fetch('/api/caption-studio/auto-caption', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            video_file: this.videoFile,
                            project_id: this.project ? this.project.id : '',
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.captions) {
                        this.captions = data.captions;
                        this.renderCaptionsList();
                        this.renderTimeline();
                        this.drawRuler();
                        this.markDirty();
                        this.saveHistoryState();
                        this.showToast(`Auto-captioning generated ${data.captions.length} segments!`, 'success');
                    } else {
                        this.showToast(data.error || 'Transcription failed', 'error');
                    }
                } catch (e) {
                    console.error("Auto caption error:", e);
                    this.showToast('Auto-caption service unavailable', 'error');
                } finally {
                    autoCaptionBtn.disabled = false;
                    autoCaptionBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg><span>Auto Caption</span>`;
                }
            });
        }
    }

    renderCaptionsList() {
        const container = document.getElementById('captionSegmentsList');
        const countBadge = document.getElementById('captionsCountBadge');
        if (!container) return;

        if (countBadge) countBadge.textContent = this.captions.length;

        if (this.captions.length === 0) {
            this.renderEmptyState();
            return;
        }

        container.innerHTML = '';

        this.captions.forEach((cap, idx) => {
            const card = document.createElement('div');
            card.className = 'caption-segment-card' + (cap.id === this.selectedCaptionId ? ' selected' : '');
            card.dataset.captionId = cap.id;

            card.innerHTML = `
                <div class="caption-segment-header">
                    <div class="caption-index-badge">#${idx + 1}</div>
                    <div class="caption-timing-inputs">
                        <input type="text" class="timing-input start-time" value="${this.formatTime(cap.start)}" data-type="start">
                        <span>→</span>
                        <input type="text" class="timing-input end-time" value="${this.formatTime(cap.end)}" data-type="end">
                    </div>
                    <div class="caption-card-actions">
                        <button class="btn btn-icon btn-xs split-btn" title="Split at playhead">✂</button>
                        <button class="btn btn-icon btn-xs duplicate-btn" title="Duplicate">⎘</button>
                        <button class="btn btn-icon btn-xs delete-btn" title="Delete">✕</button>
                    </div>
                </div>
                <textarea class="caption-segment-textarea" rows="2">${cap.text}</textarea>
            `;

            // Card Selection
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA') {
                    this.selectCaption(cap.id);
                }
            });

            // Textarea Editing
            const textarea = card.querySelector('.caption-segment-textarea');
            textarea.addEventListener('focus', () => this.selectCaption(cap.id));
            textarea.addEventListener('input', () => {
                cap.text = textarea.value;
                this.updateCaptionWordsFromText(cap);
                this.updateLiveCaptionDisplay();
                this.markDirty();
            });
            textarea.addEventListener('blur', () => this.saveHistoryState());

            // Card Actions
            card.querySelector('.split-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.splitCaptionAtPlayhead(cap.id);
            });

            card.querySelector('.duplicate-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateCaption(cap.id);
            });

            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteCaption(cap.id);
            });

            container.appendChild(card);
        });
    }

    renderEmptyState() {
        const container = document.getElementById('captionSegmentsList');
        const countBadge = document.getElementById('captionsCountBadge');
        if (countBadge) countBadge.textContent = '0';
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state-caption">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted); margin-bottom:var(--space-2);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <div>No captions found.</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Click <b>Auto Caption</b> to transcribe audio with AI.</div>
            </div>
        `;
    }

    updateCaptionWordsFromText(cap) {
        const words = cap.text.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            cap.words = [];
            return;
        }

        const duration = Math.max(0.1, cap.end - cap.start);
        const wordDur = duration / words.length;

        cap.words = words.map((w, i) => ({
            text: w,
            start: parseFloat((cap.start + i * wordDur).toFixed(2)),
            end: parseFloat((cap.start + (i + 1) * wordDur).toFixed(2))
        }));
    }

    selectCaption(captionId) {
        this.selectedCaptionId = captionId;
        document.querySelectorAll('.caption-segment-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.captionId === captionId);
        });
        document.querySelectorAll('.caption-timeline-block').forEach(b => {
            b.classList.toggle('selected', b.dataset.captionId === captionId);
        });

        const cap = this.captions.find(c => c.id === captionId);
        if (cap) {
            this.renderWordBreakdown(cap);
        }
    }

    highlightActiveSegmentInList(captionId) {
        document.querySelectorAll('.caption-segment-card').forEach(c => {
            const isActive = c.dataset.captionId === captionId;
            c.classList.toggle('active-playback', isActive);
            if (isActive && !this.selectedCaptionId) {
                c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    renderWordBreakdown(cap) {
        if (!this.wordBreakdownBar) return;
        this.wordBreakdownBar.innerHTML = '';

        if (!cap.words || cap.words.length === 0) return;

        cap.words.forEach((w, i) => {
            const chip = document.createElement('div');
            chip.className = 'word-timing-chip';
            chip.innerHTML = `
                <span class="chip-word">${w.text}</span>
                <span class="chip-time">${(w.end - w.start).toFixed(2)}s</span>
            `;
            chip.addEventListener('click', () => {
                if (this.video) {
                    this.video.currentTime = w.start;
                }
            });
            this.wordBreakdownBar.appendChild(chip);
        });
    }

    // ---------- Timeline Lane Rendering ----------
    initTimeline() {
        if (this.timelineZoom) {
            this.timelineZoom.addEventListener('input', (e) => {
                this.zoom = parseInt(e.target.value);
                this.drawRuler();
                this.renderTimeline();
                this.updatePlayheadVisual();
            });
        }

        if (this.snapToggle) {
            this.snapToggle.addEventListener('click', () => {
                this.snapping = !this.snapping;
                this.snapToggle.classList.toggle('active', this.snapping);
            });
        }

        if (this.timelineTracksArea) {
            this.timelineTracksArea.addEventListener('click', (e) => {
                if (e.target.closest('.caption-timeline-block')) return;
                const rect = this.timelineTracksArea.getBoundingClientRect();
                const clickX = e.clientX - rect.left + this.timelineTracksArea.scrollLeft;
                const time = Math.max(0, clickX / this.zoom);
                if (this.video) {
                    this.video.currentTime = time;
                }
            });
        }
    }

    renderTimeline() {
        const lane = this.captionTrackLane;
        if (!lane) return;
        lane.innerHTML = '';

        this.captions.forEach(cap => {
            const left = cap.start * this.zoom;
            const width = Math.max(16, (cap.end - cap.start) * this.zoom);

            const block = document.createElement('div');
            block.className = 'caption-timeline-block' + (cap.id === this.selectedCaptionId ? ' selected' : '');
            block.dataset.captionId = cap.id;
            block.style.left = left + 'px';
            block.style.width = width + 'px';

            block.innerHTML = `
                <div class="block-trim-handle left-handle"></div>
                <div class="block-label">${cap.text}</div>
                <div class="block-trim-handle right-handle"></div>
            `;

            block.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectCaption(cap.id);
                if (this.video) this.video.currentTime = cap.start;
            });

            // Trim Handles & Block Moving
            block.querySelector('.left-handle').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.initBlockTrimming(cap, 'left', e);
            });

            block.querySelector('.right-handle').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.initBlockTrimming(cap, 'right', e);
            });

            block.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('block-trim-handle')) return;
                this.initBlockMoving(cap, block, e);
            });

            lane.appendChild(block);
        });
    }

    initBlockMoving(cap, blockEl, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initialStart = cap.start;
        let dur = cap.end - cap.start;
        let isMoving = false;

        const onMouseMove = (e) => {
            isMoving = true;
            const dx = (e.clientX - startX) / this.zoom;
            let targetStart = initialStart + dx;
            if (targetStart < 0) targetStart = 0;

            if (this.snapping) {
                const threshold = 8 / this.zoom;
                if (Math.abs(targetStart - this.playheadTime) < threshold) targetStart = this.playheadTime;
            }

            cap.start = parseFloat(targetStart.toFixed(2));
            cap.end = parseFloat((targetStart + dur).toFixed(2));

            blockEl.style.left = (cap.start * this.zoom) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isMoving) {
                this.captions.sort((a, b) => a.start - b.start);
                this.renderCaptionsList();
                this.renderTimeline();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initBlockTrimming(cap, edge, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initialStart = cap.start;
        let initialEnd = cap.end;
        let isTrimming = false;

        const onMouseMove = (e) => {
            isTrimming = true;
            const dx = (e.clientX - startX) / this.zoom;

            if (edge === 'left') {
                let newStart = initialStart + dx;
                if (newStart < 0) newStart = 0;
                if (newStart >= cap.end - 0.2) newStart = cap.end - 0.2;
                cap.start = parseFloat(newStart.toFixed(2));
            } else {
                let newEnd = initialEnd + dx;
                if (newEnd <= cap.start + 0.2) newEnd = cap.start + 0.2;
                cap.end = parseFloat(newEnd.toFixed(2));
            }

            this.renderTimeline();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isTrimming) {
                this.renderCaptionsList();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    drawRuler() {
        const canvas = this.rulerCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = '#2d2d2d';
        ctx.fillStyle = '#a1a1a1';
        ctx.font = '10px monospace';
        ctx.lineWidth = 1;

        let tickInterval = 5;
        if (this.zoom > 100) tickInterval = 0.5;
        else if (this.zoom > 50) tickInterval = 1;
        else if (this.zoom > 20) tickInterval = 5;
        else tickInterval = 10;

        const maxTime = width / this.zoom;

        for (let t = 0; t <= maxTime; t += tickInterval) {
            const x = t * this.zoom;
            ctx.beginPath();
            ctx.moveTo(x, height - 12);
            ctx.lineTo(x, height);
            ctx.stroke();

            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            const label = m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
            ctx.fillText(label, x + 4, height - 4);

            const sub = tickInterval / 5;
            for (let k = 1; k < 5; k++) {
                const subX = (t + k * sub) * this.zoom;
                ctx.beginPath();
                ctx.moveTo(subX, height - 6);
                ctx.lineTo(subX, height);
                ctx.stroke();
            }
        }
    }

    updatePlayheadVisual() {
        const x = this.playheadTime * this.zoom;
        if (this.timelinePlayhead) this.timelinePlayhead.style.left = x + 'px';
        if (this.timelineTimeReadout) this.timelineTimeReadout.textContent = this.formatTime(this.playheadTime);
    }

    // ---------- Undo / Redo Manager ----------
    saveHistoryState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const snapshot = JSON.stringify({
            captions: this.captions,
            style: this.style,
        });

        this.history.push(snapshot);
        this.historyIndex = this.history.length - 1;

        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreHistoryState(this.history[this.historyIndex]);
            this.markDirty();
            this.showToast('Undo', 'success');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistoryState(this.history[this.historyIndex]);
            this.markDirty();
            this.showToast('Redo', 'success');
        }
    }

    restoreHistoryState(snapshotStr) {
        try {
            const state = JSON.parse(snapshotStr);
            this.captions = state.captions || [];
            this.style = state.style || this.style;

            this.updateInspectorFromStyle();
            this.applyStyleToPreview();
            this.renderCaptionsList();
            this.renderTimeline();
            this.updateLiveCaptionDisplay();
        } catch (e) {
            console.error("Undo restore failed:", e);
        }
    }

    // ---------- Hotkeys ----------
    initHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            const key = e.key.toLowerCase();
            if (e.ctrlKey || e.metaKey) {
                if (key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) this.redo();
                    else this.undo();
                } else if (key === 'y') {
                    e.preventDefault();
                    this.redo();
                } else if (key === 's') {
                    e.preventDefault();
                    this.saveProjectState();
                } else if (key === 'd') {
                    e.preventDefault();
                    this.duplicateSelectedCaption();
                } else if (key === 'm') {
                    e.preventDefault();
                    this.mergeSelectedCaptions();
                } else if (key === 'k') {
                    e.preventDefault();
                    this.triggerCommandPalette();
                }
            } else {
                if (e.key === ' ') {
                    e.preventDefault();
                    this.togglePlayback();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.updateSelectedCaptionText();
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (this.selectedCaptionId) {
                        e.preventDefault();
                        this.deleteSelectedCaption();
                    }
                }
            }
        });

        const cmdBtn = document.getElementById('captionCommandPaletteBtn');
        if (cmdBtn) {
            cmdBtn.addEventListener('click', () => this.triggerCommandPalette());
        }
    }

    triggerCommandPalette() {
        const cmds = [
            "Auto Caption Audio",
            "Auto-Split Captions (1-5 Words)",
            "Apply Clean Style Preset",
            "Apply Bold Style Preset",
            "Apply Creator Style Preset",
            "Apply Podcast Style Preset",
            "Apply Gaming Style Preset",
            "Export Burned Subtitle Video",
            "Export Subtitle Files (SRT/VTT)",
            "Save Project State"
        ];
        const chosen = prompt("UpClip Studio Command Palette:\n\n" + cmds.map((c, i) => `${i+1}. ${c}`).join('\n') + "\n\nEnter command number (1-10):");
        if (!chosen) return;

        const num = parseInt(chosen.trim());
        if (num === 1) document.getElementById('autoCaptionBtn')?.click();
        else if (num === 2) document.getElementById('autoSplitBtn')?.click();
        else if (num === 3) this.applyPreset('cap_clean');
        else if (num === 4) this.applyPreset('cap_bold');
        else if (num === 5) this.applyPreset('cap_creator');
        else if (num === 6) this.applyPreset('cap_podcast');
        else if (num === 7) this.applyPreset('cap_gaming');
        else if (num === 8) document.getElementById('exportVideoBtn')?.click();
        else if (num === 9) document.getElementById('exportSubBtn')?.click();
        else if (num === 10) this.saveProjectState();
    }

    // ---------- Segment Operations ----------
    splitSelectedCaption() {
        if (!this.selectedCaptionId) {
            this.showToast('Select a caption segment to split', 'error');
            return;
        }
        this.splitCaptionAtPlayhead(this.selectedCaptionId);
    }

    async splitCaptionAtPlayhead(captionId) {
        const cap = this.captions.find(c => c.id === captionId);
        if (!cap) return;

        let splitTime = this.playheadTime;
        if (splitTime <= cap.start || splitTime >= cap.end) {
            splitTime = cap.start + (cap.end - cap.start) / 2.0;
        }

        try {
            const res = await fetch('/api/caption-studio/segments/split', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    captions: this.captions,
                    caption_id: captionId,
                    split_time: splitTime,
                })
            });
            const data = await res.json();
            if (data.success) {
                this.captions = data.captions;
                this.renderCaptionsList();
                this.renderTimeline();
                this.markDirty();
                this.saveHistoryState();
                this.showToast('Split caption segment', 'success');
            } else {
                this.showToast(data.error || 'Split failed', 'error');
            }
        } catch (e) {
            console.error("Split error:", e);
        }
    }

    mergeSelectedCaptions() {
        if (!this.selectedCaptionId) {
            this.showToast('Select a caption segment to merge', 'error');
            return;
        }
        this.mergeCaptionWithNext(this.selectedCaptionId);
    }

    async mergeCaptionWithNext(captionId) {
        const idx = this.captions.findIndex(c => c.id === captionId);
        if (idx < 0 || idx >= this.captions.length - 1) {
            this.showToast('No next caption to merge with', 'error');
            return;
        }

        const nextCap = this.captions[idx + 1];

        try {
            const res = await fetch('/api/caption-studio/segments/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    captions: this.captions,
                    caption_id_a: captionId,
                    caption_id_b: nextCap.id,
                })
            });
            const data = await res.json();
            if (data.success) {
                this.captions = data.captions;
                this.renderCaptionsList();
                this.renderTimeline();
                this.selectCaption(captionId);
                this.markDirty();
                this.saveHistoryState();
                this.showToast('Merged caption segments', 'success');
            } else {
                this.showToast(data.error || 'Merge failed', 'error');
            }
        } catch (e) {
            console.error("Merge error:", e);
        }
    }

    deleteSelectedCaption() {
        if (!this.selectedCaptionId) {
            this.showToast('No caption selected', 'error');
            return;
        }
        this.deleteCaption(this.selectedCaptionId);
    }

    async deleteCaption(captionId) {
        try {
            const res = await fetch('/api/caption-studio/segments/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ captions: this.captions, caption_id: captionId }),
            });
            const data = await res.json();
            if (data.success) {
                this.captions = data.captions;
                this.selectedCaptionId = null;
                this.renderCaptionsList();
                this.renderTimeline();
                this.markDirty();
                this.saveHistoryState();
                this.showToast('Caption deleted', 'success');
            }
        } catch (e) {
            console.error("Delete error:", e);
        }
    }

    duplicateSelectedCaption() {
        if (!this.selectedCaptionId) {
            this.showToast('Select a caption segment to duplicate', 'error');
            return;
        }
        this.duplicateCaption(this.selectedCaptionId);
    }

    async duplicateCaption(captionId) {
        try {
            const res = await fetch('/api/caption-studio/segments/duplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ captions: this.captions, caption_id: captionId }),
            });
            const data = await res.json();
            if (data.success) {
                this.captions = data.captions;
                this.renderCaptionsList();
                this.renderTimeline();
                this.selectCaption(captionId);
                this.markDirty();
                this.saveHistoryState();
                this.showToast('Caption duplicated', 'success');
            } else {
                this.showToast(data.error || 'Duplicate failed', 'error');
            }
        } catch (e) {
            console.error("Duplicate error:", e);
        }
    }

    updateSelectedCaptionText() {
        if (!this.selectedCaptionId) {
            this.showToast('Select a caption segment to edit', 'error');
            return;
        }
        const card = document.querySelector(`.caption-segment-card[data-caption-id="${this.selectedCaptionId}"]`);
        if (card) {
            const textarea = card.querySelector('.caption-segment-textarea');
            if (textarea) {
                textarea.focus();
                textarea.select();
            }
        }
    }

    // ---------- Context Menu ----------
    initContextMenus() {
        const listContainer = document.getElementById('captionSegmentsList');
        const menu = document.getElementById('captionContextMenu');
        if (!listContainer || !menu) return;

        listContainer.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.caption-segment-card');
            if (!card) return;
            e.preventDefault();
            this.selectCaption(card.dataset.captionId);
            
            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
        });

        document.getElementById('ctxEdit')?.addEventListener('click', () => {
            menu.style.display = 'none';
            this.updateSelectedCaptionText();
        });
        document.getElementById('ctxSplit')?.addEventListener('click', () => {
            menu.style.display = 'none';
            this.splitSelectedCaption();
        });
        document.getElementById('ctxMerge')?.addEventListener('click', () => {
            menu.style.display = 'none';
            this.mergeSelectedCaptions();
        });
        document.getElementById('ctxDuplicate')?.addEventListener('click', () => {
            menu.style.display = 'none';
            this.duplicateSelectedCaption();
        });
        document.getElementById('ctxApplyStyle')?.addEventListener('click', async () => {
            menu.style.display = 'none';
            if (this.selectedCaptionId) {
                await fetch('/api/caption-studio/style/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        captions: this.captions,
                        style: this.style,
                        target_ids: [this.selectedCaptionId],
                        scope: 'selected'
                    })
                });
                this.showToast('Applied active style to segment', 'success');
            }
        });
        document.getElementById('ctxDelete')?.addEventListener('click', () => {
            menu.style.display = 'none';
            this.deleteSelectedCaption();
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }

    // ---------- Auto/Manual Save ----------
    markDirty() {
        this.isDirty = true;
        const ind = document.getElementById('dirtyIndicator');
        if (ind) ind.style.display = 'inline';

        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) saveStatus.textContent = 'Unsaved changes';

        if (this.autosaveTimeout) clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = setTimeout(() => this.saveProjectState(true), 2000);
    }

    async saveProjectState(isAutosave = false) {
        if (!this.isDirty && isAutosave) return;

        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) saveStatus.textContent = 'Saving...';

        try {
            const res = await fetch('/api/caption-studio/save-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: this.project ? this.project.id : '',
                    captions: this.captions,
                    style: this.style,
                })
            });
            const data = await res.json();
            if (data.success) {
                this.isDirty = false;
                const ind = document.getElementById('dirtyIndicator');
                if (ind) ind.style.display = 'none';
                if (saveStatus) saveStatus.textContent = 'Saved';
            }
        } catch (e) {
            console.error("Save error:", e);
            if (saveStatus) saveStatus.textContent = 'Save failed';
        }
    }

    // ---------- Video & Subtitle Export Manager ----------
    initExport() {
        const modal = document.getElementById('exportModal');
        const openBtn = document.getElementById('exportVideoBtn');
        const closeBtn = document.getElementById('exportModalClose');
        const cancelBtn = document.getElementById('exportCancelBtn');
        const startBtn = document.getElementById('exportStartBtn');
        const statusPanel = document.getElementById('exportStatusPanel');
        const exportSubBtn = document.getElementById('exportSubBtn');
        const importSubBtn = document.getElementById('importSubBtn');
        const subFileInput = document.getElementById('subFileInput');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                if (this.captions.length === 0) {
                    this.showToast('Please add or generate captions before exporting', 'error');
                    return;
                }
                modal.hidden = false;
            });
        }

        const closeModal = () => {
            modal.hidden = true;
            if (statusPanel) statusPanel.style.display = 'none';
            if (startBtn) startBtn.disabled = false;
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                startBtn.disabled = true;
                statusPanel.style.display = 'block';

                const statusText = document.getElementById('exportStatusText');
                const percentText = document.getElementById('exportPercentText');
                const bar = document.getElementById('exportProgressBar');

                statusText.textContent = 'Building ASS animated subtitle styles...';
                percentText.textContent = '0%';
                bar.style.width = '0%';

                let progress = 0;
                const timer = setInterval(() => {
                    if (progress < 90) {
                        progress += Math.floor(Math.random() * 9) + 3;
                        if (progress > 90) progress = 90;
                        statusText.textContent = progress > 50 ? 'Burning styled subtitles with FFmpeg...' : 'Generating typography vectors...';
                        percentText.textContent = progress + '%';
                        bar.style.width = progress + '%';
                    }
                }, 350);

                try {
                    const aspectPreset = document.getElementById('exportAspectPreset')?.value || '9:16_1080p';
                    const res = await fetch('/api/caption-studio/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            videoFileName: this.videoFile,
                            project_id: this.project ? this.project.id : '',
                            captions: this.captions,
                            style: this.style,
                            aspectPreset: aspectPreset
                        })
                    });
                    const data = await res.json();
                    clearInterval(timer);

                    if (data.success) {
                        percentText.textContent = '100%';
                        bar.style.width = '100%';
                        statusText.textContent = 'Captioned video rendered successfully!';
                        this.showToast('Export complete!', 'success');

                        setTimeout(() => {
                            closeModal();
                            window.open(data.download_url, '_blank');
                        }, 1200);
                    } else {
                        statusText.textContent = 'Export failed: ' + data.error;
                        startBtn.disabled = false;
                    }
                } catch (e) {
                    clearInterval(timer);
                    console.error("Export request failed:", e);
                    statusText.textContent = 'Export request failed';
                    startBtn.disabled = false;
                }
            });
        }

        // Export Subtitles SRT/VTT
        if (exportSubBtn) {
            exportSubBtn.addEventListener('click', async () => {
                if (this.captions.length === 0) {
                    this.showToast('No captions to export', 'error');
                    return;
                }
                try {
                    const res = await fetch('/api/caption-studio/export-captions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            captions: this.captions,
                            project_id: this.project ? this.project.id : '',
                            format: 'both',
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.files) {
                        this.showToast('SRT & VTT subtitle files exported', 'success');
                        if (data.files.srt) window.open(data.files.srt.url, '_blank');
                    }
                } catch (e) {
                    console.error("Export subtitles error:", e);
                }
            });
        }

        // Import Subtitles
        if (importSubBtn && subFileInput) {
            importSubBtn.addEventListener('click', () => subFileInput.click());
            subFileInput.addEventListener('change', async () => {
                if (subFileInput.files.length === 0) return;
                const file = subFileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);
                if (this.project) formData.append('project_id', this.project.id);

                try {
                    const res = await fetch('/api/caption-studio/import', {
                        method: 'POST',
                        body: formData,
                    });
                    const data = await res.json();
                    if (data.success && data.captions) {
                        this.captions = data.captions;
                        this.renderCaptionsList();
                        this.renderTimeline();
                        this.drawRuler();
                        this.markDirty();
                        this.saveHistoryState();
                        this.showToast(`Imported ${data.captions.length} captions`, 'success');
                    } else {
                        this.showToast(data.error || 'Import failed', 'error');
                    }
                } catch (e) {
                    console.error("Import error:", e);
                }
            });
        }
    }

    initCommandPalette() {
        if (!window.UpClipCommands) return;

        window.UpClipCommands.register({
            id: "caption_save_project",
            label: "Save Caption Project",
            category: "Project",
            shortcut: "Ctrl+S",
            keywords: ["save", "persist", "disk"],
            action: () => this.saveProject()
        });

        window.UpClipCommands.register({
            id: "caption_split_segment",
            label: "Split Caption Segment at Playhead",
            category: "Caption",
            shortcut: "S",
            keywords: ["cut", "slice", "split", "caption"],
            action: () => this.splitSegmentAtPlayhead()
        });

        window.UpClipCommands.register({
            id: "caption_merge_next",
            label: "Merge Caption with Next",
            category: "Caption",
            shortcut: "M",
            keywords: ["merge", "combine", "join"],
            action: () => this.mergeWithNext()
        });

        window.UpClipCommands.register({
            id: "caption_duplicate_segment",
            label: "Duplicate Caption Segment",
            category: "Caption",
            shortcut: "Ctrl+D",
            keywords: ["clone", "copy", "duplicate"],
            action: () => this.duplicateSelectedCaption()
        });

        window.UpClipCommands.register({
            id: "caption_delete_segment",
            label: "Delete Caption Segment",
            category: "Caption",
            shortcut: "Delete",
            keywords: ["remove", "trash", "delete"],
            action: () => this.deleteSelectedCaption()
        });

        window.UpClipCommands.register({
            id: "caption_export_burned",
            label: "Export Video with Burned Captions",
            category: "Project",
            shortcut: "Ctrl+E",
            keywords: ["render", "burn", "export", "mp4"],
            action: () => {
                const exportModal = document.getElementById('captionExportModal');
                if (exportModal) {
                    exportModal.classList.remove('hidden');
                    exportModal.style.display = 'flex';
                }
            }
        });

        window.UpClipCommands.register({
            id: "caption_export_srt",
            label: "Export Subtitles (.SRT / .VTT)",
            category: "Caption",
            keywords: ["srt", "vtt", "subtitles", "text"],
            action: () => {
                const exportBtn = document.getElementById('exportSubtitlesBtn');
                if (exportBtn) exportBtn.click();
            }
        });
    }

    showToast(message, type = 'success') {
        if (window.UpClipToast) {
            window.UpClipToast.show(message, type);
        } else {
            console.log(`[Toast ${type}] ${message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.captionStudio = new CaptionStudioApp();
});
