// static/js/editor.js
/**
 * Professional Video Editor, Graphics Studio, Audio Studio & AI Intelligent Editing Controller for UpClip Studio.
 * Handles video cuts, graphics burning, multi-track audio engine (Video Audio, Music, Voice, SFX),
 * AI video analysis (scenes, silence detection, highlights, smart reframing, advisor suggestions),
 * Web Audio preview mixing, waveforms, volume/pan/fade controls, audio ducking, undo/redo, autosave, and export.
 */

class UpClipEditor {
    constructor() {
        this.project = null;
        this.fileParam = null;
        
        // Editor State
        this.clips = []; // Video clips [{ id, filename, start, end, duration, timelineStart, track: 'video', transform }]
        this.graphics = []; // Graphic layers [{ id, type, name, start, end, duration, layerOrder, visible, locked, transform, appearance, typography, content, animation }]
        this.audioTracks = [
            { id: 'track_video_audio', type: 'video_audio', name: 'Video Audio', volume: 100, pan: 0, muted: false, solo: false, locked: false },
            { id: 'track_music', type: 'music', name: 'Music', volume: 80, pan: 0, muted: false, solo: false, locked: false, ducking: { enabled: true, amount: 60 } },
            { id: 'track_voice', type: 'voice', name: 'Voice / Voiceover', volume: 100, pan: 0, muted: false, solo: false, locked: false },
            { id: 'track_sfx', type: 'sfx', name: 'SFX', volume: 90, pan: 0, muted: false, solo: false, locked: false }
        ];
        this.audioClips = []; // Audio clips [{ id, trackId, name, filename, url, start, end, duration, sourceStart, sourceEnd, volume, pan, fadeIn, fadeOut, speed, muted }]
        
        // AI Studio State
        this.aiAnalysis = {
            scenes: [],
            silences: [],
            keep_segments: [],
            total_silence: 0,
            highlights: [],
            reframe: {},
            suggestions: []
        };
        this.activeAiTab = 'highlights';
        this.isAnalyzing = false;
        
        this.playheadTime = 0.0;
        this.selectedClipId = null;
        this.selectedGraphicId = null;
        this.selectedAudioClipId = null;
        this.activeSidebarTab = 'media';
        this.zoom = 30; // Timeline pixels-per-second factor
        this.snapping = true;
        this.safeAreaVisible = true;
        this.isDirty = false;
        
        // Phase 11 & 12 Workspace, Markers & AI Copilot State
        this.currentWorkspace = 'editing';
        this.markers = [];
        this.timestampNotes = [];
        this.reviewComments = [];
        this.pendingCopilotAction = null;
        
        // Audio Engine
        this.previewAudio = new Audio();
        this.activeAudioNodes = [];
        
        // Undo/Redo Stacks
        this.history = [];
        this.historyIndex = -1;
        this.autosaveTimeout = null;
        
        // DOM Elements
        this.video = document.getElementById('editorVideoPlayer');
        this.playBtn = document.getElementById('playBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
        this.currentTimeDisplay = document.getElementById('currentTimeDisplay');
        this.durationDisplay = document.getElementById('durationDisplay');
        this.aspectRatioSelect = document.getElementById('aspectRatioSelect');
        this.toggleSafeGuide = document.getElementById('toggleSafeGuide');
        this.canvasSafeGuides = document.getElementById('canvasSafeGuides');
        this.videoTransformWrapper = document.getElementById('videoTransformWrapper');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.graphicsCanvasOverlay = document.getElementById('graphicsCanvasOverlay');
        
        // Inspector References
        this.inspectorEmptyState = document.getElementById('inspectorEmptyState');
        this.videoInspectorGroup = document.getElementById('videoInspectorGroup');
        this.graphicInspectorGroup = document.getElementById('graphicInspectorGroup');
        this.audioClipInspectorGroup = document.getElementById('audioClipInspectorGroup');
        this.aiInspectorGroup = document.getElementById('aiInspectorGroup');
        
        // Video Inspector inputs
        this.inspectXRange = document.getElementById('inspectXRange');
        this.inspectXNum = document.getElementById('inspectXNum');
        this.inspectYRange = document.getElementById('inspectYRange');
        this.inspectYNum = document.getElementById('inspectYNum');
        this.inspectScaleRange = document.getElementById('inspectScaleRange');
        this.inspectScaleNum = document.getElementById('inspectScaleNum');
        this.inspectRotRange = document.getElementById('inspectRotRange');
        this.inspectRotNum = document.getElementById('inspectRotNum');
        this.inspectOpacityRange = document.getElementById('inspectOpacityRange');
        this.inspectOpacityNum = document.getElementById('inspectOpacityNum');
        this.resetTransformBtn = document.getElementById('resetTransformBtn');

        this.waveformCache = {};
        this.mediaLibrary = [];
        this.mediaFilter = 'all';
        this.mediaSearchQuery = '';
        this.mediaSortBy = 'date';
        this.mediaViewMode = 'grid';

        // Timeline References
        this.rulerCanvas = document.getElementById('rulerCanvas');
        this.timelineTracksArea = document.getElementById('timelineTracksArea');
        this.timelinePlayhead = document.getElementById('timelinePlayhead');
        this.videoTrackLane = document.getElementById('videoTrackLane');
        this.graphicsTrackLane = document.getElementById('graphicsTrackLane');
        this.timelineZoom = document.getElementById('timelineZoom');
        this.snapToggle = document.getElementById('snapToggle');
        this.timelineTimeReadout = document.getElementById('timelineTimeReadout');

        this.init();
    }

    async init() {
        const contextEl = document.getElementById('projectContextData');
        if (contextEl) {
            try {
                this.project = JSON.parse(contextEl.getAttribute('data-project') || 'null');
                this.fileParam = contextEl.getAttribute('data-file-param') || null;
            } catch (e) {
                console.error("Context injection parsing failed:", e);
            }
        }
        
        if (!this.project) {
            alert("No project loaded. Redirecting to projects workspace.");
            window.location.href = "/";
            return;
        }

        const titleText = document.getElementById('projectNameText');
        if (titleText) titleText.textContent = this.project.name;

        // Initialize UI, Audio, Graphics & AI Subsystems
        this.initSidebarNavigation();
        this.initAiStudio();
        this.initAudioLibrary();
        this.initGraphicsLibrary();
        this.initTextPresets();
        this.initPlayer();
        this.initCanvasDragging();
        this.initInspector();
        this.initTimeline();
        this.initTrackHeaders();
        this.initHotkeys();
        this.initContextMenus();
        this.initGraphicKeyframes();
        this.initExportCenterAndQueue();
        this.initMediaManager();
        this.initAssetUpload();
        this.initAudioUpload();
        this.initTemplatesAndPresets();
        this.initProjectManagementActions();
        this.initWorkspaceSwitcher();
        this.initCommandPalette();
        this.initNotesAndMarkers();
        this.initVersionManagement();
        this.initDiagnosticsModal();
        this.initAiCopilot();
        this.initContentIntelligenceAndShortsFactory();
        this.initMotionGraphicsAndVisualDesignSystem();
        this.initProfessionalAudioStudio();
        
        // Load initial state
        await this.loadProjectState();
        await this.loadFonts();
        this.saveHistoryState();
    }

    // ---------- Sidebar Tool Navigation ----------
    initSidebarNavigation() {
        const tools = [
            { id: 'toolMedia', pane: 'subpaneMedia', name: 'media' },
            { id: 'toolTemplates', pane: 'subpaneTemplates', name: 'templates' },
            { id: 'toolAI', pane: 'subpaneAI', name: 'ai' },
            { id: 'toolAudio', pane: 'subpaneAudio', name: 'audio' },
            { id: 'toolGraphics', pane: 'subpaneGraphics', name: 'graphics' },
            { id: 'toolText', pane: 'subpaneText', name: 'text' },
            { id: 'toolLayers', pane: 'subpaneLayers', name: 'layers' },
            { id: 'toolNotes', pane: 'subpaneNotes', name: 'notes' },
            { id: 'toolIntelligence', pane: 'subpaneIntelligence', name: 'intelligence' }
        ];

        tools.forEach(t => {
            const btn = document.getElementById(t.id);
            if (btn) {
                btn.addEventListener('click', () => {
                    tools.forEach(other => {
                        document.getElementById(other.id)?.classList.remove('active');
                        const p = document.getElementById(other.pane);
                        if (p) p.style.display = 'none';
                    });
                    btn.classList.add('active');
                    const targetPane = document.getElementById(t.pane);
                    if (targetPane) targetPane.style.display = 'block';
                    this.activeSidebarTab = t.name;

                    if (t.name === 'templates') {
                        this.loadTemplatesAndPresets();
                    } else if (t.name === 'layers') {
                        this.renderLayersStack();
                    } else if (t.name === 'audio') {
                        this.fetchAudioLibrary();
                    } else if (t.name === 'intelligence') {
                        this.loadContentIntelligence();
                    } else if (t.name === 'ai') {
                        if (!this.selectedClipId && !this.selectedGraphicId && !this.selectedAudioClipId) {
                            this.showAiInspector();
                        }
                    }
                });
            }
        });
    }

    showAiInspector() {
        if (this.inspectorEmptyState) this.inspectorEmptyState.style.display = 'none';
        if (this.videoInspectorGroup) this.videoInspectorGroup.style.display = 'none';
        if (this.graphicInspectorGroup) this.graphicInspectorGroup.style.display = 'none';
        if (this.audioClipInspectorGroup) this.audioClipInspectorGroup.style.display = 'none';
        if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'block';
    }

    async loadFonts() {
        try {
            const res = await fetch('/api/editor/fonts');
            const data = await res.json();
            if (data.success && data.categories) {
                this.populateFontSelects(data.categories);
            }
        } catch (e) {
            console.error("Failed to load fonts:", e);
        }
    }

    populateFontSelects(categories) {
        const selects = [document.getElementById('gFontFamilySelect'), document.getElementById('fontFamilySelect')];
        selects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '';
            Object.entries(categories).forEach(([category, fonts]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category;
                fonts.forEach(font => {
                    const option = document.createElement('option');
                    option.value = font;
                    option.textContent = font;
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            });
            if (currentValue) select.value = currentValue;
        });
    }

    // ---------- Load Initial State ----------
    async loadProjectState() {
        if (this.project.editor_state) {
            try {
                const saved = JSON.parse(this.project.editor_state);
                this.clips = saved.clips || [];
                this.graphics = saved.graphics || [];
                if (saved.audioTracks) this.audioTracks = saved.audioTracks;
                if (saved.audioClips) this.audioClips = saved.audioClips;
                if (saved.aiAnalysis) this.aiAnalysis = saved.aiAnalysis;
                this.zoom = saved.zoom || 30;
                this.snapping = saved.snapping !== undefined ? saved.snapping : true;
                this.safeAreaVisible = saved.safeAreaVisible !== undefined ? saved.safeAreaVisible : true;
                if (this.timelineZoom) this.timelineZoom.value = this.zoom;
            } catch (e) {
                console.error("Failed to parse project editor state:", e);
            }
        }

        // Fetch clips if empty
        if (this.clips.length === 0) {
            try {
                const res = await fetch(`/studio/project/proj_${this.project.id}`);
                const data = await res.json();
                if (data.success && data.project && data.project.clips) {
                    let totalStart = 0;
                    data.project.clips.forEach((c, idx) => {
                        this.clips.push({
                            id: 'clip_' + idx + '_' + Date.now(),
                            filename: c.filename,
                            start: 0,
                            end: 10,
                            duration: 10,
                            timelineStart: totalStart,
                            track: 'video',
                            transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }
                        });
                        totalStart += 10.5;
                    });
                }
            } catch (e) {
                console.warn("Could not retrieve project clips list:", e);
            }
        }

        this.renderLibrary();
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.renderAiStudioLists();
        this.drawRuler();
        this.updatePlayerSource();
    }

    // ---------- AI Studio Assistant Controller ----------
    initAiStudio() {
        const analyzeBtn = document.getElementById('runAiAnalyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.runAiAnalysis());
        }

        // Sub-tabs for AI insights
        const chips = document.querySelectorAll('.ai-insight-chips .chip-btn');
        chips.forEach(btn => {
            btn.addEventListener('click', () => {
                chips.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                this.activeAiTab = tab;

                ['Highlights', 'Silence', 'Scenes', 'Suggestions'].forEach(t => {
                    const el = document.getElementById(`aiTab${t}`);
                    if (el) el.style.display = t.toLowerCase() === tab ? 'block' : 'none';
                });
            });
        });

        // Silence auto-trim button
        const removeSilencesBtn = document.getElementById('removeSilencesBtn');
        if (removeSilencesBtn) {
            removeSilencesBtn.addEventListener('click', () => this.applySilenceTrim());
        }

        // Smart Reframe button in Inspector
        const applyReframeBtn = document.getElementById('applySmartReframeBtn');
        if (applyReframeBtn) {
            applyReframeBtn.addEventListener('click', () => this.applySmartReframe());
        }
    }

    async runAiAnalysis() {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        const statusCard = document.getElementById('aiAnalysisStatusCard');
        const statusText = document.getElementById('aiAnalysisStatusText');
        const percentText = document.getElementById('aiAnalysisPercentText');
        const bar = document.getElementById('aiAnalysisProgressBar');
        const analyzeBtn = document.getElementById('runAiAnalyzeBtn');

        if (statusCard) statusCard.style.display = 'block';
        if (analyzeBtn) analyzeBtn.disabled = true;

        let progress = 0;
        const stages = ['Preparing video frames...', 'Detecting scene cuts...', 'Analyzing audio silence...', 'Extracting content highlights...', 'Generating editing suggestions...'];
        let stageIdx = 0;

        const progressTimer = setInterval(() => {
            if (progress < 90) {
                progress += Math.floor(Math.random() * 12) + 5;
                if (progress > 90) progress = 90;
                stageIdx = Math.min(stages.length - 1, Math.floor((progress / 90) * stages.length));
                if (statusText) statusText.textContent = stages[stageIdx];
                if (percentText) percentText.textContent = `${progress}%`;
                if (bar) bar.style.width = `${progress}%`;
            }
        }, 220);

        try {
            const filename = this.project.source_path || (this.clips[0] ? this.clips[0].filename : '');
            const res = await fetch('/editor/api/editor/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.project.id,
                    filename: filename,
                    projectData: {
                        clips: this.clips,
                        graphics: this.graphics,
                        audioTracks: this.audioTracks,
                        audioClips: this.audioClips
                    }
                })
            });

            const data = await res.json();
            clearInterval(progressTimer);

            if (data.success) {
                if (statusText) statusText.textContent = 'Analysis complete!';
                if (percentText) percentText.textContent = '100%';
                if (bar) bar.style.width = '100%';

                this.aiAnalysis = {
                    scenes: data.scenes || [],
                    silences: data.silences || [],
                    keep_segments: data.keep_segments || [],
                    total_silence: data.total_silence || 0,
                    highlights: data.highlights || [],
                    reframe: data.reframe || {},
                    suggestions: data.suggestions || []
                };

                this.renderAiStudioLists();
                this.markDirty();
                this.saveHistoryState();
                this.showToast('AI analysis completed successfully', 'success');

                setTimeout(() => {
                    if (statusCard) statusCard.style.display = 'none';
                    if (analyzeBtn) analyzeBtn.disabled = false;
                }, 1200);
            } else {
                if (statusText) statusText.textContent = 'Analysis failed: ' + (data.error || '');
                if (analyzeBtn) analyzeBtn.disabled = false;
            }
        } catch (e) {
            clearInterval(progressTimer);
            console.error("AI Analysis error:", e);
            if (statusText) statusText.textContent = 'Analysis error';
            if (analyzeBtn) analyzeBtn.disabled = false;
        } finally {
            this.isAnalyzing = false;
        }
    }

    renderAiStudioLists() {
        // 1. Render Highlights List
        const hlContainer = document.getElementById('aiHighlightsList');
        if (hlContainer) {
            hlContainer.innerHTML = '';
            const hls = this.aiAnalysis.highlights || [];

            if (hls.length === 0) {
                hlContainer.innerHTML = `
                    <div class="ai-empty-state">
                        <div style="font-size:24px; margin-bottom:4px;">✨</div>
                        <div style="font-weight:600; font-size:12px;">No Highlights Yet</div>
                        <div style="font-size:10px; color:var(--text-muted);">Click Analyze to find engaging moments</div>
                    </div>
                `;
            } else {
                hls.forEach((hl, idx) => {
                    const card = document.createElement('div');
                    card.className = 'ai-highlight-card';
                    card.innerHTML = `
                        <div class="ai-card-top">
                            <div class="ai-card-title">${hl.title}</div>
                            <span class="ai-score-badge">${hl.score}% Fit</span>
                        </div>
                        <div class="ai-card-meta">
                            <span>⏱ ${hl.duration}s (${this.formatTime(hl.start)} → ${this.formatTime(hl.end)})</span>
                            <span class="ai-category-tag">${hl.category}</span>
                        </div>
                        <div class="ai-card-reason">💡 ${hl.reason}</div>
                        <div class="ai-card-actions">
                            <button class="btn btn-secondary btn-sm preview-hl-btn">Preview</button>
                            <button class="btn btn-primary btn-sm add-hl-btn">+ Create Clip</button>
                        </div>
                    `;

                    // Preview button seeks playhead
                    card.querySelector('.preview-hl-btn').addEventListener('click', () => {
                        this.playheadTime = hl.start;
                        if (this.video) this.video.currentTime = hl.start;
                        this.updatePlayheadVisual();
                        this.updatePlayerSource();
                    });

                    // Add Clip to Timeline
                    card.querySelector('.add-hl-btn').addEventListener('click', () => {
                        this.createClipFromHighlight(hl);
                    });

                    hlContainer.appendChild(card);
                });
            }
        }

        // 2. Render Silence List
        const silContainer = document.getElementById('aiSilenceList');
        const silTotalLabel = document.getElementById('silenceTotalLabel');
        const removeSilencesBtn = document.getElementById('removeSilencesBtn');

        if (silContainer) {
            silContainer.innerHTML = '';
            const sils = this.aiAnalysis.silences || [];

            if (silTotalLabel) silTotalLabel.textContent = `${sils.length} pauses (${this.aiAnalysis.total_silence}s)`;
            if (removeSilencesBtn) removeSilencesBtn.disabled = sils.length === 0;

            if (sils.length === 0) {
                silContainer.innerHTML = `<div class="ai-empty-state"><div style="font-size:11px; color:var(--text-muted);">No dead air detected</div></div>`;
            } else {
                sils.forEach((s, idx) => {
                    const card = document.createElement('div');
                    card.className = 'ai-silence-item';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:600; font-size:11px;">Pause ${idx + 1} (${s.duration}s)</span>
                            <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${this.formatTime(s.start)} → ${this.formatTime(s.end)}</span>
                        </div>
                    `;
                    card.addEventListener('click', () => {
                        this.playheadTime = s.start;
                        if (this.video) this.video.currentTime = s.start;
                        this.updatePlayheadVisual();
                    });
                    silContainer.appendChild(card);
                });
            }
        }

        // 3. Render Scenes List
        const scenesContainer = document.getElementById('aiScenesList');
        if (scenesContainer) {
            scenesContainer.innerHTML = '';
            const scenes = this.aiAnalysis.scenes || [];

            if (scenes.length === 0) {
                scenesContainer.innerHTML = `<div class="ai-empty-state"><div style="font-size:11px; color:var(--text-muted);">No scene cuts analyzed</div></div>`;
            } else {
                scenes.forEach(sc => {
                    const card = document.createElement('div');
                    card.className = 'ai-scene-item';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:600; font-size:11px;">🎬 Scene ${sc.sceneNumber}</span>
                            <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${sc.duration}s</span>
                        </div>
                        <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">${this.formatTime(sc.start)} → ${this.formatTime(sc.end)}</div>
                    `;
                    card.addEventListener('click', () => {
                        this.playheadTime = sc.start;
                        if (this.video) this.video.currentTime = sc.start;
                        this.updatePlayheadVisual();
                    });
                    scenesContainer.appendChild(card);
                });
            }
        }

        // 4. Render Suggestions / Advisor List
        const sugContainer = document.getElementById('aiSuggestionsList');
        if (sugContainer) {
            sugContainer.innerHTML = '';
            const sugs = this.aiAnalysis.suggestions || [];

            if (sugs.length === 0) {
                sugContainer.innerHTML = `<div class="ai-empty-state"><div style="font-size:11px; color:var(--text-muted);">No suggestions pending</div></div>`;
            } else {
                sugs.forEach(sug => {
                    const card = document.createElement('div');
                    card.className = 'ai-suggestion-card';
                    card.innerHTML = `
                        <div class="ai-card-top">
                            <span class="ai-card-title">${sug.title}</span>
                            <span class="ai-confidence-tag">${sug.confidence || 'High'}</span>
                        </div>
                        <div class="ai-card-reason">${sug.reason}</div>
                        <div class="ai-card-actions">
                            <button class="btn btn-secondary btn-sm dismiss-sug-btn">Dismiss</button>
                            <button class="btn btn-primary btn-sm accept-sug-btn">✓ ${sug.action}</button>
                        </div>
                    `;

                    card.querySelector('.dismiss-sug-btn').addEventListener('click', () => {
                        this.aiAnalysis.suggestions = this.aiAnalysis.suggestions.filter(s => s.id !== sug.id);
                        this.renderAiStudioLists();
                    });

                    card.querySelector('.accept-sug-btn').addEventListener('click', () => {
                        this.acceptAiSuggestion(sug);
                    });

                    sugContainer.appendChild(card);
                });
            }
        }
    }

    createClipFromHighlight(hl) {
        const sourceFilename = this.project.source_path || (this.clips[0] ? this.clips[0].filename : '');
        const newClip = {
            id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            filename: sourceFilename,
            start: hl.start,
            end: hl.end,
            duration: hl.duration,
            timelineStart: this.playheadTime,
            track: 'video',
            transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }
        };

        this.clips.push(newClip);
        this.selectClip(newClip.id);
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Created clip: ${hl.title}`, 'success');
    }

    applySilenceTrim() {
        const keeps = this.aiAnalysis.keep_segments || [];
        if (keeps.length === 0) {
            this.showToast('No active speech segments to trim', 'error');
            return;
        }

        const sourceFilename = this.project.source_path || (this.clips[0] ? this.clips[0].filename : '');
        let currentTl = 0.0;
        const newClips = [];

        keeps.forEach((seg, idx) => {
            newClips.push({
                id: 'clip_speech_' + idx + '_' + Date.now(),
                filename: sourceFilename,
                start: seg.start,
                end: seg.end,
                duration: seg.duration,
                timelineStart: parseFloat(currentTl.toFixed(2)),
                track: 'video',
                transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }
            });
            currentTl += seg.duration;
        });

        this.clips = newClips;
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Auto-trimmed dead air (${this.aiAnalysis.total_silence}s removed in 1 step)`, 'success');
    }

    applySmartReframe() {
        const reframe = this.aiAnalysis.reframe || {};
        const recX = reframe.recommendedX || 0;
        const scale = reframe.scale || 177.78;

        if (this.aspectRatioSelect) {
            this.aspectRatioSelect.value = '9:16';
        }

        // Apply framing to all video clips non-destructively
        this.clips.forEach(c => {
            if (!c.transform) c.transform = { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 };
            c.transform.scale = scale;
            c.transform.x = recX;
        });

        const activeClip = this.getActiveClipAtTime(this.playheadTime);
        if (activeClip) {
            this.applyClipTransforms(activeClip);
            this.updateVideoInspectorValues(activeClip);
        }

        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Applied Smart 9:16 Reframe (X: ${recX}px, Scale: ${scale}%)`, 'success');
    }

    acceptAiSuggestion(sug) {
        const p = sug.payload || {};
        if (p.type === 'silence_trim') {
            this.applySilenceTrim();
        } else if (p.type === 'enable_ducking') {
            const track = this.audioTracks.find(t => t.id === p.trackId);
            if (track) {
                if (!track.ducking) track.ducking = { enabled: true, amount: 60 };
                else track.ducking.enabled = true;
                this.showToast('Enabled Voice Ducking on Music Track', 'success');
            }
        } else if (p.type === 'reposition_graphic') {
            const layer = this.graphics.find(g => g.id === p.layerId);
            if (layer) {
                layer.transform.y = p.targetY;
                this.renderGraphicsCanvas();
                this.updateGraphicInspector(layer);
                this.showToast(`Centered graphic '${layer.name}'`, 'success');
            }
        } else if (p.type === 'create_clip') {
            this.createClipFromHighlight(p.highlight);
        }

        this.aiAnalysis.suggestions = this.aiAnalysis.suggestions.filter(s => s.id !== sug.id);
        this.renderAiStudioLists();
        this.markDirty();
        this.saveHistoryState();
    }

    // ---------- Audio Studio Library ----------
    initAudioLibrary() {
        this.fetchAudioLibrary();
    }

    async fetchAudioLibrary(filterCat = 'all') {
        const list = document.getElementById('audioAssetList');
        if (!list) return;

        try {
            const res = await fetch('/editor/api/editor/audio-library');
            const data = await res.json();
            if (data.success && data.assets) {
                this.renderAudioLibraryList(data.assets, filterCat);
            }
        } catch (e) {
            console.error("Failed to fetch audio library:", e);
        }

        const chipsContainer = document.querySelector('#subpaneAudio .graphics-category-chips');
        if (chipsContainer) {
            chipsContainer.querySelectorAll('.chip-btn').forEach(btn => {
                btn.onclick = () => {
                    chipsContainer.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.fetchAudioLibrary(btn.dataset.cat);
                };
            });
        }
    }

    renderAudioLibraryList(assets, filterCat = 'all') {
        const list = document.getElementById('audioAssetList');
        if (!list) return;
        list.innerHTML = '';

        const filtered = filterCat === 'all' ? assets : assets.filter(a => a.category === filterCat);

        filtered.forEach(asset => {
            const card = document.createElement('div');
            card.className = 'audio-asset-item';
            card.innerHTML = `
                <button class="audio-play-btn" title="Preview Audio">▶</button>
                <div class="audio-item-info">
                    <div class="audio-item-title">${asset.title}</div>
                    <span class="audio-category-badge badge-${asset.category}">${asset.category.toUpperCase()}</span>
                </div>
                <button class="btn btn-secondary btn-sm add-track-btn" title="Add to Timeline">+</button>
            `;

            const playBtn = card.querySelector('.audio-play-btn');
            playBtn.addEventListener('click', () => {
                if (this.previewAudio.src && !this.previewAudio.paused && this.previewAudio.src.endsWith(asset.url)) {
                    this.previewAudio.pause();
                    playBtn.textContent = '▶';
                } else {
                    document.querySelectorAll('.audio-play-btn').forEach(b => b.textContent = '▶');
                    this.previewAudio.src = asset.url;
                    this.previewAudio.play().catch(e => {});
                    playBtn.textContent = '⏸';
                }
            });

            card.querySelector('.add-track-btn').addEventListener('click', () => {
                this.addAudioClipToTimeline(asset);
            });

            card.addEventListener('dblclick', () => {
                this.addAudioClipToTimeline(asset);
            });

            list.appendChild(card);
        });
    }

    addAudioClipToTimeline(asset) {
        let targetTrackId = 'track_sfx';
        if (asset.category === 'music') targetTrackId = 'track_music';
        else if (asset.category === 'voice') targetTrackId = 'track_voice';

        const start = this.playheadTime;
        const dur = 6.0;

        const newClip = {
            id: 'aclip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            trackId: targetTrackId,
            name: asset.title,
            filename: asset.filename,
            url: asset.url,
            start: parseFloat(start.toFixed(2)),
            end: parseFloat((start + dur).toFixed(2)),
            duration: dur,
            sourceStart: 0.0,
            sourceEnd: dur,
            volume: 100,
            pan: 0,
            fadeIn: 0.5,
            fadeOut: 0.5,
            speed: 1.0,
            muted: false
        };

        this.audioClips.push(newClip);
        this.selectAudioClip(newClip.id);
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Added ${newClip.name} to ${targetTrackId.replace('track_', '').toUpperCase()}`, 'success');
    }

    initAudioUpload() {
        const uploadBtn = document.getElementById('uploadAudioBtn');
        const fileInput = document.getElementById('audioFileInput');
        if (!uploadBtn || !fileInput) return;

        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length === 0) return;
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/editor/api/editor/upload-audio', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.showToast(`Imported ${file.name}`, 'success');
                    this.fetchAudioLibrary('imported');
                } else {
                    this.showToast(data.error || 'Upload failed', 'error');
                }
            } catch (e) {
                console.error("Audio upload error:", e);
            }
        });
    }

    // ---------- Track Headers & Mini Controls ----------
    initTrackHeaders() {
        document.querySelectorAll('.audio-track-row').forEach(row => {
            const trackId = row.dataset.trackId;
            const track = this.audioTracks.find(t => t.id === trackId);
            if (!track) return;

            const muteBtn = row.querySelector('.mute-btn');
            const soloBtn = row.querySelector('.solo-btn');

            if (muteBtn) {
                muteBtn.classList.toggle('active', track.muted);
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    track.muted = !track.muted;
                    muteBtn.classList.toggle('active', track.muted);
                    this.renderTimeline();
                    this.markDirty();
                });
            }

            if (soloBtn) {
                soloBtn.classList.toggle('active', track.solo);
                soloBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    track.solo = !track.solo;
                    soloBtn.classList.toggle('active', track.solo);
                    this.renderTimeline();
                    this.markDirty();
                });
            }
        });
    }

    // ---------- Inspector State Switching ----------
    selectAudioClip(clipId) {
        this.selectedAudioClipId = clipId;
        this.selectedClipId = null;
        this.selectedGraphicId = null;

        document.querySelectorAll('.timeline-clip, .timeline-graphic-block').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.timeline-audio-clip').forEach(el => el.classList.toggle('selected', el.dataset.clipId === clipId));

        const clip = this.audioClips.find(c => c.id === clipId);
        if (clip) {
            this.inspectorEmptyState.style.display = 'none';
            this.videoInspectorGroup.style.display = 'none';
            this.graphicInspectorGroup.style.display = 'none';
            if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'none';
            this.audioClipInspectorGroup.style.display = 'block';
            this.updateAudioInspectorValues(clip);
        } else {
            this.inspectorEmptyState.style.display = 'block';
            this.videoInspectorGroup.style.display = 'none';
            this.graphicInspectorGroup.style.display = 'none';
            this.audioClipInspectorGroup.style.display = 'none';
            if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'none';
        }
    }

    updateAudioInspectorValues(clip) {
        if (!clip) return;
        const nameInput = document.getElementById('audioClipNameInput');
        const trackSelect = document.getElementById('audioClipTrackSelect');
        const volRange = document.getElementById('audioClipVolRange');
        const volDisplay = document.getElementById('audioClipVolDisplay');
        const muteCheck = document.getElementById('audioClipMuteCheck');
        const panRange = document.getElementById('audioClipPanRange');
        const panDisplay = document.getElementById('audioClipPanDisplay');
        const fadeInRange = document.getElementById('audioClipFadeInRange');
        const fadeInDisplay = document.getElementById('audioClipFadeInDisplay');
        const fadeOutRange = document.getElementById('audioClipFadeOutRange');
        const fadeOutDisplay = document.getElementById('audioClipFadeOutDisplay');

        if (nameInput) nameInput.value = clip.name || '';
        if (trackSelect) trackSelect.value = clip.trackId || 'track_sfx';
        if (volRange) volRange.value = clip.volume || 100;
        if (volDisplay) volDisplay.textContent = clip.volume || 100;
        if (muteCheck) muteCheck.checked = !!clip.muted;

        if (panRange) panRange.value = clip.pan || 0;
        if (panDisplay) {
            const p = clip.pan || 0;
            panDisplay.textContent = p === 0 ? 'C' : p < 0 ? `${Math.abs(p)}% L` : `${p}% R`;
        }

        if (fadeInRange) fadeInRange.value = Math.round((clip.fadeIn || 0) * 10);
        if (fadeInDisplay) fadeInDisplay.textContent = (clip.fadeIn || 0).toFixed(1);
        if (fadeOutRange) fadeOutRange.value = Math.round((clip.fadeOut || 0) * 10);
        if (fadeOutDisplay) fadeOutDisplay.textContent = (clip.fadeOut || 0).toFixed(1);
    }

    // ---------- Graphics & Shapes Library ----------
    initGraphicsLibrary() {
        const grid = document.getElementById('graphicsAssetGrid');
        if (!grid) return;

        const assets = [
            { type: 'shape', shapeType: 'rect', name: 'Rectangle', cat: 'shapes', fill: '#8B5CF6', icon: '■' },
            { type: 'shape', shapeType: 'rounded_rect', name: 'Rounded Box', cat: 'shapes', fill: '#3B82F6', icon: '▢' },
            { type: 'shape', shapeType: 'circle', name: 'Circle', cat: 'shapes', fill: '#EC4899', icon: '●' },
            { type: 'shape', shapeType: 'triangle', name: 'Triangle', cat: 'shapes', fill: '#F59E0B', icon: '▲' },
            { type: 'shape', shapeType: 'star', name: 'Star', cat: 'shapes', fill: '#FBBF24', icon: '★' },
            { type: 'shape', shapeType: 'arrow', name: 'Arrow Pointer', cat: 'shapes', fill: '#10B981', icon: '➔' },
            { type: 'icon', iconName: 'zap', name: 'Lightning Zap', cat: 'icons', fill: '#F59E0B', icon: '⚡' },
            { type: 'icon', iconName: 'flame', name: 'Fire Flame', cat: 'icons', fill: '#EF4444', icon: '🔥' },
            { type: 'icon', iconName: 'heart', name: 'Heart', cat: 'icons', fill: '#F43F5E', icon: '❤' },
            { type: 'icon', iconName: 'star_icon', name: 'Gold Star', cat: 'icons', fill: '#FBBF24', icon: '⭐' },
            { type: 'icon', iconName: 'bell', name: 'Subscribe Bell', cat: 'icons', fill: '#8B5CF6', icon: '🔔' },
            { type: 'icon', iconName: 'thumbs_up', name: 'Thumbs Up', cat: 'icons', fill: '#3B82F6', icon: '👍' },
            { type: 'icon', iconName: 'sparkles', name: 'Sparkles', cat: 'icons', fill: '#A855F7', icon: '✨' },
            { type: 'shape', shapeType: 'badge', name: 'HOT Badge', cat: 'badges', fill: '#EF4444', text: 'HOT 🔥', icon: '🏷' },
            { type: 'shape', shapeType: 'badge', name: 'NEW Badge', cat: 'badges', fill: '#3B82F6', text: 'NEW ✨', icon: '🏷' },
            { type: 'shape', shapeType: 'badge', name: 'LIVE Badge', cat: 'badges', fill: '#DC2626', text: '● LIVE', icon: '🔴' },
            { type: 'shape', shapeType: 'badge', name: '50% OFF', cat: 'badges', fill: '#10B981', text: '50% OFF', icon: '🏷' }
        ];

        const renderGrid = (filterCat = 'all') => {
            grid.innerHTML = '';
            const filtered = filterCat === 'all' ? assets : assets.filter(a => a.cat === filterCat);

            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'graphic-asset-card';
                card.innerHTML = `
                    <div class="asset-preview-thumb" style="color:${item.fill};">
                        <span style="font-size:24px;">${item.icon}</span>
                    </div>
                    <div class="asset-card-title">${item.name}</div>
                `;

                card.addEventListener('click', () => {
                    this.addGraphicLayer(item);
                });

                grid.appendChild(card);
            });
        };

        renderGrid('all');

        const chips = document.querySelector('#subpaneGraphics .graphics-category-chips');
        if (chips) {
            chips.querySelectorAll('.chip-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    chips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderGrid(btn.dataset.cat);
                });
            });
        }
    }

    // ---------- Text & Titles Presets ----------
    initTextPresets() {
        const container = document.getElementById('textPresetsList');
        if (!container) return;

        const presets = [
            { name: 'Headline Title', text: 'HEADLINE TITLE', font: 'Anton', size: 44, fill: '#FFFFFF', bg: '#000000', op: 0 },
            { name: 'Lower Third Bar', text: 'John Doe | Creative Director', font: 'DM Sans', size: 28, fill: '#FFFFFF', bg: '#8B5CF6', op: 90, type: 'lower_third' },
            { name: 'Neon Glow Text', text: 'NEON SHINE', font: 'Montserrat', size: 40, fill: '#38BDF8', bg: '#000000', op: 0 },
            { name: 'Callout Tag', text: 'Important Note', font: 'Inter', size: 24, fill: '#000000', bg: '#FBBF24', op: 100 }
        ];

        container.innerHTML = '';
        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'text-preset-card';
            card.innerHTML = `
                <div class="text-preset-header">${p.name}</div>
                <div class="text-preset-sample" style="font-family:'${p.font}', sans-serif; color:${p.fill}; background:${p.op > 0 ? p.bg : 'transparent'};">
                    ${p.text}
                </div>
            `;

            card.addEventListener('click', () => {
                this.addTextLayer(p);
            });

            container.appendChild(card);
        });
    }

    addGraphicLayer(item) {
        const start = this.playheadTime;
        const dur = 4.0;
        const newLayer = {
            id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: item.type || 'shape',
            name: item.name || 'Graphic Layer',
            start: parseFloat(start.toFixed(2)),
            end: parseFloat((start + dur).toFixed(2)),
            duration: dur,
            layerOrder: this.graphics.length + 1,
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, width: 140, height: 140, scale: 100, rotation: 0, opacity: 100 },
            appearance: { fill: item.fill || '#8B5CF6', stroke: '#000000', strokeWidth: 2, cornerRadius: item.shapeType === 'circle' ? 70 : 8, shadowBlur: 4, shadowColor: '#000000' },
            content: { shapeType: item.shapeType || 'rect', iconName: item.iconName || '', imageUrl: item.imageUrl || '' },
            typography: { text: item.text || '', fontFamily: 'Inter', fontSize: 24, fontWeight: 700, color: '#FFFFFF' },
            animation: { entrance: 'pop', exit: 'none', duration: 0.3 }
        };

        this.graphics.push(newLayer);
        this.selectGraphic(newLayer.id);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Added ${newLayer.name}`, 'success');
    }

    addTextLayer(preset) {
        const start = this.playheadTime;
        const dur = 4.0;
        const newLayer = {
            id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: 'text',
            name: preset.name || 'Text Title',
            start: parseFloat(start.toFixed(2)),
            end: parseFloat((start + dur).toFixed(2)),
            duration: dur,
            layerOrder: this.graphics.length + 1,
            visible: true,
            locked: false,
            transform: { x: 0, y: preset.type === 'lower_third' ? 120 : 0, width: 260, height: 60, scale: 100, rotation: 0, opacity: 100 },
            appearance: { fill: preset.bg || '#000000', stroke: '#000000', strokeWidth: 0, cornerRadius: 8, shadowBlur: 4, shadowColor: '#000000' },
            typography: { text: preset.text || 'TITLE TEXT', fontFamily: preset.font || 'Inter', fontSize: preset.size || 36, fontWeight: 800, color: preset.fill || '#FFFFFF' },
            content: {},
            animation: { entrance: 'slide_up', exit: 'none', duration: 0.3 }
        };

        this.graphics.push(newLayer);
        this.selectGraphic(newLayer.id);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Added ${newLayer.name}`, 'success');
    }

    // ---------- Live Graphics Canvas Rendering with Transform Handles ----------
    renderGraphicsCanvas() {
        const overlay = this.graphicsCanvasOverlay;
        if (!overlay) return;
        overlay.innerHTML = '';

        const activeGraphics = this.graphics.filter(g => 
            g.visible !== false &&
            this.playheadTime >= g.start &&
            this.playheadTime <= g.end
        );

        activeGraphics.sort((a, b) => (a.layerOrder || 0) - (b.layerOrder || 0));

        activeGraphics.forEach(layer => {
            const el = document.createElement('div');
            el.className = 'graphic-canvas-item';
            el.dataset.layerId = layer.id;
            const isSelected = layer.id === this.selectedGraphicId;
            if (isSelected) el.classList.add('selected');

            const t = this.getInterpolatedTransform(layer);
            const app = layer.appearance;
            const typo = layer.typography;

            const w = t.width || 120;
            const h = t.height || 120;
            const x = t.x || 0;
            const y = t.y || 0;
            const scale = (t.scale || 100) / 100;
            const rot = t.rotation || 0;
            const op = (t.opacity !== undefined ? t.opacity : 100) / 100;

            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rot}deg) scale(${scale})`;
            el.style.opacity = op;

            let innerHtml = '';
            if (layer.type === 'shape') {
                const shape = layer.content.shapeType;
                if (shape === 'circle') {
                    innerHtml = `<div class="shape-circle" style="background:${app.fill}; border:${app.strokeWidth}px solid ${app.stroke}; box-shadow:0 0 ${app.shadowBlur}px ${app.shadowColor}; width:100%; height:100%; border-radius:50%;"></div>`;
                } else if (shape === 'triangle') {
                    innerHtml = `<div style="width:100%; height:100%; clip-path:polygon(50% 0%, 0% 100%, 100% 100%); background:${app.fill};"></div>`;
                } else if (shape === 'star') {
                    innerHtml = `<div style="width:100%; height:100%; clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); background:${app.fill};"></div>`;
                } else if (shape === 'badge') {
                    innerHtml = `<div style="background:${app.fill}; color:${typo.color}; font-family:'${typo.fontFamily}', sans-serif; font-size:${typo.fontSize}px; font-weight:800; border-radius:${app.cornerRadius}px; width:100%; height:100%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px ${app.shadowBlur}px ${app.shadowColor};">${typo.text || 'HOT'}</div>`;
                } else {
                    innerHtml = `<div class="shape-rect" style="background:${app.fill}; border:${app.strokeWidth}px solid ${app.stroke}; border-radius:${app.cornerRadius}px; box-shadow:0 0 ${app.shadowBlur}px ${app.shadowColor}; width:100%; height:100%;"></div>`;
                }
            } else if (layer.type === 'text') {
                innerHtml = `<div style="font-family:'${typo.fontFamily}', sans-serif; font-size:${typo.fontSize}px; font-weight:${typo.fontWeight}; color:${typo.color}; background:${app.fill !== '#000000' && app.fill ? app.fill : 'transparent'}; border-radius:${app.cornerRadius}px; width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-shadow:0 2px ${app.shadowBlur}px ${app.shadowColor}; text-align:center; padding:4px 8px;">${typo.text || 'Text'}</div>`;
            } else if (layer.type === 'icon') {
                innerHtml = `<div style="font-size:${h * 0.6}px; color:${app.fill}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-shadow:0 2px ${app.shadowBlur}px ${app.shadowColor};">★</div>`;
            } else if (layer.type === 'image') {
                innerHtml = `<img src="${layer.content.imageUrl}" style="width:100%; height:100%; object-fit:contain; pointer-events:none;">`;
            }

            if (isSelected) {
                innerHtml += `
                    <div class="transform-bounding-box">
                        <div class="handle handle-tl"></div>
                        <div class="handle handle-tr"></div>
                        <div class="handle handle-bl"></div>
                        <div class="handle handle-br"></div>
                        <div class="handle handle-rot"></div>
                    </div>
                `;
            }

            el.innerHTML = innerHtml;

            el.addEventListener('mousedown', (e) => {
                if (layer.locked) return;
                this.selectGraphic(layer.id);
                this.initCanvasGraphicDrag(layer, el, e);
                e.stopPropagation();
            });

            overlay.appendChild(el);
        });
    }

    initCanvasGraphicDrag(layer, el, mousedownEvt) {
        if (mousedownEvt.target.classList.contains('handle')) {
            if (mousedownEvt.target.classList.contains('handle-rot')) {
                this.initGraphicRotate(layer, el, mousedownEvt);
            } else {
                this.initGraphicResize(layer, el, mousedownEvt);
            }
            return;
        }

        let startX = mousedownEvt.clientX;
        let startY = mousedownEvt.clientY;
        let initX = layer.transform.x || 0;
        let initY = layer.transform.y || 0;
        let isMoving = false;

        const onMouseMove = (e) => {
            isMoving = true;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            layer.transform.x = Math.round(initX + dx);
            layer.transform.y = Math.round(initY + dy);

            const scale = (layer.transform.scale || 100) / 100;
            const rot = layer.transform.rotation || 0;
            el.style.transform = `translate(calc(-50% + ${layer.transform.x}px), calc(-50% + ${layer.transform.y}px)) rotate(${rot}deg) scale(${scale})`;

            this.updateGraphicInspector(layer);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isMoving) {
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initGraphicResize(layer, el, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let startY = mousedownEvt.clientY;
        let initW = layer.transform.width || 120;
        let initH = layer.transform.height || 120;

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            layer.transform.width = Math.max(20, Math.round(initW + dx));
            layer.transform.height = Math.max(20, Math.round(initH + dy));

            el.style.width = layer.transform.width + 'px';
            el.style.height = layer.transform.height + 'px';

            this.updateGraphicInspector(layer);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.renderGraphicsCanvas();
            this.markDirty();
            this.saveHistoryState();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initGraphicRotate(layer, el, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let startY = mousedownEvt.clientY;
        let initRot = layer.transform.rotation || 0;

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            layer.transform.rotation = Math.round((initRot + dx) % 360);

            const scale = (layer.transform.scale || 100) / 100;
            el.style.transform = `translate(calc(-50% + ${layer.transform.x}px), calc(-50% + ${layer.transform.y}px)) rotate(${layer.transform.rotation}deg) scale(${scale})`;

            this.updateGraphicInspector(layer);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.markDirty();
            this.saveHistoryState();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    getInterpolatedTransform(layer) {
        const t = layer.transform || {};
        const keyframes = layer.keyframes || [];
        if (!keyframes || keyframes.length <= 1) return t;

        const sorted = [...keyframes].sort((a, b) => a.time - b.time);
        let prev = sorted[0];
        let next = sorted[sorted.length - 1];

        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].time <= this.playheadTime) prev = sorted[i];
            if (sorted[i].time >= this.playheadTime) { next = sorted[i]; break; }
        }

        if (Math.abs(next.time - prev.time) < 0.001) return { ...t, ...prev };

        const progress = Math.max(0, Math.min(1, (this.playheadTime - prev.time) / (next.time - prev.time)));

        const lerp = (a, b, p) => (typeof a === 'number' && typeof b === 'number') ? a + (b - a) * p : (p > 0.5 ? b : a);

        const props = ['x', 'y', 'scale', 'rotation', 'opacity', 'width', 'height'];
        const result = { ...t };
        props.forEach(prop => {
            if (prop in prev || prop in next) {
                result[prop] = lerp(prev[prop] ?? t[prop] ?? 0, next[prop] ?? t[prop] ?? 0, progress);
            }
        });
        return result;
    }

    selectGraphic(graphicId) {
        this.selectedGraphicId = graphicId;
        this.selectedClipId = null;
        this.selectedAudioClipId = null;

        document.querySelectorAll('.timeline-clip, .timeline-audio-clip').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.timeline-graphic-block').forEach(b => b.classList.toggle('selected', b.dataset.layerId === graphicId));

        const layer = this.graphics.find(g => g.id === graphicId);
        if (layer) {
            this.inspectorEmptyState.style.display = 'none';
            this.videoInspectorGroup.style.display = 'none';
            this.audioClipInspectorGroup.style.display = 'none';
            if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'none';
            this.graphicInspectorGroup.style.display = 'block';
            this.updateGraphicInspector(layer);
        } else {
            this.inspectorEmptyState.style.display = 'block';
            this.videoInspectorGroup.style.display = 'none';
            this.graphicInspectorGroup.style.display = 'none';
            this.audioClipInspectorGroup.style.display = 'none';
            if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'none';
        }

        this.renderGraphicsCanvas();
    }

    updateGraphicInspector(layer) {
        if (!layer) return;

        const nameInput = document.getElementById('graphicNameInput');
        const xNum = document.getElementById('gPosXNum');
        const yNum = document.getElementById('gPosYNum');
        const wNum = document.getElementById('gWidthNum');
        const hNum = document.getElementById('gHeightNum');
        const scaleRange = document.getElementById('gScaleRange');
        const scaleDisplay = document.getElementById('gScaleDisplay');
        const rotRange = document.getElementById('gRotRange');
        const rotDisplay = document.getElementById('gRotDisplay');
        const opRange = document.getElementById('gOpacityRange');
        const opDisplay = document.getElementById('gOpacityDisplay');

        const fillColorPicker = document.getElementById('gFillColorPicker');
        const strokeColorPicker = document.getElementById('gStrokeColorPicker');
        const strokeWidthRange = document.getElementById('gStrokeWidthRange');
        const strokeWidthDisplay = document.getElementById('gStrokeWidthDisplay');
        const cornerRange = document.getElementById('gCornerRadiusRange');
        const cornerDisplay = document.getElementById('gCornerRadiusDisplay');

        const textCard = document.getElementById('graphicTypographyCard');
        const textInput = document.getElementById('gTextInput');
        const fontSelect = document.getElementById('gFontFamilySelect');
        const fontSizeRange = document.getElementById('gFontSizeRange');
        const fontSizeDisplay = document.getElementById('gFontSizeDisplay');
        const textColorPicker = document.getElementById('gTextColorPicker');

        const entranceSelect = document.getElementById('gEntranceAnimSelect');
        const exitSelect = document.getElementById('gExitAnimSelect');

        const t = layer.transform;
        const app = layer.appearance;
        const typo = layer.typography;

        if (nameInput) nameInput.value = layer.name || '';
        if (xNum) xNum.value = t.x || 0;
        if (yNum) yNum.value = t.y || 0;
        if (wNum) wNum.value = t.width || 120;
        if (hNum) hNum.value = t.height || 120;
        if (scaleRange) scaleRange.value = t.scale || 100;
        if (scaleDisplay) scaleDisplay.textContent = t.scale || 100;
        if (rotRange) rotRange.value = t.rotation || 0;
        if (rotDisplay) rotDisplay.textContent = t.rotation || 0;
        if (opRange) opRange.value = t.opacity !== undefined ? t.opacity : 100;
        if (opDisplay) opDisplay.textContent = t.opacity !== undefined ? t.opacity : 100;

        if (fillColorPicker) fillColorPicker.value = app.fill || '#8B5CF6';
        if (strokeColorPicker) strokeColorPicker.value = app.stroke || '#000000';
        if (strokeWidthRange) strokeWidthRange.value = app.strokeWidth !== undefined ? app.strokeWidth : 2;
        if (strokeWidthDisplay) strokeWidthDisplay.textContent = app.strokeWidth !== undefined ? app.strokeWidth : 2;
        if (cornerRange) cornerRange.value = app.cornerRadius !== undefined ? app.cornerRadius : 8;
        if (cornerDisplay) cornerDisplay.textContent = app.cornerRadius !== undefined ? app.cornerRadius : 8;

        if (layer.type === 'text' || layer.content.shapeType === 'badge') {
            if (textCard) textCard.style.display = 'block';
            if (textInput) textInput.value = typo.text || '';
            if (fontSelect) fontSelect.value = typo.fontFamily || 'Inter';
            if (fontSizeRange) fontSizeRange.value = typo.fontSize || 36;
            if (fontSizeDisplay) fontSizeDisplay.textContent = typo.fontSize || 36;
            if (textColorPicker) textColorPicker.value = typo.color || '#FFFFFF';
        } else {
            if (textCard) textCard.style.display = 'none';
        }

        if (entranceSelect) entranceSelect.value = layer.animation?.entrance || 'pop';
        if (exitSelect) exitSelect.value = layer.animation?.exit || 'none';
    }

    renderLayersStack() {
        const container = document.getElementById('layersStackList');
        const countLabel = document.getElementById('layersCountLabel');
        if (!container) return;

        if (countLabel) countLabel.textContent = `${this.graphics.length} layers`;

        if (this.graphics.length === 0) {
            container.innerHTML = '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:var(--space-4);">No graphic layers added</div>';
            return;
        }

        container.innerHTML = '';
        const sorted = [...this.graphics].sort((a, b) => (b.layerOrder || 0) - (a.layerOrder || 0));

        sorted.forEach(layer => {
            const row = document.createElement('div');
            row.className = 'layer-row-item';
            if (layer.id === this.selectedGraphicId) row.classList.add('selected');

            row.innerHTML = `
                <div class="layer-item-title">
                    <span class="layer-item-icon">${layer.type === 'text' ? 'T' : '■'}</span>
                    <span>${layer.name}</span>
                </div>
                <div class="layer-item-actions">
                    <button class="btn btn-icon btn-sm eye-btn" title="Toggle Visibility">${layer.visible !== false ? '👁' : '🚫'}</button>
                    <button class="btn btn-icon btn-sm lock-btn" title="Toggle Lock">${layer.locked ? '🔒' : '🔓'}</button>
                    <button class="btn btn-icon btn-sm del-btn" title="Delete" style="color:var(--error);">✕</button>
                </div>
            `;

            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-icon')) return;
                this.selectGraphic(layer.id);
            });

            row.querySelector('.eye-btn').addEventListener('click', () => {
                layer.visible = layer.visible === false ? true : false;
                this.renderGraphicsCanvas();
                this.renderLayersStack();
                this.markDirty();
            });

            row.querySelector('.lock-btn').addEventListener('click', () => {
                layer.locked = !layer.locked;
                this.renderLayersStack();
                this.markDirty();
            });

            row.querySelector('.del-btn').addEventListener('click', () => {
                this.selectedGraphicId = layer.id;
                this.deleteSelectedGraphic();
            });

            container.appendChild(row);
        });
    }

    deleteSelectedGraphic() {
        if (!this.selectedGraphicId) return;
        this.graphics = this.graphics.filter(g => g.id !== this.selectedGraphicId);
        this.selectGraphic(null);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('Graphic layer deleted', 'success');
    }

    initAssetUpload() {
        const uploadBtn = document.getElementById('uploadAssetBtn');
        const fileInput = document.getElementById('assetFileInput');
        if (!uploadBtn || !fileInput) return;

        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length === 0) return;
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/editor/api/editor/upload-asset', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.addGraphicLayer({
                        type: 'image',
                        name: file.name,
                        imageUrl: data.url,
                        fill: '#FFFFFF',
                        icon: '🖼'
                    });
                    this.showToast(`Imported ${file.name}`, 'success');
                } else {
                    this.showToast(data.error || 'Upload failed', 'error');
                }
            } catch (e) {
                console.error("Asset upload error:", e);
            }
        });
    }

    initCanvasDragging() {
        let isDragging = false;
        let startX = 0, startY = 0;
        let initX = 0, initY = 0;

        const wrapper = this.videoTransformWrapper;
        if (!wrapper) return;

        wrapper.addEventListener('mousedown', (e) => {
            const clip = this.clips.find(c => c.id === this.selectedClipId);
            if (!clip) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initX = clip.transform.x || 0;
            initY = clip.transform.y || 0;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const clip = this.clips.find(c => c.id === this.selectedClipId);
            if (!clip) return;
            clip.transform.x = initX + (e.clientX - startX);
            clip.transform.y = initY + (e.clientY - startY);
            this.applyClipTransforms(clip);
            this.updateVideoInspectorValues(clip);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.markDirty();
                this.saveHistoryState();
            }
        });
    }

    applyClipTransforms(clip) {
        if (!clip || !this.videoTransformWrapper) return;
        const t = clip.transform;
        const x = t.x || 0;
        const y = t.y || 0;
        const scale = (t.scale || 100) / 100;
        const rot = t.rotation || 0;
        const op = (t.opacity !== undefined ? t.opacity : 100) / 100;
        this.videoTransformWrapper.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rot}deg)`;
        this.videoTransformWrapper.style.opacity = op;
    }

    selectClip(clipId) {
        this.selectedClipId = clipId;
        this.selectedGraphicId = null;
        this.selectedAudioClipId = null;

        document.querySelectorAll('.timeline-clip').forEach(el => el.classList.toggle('selected', el.dataset.clipId === clipId));
        document.querySelectorAll('.timeline-graphic-block, .timeline-audio-clip').forEach(b => b.classList.remove('selected'));

        const clip = this.clips.find(c => c.id === clipId);
        if (clip) {
            this.inspectorEmptyState.style.display = 'none';
            this.videoInspectorGroup.style.display = 'block';
            this.graphicInspectorGroup.style.display = 'none';
            this.audioClipInspectorGroup.style.display = 'none';
            if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'none';
            this.updateVideoInspectorValues(clip);
            this.applyClipTransforms(clip);
        } else {
            this.inspectorEmptyState.style.display = 'block';
            this.videoInspectorGroup.style.display = 'none';
            this.graphicInspectorGroup.style.display = 'none';
            this.audioClipInspectorGroup.style.display = 'none';
            if (this.aiInspectorGroup) this.aiInspectorGroup.style.display = 'none';
        }

        this.renderGraphicsCanvas();
    }

    updateVideoInspectorValues(clip) {
        if (!clip) return;
        const t = clip.transform;
        if (this.inspectXRange) this.inspectXRange.value = t.x || 0;
        if (this.inspectXNum) this.inspectXNum.value = t.x || 0;
        if (this.inspectYRange) this.inspectYRange.value = t.y || 0;
        if (this.inspectYNum) this.inspectYNum.value = t.y || 0;
        if (this.inspectScaleRange) this.inspectScaleRange.value = t.scale || 100;
        if (this.inspectScaleNum) this.inspectScaleNum.value = t.scale || 100;
        if (this.inspectRotRange) this.inspectRotRange.value = t.rotation || 0;
        if (this.inspectRotNum) this.inspectRotNum.value = t.rotation || 0;
        if (this.inspectOpacityRange) this.inspectOpacityRange.value = t.opacity !== undefined ? t.opacity : 100;
        if (this.inspectOpacityNum) this.inspectOpacityNum.value = t.opacity !== undefined ? t.opacity : 100;
    }

    initClipDragging(clip, el, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initLeft = clip.timelineStart;
        let isMoving = false;

        const onMouseMove = (e) => {
            isMoving = true;
            const dx = (e.clientX - startX) / this.zoom;
            clip.timelineStart = Math.max(0, initLeft + dx);
            el.style.left = (clip.timelineStart * this.zoom) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isMoving) {
                this.renderTimeline();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initClipTrimming(clip, edge, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initStart = clip.start;
        let initEnd = clip.end;
        let initTlStart = clip.timelineStart;
        let isTrimming = false;

        const onMouseMove = (e) => {
            isTrimming = true;
            const dx = (e.clientX - startX) / this.zoom;
            if (edge === 'left') {
                let newStart = Math.max(0, initStart + dx);
                if (newStart < clip.end - 0.5) {
                    clip.start = newStart;
                    clip.duration = clip.end - newStart;
                    clip.timelineStart = initTlStart + (newStart - initStart);
                }
            } else {
                let newEnd = Math.max(clip.start + 0.5, initEnd + dx);
                clip.end = newEnd;
                clip.duration = newEnd - clip.start;
            }
            this.renderTimeline();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isTrimming) {
                this.markDirty();
                this.saveHistoryState();
                this.updatePlayerSource();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initGraphicTimelineDrag(layer, blockEl, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initStart = layer.start;
        let dur = layer.end - layer.start;
        let isMoving = false;

        const onMouseMove = (e) => {
            isMoving = true;
            const dx = (e.clientX - startX) / this.zoom;
            let targetStart = Math.max(0, initStart + dx);

            if (this.snapping) {
                const threshold = 8 / this.zoom;
                if (Math.abs(targetStart - this.playheadTime) < threshold) targetStart = this.playheadTime;
            }

            layer.start = parseFloat(targetStart.toFixed(2));
            layer.end = parseFloat((targetStart + dur).toFixed(2));
            blockEl.style.left = (layer.start * this.zoom) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isMoving) {
                this.renderTimeline();
                this.renderGraphicsCanvas();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initGraphicTimelineTrim(layer, edge, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initStart = layer.start;
        let initEnd = layer.end;
        let isTrimming = false;

        const onMouseMove = (e) => {
            isTrimming = true;
            const dx = (e.clientX - startX) / this.zoom;
            if (edge === 'left') {
                layer.start = Math.min(initEnd - 0.2, Math.max(0, initStart + dx));
            } else {
                layer.end = Math.max(initStart + 0.2, initEnd + dx);
            }
            this.renderTimeline();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isTrimming) {
                this.renderTimeline();
                this.renderGraphicsCanvas();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // ---------- Timeline Multi-Track Engine ----------
    renderTimeline() {
        this.videoTrackLane.innerHTML = '';
        this.graphicsTrackLane.innerHTML = '';

        const laneMap = {
            'track_video_audio': document.getElementById('laneVideoAudio'),
            'track_music': document.getElementById('laneMusic'),
            'track_voice': document.getElementById('laneVoice'),
            'track_sfx': document.getElementById('laneSfx')
        };

        Object.values(laneMap).forEach(lane => { if (lane) lane.innerHTML = ''; });

        let totalDuration = 0;
        this.clips.forEach(c => totalDuration = Math.max(totalDuration, c.timelineStart + c.duration));
        this.graphics.forEach(g => totalDuration = Math.max(totalDuration, g.end));
        this.audioClips.forEach(a => totalDuration = Math.max(totalDuration, a.end));

        const width = Math.max(this.timelineTracksArea.offsetWidth, (totalDuration + 20) * this.zoom);
        this.videoTrackLane.style.width = width + 'px';
        this.graphicsTrackLane.style.width = width + 'px';
        Object.values(laneMap).forEach(l => { if (l) l.style.width = width + 'px'; });
        if (this.rulerCanvas) this.rulerCanvas.style.width = width + 'px';

        // 1. Render Video Track (V1)
        this.clips.forEach(c => {
            const el = document.createElement('div');
            el.className = 'timeline-clip';
            if (c.id === this.selectedClipId) el.classList.add('selected');
            el.style.left = (c.timelineStart * this.zoom) + 'px';
            el.style.width = (c.duration * this.zoom) + 'px';

            el.innerHTML = `
                <div class="trim-handle trim-left"></div>
                <div class="clip-label-wrap">
                    <span class="clip-label">${c.filename}</span>
                    <span class="clip-dur">${c.duration.toFixed(1)}s</span>
                </div>
                <div class="trim-handle trim-right"></div>
            `;

            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('trim-handle')) return;
                this.selectClip(c.id);
                this.initClipDragging(c, el, e);
                e.stopPropagation();
            });

            el.querySelector('.trim-left').addEventListener('mousedown', (e) => {
                this.selectClip(c.id);
                this.initClipTrimming(c, 'left', e);
                e.stopPropagation();
            });

            el.querySelector('.trim-right').addEventListener('mousedown', (e) => {
                this.selectClip(c.id);
                this.initClipTrimming(c, 'right', e);
                e.stopPropagation();
            });

            this.videoTrackLane.appendChild(el);
        });

        // 2. Render Graphics Track (G1)
        this.graphics.forEach(layer => {
            const el = document.createElement('div');
            el.className = 'timeline-graphic-block';
            el.dataset.layerId = layer.id;
            if (layer.id === this.selectedGraphicId) el.classList.add('selected');

            const dur = Math.max(0.2, layer.end - layer.start);
            el.style.left = (layer.start * this.zoom) + 'px';
            el.style.width = (dur * this.zoom) + 'px';

            el.innerHTML = `
                <div class="trim-handle trim-left"></div>
                <div class="block-label-wrap">
                    <span class="block-text">✦ ${layer.name}</span>
                    <span class="block-dur">${dur.toFixed(1)}s</span>
                </div>
                <div class="trim-handle trim-right"></div>
            `;

            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('trim-handle')) return;
                this.selectGraphic(layer.id);
                this.initGraphicTimelineDrag(layer, el, e);
                e.stopPropagation();
            });

            el.querySelector('.trim-left').addEventListener('mousedown', (e) => {
                this.selectGraphic(layer.id);
                this.initGraphicTimelineTrim(layer, 'left', e);
                e.stopPropagation();
            });

            el.querySelector('.trim-right').addEventListener('mousedown', (e) => {
                this.selectGraphic(layer.id);
                this.initGraphicTimelineTrim(layer, 'right', e);
                e.stopPropagation();
            });

            this.graphicsTrackLane.appendChild(el);
        });

        // 3. Render Audio Tracks (A1 to A4)
        this.audioClips.forEach(clip => {
            const targetLane = laneMap[clip.trackId] || laneMap['track_sfx'];
            if (!targetLane) return;

            const el = document.createElement('div');
            el.className = 'timeline-audio-clip audio-clip-' + (clip.trackId || 'track_sfx').replace('track_', '');
            el.dataset.clipId = clip.id;
            if (clip.id === this.selectedAudioClipId) el.classList.add('selected');

            const dur = Math.max(0.2, clip.end - clip.start);
            el.style.left = (clip.start * this.zoom) + 'px';
            el.style.width = (dur * this.zoom) + 'px';

            // Synthetic waveform bars
            let waveformSvg = '<svg class="waveform-svg" preserveAspectRatio="none" viewBox="0 0 100 20">';
            for (let i = 2; i < 100; i += 3) {
                const h = Math.max(3, (Math.sin(i * 0.4) * 0.5 + 0.5) * 16);
                waveformSvg += `<rect x="${i}" y="${10 - h/2}" width="1.5" height="${h}" rx="0.5" fill="currentColor" opacity="0.45"/>`;
            }
            waveformSvg += '</svg>';

            el.innerHTML = `
                <div class="trim-handle trim-left"></div>
                ${waveformSvg}
                <div class="audio-clip-label-wrap">
                    <span class="audio-clip-name">${clip.name}</span>
                    <span class="audio-clip-dur">${dur.toFixed(1)}s</span>
                </div>
                <div class="trim-handle trim-right"></div>
            `;

            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('trim-handle')) return;
                this.selectAudioClip(clip.id);
                this.initAudioTimelineDrag(clip, el, e);
                e.stopPropagation();
            });

            el.querySelector('.trim-left').addEventListener('mousedown', (e) => {
                this.selectAudioClip(clip.id);
                this.initAudioTimelineTrim(clip, 'left', e);
                e.stopPropagation();
            });

            el.querySelector('.trim-right').addEventListener('mousedown', (e) => {
                this.selectAudioClip(clip.id);
                this.initAudioTimelineTrim(clip, 'right', e);
                e.stopPropagation();
            });

            targetLane.appendChild(el);
        });

        this.updateTimeDisplay();
    }

    initAudioTimelineDrag(clip, el, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initStart = clip.start;
        let dur = clip.end - clip.start;
        let isMoving = false;

        const onMouseMove = (e) => {
            isMoving = true;
            const dx = (e.clientX - startX) / this.zoom;
            let targetStart = Math.max(0, initStart + dx);

            if (this.snapping) {
                const threshold = 8 / this.zoom;
                if (Math.abs(targetStart - this.playheadTime) < threshold) targetStart = this.playheadTime;
            }

            clip.start = parseFloat(targetStart.toFixed(2));
            clip.end = parseFloat((targetStart + dur).toFixed(2));
            el.style.left = (clip.start * this.zoom) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isMoving) {
                this.renderTimeline();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    initAudioTimelineTrim(clip, edge, mousedownEvt) {
        let startX = mousedownEvt.clientX;
        let initStart = clip.start;
        let initEnd = clip.end;
        let isTrimming = false;

        const onMouseMove = (e) => {
            isTrimming = true;
            const dx = (e.clientX - startX) / this.zoom;
            if (edge === 'left') {
                clip.start = Math.min(initEnd - 0.2, Math.max(0, initStart + dx));
            } else {
                clip.end = Math.max(initStart + 0.2, initEnd + dx);
            }
            this.renderTimeline();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isTrimming) {
                this.renderTimeline();
                this.markDirty();
                this.saveHistoryState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // ---------- Inspector Event Listeners ----------
    initInspector() {
        // Video Inspector
        const updateVideoVal = (prop, range, num) => {
            const clip = this.clips.find(c => c.id === this.selectedClipId);
            if (!clip) return;
            const val = parseFloat(range.value);
            num.value = val;
            clip.transform[prop] = val;
            this.applyClipTransforms(clip);
            this.markDirty();
        };

        const setupVideoPair = (prop, range, num) => {
            if (!range || !num) return;
            range.addEventListener('input', () => updateVideoVal(prop, range, num));
            num.addEventListener('input', () => {
                range.value = num.value;
                updateVideoVal(prop, range, num);
            });
            range.addEventListener('change', () => this.saveHistoryState());
        };

        setupVideoPair('x', this.inspectXRange, this.inspectXNum);
        setupVideoPair('y', this.inspectYRange, this.inspectYNum);
        setupVideoPair('scale', this.inspectScaleRange, this.inspectScaleNum);
        setupVideoPair('rotation', this.inspectRotRange, this.inspectRotNum);
        setupVideoPair('opacity', this.inspectOpacityRange, this.inspectOpacityNum);

        // Audio Inspector
        const audioNameInput = document.getElementById('audioClipNameInput');
        const audioTrackSelect = document.getElementById('audioClipTrackSelect');
        const audioVolRange = document.getElementById('audioClipVolRange');
        const audioMuteCheck = document.getElementById('audioClipMuteCheck');
        const audioPanRange = document.getElementById('audioClipPanRange');
        const audioFadeInRange = document.getElementById('audioClipFadeInRange');
        const audioFadeOutRange = document.getElementById('audioClipFadeOutRange');
        const deleteAudioClipBtn = document.getElementById('deleteAudioClipBtn');

        const bindAudioProp = (el, callback) => {
            if (!el) return;
            el.addEventListener('input', () => {
                const clip = this.audioClips.find(c => c.id === this.selectedAudioClipId);
                if (clip) {
                    callback(clip);
                    this.renderTimeline();
                    this.markDirty();
                }
            });
            el.addEventListener('change', () => this.saveHistoryState());
        };

        bindAudioProp(audioNameInput, (c) => c.name = audioNameInput.value);
        bindAudioProp(audioTrackSelect, (c) => c.trackId = audioTrackSelect.value);
        bindAudioProp(audioVolRange, (c) => {
            c.volume = parseInt(audioVolRange.value);
            document.getElementById('audioClipVolDisplay').textContent = c.volume;
        });
        bindAudioProp(audioMuteCheck, (c) => c.muted = audioMuteCheck.checked);
        bindAudioProp(audioPanRange, (c) => {
            c.pan = parseInt(audioPanRange.value);
            const p = c.pan;
            document.getElementById('audioClipPanDisplay').textContent = p === 0 ? 'C' : p < 0 ? `${Math.abs(p)}% L` : `${p}% R`;
        });
        bindAudioProp(audioFadeInRange, (c) => {
            c.fadeIn = parseFloat(audioFadeInRange.value) / 10.0;
            document.getElementById('audioClipFadeInDisplay').textContent = c.fadeIn.toFixed(1);
        });
        bindAudioProp(audioFadeOutRange, (c) => {
            c.fadeOut = parseFloat(audioFadeOutRange.value) / 10.0;
            document.getElementById('audioClipFadeOutDisplay').textContent = c.fadeOut.toFixed(1);
        });

        if (deleteAudioClipBtn) {
            deleteAudioClipBtn.addEventListener('click', () => {
                if (this.selectedAudioClipId) {
                    this.audioClips = this.audioClips.filter(c => c.id !== this.selectedAudioClipId);
                    this.selectAudioClip(null);
                    this.renderTimeline();
                    this.markDirty();
                    this.saveHistoryState();
                    this.showToast('Audio clip deleted', 'success');
                }
            });
        }
    }

    // ---------- Video Player & Web Audio Preview Sync ----------
    initPlayer() {
        if (!this.video) return;

        this.playBtn.addEventListener('click', () => this.togglePlayback());

        this.video.addEventListener('play', () => {
            this.playBtn.querySelector('.play-icon').style.display = 'none';
            this.playBtn.querySelector('.pause-icon').style.display = 'block';
            this.startPlayheadTracking();
            this.syncAudioClipsPlayback();
        });

        this.video.addEventListener('pause', () => {
            this.playBtn.querySelector('.play-icon').style.display = 'block';
            this.playBtn.querySelector('.pause-icon').style.display = 'none';
            this.stopPlayheadTracking();
            this.stopAudioClipsPlayback();
        });

        this.video.addEventListener('timeupdate', () => {
            this.updateTimeDisplay();
        });

        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', () => {
                this.video.volume = this.volumeSlider.value / 100;
            });
        }
    }

    syncAudioClipsPlayback() {
        this.stopAudioClipsPlayback();
        const curTime = this.playheadTime;

        this.audioClips.forEach(clip => {
            if (clip.muted) return;
            const track = this.audioTracks.find(t => t.id === clip.trackId);
            if (track && track.muted) return;

            if (curTime >= clip.start && curTime < clip.end) {
                const audio = new Audio(clip.url);
                const offset = (curTime - clip.start) + (clip.sourceStart || 0);
                audio.currentTime = offset;
                const effVol = ((clip.volume || 100) / 100) * ((track?.volume || 100) / 100);
                audio.volume = Math.max(0, Math.min(1, effVol));
                audio.play().catch(e => {});
                this.activeAudioNodes.push(audio);
            }
        });

        // Simulate meter animation
        const meterL = document.getElementById('meterBarLeft');
        const meterR = document.getElementById('meterBarRight');
        if (meterL && meterR) {
            meterL.style.height = '65%';
            meterR.style.height = '70%';
        }
    }

    stopAudioClipsPlayback() {
        this.activeAudioNodes.forEach(a => {
            try { a.pause(); } catch(e) {}
        });
        this.activeAudioNodes = [];

        const meterL = document.getElementById('meterBarLeft');
        const meterR = document.getElementById('meterBarRight');
        if (meterL && meterR) {
            meterL.style.height = '0%';
            meterR.style.height = '0%';
        }
    }

    togglePlayback() {
        if (!this.video.src) return;
        if (this.video.paused) {
            this.video.play().catch(e => {});
        } else {
            this.video.pause();
        }
    }

    startPlayheadTracking() {
        this.ticker = requestAnimationFrame(() => this.trackPlayhead());
    }

    stopPlayheadTracking() {
        if (this.ticker) cancelAnimationFrame(this.ticker);
    }

    trackPlayhead() {
        if (this.video.paused) return;

        const clip = this.getActiveClipAtTime(this.playheadTime);
        if (clip) {
            const elapsed = this.video.currentTime - clip.start;
            const newTime = clip.timelineStart + elapsed;

            if (this.video.currentTime >= clip.end || newTime >= clip.timelineStart + clip.duration) {
                this.playheadTime = clip.timelineStart + clip.duration;
                this.updatePlayerSource();
            } else {
                this.playheadTime = newTime;
                this.updatePlayheadVisual();
                this.renderGraphicsCanvas();
            }
        } else {
            this.video.pause();
        }

        this.ticker = requestAnimationFrame(() => this.trackPlayhead());
    }

    getActiveClipAtTime(time) {
        return this.clips.find(c => time >= c.timelineStart && time <= (c.timelineStart + c.duration));
    }

    updatePlayerSource() {
        if (!this.video) return;
        const clip = this.getActiveClipAtTime(this.playheadTime);
        if (clip) {
            const expectedUrl = clip.filename.includes('clip') ? `/download/clip/stream/${clip.filename}` : `/download/input/${clip.filename}`;
            if (this.video.getAttribute('data-current-src') !== expectedUrl) {
                const wasPlaying = !this.video.paused;
                this.video.setAttribute('data-current-src', expectedUrl);
                this.video.src = expectedUrl;
                this.video.load();

                this.video.addEventListener('loadedmetadata', () => {
                    const localTime = clip.start + (this.playheadTime - clip.timelineStart);
                    this.video.currentTime = Math.max(clip.start, Math.min(clip.end, localTime));
                    this.applyClipTransforms(clip);
                    if (wasPlaying) this.video.play().catch(e => {});
                }, { once: true });
            } else {
                const localTime = clip.start + (this.playheadTime - clip.timelineStart);
                this.video.currentTime = Math.max(clip.start, Math.min(clip.end, localTime));
                this.applyClipTransforms(clip);
            }
        } else {
            this.video.pause();
            this.video.src = '';
            this.video.removeAttribute('data-current-src');
        }
    }

    updateTimeDisplay() {
        if (this.currentTimeDisplay) this.currentTimeDisplay.textContent = this.formatTime(this.playheadTime);
        if (this.durationDisplay) {
            let total = 0;
            this.clips.forEach(c => total = Math.max(total, c.timelineStart + c.duration));
            this.durationDisplay.textContent = this.formatTime(total);
        }
    }

    formatTime(secs) {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        const ms = Math.floor((secs % 1) * 100).toString().padStart(2, '0');
        return `${m}:${s}.${ms}`;
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
            ctx.fillText(m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`, x + 4, height - 4);
        }
    }

    updatePlayheadVisual() {
        const x = this.playheadTime * this.zoom;
        if (this.timelinePlayhead) this.timelinePlayhead.style.left = x + 'px';
        if (this.timelineTimeReadout) this.timelineTimeReadout.textContent = this.formatTime(this.playheadTime);
    }

    // ---------- Export Video with Multi-Track Audio Mixing & Graphics ----------
    initExport() {
        const modal = document.getElementById('exportModal');
        const openBtn = document.getElementById('exportBtn');
        const closeBtn = document.getElementById('exportModalClose');
        const cancelBtn = document.getElementById('exportCancelBtn');
        const startBtn = document.getElementById('exportStartBtn');
        const statusPanel = document.getElementById('exportStatusPanel');

        if (!modal || !openBtn) return;

        openBtn.addEventListener('click', () => {
            if (this.clips.length === 0) {
                this.showToast('Cannot export an empty timeline', 'error');
                return;
            }
            modal.hidden = false;
        });

        const closeModal = () => {
            modal.hidden = true;
            if (statusPanel) statusPanel.style.display = 'none';
            if (startBtn) startBtn.disabled = false;
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        startBtn.addEventListener('click', async () => {
            startBtn.disabled = true;
            statusPanel.style.display = 'block';

            const statusText = document.getElementById('exportStatusText');
            const percentText = document.getElementById('exportPercentText');
            const bar = document.getElementById('exportProgressBar');

            statusText.textContent = 'Mixing multi-track audio & motion graphics...';
            percentText.textContent = '0%';
            bar.style.width = '0%';

            let progress = 0;
            const progressTimer = setInterval(() => {
                if (progress < 90) {
                    progress += Math.floor(Math.random() * 8) + 3;
                    if (progress > 90) progress = 90;
                    statusText.textContent = progress > 50 ? 'Rendering master audio & video streams...' : 'Processing audio tracks (Music, Voice, SFX)...';
                    percentText.textContent = progress + '%';
                    bar.style.width = progress + '%';
                }
            }, 300);

            try {
                const res = await fetch(`/editor/api/projects/${this.project.id}/export-timeline`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clips: this.clips,
                        graphics: this.graphics,
                        audioTracks: this.audioTracks,
                        audioClips: this.audioClips,
                        videoAudioVolume: 100,
                        videoAudioMuted: false,
                        canvasWidth: 360,
                        canvasHeight: 640
                    })
                });
                const data = await res.json();
                clearInterval(progressTimer);

                if (data.success) {
                    percentText.textContent = '100%';
                    bar.style.width = '100%';
                    statusText.textContent = 'Export completed with master audio mix!';
                    this.showToast('Export successful!', 'success');

                    setTimeout(() => {
                        closeModal();
                        window.open(data.url, '_blank');
                    }, 1200);
                } else {
                    statusText.textContent = 'Render failed: ' + data.error;
                    startBtn.disabled = false;
                }
            } catch (e) {
                clearInterval(progressTimer);
                console.error("Export error:", e);
                statusText.textContent = 'Export failed';
                startBtn.disabled = false;
            }
        });
    }

    // ---------- Autosave & State Persistence ----------
    markDirty() {
        this.isDirty = true;
        const ind = document.getElementById('dirtyIndicator');
        if (ind) ind.style.display = 'inline';

        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) saveStatus.textContent = 'Unsaved changes';

        if (this.autosaveTimeout) clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = setTimeout(() => this.saveProject(true), 2000);
    }

    async saveProject(isAutosave = false) {
        if (!this.isDirty && isAutosave) return;
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) saveStatus.textContent = 'Saving...';

        const payload = {
            editor_state: JSON.stringify({
                clips: this.clips,
                graphics: this.graphics,
                audioTracks: this.audioTracks,
                audioClips: this.audioClips,
                aiAnalysis: this.aiAnalysis,
                zoom: this.zoom,
                snapping: this.snapping,
                safeAreaVisible: this.safeAreaVisible
            })
        };

        try {
            const res = await fetch(`/editor/api/projects/${this.project.id}/editor-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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

    saveHistoryState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const snapshot = JSON.stringify({
            clips: this.clips,
            graphics: this.graphics,
            audioTracks: this.audioTracks,
            audioClips: this.audioClips,
            aiAnalysis: this.aiAnalysis,
            zoom: this.zoom
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
            this.clips = state.clips || [];
            this.graphics = state.graphics || [];
            this.audioTracks = state.audioTracks || this.audioTracks;
            this.audioClips = state.audioClips || [];
            this.aiAnalysis = state.aiAnalysis || this.aiAnalysis;
            this.zoom = state.zoom || 30;

            this.renderTimeline();
            this.renderGraphicsCanvas();
            this.renderAiStudioLists();
            this.drawRuler();
            this.updatePlayerSource();
        } catch (e) {
            console.error("Undo restore failed:", e);
        }
    }

    initHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

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
                    this.saveProject(false);
                } else if (key === 'd') {
                    e.preventDefault();
                    if (e.shiftKey && this.selectedGraphicId) {
                        this.duplicateSelectedGraphic();
                    } else if (this.selectedClipId) {
                        this.duplicateSelectedClip();
                    } else if (this.selectedGraphicId) {
                        this.duplicateSelectedGraphic();
                    }
                }
            } else {
                if (e.key === ' ') {
                    e.preventDefault();
                    this.togglePlayback();
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (this.selectedAudioClipId) {
                        e.preventDefault();
                        this.audioClips = this.audioClips.filter(c => c.id !== this.selectedAudioClipId);
                        this.selectAudioClip(null);
                        this.renderTimeline();
                        this.markDirty();
                    } else if (this.selectedGraphicId) {
                        e.preventDefault();
                        this.deleteSelectedGraphic();
                    } else if (this.selectedClipId) {
                        e.preventDefault();
                        this.deleteSelectedClip();
                    }
                }
            }
        });
    }

    // ---------- Context Menus ----------
    initContextMenus() {
        const timelineArea = this.timelineTracksArea;
        if (!timelineArea) return;

        timelineArea.addEventListener('contextmenu', (e) => {
            const clipBlock = e.target.closest('.timeline-clip');
            const graphicBlock = e.target.closest('.timeline-graphic-block');

            if (clipBlock) {
                e.preventDefault();
                this.selectedClipId = clipBlock.dataset.clipId;
                this.showTimelineClipContextMenu(e.clientX, e.clientY, clipBlock.dataset.clipId);
            } else if (graphicBlock) {
                e.preventDefault();
                this.selectedGraphicId = graphicBlock.dataset.layerId;
                this.showGraphicContextMenu(e.clientX, e.clientY, graphicBlock.dataset.layerId);
            }
        });
    }

    showTimelineClipContextMenu(x, y, clipId) {
        const existing = document.getElementById('editorContextMenu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'editorContextMenu';
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const items = [
            { label: '✕ Delete Clip', action: () => this.deleteSelectedClip() },
            { label: '⎘ Duplicate Clip', action: () => this.duplicateSelectedClip() },
            { label: '✂ Split at Playhead', action: () => this.splitClipAtPlayhead() },
            { label: '▶ Move to Playhead', action: () => this.moveClipToPlayhead() },
        ];

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item' + (item.danger ? ' danger' : '');
            btn.textContent = item.label;
            btn.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    showGraphicContextMenu(x, y, graphicId) {
        const existing = document.getElementById('editorContextMenu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'editorContextMenu';
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const items = [
            { label: '✕ Delete', action: () => this.deleteSelectedGraphic() },
            { label: '⎘ Duplicate', action: () => this.duplicateSelectedGraphic() },
            { label: '⬆ Bring Forward', action: () => this.bringGraphicForward() },
            { label: '⬇ Send Backward', action: () => this.sendGraphicBackward() },
            { label: '↺ Reset Transform', action: () => this.resetGraphicTransform() },
            { label: '◆ Add Keyframe', action: () => this.addKeyframeAtPlayhead() },
        ];

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item' + (item.danger ? ' danger' : '');
            btn.textContent = item.label;
            btn.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // ---------- Graphic Keyframes ----------
    initGraphicKeyframes() {
        const kfTimeline = document.getElementById('keyframeTimeline');
        const kfAddBtn = document.getElementById('addKeyframeBtn');
        const kfRemoveBtn = document.getElementById('removeKeyframeBtn');
        if (!kfTimeline) return;

        if (kfAddBtn) {
            kfAddBtn.addEventListener('click', () => {
                const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
                if (!layer) return;
                const t = this.playheadTime;
                const transform = layer.transform || {};
                this.saveGraphicKeyframes(layer.id, [
                    ...(layer.keyframes || []),
                    { time: t, x: transform.x || 0, y: transform.y || 0, scale: transform.scale || 100, rotation: transform.rotation || 0, opacity: transform.opacity || 100 }
                ]);
                this.renderKeyframeTimeline();
            });
        }

        if (kfRemoveBtn) {
            kfRemoveBtn.addEventListener('click', () => {
                const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
                if (!layer || !layer.keyframes) return;
                const closest = layer.keyframes.reduce((prev, curr) =>
                    Math.abs(curr.time - this.playheadTime) < Math.abs(prev.time - this.playheadTime) ? curr : prev
                );
                if (Math.abs(closest.time - this.playheadTime) < 0.5) {
                    this.saveGraphicKeyframes(layer.id, layer.keyframes.filter(k => k.time !== closest.time));
                    this.renderKeyframeTimeline();
                }
            });
        }
    }

    renderKeyframeTimeline() {
        const kfTimeline = document.getElementById('keyframeTimeline');
        if (!kfTimeline) return;

        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer || !layer.keyframes || layer.keyframes.length === 0) {
            kfTimeline.innerHTML = '<span style="font-size:10px; color:var(--text-muted);">No keyframes. Click Add Keyframe to create one.</span>';
            return;
        }

        kfTimeline.innerHTML = '';
        layer.keyframes.forEach((kf, i) => {
            const chip = document.createElement('div');
            chip.className = 'keyframe-chip';
            chip.innerHTML = `<span>K${i + 1}</span><span>${kf.time.toFixed(1)}s</span>`;
            chip.addEventListener('click', () => {
                if (this.video) {
                    this.video.currentTime = kf.time;
                    this.playheadTime = kf.time;
                    this.updatePlayheadVisual();
                    this.renderGraphicsCanvas();
                }
            });
            kfTimeline.appendChild(chip);
        });
    }

    async saveGraphicKeyframes(graphicId, keyframes) {
        try {
            await fetch('/api/editor/graphics/keyframes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ graphic_id: graphicId, keyframes }),
            });
            const layer = this.graphics.find(g => g.id === graphicId);
            if (layer) layer.keyframes = keyframes;
        } catch (e) {
            console.error("Keyframe save error:", e);
        }
    }

    // ---------- Graphic Operations ----------
    duplicateSelectedGraphic() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;

        const newLayer = JSON.parse(JSON.stringify(layer));
        newLayer.id = 'layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        newLayer.transform.x = (layer.transform.x || 0) + 20;
        newLayer.transform.y = (layer.transform.y || 0) + 20;
        this.graphics.push(newLayer);
        this.selectGraphic(newLayer.id);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('Graphic duplicated', 'success');
    }

    duplicateSelectedClip() {
        if (!this.selectedClipId) return;
        const clip = this.clips.find(c => c.id === this.selectedClipId);
        if (!clip) return;

        const newClip = JSON.parse(JSON.stringify(clip));
        newClip.id = 'clip_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const dur = clip.end - clip.start;
        newClip.start = clip.end + 0.1;
        newClip.end = newClip.start + dur;
        this.clips.push(newClip);
        this.selectClip(newClip.id);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('Clip duplicated', 'success');
    }

    deleteSelectedClip() {
        if (!this.selectedClipId) return;
        this.clips = this.clips.filter(c => c.id !== this.selectedClipId);
        this.selectClip(null);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('Clip deleted', 'success');
    }

    splitClipAtPlayhead() {
        if (!this.selectedClipId) return;
        const clip = this.clips.find(c => c.id === this.selectedClipId);
        if (!clip) return;
        const t = this.playheadTime;
        if (t <= clip.start || t >= clip.end) {
            this.showToast('Playhead must be within clip range', 'error');
            return;
        }

        const newClip = JSON.parse(JSON.stringify(clip));
        newClip.id = 'clip_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        newClip.start = t;
        clip.end = t;
        this.clips.push(newClip);
        this.clips.sort((a, b) => a.start - b.start);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('Clip split at playhead', 'success');
    }

    moveClipToPlayhead() {
        if (!this.selectedClipId) return;
        const clip = this.clips.find(c => c.id === this.selectedClipId);
        if (!clip) return;
        const dur = clip.end - clip.start;
        clip.start = this.playheadTime;
        clip.end = this.playheadTime + dur;
        this.clips.sort((a, b) => a.start - b.start);
        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
    }

    bringGraphicForward() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        layer.layerOrder = (layer.layerOrder || 0) + 1;
        this.renderLayersStack();
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
    }

    sendGraphicBackward() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        layer.layerOrder = Math.max(0, (layer.layerOrder || 0) - 1);
        this.renderLayersStack();
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
    }

    resetGraphicTransform() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        layer.transform = { x: 0, y: 0, width: 120, height: 120, scale: 100, rotation: 0, opacity: 100 };
        this.updateGraphicInspector(layer);
        this.renderGraphicsCanvas();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('Transform reset', 'success');
    }

    addKeyframeAtPlayhead() {
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        const t = this.playheadTime;
        const transform = layer.transform || {};
        const newKf = { time: t, x: transform.x || 0, y: transform.y || 0, scale: transform.scale || 100, rotation: transform.rotation || 0, opacity: transform.opacity || 100 };
        const existing = layer.keyframes || [];
        const filtered = existing.filter(k => Math.abs(k.time - t) >= 0.01);
        filtered.push(newKf);
        filtered.sort((a, b) => a.time - b.time);
        this.saveGraphicKeyframes(layer.id, filtered);
        this.renderKeyframeTimeline();
        this.showToast('Keyframe added', 'success');
    }

    initTimeline() {
        if (this.timelineZoom) {
            this.timelineZoom.addEventListener('input', () => {
                this.zoom = parseFloat(this.timelineZoom.value);
                this.renderTimeline();
                this.drawRuler();
                this.updatePlayheadVisual();
            });
        }

        if (this.snapToggle) {
            this.snapToggle.addEventListener('click', () => {
                this.snapping = !this.snapping;
                this.snapToggle.classList.toggle('active', this.snapping);
            });
        }

        const ruler = this.rulerCanvas;
        if (ruler) {
            ruler.addEventListener('mousedown', (e) => {
                const seekTo = (evt) => {
                    const rect = ruler.getBoundingClientRect();
                    const x = evt.clientX - rect.left + this.timelineTracksArea.scrollLeft;
                    this.playheadTime = Math.max(0, x / this.zoom);
                    if (this.video) this.video.currentTime = this.playheadTime;
                    this.updatePlayheadVisual();
                    this.updatePlayerSource();
                    this.renderGraphicsCanvas();
                };

                seekTo(e);

                const onMouseMove = (evt) => seekTo(evt);
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
    }

    // =========================================================================
    // TEMPLATES, PRESETS & BRAND KIT WORKFLOW CONTROLLER
    // =========================================================================
    initTemplatesAndPresets() {
        const navChips = document.querySelectorAll('.template-nav-chips .chip-btn');
        navChips.forEach(chip => {
            chip.addEventListener('click', () => {
                navChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const targetTab = chip.dataset.tab;
                document.querySelectorAll('.template-tab-view').forEach(view => view.style.display = 'none');

                const tabMap = {
                    'templates': 'tplTabViewTemplates',
                    'brand': 'tplTabViewBrand',
                    'captions': 'tplTabViewCaptions',
                    'graphics': 'tplTabViewGraphics',
                    'audio': 'tplTabViewAudio',
                    'export': 'tplTabViewExport'
                };

                const activeViewId = tabMap[targetTab] || 'tplTabViewTemplates';
                const activeView = document.getElementById(activeViewId);
                if (activeView) activeView.style.display = 'block';
            });
        });

        // Apply Brand Kit Button
        const applyBrandBtn = document.getElementById('applyBrandKitBtn');
        if (applyBrandBtn) {
            applyBrandBtn.addEventListener('click', () => this.applyBrandKitToProject());
        }
    }

    async loadTemplatesAndPresets() {
        try {
            // Load templates
            const tplRes = await fetch('/api/editor/templates');
            const tplData = await tplRes.json();
            if (tplData.success && tplData.templates) {
                this.renderTemplatesGrid(tplData.templates);
            }

            // Load presets and brand kit
            const preRes = await fetch('/api/editor/presets');
            const preData = await preRes.json();
            if (preData.success && preData.presets) {
                const p = preData.presets;
                this.renderCaptionPresetsGrid(p.captions || []);
                this.renderGraphicsPresetsGrid(p.graphics || []);
                this.renderAudioPresetsGrid(p.audio || []);
                this.renderExportPresetsGrid(p.export || []);

                if (p.brandKit) {
                    const primary = document.getElementById('brandPrimaryColor');
                    const secondary = document.getElementById('brandSecondaryColor');
                    const accent = document.getElementById('brandAccentColor');
                    const font = document.getElementById('brandPrimaryFont');
                    if (primary && p.brandKit.primaryColor) primary.value = p.brandKit.primaryColor;
                    if (secondary && p.brandKit.secondaryColor) secondary.value = p.brandKit.secondaryColor;
                    if (accent && p.brandKit.accentColor) accent.value = p.brandKit.accentColor;
                    if (font && p.brandKit.primaryFont) font.value = p.brandKit.primaryFont;
                }
            }
        } catch (e) {
            console.error("Failed to load templates and presets:", e);
        }
    }

    renderTemplatesGrid(templates) {
        const grid = document.getElementById('templatesListGrid');
        if (!grid) return;
        grid.innerHTML = '';

        templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'template-card-item';
            card.innerHTML = `
                <div class="template-card-top">
                    <span class="template-card-icon">${t.thumbnailIcon || '🎨'}</span>
                    <span class="template-aspect-badge">${t.aspectRatio || '9:16'}</span>
                </div>
                <div class="template-card-name">${t.name}</div>
                <div class="template-card-desc">${t.description || ''}</div>
                <div class="template-card-actions">
                    <button class="btn btn-secondary btn-sm use-tpl-btn" style="width:100%; justify-content:center;">✦ Apply Template</button>
                </div>
            `;

            card.querySelector('.use-tpl-btn').addEventListener('click', () => this.applyTemplate(t));
            grid.appendChild(card);
        });
    }

    applyTemplate(tpl) {
        if (!confirm(`Apply "${tpl.name}" template to current project? (This will add default graphics, audio ducking, and caption styling)`)) return;

        const data = tpl.data || {};
        
        // 1. Caption style
        if (data.captionStyle) {
            this.captionStyle = { ...data.captionStyle };
        }

        // 2. Add graphics
        if (Array.isArray(data.graphics)) {
            data.graphics.forEach(g => {
                const newG = JSON.parse(JSON.stringify(g));
                newG.id = 'layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                this.graphics.push(newG);
            });
        }

        // 3. Audio Tracks setup
        if (Array.isArray(data.audioTracks)) {
            this.audioTracks = JSON.parse(JSON.stringify(data.audioTracks));
        }

        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`✦ Template "${tpl.name}" applied successfully!`, 'success');
    }

    renderCaptionPresetsGrid(presets) {
        const grid = document.getElementById('captionPresetsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'preset-card-item';
            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-card-title">${p.name}</span>
                    <span class="ai-score-badge" style="font-size:9px;">${p.category || 'Style'}</span>
                </div>
                <div class="caption-sample-box" style="font-family:'${p.fontFamily || 'Inter'}', sans-serif; color:${p.textColor || '#FFF'};">
                    "Caption Preview"
                </div>
                <button class="btn btn-secondary btn-sm apply-cap-btn" style="width:100%; justify-content:center; margin-top:6px; font-size:11px;">Apply Style</button>
            `;

            card.querySelector('.apply-cap-btn').addEventListener('click', () => {
                this.captionStyle = {
                    fontFamily: p.fontFamily,
                    fontSize: p.fontSize,
                    fontWeight: p.fontWeight,
                    textColor: p.textColor,
                    activeWordColor: p.activeWordColor,
                    backgroundColor: p.backgroundColor || '#000000',
                    backgroundOpacity: p.backgroundOpacity !== undefined ? p.backgroundOpacity : 0.0,
                    outlineWidth: p.outlineWidth || 0,
                    outlineColor: p.outlineColor || '#000000',
                    shadowBlur: p.shadowBlur || 0,
                    animation: p.animation || 'pop'
                };
                this.markDirty();
                this.saveHistoryState();
                this.showToast(`Caption style "${p.name}" applied`, 'success');
            });

            grid.appendChild(card);
        });
    }

    renderGraphicsPresetsGrid(presets) {
        const grid = document.getElementById('graphicsPresetsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'preset-card-item';
            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-card-title">${p.name}</span>
                    <span class="ai-score-badge" style="font-size:9px;">${p.category || 'Graphic'}</span>
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${p.text || p.name}</div>
                <button class="btn btn-secondary btn-sm add-g-btn" style="width:100%; justify-content:center; margin-top:6px; font-size:11px;">+ Add to Canvas</button>
            `;

            card.querySelector('.add-g-btn').addEventListener('click', () => {
                this.addGraphicLayer({
                    type: p.type || 'text',
                    name: p.name,
                    fill: p.fill || '#8B5CF6',
                    text: p.text || p.name,
                    icon: '✦',
                    shapeType: p.shapeType || 'rect'
                });
            });

            grid.appendChild(card);
        });
    }

    renderAudioPresetsGrid(presets) {
        const grid = document.getElementById('audioPresetsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'preset-card-item';
            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-card-title">${p.name}</span>
                    <span class="ai-score-badge" style="font-size:9px;">${p.category || 'Audio'}</span>
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Voice ${p.voiceVolume}% | Music ${p.musicVolume}% ${p.duckingEnabled ? '(Ducking On)' : ''}</div>
                <button class="btn btn-secondary btn-sm apply-aud-btn" style="width:100%; justify-content:center; margin-top:6px; font-size:11px;">Apply Mix</button>
            `;

            card.querySelector('.apply-aud-btn').addEventListener('click', () => {
                const vTrack = this.audioTracks.find(t => t.type === 'video_audio' || t.type === 'voice');
                const mTrack = this.audioTracks.find(t => t.type === 'music');
                if (vTrack && p.voiceVolume !== undefined) vTrack.volume = p.voiceVolume;
                if (mTrack) {
                    if (p.musicVolume !== undefined) mTrack.volume = p.musicVolume;
                    if (p.duckingEnabled !== undefined) mTrack.ducking = { enabled: p.duckingEnabled, amount: p.duckingAmount || 60 };
                }
                this.markDirty();
                this.saveHistoryState();
                this.showToast(`Audio preset "${p.name}" applied`, 'success');
            });

            grid.appendChild(card);
        });
    }

    renderExportPresetsGrid(presets) {
        const grid = document.getElementById('exportPresetsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'preset-card-item';
            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-card-title">${p.name}</span>
                    <span class="ai-score-badge" style="font-size:9px;">${p.category || 'Export'}</span>
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${p.width}x${p.height} @ ${p.fps}fps (${p.bitrate})</div>
                <button class="btn btn-secondary btn-sm sel-exp-btn" style="width:100%; justify-content:center; margin-top:6px; font-size:11px;">Select for Export</button>
            `;

            card.querySelector('.sel-exp-btn').addEventListener('click', () => {
                this.selectedExportPreset = p;
                this.showToast(`Selected export format: ${p.name}`, 'success');
                const exportModal = document.getElementById('exportModal');
                if (exportModal) exportModal.removeAttribute('hidden');
            });

            grid.appendChild(card);
        });
    }

    async applyBrandKitToProject() {
        const primaryColor = document.getElementById('brandPrimaryColor')?.value || '#8B5CF6';
        const secondaryColor = document.getElementById('brandSecondaryColor')?.value || '#3B82F6';
        const accentColor = document.getElementById('brandAccentColor')?.value || '#10B981';
        const primaryFont = document.getElementById('brandPrimaryFont')?.value || 'Inter';

        // 1. Tint all graphic layers with brand primary / secondary color
        this.graphics.forEach((layer, idx) => {
            if (layer.appearance) {
                layer.appearance.fill = (idx % 2 === 0) ? primaryColor : secondaryColor;
            }
            if (layer.typography) {
                layer.typography.fontFamily = primaryFont;
            }
        });

        // 2. Update caption style with brand typography & active color
        if (!this.captionStyle) this.captionStyle = {};
        this.captionStyle.fontFamily = primaryFont;
        this.captionStyle.activeWordColor = accentColor;

        // 3. Save brand kit to backend
        try {
            await fetch('/api/editor/brand-kit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primaryColor,
                    secondaryColor,
                    accentColor,
                    primaryFont
                })
            });
        } catch (e) {
            console.error("Failed to save brand kit:", e);
        }

        this.renderTimeline();
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast('✦ Brand Kit applied to all graphics and typography!', 'success');
    }

    initProjectManagementActions() {
        // 1. Duplicate Project
        const dupBtn = document.getElementById('duplicateProjectBtn');
        if (dupBtn) {
            dupBtn.addEventListener('click', async () => {
                if (!confirm(`Duplicate project "${this.project.name}"?`)) return;
                try {
                    const res = await fetch(`/api/projects/${this.project.id}/duplicate`, { method: 'POST' });
                    const data = await res.json();
                    if (data.success && data.project) {
                        this.showToast(`✦ Project duplicated as "${data.project.name}"`, 'success');
                        if (confirm(`Project duplicated! Switch to new project "${data.project.name}" now?`)) {
                            window.location.href = `/editor?project_id=${data.project.id}`;
                        }
                    }
                } catch (e) {
                    console.error("Duplicate project error:", e);
                    this.showToast("Failed to duplicate project", "error");
                }
            });
        }

        // 2. Save as Template
        const saveTplBtn = document.getElementById('saveAsTemplateBtn');
        const modal = document.getElementById('saveTemplateModal');
        const closeBtn = document.getElementById('saveTemplateModalClose');
        const cancelBtn = document.getElementById('saveTemplateCancelBtn');
        const confirmBtn = document.getElementById('saveTemplateConfirmBtn');
        const nameInput = document.getElementById('tplModalNameInput');
        const catSelect = document.getElementById('tplModalCategorySelect');
        const descInput = document.getElementById('tplModalDescInput');

        if (saveTplBtn && modal) {
            saveTplBtn.addEventListener('click', () => {
                if (nameInput) nameInput.value = `${this.project.name} Template`;
                modal.removeAttribute('hidden');
            });

            const hideModal = () => modal.setAttribute('hidden', '');
            if (closeBtn) closeBtn.addEventListener('click', hideModal);
            if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    const name = nameInput ? nameInput.value.trim() : '';
                    if (!name) {
                        alert("Please enter a template name.");
                        return;
                    }

                    const category = catSelect ? catSelect.value : 'Custom';
                    const description = descInput ? descInput.value.trim() : '';

                    try {
                        const res = await fetch(`/api/projects/${this.project.id}/save-as-template`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, category, description })
                        });
                        const data = await res.json();
                        if (data.success) {
                            hideModal();
                            this.showToast(`✦ Template "${name}" saved to Template Center!`, 'success');
                            this.loadTemplatesAndPresets();
                        } else {
                            this.showToast(data.error || "Failed to save template", "error");
                        }
                    } catch (e) {
                        console.error("Save template error:", e);
                        this.showToast("Failed to save template", "error");
                    }
                });
            }
        }
    }

    // =========================================================================
    // PHASE 10: PRODUCTION EXPORT CENTER, RENDER QUEUE & MEDIA MANAGEMENT
    // =========================================================================
    initExportCenterAndQueue() {
        const exportBtn = document.getElementById('exportBtn');
        const exportModal = document.getElementById('exportModal');
        const exportModalClose = document.getElementById('exportModalClose');
        const exportCancelBtn = document.getElementById('exportCancelBtn');
        const exportStartBtn = document.getElementById('exportStartBtn');
        const addToQueueBtn = document.getElementById('addToQueueBtn');
        const filenameInput = document.getElementById('exportFilenameInput');

        const queueTopBtn = document.getElementById('renderQueueTopBtn');
        const queueModal = document.getElementById('renderQueueModal');
        const queueModalClose = document.getElementById('renderQueueModalClose');
        const clearHistoryBtn = document.getElementById('clearQueueHistoryBtn');

        if (exportBtn && exportModal) {
            exportBtn.addEventListener('click', () => {
                if (filenameInput) {
                    const safeName = (this.project.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');
                    filenameInput.value = `${safeName}_export_${Date.now().toString().slice(-4)}.mp4`;
                }
                exportModal.removeAttribute('hidden');
                this.runPreExportReadyCheck();
            });

            const closeExport = () => exportModal.setAttribute('hidden', '');
            if (exportModalClose) exportModalClose.addEventListener('click', closeExport);
            if (exportCancelBtn) exportCancelBtn.addEventListener('click', closeExport);

            // Add to Render Queue Action
            if (addToQueueBtn) {
                addToQueueBtn.addEventListener('click', async () => {
                    const presetSelect = document.getElementById('exportPresetSelect');
                    const qualitySelect = document.getElementById('exportQualitySelect');
                    const filename = filenameInput ? filenameInput.value.trim() : `project_${this.project.id}_export.mp4`;

                    const payload = {
                        projectId: this.project.id,
                        projectName: this.project.name,
                        timelineData: {
                            clips: this.clips,
                            graphics: this.graphics,
                            audioTracks: this.audioTracks,
                            audioClips: this.audioClips,
                            videoAudioVolume: 100,
                            videoAudioMuted: false,
                            canvasWidth: 360,
                            canvasHeight: 640
                        },
                        exportSettings: {
                            presetName: presetSelect ? presetSelect.options[presetSelect.selectedIndex].text : '9:16 Shorts',
                            quality: qualitySelect ? qualitySelect.value : 'standard',
                            outputFilename: filename
                        }
                    };

                    try {
                        const res = await fetch('/api/editor/render-queue/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const data = await res.json();
                        if (data.success) {
                            closeExport();
                            this.showToast("✦ Added to Render Queue", "success");
                            if (queueModal) queueModal.removeAttribute('hidden');
                            this.pollRenderQueueStatus();
                        } else {
                            this.showToast(data.error || "Failed to enqueue render", "error");
                        }
                    } catch (e) {
                        console.error("Queue add error:", e);
                        this.showToast("Failed to enqueue render", "error");
                    }
                });
            }

            // Direct Export Action
            if (exportStartBtn) {
                exportStartBtn.addEventListener('click', async () => {
                    const statusPanel = document.getElementById('exportStatusPanel');
                    const statusText = document.getElementById('exportStatusText');
                    const percentText = document.getElementById('exportPercentText');
                    const progressBar = document.getElementById('exportProgressBar');

                    if (statusPanel) statusPanel.style.display = 'block';
                    if (statusText) statusText.textContent = "Processing timeline...";
                    if (percentText) percentText.textContent = "25%";
                    if (progressBar) progressBar.style.width = "25%";

                    try {
                        const res = await fetch(`/api/projects/${this.project.id}/export-timeline`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                clips: this.clips,
                                graphics: this.graphics,
                                audioTracks: this.audioTracks,
                                audioClips: this.audioClips,
                                videoAudioVolume: 100,
                                videoAudioMuted: false,
                                canvasWidth: 360,
                                canvasHeight: 640
                            })
                        });

                        const data = await res.json();
                        if (data.success) {
                            if (percentText) percentText.textContent = "100%";
                            if (progressBar) progressBar.style.width = "100%";
                            if (statusText) statusText.textContent = "Render Completed!";
                            this.showToast("✦ Export finished successfully!", "success");
                            setTimeout(() => {
                                closeExport();
                                if (statusPanel) statusPanel.style.display = 'none';
                                if (data.url) window.open(data.url, '_blank');
                            }, 1000);
                        } else {
                            if (statusText) statusText.textContent = `Error: ${data.error}`;
                            this.showToast(data.error || "Export failed", "error");
                        }
                    } catch (e) {
                        console.error("Export error:", e);
                        if (statusText) statusText.textContent = "Export failed";
                        this.showToast("Render failed", "error");
                    }
                });
            }
        }

        // Render Queue Drawer
        if (queueTopBtn && queueModal) {
            queueTopBtn.addEventListener('click', () => {
                queueModal.removeAttribute('hidden');
                this.pollRenderQueueStatus();
            });

            if (queueModalClose) queueModalClose.addEventListener('click', () => queueModal.setAttribute('hidden', ''));

            if (clearHistoryBtn) {
                clearHistoryBtn.addEventListener('click', async () => {
                    await fetch('/api/editor/render-queue/clear-history', { method: 'POST' });
                    this.pollRenderQueueStatus();
                });
            }

            // Initial poll on startup to check active jobs
            this.pollRenderQueueStatus();
        }
    }

    async runPreExportReadyCheck() {
        const listEl = document.getElementById('readyCheckList');
        const badgeEl = document.getElementById('readyCheckBadge');
        if (!listEl) return;

        listEl.innerHTML = '<div style="color:var(--text-muted);">Running ready check verification...</div>';

        try {
            const res = await fetch('/api/editor/ready-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clips: this.clips,
                    graphics: this.graphics,
                    audioTracks: this.audioTracks,
                    audioClips: this.audioClips
                })
            });
            const data = await res.json();
            if (data.success) {
                listEl.innerHTML = '';
                data.checks.forEach(c => {
                    const row = document.createElement('div');
                    const icon = c.status === 'ok' ? '✓' : c.status === 'warning' ? '⚠' : '✕';
                    const color = c.status === 'ok' ? '#10B981' : c.status === 'warning' ? '#F59E0B' : '#EF4444';
                    row.innerHTML = `<span style="color:${color}; font-weight:bold; margin-right:4px;">${icon}</span> <strong>${c.item}:</strong> ${c.message}`;
                    listEl.appendChild(row);
                });

                if (badgeEl) {
                    if (data.ready) {
                        badgeEl.textContent = "✓ Ready to Render";
                        badgeEl.style.color = "#10B981";
                        badgeEl.style.background = "rgba(16,185,129,0.15)";
                    } else {
                        badgeEl.textContent = "✕ Action Required";
                        badgeEl.style.color = "#EF4444";
                        badgeEl.style.background = "rgba(239,68,68,0.15)";
                    }
                }
            }
        } catch (e) {
            console.error("Ready check error:", e);
        }
    }

    async pollRenderQueueStatus() {
        try {
            const res = await fetch('/api/editor/render-queue/status');
            const data = await res.json();
            if (data.success) {
                const badge = document.getElementById('queueBadge');
                const countTag = document.getElementById('queueActiveCountTag');
                const list = document.getElementById('renderQueueList');

                const totalActive = (data.activeJob ? 1 : 0) + (data.queuedCount || 0);
                if (badge) {
                    badge.textContent = totalActive;
                    badge.style.display = totalActive > 0 ? 'inline-block' : 'none';
                }
                if (countTag) countTag.textContent = `${totalActive} Active`;

                if (list) {
                    list.innerHTML = '';
                    if (!data.jobs || data.jobs.length === 0) {
                        list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Render Queue is empty</div>';
                    } else {
                        data.jobs.forEach(job => {
                            const item = document.createElement('div');
                            item.className = 'preset-card-item';
                            item.style.padding = '10px';

                            const statusColor = job.status === 'completed' ? '#10B981' : job.status === 'rendering' ? '#3B82F6' : job.status === 'failed' ? '#EF4444' : '#F59E0B';

                            item.innerHTML = `
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="font-weight:700; font-size:12px;">${job.projectName}</div>
                                    <span class="ai-score-badge" style="color:${statusColor}; font-size:9px; text-transform:uppercase;">${job.status} (${job.progress}%)</span>
                                </div>
                                <div style="font-size:10px; color:var(--text-muted); margin:3px 0;">${job.presetName} • ${job.stage || ''}</div>
                                <div class="progress-bar-container" style="height:4px; background:var(--border); border-radius:2px; overflow:hidden; margin:4px 0;">
                                    <div style="width:${job.progress}%; height:100%; background:${statusColor}; transition:width 0.3s;"></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:11px;">
                                    <span style="font-size:9px; color:var(--text-muted);">${job.createdAt || ''}</span>
                                    <div style="display:flex; gap:4px;">
                                        ${job.status === 'completed' ? `<a href="${job.outputUrl}" target="_blank" class="btn btn-secondary btn-sm" style="font-size:10px; padding:2px 6px;">Open File</a>` : ''}
                                        ${job.status === 'rendering' || job.status === 'queued' ? `<button class="btn btn-secondary btn-sm cancel-job-btn" style="font-size:10px; padding:2px 6px; color:#EF4444;">Cancel</button>` : ''}
                                        ${job.status === 'failed' || job.status === 'cancelled' ? `<button class="btn btn-secondary btn-sm retry-job-btn" style="font-size:10px; padding:2px 6px;">Retry</button>` : ''}
                                        <button class="btn btn-secondary btn-sm remove-job-btn" style="font-size:10px; padding:2px 6px;">✕</button>
                                    </div>
                                </div>
                            `;

                            item.querySelector('.cancel-job-btn')?.addEventListener('click', async () => {
                                await fetch(`/api/editor/render-queue/cancel/${job.id}`, { method: 'POST' });
                                this.pollRenderQueueStatus();
                            });

                            item.querySelector('.retry-job-btn')?.addEventListener('click', async () => {
                                await fetch(`/api/editor/render-queue/retry/${job.id}`, { method: 'POST' });
                                this.pollRenderQueueStatus();
                            });

                            item.querySelector('.remove-job-btn')?.addEventListener('click', async () => {
                                await fetch(`/api/editor/render-queue/job/${job.id}`, { method: 'DELETE' });
                                this.pollRenderQueueStatus();
                            });

                            list.appendChild(item);
                        });
                    }
                }

                // If active job is rendering, schedule next poll
                if (data.activeJob) {
                    setTimeout(() => this.pollRenderQueueStatus(), 1500);
                }
            }
        } catch (e) {
            console.error("Render queue polling error:", e);
        }
    }

    initMediaManager() {
        const mediaBtn = document.getElementById('mediaHealthBtn');
        const modal = document.getElementById('mediaManagerModal');
        const closeBtn = document.getElementById('mediaManagerModalClose');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        const packageBtn = document.getElementById('packageProjectBtn');
        const cacheSizeText = document.getElementById('cacheSizeText');
        const assetList = document.getElementById('mediaManagerAssetList');

        if (mediaBtn && modal) {
            mediaBtn.addEventListener('click', async () => {
                modal.removeAttribute('hidden');
                
                // Populate assets
                if (assetList) {
                    assetList.innerHTML = '';
                    const assets = [];
                    if (this.project.source_path) assets.push({ name: this.project.source_path, type: 'Video' });
                    this.audioClips.forEach(a => assets.push({ name: a.filename || a.name, type: 'Audio' }));

                    if (assets.length === 0) {
                        assetList.innerHTML = '<div style="font-size:11px; color:var(--text-muted);">No external assets attached</div>';
                    } else {
                        assets.forEach(a => {
                            const row = document.createElement('div');
                            row.style.display = 'flex';
                            row.style.justifyContent = 'space-between';
                            row.style.alignItems = 'center';
                            row.style.fontSize = '11px';
                            row.style.padding = '4px 0';
                            row.innerHTML = `
                                <span>🎬 <strong>${a.name}</strong> (${a.type})</span>
                                <span class="ai-score-badge" style="font-size:9px;">Available</span>
                            `;
                            assetList.appendChild(row);
                        });
                    }
                }

                // Fetch cache stats
                try {
                    const res = await fetch('/api/editor/cache');
                    const data = await res.json();
                    if (data.success && cacheSizeText) {
                        cacheSizeText.textContent = `${data.cache.tempSizeMB} MB (${data.cache.tempFilesCount} temp files)`;
                    }
                } catch (e) {}
            });

            if (closeBtn) closeBtn.addEventListener('click', () => modal.setAttribute('hidden', ''));

            if (clearCacheBtn) {
                clearCacheBtn.addEventListener('click', async () => {
                    const res = await fetch('/api/editor/cache', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        if (cacheSizeText) cacheSizeText.textContent = '0 MB (0 temp files)';
                        this.showToast(`Cleared ${data.clearedCount} temporary cache files`, 'success');
                    }
                });
            }

            if (packageBtn) {
                packageBtn.addEventListener('click', async () => {
                    try {
                        const res = await fetch('/api/editor/project/package', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: this.project.id })
                        });
                        const data = await res.json();
                        if (data.success && data.packageUrl) {
                            this.showToast("✦ Project packaged successfully!", "success");
                            window.open(data.packageUrl, '_blank');
                        } else {
                            this.showToast(data.error || "Package failed", "error");
                        }
                    } catch (e) {
                        this.showToast("Package failed", "error");
                    }
                });
            }
        }
    }

    // =========================================================================
    // PHASE 11: WORKSPACES, COMMAND PALETTE, NOTES, VERSIONS & DIAGNOSTICS
    // =========================================================================
    initWorkspaceSwitcher() {
        const select = document.getElementById('workspaceSwitcherSelect');
        if (!select) return;

        select.addEventListener('change', (e) => {
            const ws = e.target.value;
            this.currentWorkspace = ws;
            const sidebar = document.querySelector('.editor-toolbar-sidebar');
            const inspector = document.querySelector('.editor-right-pane');

            if (sidebar) sidebar.style.display = ws === 'minimal' ? 'none' : 'flex';
            if (inspector) inspector.style.display = (ws === 'minimal' || ws === 'review') ? 'none' : 'flex';

            if (ws === 'review') {
                document.getElementById('toolNotes')?.click();
                document.querySelector('.notes-tab-chips button[data-tab="review"]')?.click();
            } else if (ws === 'captions') {
                document.getElementById('toolText')?.click();
            } else if (ws === 'graphics') {
                document.getElementById('toolGraphics')?.click();
            } else if (ws === 'ai') {
                document.getElementById('toolAI')?.click();
            } else if (ws === 'editing') {
                document.getElementById('toolMedia')?.click();
            }
            this.showToast(`Switched to ${ws.toUpperCase()} workspace`, 'info');
        });
    }

    initCommandPalette() {
        const modal = document.getElementById('commandPaletteModal');
        const input = document.getElementById('commandPaletteInput');
        const results = document.getElementById('commandPaletteResults');
        const btn = document.getElementById('editorCommandPaletteBtn');

        const commands = [
            { title: 'Export Video / Render Queue', cat: 'Production', icon: '✦', action: () => document.getElementById('exportBtn')?.click() },
            { title: 'Add Marker at Playhead', cat: 'Timeline', icon: '📍', action: () => document.getElementById('addMarkerAtPlayheadBtn')?.click() },
            { title: 'Add Timestamp Note', cat: 'Collab', icon: '📝', action: () => { document.getElementById('toolNotes')?.click(); document.querySelector('.notes-tab-chips button[data-tab="notes"]')?.click(); } },
            { title: 'Save Project Snapshot Version', cat: 'Version', icon: '💾', action: () => document.getElementById('createNewVersionBtn')?.click() },
            { title: 'View Version History', cat: 'Version', icon: '🕒', action: () => document.getElementById('versionMenuBtn')?.click() },
            { title: 'Open Media Manager & Health', cat: 'Assets', icon: '🎬', action: () => document.getElementById('mediaHealthBtn')?.click() },
            { title: 'Open Background Render Queue', cat: 'Production', icon: '⚙', action: () => document.getElementById('renderQueueTopBtn')?.click() },
            { title: 'Run AI Highlights & Silence Trim', cat: 'AI', icon: '⚡', action: () => document.getElementById('toolAI')?.click() },
            { title: 'Open Templates & Brand Kit', cat: 'Templates', icon: '🎨', action: () => document.getElementById('toolTemplates')?.click() },
            { title: 'Switch to Review & Approval Workspace', cat: 'Workspace', icon: '✓', action: () => { const s = document.getElementById('workspaceSwitcherSelect'); if (s) { s.value = 'review'; s.dispatchEvent(new Event('change')); } } },
            { title: 'Switch to Editing Workspace', cat: 'Workspace', icon: '✂', action: () => { const s = document.getElementById('workspaceSwitcherSelect'); if (s) { s.value = 'editing'; s.dispatchEvent(new Event('change')); } } },
            { title: 'Split Clip at Playhead', cat: 'Timeline', icon: '✂', action: () => document.getElementById('splitClipBtn')?.click() },
            { title: 'Save Project', cat: 'Project', icon: '💾', action: () => document.getElementById('saveBtn')?.click() },
            { title: 'Duplicate Project', cat: 'Project', icon: '📋', action: () => document.getElementById('duplicateProjectBtn')?.click() },
            { title: 'System Diagnostics', cat: 'Help', icon: 'ℹ', action: () => document.getElementById('systemDiagBtn')?.click() }
        ];

        const openPalette = () => {
            if (!modal) return;
            modal.removeAttribute('hidden');
            if (input) {
                input.value = '';
                input.focus();
            }
            renderResults('');
        };

        const closePalette = () => {
            if (modal) modal.setAttribute('hidden', '');
        };

        const renderResults = (query) => {
            if (!results) return;
            results.innerHTML = '';
            const q = query.toLowerCase().trim();
            const filtered = commands.filter(c => c.title.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q));

            if (filtered.length === 0) {
                results.innerHTML = '<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:12px;">No matching commands</div>';
                return;
            }

            filtered.forEach((cmd, idx) => {
                const item = document.createElement('div');
                item.className = 'command-palette-item';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '8px 12px';
                item.style.borderRadius = 'var(--radius-xs)';
                item.style.cursor = 'pointer';
                item.style.fontSize = '12px';
                if (idx === 0) item.style.background = 'var(--surface-3)';

                item.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${cmd.icon}</span>
                        <span style="font-weight:600;">${cmd.title}</span>
                    </div>
                    <span class="ai-score-badge" style="font-size:9px;">${cmd.cat}</span>
                `;

                item.addEventListener('mouseenter', () => {
                    results.querySelectorAll('.command-palette-item').forEach(el => el.style.background = 'transparent');
                    item.style.background = 'var(--surface-3)';
                });

                item.addEventListener('click', () => {
                    closePalette();
                    cmd.action();
                });

                results.appendChild(item);
            });
        };

        if (btn) btn.addEventListener('click', openPalette);
        if (input) input.addEventListener('input', (e) => renderResults(e.target.value));

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (modal && modal.hasAttribute('hidden')) openPalette();
                else closePalette();
            } else if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
                closePalette();
            }
        });

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closePalette();
            });
        }
    }

    initNotesAndMarkers() {
        const chips = document.querySelectorAll('.notes-tab-chips button');
        const views = {
            markers: document.getElementById('notesTabMarkers'),
            notes: document.getElementById('notesTabNotes'),
            review: document.getElementById('notesTabReview')
        };

        chips.forEach(c => {
            c.addEventListener('click', () => {
                chips.forEach(other => other.classList.remove('active'));
                c.classList.add('active');
                const tab = c.dataset.tab;
                Object.keys(views).forEach(k => {
                    if (views[k]) views[k].style.display = k === tab ? 'block' : 'none';
                });
                if (tab === 'review') this.fetchReviewData();
            });
        });

        // Add Marker
        const addMarkerBtn = document.getElementById('addMarkerAtPlayheadBtn');
        const markerTypeSelect = document.getElementById('markerTypeSelect');
        if (addMarkerBtn) {
            addMarkerBtn.addEventListener('click', () => {
                const type = markerTypeSelect ? markerTypeSelect.value : 'general';
                const time = parseFloat((this.playheadTime || 0).toFixed(2));
                const marker = {
                    id: `m_${Date.now()}`,
                    time: time,
                    type: type,
                    label: `${type.toUpperCase()} @ ${time}s`
                };
                this.markers.push(marker);
                this.renderMarkersList();
                this.showToast(`Added marker at ${time}s`, 'success');
            });
        }

        // Add Timestamp Note
        const addNoteBtn = document.getElementById('addTimestampNoteBtn');
        const noteInput = document.getElementById('newTimestampNoteInput');
        if (addNoteBtn && noteInput) {
            addNoteBtn.addEventListener('click', () => {
                const text = noteInput.value.trim();
                if (!text) return;
                const time = parseFloat((this.playheadTime || 0).toFixed(2));
                this.timestampNotes.push({
                    id: `n_${Date.now()}`,
                    time: time,
                    text: text
                });
                noteInput.value = '';
                this.renderTimestampNotesList();
                this.showToast("Note added", "success");
            });
        }

        // Add Review Comment
        const addCommentBtn = document.getElementById('addReviewCommentBtn');
        const commentInput = document.getElementById('newReviewCommentInput');
        if (addCommentBtn && commentInput) {
            addCommentBtn.addEventListener('click', async () => {
                const text = commentInput.value.trim();
                if (!text) return;
                const time = parseFloat((this.playheadTime || 0).toFixed(2));
                try {
                    const res = await fetch(`/api/editor/projects/${this.project.id}/review/comment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ timestamp: time, author: 'Reviewer', text: text })
                    });
                    const data = await res.json();
                    if (data.success) {
                        commentInput.value = '';
                        this.fetchReviewData();
                        this.showToast("Comment posted", "success");
                    }
                } catch (e) {
                    console.error("Comment post error:", e);
                }
            });
        }

        // Review Status Select
        const statusSelect = document.getElementById('reviewStatusSelect');
        if (statusSelect) {
            statusSelect.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                await fetch(`/api/editor/projects/${this.project.id}/review/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                this.showToast(`Review status: ${newStatus}`, 'info');
            });
        }
    }

    renderMarkersList() {
        const list = document.getElementById('markersList');
        if (!list) return;
        list.innerHTML = '';
        if (this.markers.length === 0) {
            list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); padding:8px 0;">No markers set</div>';
            return;
        }

        this.markers.forEach((m, idx) => {
            const item = document.createElement('div');
            item.className = 'preset-card-item';
            item.style.padding = '6px 8px';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px; cursor:pointer;" class="seek-marker-btn">
                    <span style="font-weight:700; font-size:11px;">${m.time}s</span>
                    <span class="ai-score-badge" style="font-size:9px;">${m.type}</span>
                </div>
                <button class="btn btn-secondary btn-sm delete-marker-btn" style="font-size:9px; padding:2px 5px;">✕</button>
            `;

            item.querySelector('.seek-marker-btn')?.addEventListener('click', () => {
                this.playheadTime = m.time;
                if (this.video) this.video.currentTime = m.time;
                this.renderPlayhead();
            });

            item.querySelector('.delete-marker-btn')?.addEventListener('click', () => {
                this.markers.splice(idx, 1);
                this.renderMarkersList();
            });

            list.appendChild(item);
        });
    }

    renderTimestampNotesList() {
        const list = document.getElementById('timestampNotesList');
        if (!list) return;
        list.innerHTML = '';
        if (this.timestampNotes.length === 0) {
            list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); padding:8px 0;">No timestamp notes</div>';
            return;
        }

        this.timestampNotes.forEach((n, idx) => {
            const item = document.createElement('div');
            item.className = 'preset-card-item';
            item.style.padding = '6px 8px';
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700; font-size:10px; color:var(--primary); cursor:pointer;" class="seek-note-btn">▶ @ ${n.time}s</span>
                    <button class="btn btn-secondary btn-sm delete-note-btn" style="font-size:9px; padding:2px 5px;">✕</button>
                </div>
                <div style="font-size:11px; margin-top:2px;">${n.text}</div>
            `;

            item.querySelector('.seek-note-btn')?.addEventListener('click', () => {
                this.playheadTime = n.time;
                if (this.video) this.video.currentTime = n.time;
                this.renderPlayhead();
            });

            item.querySelector('.delete-note-btn')?.addEventListener('click', () => {
                this.timestampNotes.splice(idx, 1);
                this.renderTimestampNotesList();
            });

            list.appendChild(item);
        });
    }

    async fetchReviewData() {
        try {
            const res = await fetch(`/api/editor/projects/${this.project.id}/review`);
            const data = await res.json();
            if (data.success && data.review) {
                const statusSelect = document.getElementById('reviewStatusSelect');
                if (statusSelect && data.review.status) statusSelect.value = data.review.status;

                const list = document.getElementById('reviewCommentsList');
                if (!list) return;
                list.innerHTML = '';
                const comments = data.review.comments || [];
                if (comments.length === 0) {
                    list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); padding:8px 0;">No review comments yet</div>';
                    return;
                }

                comments.forEach(c => {
                    const row = document.createElement('div');
                    row.className = 'preset-card-item';
                    row.style.padding = '8px';
                    row.style.opacity = c.resolved ? '0.6' : '1';

                    row.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700; font-size:10px; color:var(--primary); cursor:pointer;" class="seek-comment-btn">▶ @ ${c.timestamp}s</span>
                            <label style="font-size:10px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" class="resolve-comment-chk" ${c.resolved ? 'checked' : ''}> Resolved
                            </label>
                        </div>
                        <div style="font-size:11px; margin-top:3px; ${c.resolved ? 'text-decoration:line-through;' : ''}">${c.text}</div>
                        <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${c.author} • ${c.createdAt || ''}</div>
                    `;

                    row.querySelector('.seek-comment-btn')?.addEventListener('click', () => {
                        this.playheadTime = c.timestamp;
                        if (this.video) this.video.currentTime = c.timestamp;
                        this.renderPlayhead();
                    });

                    row.querySelector('.resolve-comment-chk')?.addEventListener('change', async () => {
                        await fetch(`/api/editor/projects/${this.project.id}/review/comment/${c.id}/toggle`, { method: 'POST' });
                        this.fetchReviewData();
                    });

                    list.appendChild(row);
                });
            }
        } catch (e) {
            console.error("Fetch review error:", e);
        }
    }

    initVersionManagement() {
        const versionMenuBtn = document.getElementById('versionMenuBtn');
        const historyModal = document.getElementById('versionHistoryModal');
        const historyClose = document.getElementById('versionHistoryModalClose');
        const createBtn = document.getElementById('createNewVersionBtn');
        const saveModal = document.getElementById('saveVersionModal');
        const saveClose = document.getElementById('saveVersionModalClose');
        const saveCancel = document.getElementById('saveVersionCancelBtn');
        const saveConfirm = document.getElementById('saveVersionConfirmBtn');
        const nameInput = document.getElementById('saveVersionNameInput');
        const noteInput = document.getElementById('saveVersionNoteInput');

        const loadVersions = async () => {
            if (!historyModal) return;
            historyModal.removeAttribute('hidden');
            const list = document.getElementById('versionHistoryList');
            if (!list) return;
            list.innerHTML = '<div style="color:var(--text-muted); font-size:11px;">Loading versions...</div>';

            try {
                const res = await fetch(`/api/editor/projects/${this.project.id}/versions`);
                const data = await res.json();
                if (data.success) {
                    list.innerHTML = '';
                    const versions = data.versions || [];
                    if (versions.length === 0) {
                        list.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">No versions saved yet</div>';
                        return;
                    }

                    versions.forEach(v => {
                        const card = document.createElement('div');
                        card.className = 'preset-card-item';
                        card.style.padding = '10px';
                        card.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-weight:700; font-size:12px;">${v.name}</div>
                                <span class="ai-score-badge" style="font-size:9px;">${v.id.split('_')[0].toUpperCase()}</span>
                            </div>
                            <div style="font-size:10px; color:var(--text-muted); margin:3px 0;">${v.createdAt}</div>
                            ${v.note ? `<div style="font-size:11px; color:var(--text-secondary); margin:4px 0;">${v.note}</div>` : ''}
                            <div style="display:flex; justify-content:flex-end; margin-top:6px;">
                                <button class="btn btn-secondary btn-sm restore-version-btn" style="font-size:10px; padding:3px 8px;">Restore Snapshot</button>
                            </div>
                        `;

                        card.querySelector('.restore-version-btn')?.addEventListener('click', async () => {
                            if (confirm(`Restore project state to '${v.name}'? Unsaved changes in the current session will be replaced.`)) {
                                const restoreRes = await fetch(`/api/editor/projects/${this.project.id}/versions/restore`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ versionId: v.id })
                                });
                                const rData = await restoreRes.json();
                                if (rData.success && rData.version) {
                                    const state = rData.version.editorState || {};
                                    if (state.clips) this.clips = state.clips;
                                    if (state.graphics) this.graphics = state.graphics;
                                    if (state.audioClips) this.audioClips = state.audioClips;
                                    if (state.audioTracks) this.audioTracks = state.audioTracks;
                                    this.renderTimeline();
                                    this.renderAudioTimeline();
                                    this.renderLayersStack();
                                    historyModal.setAttribute('hidden', '');
                                    this.showToast(`✦ Restored to ${v.name}`, 'success');
                                }
                            }
                        });

                        list.appendChild(card);
                    });
                }
            } catch (e) {
                console.error("Load versions error:", e);
            }
        };

        if (versionMenuBtn) versionMenuBtn.addEventListener('click', loadVersions);
        if (historyClose) historyClose.addEventListener('click', () => historyModal?.setAttribute('hidden', ''));

        if (createBtn && saveModal) {
            createBtn.addEventListener('click', () => {
                saveModal.removeAttribute('hidden');
                if (nameInput) nameInput.value = `Version ${Date.now().toString().slice(-4)}`;
                if (noteInput) noteInput.value = '';
            });
        }

        const closeSave = () => saveModal?.setAttribute('hidden', '');
        if (saveClose) saveClose.addEventListener('click', closeSave);
        if (saveCancel) saveCancel.addEventListener('click', closeSave);

        if (saveConfirm) {
            saveConfirm.addEventListener('click', async () => {
                const name = nameInput ? nameInput.value.trim() : 'New Version';
                const note = noteInput ? noteInput.value.trim() : '';

                try {
                    const res = await fetch(`/api/editor/projects/${this.project.id}/versions/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            note: note,
                            editorState: {
                                clips: this.clips,
                                graphics: this.graphics,
                                audioClips: this.audioClips,
                                audioTracks: this.audioTracks
                            }
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        closeSave();
                        this.showToast(`✦ Version '${name}' saved!`, 'success');
                        loadVersions();
                    }
                } catch (e) {
                    console.error("Save version error:", e);
                    this.showToast("Failed to save version", "error");
                }
            });
        }
    }

    initDiagnosticsModal() {
        const btn = document.getElementById('systemDiagBtn');
        const modal = document.getElementById('diagnosticsModal');
        const closeBtn = document.getElementById('diagnosticsModalClose');
        const closeBtn2 = document.getElementById('closeDiagnosticsBtn');
        const copyBtn = document.getElementById('copyDiagnosticsBtn');
        const content = document.getElementById('diagnosticsContent');

        let lastDiag = null;

        if (btn && modal) {
            btn.addEventListener('click', async () => {
                modal.removeAttribute('hidden');
                if (content) content.textContent = 'Loading system diagnostic data...';
                try {
                    const res = await fetch('/api/editor/diagnostics');
                    const data = await res.json();
                    if (data.success && data.diagnostics) {
                        lastDiag = data.diagnostics;
                        if (content) {
                            content.innerHTML = `
                                <div><strong>Application:</strong> ${data.diagnostics.appName} v${data.diagnostics.version}</div>
                                <div><strong>OS:</strong> ${data.diagnostics.os}</div>
                                <div><strong>Python:</strong> ${data.diagnostics.pythonVersion}</div>
                                <div><strong>FFmpeg Engine:</strong> ${data.diagnostics.ffmpegVersion}</div>
                                <div><strong>Storage Free:</strong> ${data.diagnostics.storage.freeGB} GB / ${data.diagnostics.storage.totalGB} GB (${data.diagnostics.storage.percentFree}% free)</div>
                                <div><strong>Diagnostics Timestamp:</strong> ${data.diagnostics.timestamp}</div>
                            `;
                        }
                    }
                } catch (e) {
                    if (content) content.textContent = 'Failed to load diagnostics';
                }
            });

            const closeModal = () => modal.setAttribute('hidden', '');
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    if (lastDiag) {
                        navigator.clipboard.writeText(JSON.stringify(lastDiag, null, 2));
                        this.showToast("Copied diagnostics to clipboard", "success");
                    }
                });
            }
        }
    }

    // =========================================================================
    // PHASE 12: AI COPILOT & INTELLIGENT EDITING ENGINE
    // =========================================================================
    initAiCopilot() {
        const topBtn = document.getElementById('aiCopilotTopBtn');
        const modal = document.getElementById('aiCopilotModal');
        const closeBtn = document.getElementById('aiCopilotModalClose');
        const contextInfo = document.getElementById('copilotContextInfo');
        const input = document.getElementById('copilotInput');
        const submitBtn = document.getElementById('copilotSubmitBtn');
        const previewCard = document.getElementById('copilotPreviewCard');
        const previewTitle = document.getElementById('copilotPreviewTitle');
        const previewMessage = document.getElementById('copilotPreviewMessage');
        const changesList = document.getElementById('copilotPreviewChangesList');
        const applyBtn = document.getElementById('copilotApplyChangeBtn');
        const cancelChangeBtn = document.getElementById('copilotCancelChangeBtn');
        const chips = document.querySelectorAll('.copilot-chip');

        const openCopilot = () => {
            if (!modal) return;
            modal.removeAttribute('hidden');
            if (previewCard) previewCard.style.display = 'none';

            // Build active context display
            if (contextInfo) {
                if (this.selectedClipId) {
                    const sel = this.clips.find(c => c.id === this.selectedClipId);
                    contextInfo.textContent = `Selected Clip: ${sel ? sel.filename : ''} (${sel ? sel.start : 0}s - ${sel ? sel.end : 0}s)`;
                } else if (this.selectedGraphicId) {
                    const g = this.graphics.find(g => g.id === this.selectedGraphicId);
                    contextInfo.textContent = `Selected Graphic: ${g ? g.name : ''} (${g ? g.type : ''})`;
                } else {
                    contextInfo.textContent = `Full Project: ${this.clips.length} Video Clips • ${this.audioTracks.length} Audio Tracks • ${this.graphics.length} Graphics`;
                }
            }

            if (input) {
                input.value = '';
                input.focus();
            }
        };

        const closeCopilot = () => modal?.setAttribute('hidden', '');

        if (topBtn) topBtn.addEventListener('click', openCopilot);
        if (closeBtn) closeBtn.addEventListener('click', closeCopilot);

        // Global hotkey Ctrl+I for Copilot
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                if (modal && modal.hasAttribute('hidden')) openCopilot();
                else closeCopilot();
            }
        });

        // Quick action chips
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.dataset.prompt;
                if (input) input.value = prompt;
                this.submitCopilotQuery(prompt);
            });
        });

        // Submit query
        const handleSubmit = () => {
            const val = input ? input.value.trim() : '';
            if (val) this.submitCopilotQuery(val);
        };

        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleSubmit();
            });
        }

        if (cancelChangeBtn && previewCard) {
            cancelChangeBtn.addEventListener('click', () => {
                previewCard.style.display = 'none';
                this.pendingCopilotAction = null;
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                if (this.pendingCopilotAction) {
                    this.applyCopilotAction(this.pendingCopilotAction);
                    await fetch('/api/editor/copilot/record', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: this.pendingCopilotAction.type,
                            summary: previewTitle ? previewTitle.textContent : 'AI Edit'
                        })
                    });
                    this.showToast("✦ AI Copilot edit applied!", "success");
                    closeCopilot();
                }
            });
        }
    }

    async submitCopilotQuery(prompt) {
        const previewCard = document.getElementById('copilotPreviewCard');
        const previewTitle = document.getElementById('copilotPreviewTitle');
        const previewMessage = document.getElementById('copilotPreviewMessage');
        const changesList = document.getElementById('copilotPreviewChangesList');

        const context = {
            clips: this.clips,
            graphics: this.graphics,
            audioTracks: this.audioTracks,
            audioClips: this.audioClips,
            selectedClipId: this.selectedClipId,
            selectedGraphicId: this.selectedGraphicId,
            selectedAudioClipId: this.selectedAudioClipId,
            playheadTime: this.playheadTime,
            canvasWidth: 360,
            canvasHeight: 640,
            sourcePath: this.project.source_path,
            silences: this.aiState.silences,
            highlights: this.aiState.highlights
        };

        try {
            const res = await fetch('/api/editor/copilot/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt, context: context })
            });
            const data = await res.json();

            if (data.safetyBlocked) {
                this.showToast(data.message, "error");
                return;
            }

            if (data.success && data.preview && data.action) {
                this.pendingCopilotAction = data.action;
                if (previewTitle) previewTitle.textContent = data.preview.title;
                if (previewMessage) previewMessage.textContent = data.message;
                if (changesList) {
                    changesList.innerHTML = '';
                    (data.preview.changes || []).forEach(ch => {
                        const li = document.createElement('li');
                        li.textContent = ch;
                        changesList.appendChild(li);
                    });
                }
                if (previewCard) previewCard.style.display = 'block';
            } else {
                this.showToast(data.message || "Could not process request", "info");
            }
        } catch (e) {
            console.error("Copilot query error:", e);
            this.showToast("AI Copilot request failed", "error");
        }
    }

    applyCopilotAction(action) {
        if (!action) return;

        if (action.type === 'trim_silence' && action.silences) {
            this.applySilenceTrimming(action.silences);
        } else if (action.type === 'trim_clip') {
            const clip = this.clips.find(c => c.id === action.clipId) || this.clips[0];
            if (clip && action.newEnd) {
                clip.end = action.newEnd;
                clip.duration = clip.end - clip.start;
                this.renderTimeline();
            }
        } else if (action.type === 'reposition_graphic') {
            const g = this.graphics.find(g => g.id === action.layerId) || this.graphics[0];
            if (g) {
                g.transform.y = action.targetY;
                this.renderCanvasGraphics();
            }
        } else if (action.type === 'balance_audio') {
            const musicTrack = this.audioTracks.find(t => t.type === 'music');
            if (musicTrack) {
                musicTrack.volume = action.musicVolume || 45;
                if (action.ducking) musicTrack.ducking = { enabled: true, amount: 65 };
                this.renderTrackHeaders();
                this.renderAudioTimeline();
            }
        } else if (action.type === 'reframe_canvas') {
            const ratioSelect = document.getElementById('aspectRatioSelect');
            if (ratioSelect) {
                ratioSelect.value = action.aspectRatio;
                ratioSelect.dispatchEvent(new Event('change'));
            }
        } else if (action.type === 'add_chapters' && action.chapters) {
            action.chapters.forEach(ch => {
                this.markers.push({
                    id: `m_${Date.now()}_${Math.random()}`,
                    time: ch.time,
                    type: 'general',
                    label: ch.title
                });
            });
            this.renderMarkersList();
        } else if (action.type === 'apply_highlight' && action.highlight) {
            const hl = action.highlight;
            this.clips = [{
                id: `clip_${Date.now()}`,
                filename: this.project.source_path,
                start: hl.start,
                end: hl.end,
                duration: hl.end - hl.start,
                timelineStart: 0,
                transform: { x: 0, y: 0, scale: 100 }
            }];
            this.renderTimeline();
        }

        // Save history state into undo stack
        this.saveHistoryState();
    }

    // =========================================================================
    // PHASE 13: CONTENT INTELLIGENCE & SMART SHORTS FACTORY
    // =========================================================================
    initContentIntelligenceAndShortsFactory() {
        const navChips = document.querySelectorAll('.intel-nav-chips button');
        const reAnalyzeBtn = document.getElementById('runIntelligenceBtn');
        const selectAllBtn = document.getElementById('bulkSelectAllCandidatesBtn');
        const deselectAllBtn = document.getElementById('bulkDeselectAllCandidatesBtn');
        const createShortsBtn = document.getElementById('bulkCreateShortsBtn');
        const searchInput = document.getElementById('transcriptSearchInput');
        const searchBtn = document.getElementById('transcriptSearchBtn');

        // Tab Switching
        navChips.forEach(chip => {
            chip.addEventListener('click', () => {
                navChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const tab = chip.dataset.tab;
                document.getElementById('intelTabCandidates').style.display = tab === 'candidates' ? 'block' : 'none';
                document.getElementById('intelTabTopics').style.display = tab === 'topics' ? 'block' : 'none';
                document.getElementById('intelTabFactory').style.display = tab === 'factory' ? 'block' : 'none';
                document.getElementById('intelTabSearch').style.display = tab === 'search' ? 'block' : 'none';
            });
        });

        if (reAnalyzeBtn) {
            reAnalyzeBtn.addEventListener('click', () => this.loadContentIntelligence(true));
        }

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.factory-cand-cb').forEach(cb => cb.checked = true);
            });
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.factory-cand-cb').forEach(cb => cb.checked = false);
            });
        }

        if (createShortsBtn) {
            createShortsBtn.addEventListener('click', async () => {
                const checkedBoxes = document.querySelectorAll('.factory-cand-cb:checked');
                if (checkedBoxes.length === 0) {
                    this.showToast("Select at least 1 candidate to create shorts", "info");
                    return;
                }

                const selectedCandidates = [];
                checkedBoxes.forEach(cb => {
                    const candId = cb.dataset.candId;
                    const cand = (this.intelCandidates || []).find(c => c.id === candId);
                    if (cand) selectedCandidates.push(cand);
                });

                try {
                    const res = await fetch(`/api/editor/projects/${this.project.id}/shorts/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ candidates: selectedCandidates })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showToast(`✦ Created ${data.totalCreated} editable Child Short Projects!`, "success");
                    } else {
                        this.showToast(data.error || "Shorts creation failed", "error");
                    }
                } catch (e) {
                    console.error("Bulk shorts creation error:", e);
                    this.showToast("Failed to create short projects", "error");
                }
            });
        }

        const handleSearch = async () => {
            const q = searchInput ? searchInput.value.trim() : '';
            const resultsContainer = document.getElementById('transcriptSearchResults');
            if (!q || !resultsContainer) return;

            try {
                const res = await fetch(`/api/editor/projects/${this.project.id}/intelligence/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                resultsContainer.innerHTML = '';

                if (data.success && data.matches && data.matches.length > 0) {
                    data.matches.forEach(m => {
                        const item = document.createElement('div');
                        item.className = 'preset-card-item seek-transcript-match';
                        item.style.cursor = 'pointer';
                        item.style.padding = '6px 8px';
                        item.innerHTML = `
                            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted);">
                                <span>${m.speaker || 'Speaker'}</span>
                                <span style="color:var(--primary); font-weight:700;">${this.formatTime(m.start)}</span>
                            </div>
                            <div style="font-size:11px; color:var(--text-primary); margin-top:2px;">${m.text}</div>
                        `;
                        item.addEventListener('click', () => {
                            this.seekTo(m.start);
                            this.showToast(`Playhead moved to ${this.formatTime(m.start)}`, "info");
                        });
                        resultsContainer.appendChild(item);
                    });
                } else {
                    resultsContainer.innerHTML = '<div class="library-item empty">No matches found</div>';
                }
            } catch (e) {
                console.error("Transcript search error:", e);
            }
        };

        if (searchBtn) searchBtn.addEventListener('click', handleSearch);
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleSearch();
            });
        }
    }

    async loadContentIntelligence(forceRefresh = false) {
        const candList = document.getElementById('intelCandidatesList');
        const topicList = document.getElementById('intelTopicsList');
        const checklist = document.getElementById('factoryCandidatesChecklist');

        if (candList) candList.innerHTML = '<div class="library-item empty">Analyzing video intelligence...</div>';

        try {
            const res = await fetch(`/api/editor/projects/${this.project.id}/intelligence/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath: this.project.source_path,
                    forceRefresh: forceRefresh
                })
            });
            const data = await res.json();

            if (data.success) {
                this.intelCandidates = data.candidates || [];
                this.intelTopics = data.topics || [];

                // 1. Render Candidates
                if (candList) {
                    candList.innerHTML = '';
                    this.intelCandidates.forEach(c => {
                        const card = document.createElement('div');
                        card.className = 'preset-card-item';
                        card.style.padding = '8px';
                        card.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-weight:700; font-size:11px; color:var(--text-primary);">${c.title}</span>
                                <span class="ai-score-badge" style="font-size:9px; background:${c.badgeColor}22; color:${c.badgeColor}; border:1px solid ${c.badgeColor}44;">${c.ranking}</span>
                            </div>
                            <div style="font-size:10px; color:var(--text-muted); margin:3px 0;">
                                ⏱ ${this.formatTime(c.start)} – ${this.formatTime(c.end)} (${c.duration}s)
                            </div>
                            <div style="font-size:11px; color:var(--text-secondary); line-height:1.3; margin-bottom:6px;">
                                ${c.reason}
                            </div>
                            <div style="display:flex; gap:6px; justify-content:flex-end;">
                                <button class="btn btn-secondary btn-sm preview-cand-btn" style="font-size:10px; padding:2px 6px;">▶ Preview</button>
                                <button class="btn btn-primary btn-sm create-single-short-btn" style="font-size:10px; padding:2px 8px;">+ Create Short</button>
                            </div>
                        `;

                        card.querySelector('.preview-cand-btn').addEventListener('click', () => {
                            this.seekTo(c.start);
                        });

                        card.querySelector('.create-single-short-btn').addEventListener('click', async () => {
                            try {
                                const createRes = await fetch(`/api/editor/projects/${this.project.id}/shorts/create`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ candidate: c })
                                });
                                const createData = await createRes.json();
                                if (createData.success) {
                                    this.showToast(`✦ Created Short Project: "${createData.name}"`, "success");
                                }
                            } catch (e) {
                                this.showToast("Failed to create short", "error");
                            }
                        });

                        candList.appendChild(card);
                    });
                }

                // 2. Render Topics
                if (topicList) {
                    topicList.innerHTML = '';
                    this.intelTopics.forEach(t => {
                        const item = document.createElement('div');
                        item.className = 'preset-card-item seek-topic-item';
                        item.style.cursor = 'pointer';
                        item.style.padding = '6px 8px';
                        item.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-weight:700; font-size:11px;">${t.title}</span>
                                <span style="color:var(--primary); font-size:10px; font-weight:700;">${this.formatTime(t.start)}</span>
                            </div>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${t.description}</div>
                        `;
                        item.addEventListener('click', () => {
                            this.seekTo(t.start);
                        });
                        topicList.appendChild(item);
                    });
                }

                // 3. Render Factory Checklist
                if (checklist) {
                    checklist.innerHTML = '';
                    this.intelCandidates.forEach(c => {
                        const row = document.createElement('label');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.gap = '6px';
                        row.style.fontSize = '11px';
                        row.style.cursor = 'pointer';
                        row.innerHTML = `
                            <input type="checkbox" class="factory-cand-cb" data-cand-id="${c.id}" checked>
                            <span style="flex:1;">${c.title} (${c.duration}s)</span>
                            <span style="font-size:9px; color:${c.badgeColor}; font-weight:700;">${c.ranking}</span>
                        `;
                        checklist.appendChild(row);
                    });
                }
            } else {
                if (candList) candList.innerHTML = '<div class="library-item empty">Analysis failed</div>';
            }
        } catch (e) {
            console.error("Intelligence loading error:", e);
            if (candList) candList.innerHTML = '<div class="library-item empty">Failed to connect to Intelligence engine</div>';
        }
    }

    // =========================================================================
    // PHASE 14: PROFESSIONAL MOTION GRAPHICS & VISUAL DESIGN SYSTEM
    // =========================================================================
    initMotionGraphicsAndVisualDesignSystem() {
        const alignBtns = document.querySelectorAll('.align-btn');
        const saveTplBtn = document.getElementById('saveGraphicTemplateBtn');
        const ungroupBtn = document.getElementById('ungroupGraphicBtn');
        const catChips = document.querySelectorAll('#subpaneGraphics .graphics-category-chips button');

        // 1. 1-Click Alignment Bar
        alignBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.selectedGraphicId) {
                    this.showToast("Select a graphic layer first to align", "info");
                    return;
                }
                const alignMode = btn.dataset.align;
                const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
                if (layer) {
                    const t = layer.transform;
                    const w = parseFloat(t.width || 120) * (parseFloat(t.scale || 100) / 100);
                    const h = parseFloat(t.height || 120) * (parseFloat(t.scale || 100) / 100);
                    
                    if (alignMode === 'center_x') t.x = 0;
                    else if (alignMode === 'center_y') t.y = 0;
                    else if (alignMode === 'left') t.x = Math.round(-180 + w / 2 + 20);
                    else if (alignMode === 'right') t.x = Math.round(180 - w / 2 - 20);
                    else if (alignMode === 'top') t.y = Math.round(-320 + h / 2 + 20);
                    else if (alignMode === 'bottom') t.y = Math.round(320 - h / 2 - 20);

                    this.renderCanvasGraphics();
                    this.updateGraphicInspector(layer);
                    this.saveHistoryState();
                    this.showToast(`✦ Aligned ${alignMode.replace('_', ' ')}`, "info");
                }
            });
        });

        // 2. Save Custom Template
        if (saveTplBtn) {
            saveTplBtn.addEventListener('click', async () => {
                if (!this.selectedGraphicId) {
                    this.showToast("Select a graphic layer to save as template", "info");
                    return;
                }
                const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
                if (layer) {
                    const tplName = prompt("Enter Template Name:", layer.name || "Custom Graphic Template");
                    if (tplName) {
                        try {
                            const res = await fetch('/api/editor/graphics/templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: tplName,
                                    category: layer.type || "custom",
                                    layerData: layer
                                })
                            });
                            const data = await res.json();
                            if (data.success) {
                                this.showToast(`✦ Saved template: "${tplName}"`, "success");
                            }
                        } catch (e) {
                            this.showToast("Failed to save template", "error");
                        }
                    }
                }
            });
        }

        // 3. Ungroup Layer
        if (ungroupBtn) {
            ungroupBtn.addEventListener('click', () => {
                if (!this.selectedGraphicId) return;
                const idx = this.graphics.findIndex(g => g.id === this.selectedGraphicId);
                if (idx !== -1 && this.graphics[idx].type === 'group') {
                    const grp = this.graphics[idx];
                    const grpX = grp.transform.x || 0;
                    const grpY = grp.transform.y || 0;
                    const children = (grp.children || []).map(c => {
                        const copy = JSON.parse(JSON.stringify(c));
                        copy.id = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                        copy.transform.x = (copy.transform.x || 0) + grpX;
                        copy.transform.y = (copy.transform.y || 0) + grpY;
                        return copy;
                    });
                    this.graphics.splice(idx, 1, ...children);
                    this.selectedGraphicId = children[0] ? children[0].id : null;
                    this.renderCanvasGraphics();
                    this.renderLayersStack();
                    this.saveHistoryState();
                    this.showToast("✦ Ungrouped layer into individual elements", "info");
                }
            });
        }

        // 4. Category Filtering for Graphics Browser
        catChips.forEach(chip => {
            chip.addEventListener('click', () => {
                catChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.loadMotionGraphicsCatalog(chip.dataset.cat);
            });
        });
    }

    async loadMotionGraphicsCatalog(category = 'all') {
        const grid = document.getElementById('graphicsAssetGrid');
        if (!grid) return;

        try {
            const res = await fetch('/api/editor/graphics/catalog');
            const data = await res.json();
            if (data.success && data.catalog) {
                grid.innerHTML = '';
                const cat = data.catalog;
                let items = [];

                if (category === 'all') {
                    items = [...(cat.shapes || []), ...(cat.text || []), ...(cat.lower_thirds || []), ...(cat.badges || [])];
                } else if (category === 'shapes') {
                    items = cat.shapes || [];
                } else if (category === 'text') {
                    items = cat.text || [];
                } else if (category === 'lower_thirds') {
                    items = cat.lower_thirds || [];
                } else if (category === 'badges') {
                    items = cat.badges || [];
                } else if (category === 'templates') {
                    items = cat.templates || [];
                } else if (category === 'motion_presets') {
                    items = cat.motion_presets || [];
                }

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'preset-card-item';
                    card.style.cursor = 'pointer';
                    card.style.padding = '8px';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700; font-size:11px; color:var(--text-primary);">${item.name}</span>
                            <span class="ai-score-badge" style="font-size:9px;">${(item.type || 'layer').toUpperCase()}</span>
                        </div>
                        <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">
                            ${item.text ? `"${item.text}"` : (item.shapeType || item.category || 'Vector graphic')}
                        </div>
                    `;

                    card.addEventListener('click', () => {
                        this.insertMotionGraphicItem(item);
                    });

                    grid.appendChild(card);
                });
            }
        } catch (e) {
            console.error("Graphics catalog loading error:", e);
        }
    }

    insertMotionGraphicItem(item) {
        const newLayer = {
            id: `layer_${Date.now()}`,
            name: item.name || 'New Graphic',
            type: item.type || 'shape',
            start: this.playheadTime || 0,
            end: (this.playheadTime || 0) + 4.0,
            transform: {
                x: 0,
                y: item.type === 'lower_third' ? 180 : (item.shapeType === 'badge' ? -220 : 0),
                width: item.width || 140,
                height: item.height || 90,
                scale: 100,
                rotation: 0,
                opacity: 100
            },
            appearance: {
                fill: item.fill || '#6366F1',
                stroke: item.stroke || '#000000',
                strokeWidth: item.stroke ? 2 : 0,
                cornerRadius: item.radius || 8
            },
            content: {
                shapeType: item.shapeType || 'rect'
            },
            typography: {
                text: item.text || '',
                fontFamily: 'Inter',
                fontSize: item.fontSize || 14,
                fontWeight: item.fontWeight || 700,
                color: item.color || '#FFFFFF'
            }
        };

        this.graphics.push(newLayer);
        this.selectedGraphicId = newLayer.id;
        this.renderCanvasGraphics();
        this.renderLayersStack();
        this.updateGraphicInspector(newLayer);
        this.saveHistoryState();
        this.showToast(`✦ Added ${item.name} to canvas`, "success");
    }

    // =========================================================================
    // PHASE 15: PROFESSIONAL AUDIO STUDIO & AUDIO INTELLIGENCE
    // =========================================================================
    initProfessionalAudioStudio() {
        const trackSliders = document.querySelectorAll('.track-vol-slider');
        const muteBtns = document.querySelectorAll('.track-mute-btn');
        const soloBtns = document.querySelectorAll('.track-solo-btn');
        const lockBtns = document.querySelectorAll('.track-lock-btn');
        const masterVol = document.getElementById('masterVolSlider');
        const masterMute = document.getElementById('masterMuteBtn');

        // Initialize sliders from tracks
        if (this.audioTracks) {
            this.audioTracks.forEach(t => {
                const slider = document.querySelector(`.track-vol-slider[data-track="${t.id}"]`);
                if (slider) slider.value = t.volume || 100;
            });
        }

        // Track Sliders
        trackSliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const trackId = e.target.dataset.track;
                const track = this.audioTracks.find(t => t.id === trackId);
                if (track) {
                    track.volume = parseFloat(e.target.value);
                    this.runAudioDiagnostics();
                }
            });
        });

        // Mute / Solo / Lock Toggles
        muteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trackId = e.target.dataset.track;
                const track = this.audioTracks.find(t => t.id === trackId);
                if (track) {
                    track.muted = !track.muted;
                    btn.classList.toggle('active', track.muted);
                    this.runAudioDiagnostics();
                    this.showToast(`✦ Track ${track.name} ${track.muted ? 'Muted' : 'Unmuted'}`, 'info');
                }
            });
        });

        soloBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trackId = e.target.dataset.track;
                const track = this.audioTracks.find(t => t.id === trackId);
                if (track) {
                    track.solo = !track.solo;
                    btn.classList.toggle('active', track.solo);
                    this.showToast(`✦ Track ${track.name} Solo ${track.solo ? 'On' : 'Off'}`, 'info');
                }
            });
        });

        lockBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trackId = e.target.dataset.track;
                const track = this.audioTracks.find(t => t.id === trackId);
                if (track) {
                    track.locked = !track.locked;
                    btn.classList.toggle('active', track.locked);
                    this.showToast(`✦ Track ${track.name} ${track.locked ? 'Locked' : 'Unlocked'}`, 'info');
                }
            });
        });

        // Master Volume
        if (masterVol) {
            masterVol.addEventListener('input', (e) => {
                this.videoAudioVolume = parseFloat(e.target.value);
            });
        }
        if (masterMute) {
            masterMute.addEventListener('click', () => {
                this.videoAudioMuted = !this.videoAudioMuted;
                masterMute.classList.toggle('active', this.videoAudioMuted);
            });
        }

        // Clean Voice Effects Listeners in Clip Inspector
        const nrCheck = document.getElementById('audioClipNoiseReductionCheck');
        const veCheck = document.getElementById('audioClipVoiceEnhanceCheck');
        const normCheck = document.getElementById('audioClipNormalizeCheck');

        [nrCheck, veCheck, normCheck].forEach(chk => {
            if (chk) {
                chk.addEventListener('change', () => {
                    const activeClip = this.audioClips.find(c => c.id === this.selectedAudioClipId);
                    if (activeClip) {
                        activeClip.noiseReduction = nrCheck.checked;
                        activeClip.voiceEnhance = veCheck.checked;
                        activeClip.normalize = normCheck.checked;
                        this.saveHistoryState();
                        this.runAudioDiagnostics();
                    }
                });
            }
        });
    }

    async runAudioDiagnostics() {
        const diagList = document.getElementById('audioDiagnosticsList');
        if (!diagList) return;

        try {
            const res = await fetch('/api/editor/audio/diagnostics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioTracks: this.audioTracks || [],
                    audioClips: this.audioClips || []
                })
            });
            const data = await res.json();
            if (data.success && data.issues) {
                diagList.innerHTML = '';
                data.issues.forEach(issue => {
                    const row = document.createElement('div');
                    row.className = `diag-issue-row ${issue.level}`;
                    row.style.padding = '4px 6px';
                    row.style.borderRadius = '4px';
                    row.style.marginBottom = '2px';
                    row.style.background = issue.level === 'warning' ? 'rgba(245, 158, 11, 0.15)' : (issue.level === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)');
                    row.style.border = `1px solid ${issue.level === 'warning' ? 'rgba(245, 158, 11, 0.3)' : (issue.level === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)')}`;
                    row.innerHTML = `
                        <div style="font-weight:700; color: ${issue.level === 'warning' ? '#F59E0B' : (issue.level === 'error' ? '#EF4444' : '#10B981')};">${issue.category}</div>
                        <div style="color:var(--text-secondary); margin-top:2px;">${issue.message}</div>
                    `;
                    diagList.appendChild(row);
                });
            }
        } catch (e) {
            console.error("Audio diagnostics error:", e);
        }
    }

    // ============================================================
    // MEDIA MANAGEMENT SYSTEM (Library, Search, Sort, Filter, Relink)
    // ============================================================
    initMediaManager() {
        this.fetchMediaLibrary();

        // Search & Filter listeners
        const searchInput = document.getElementById('mediaSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.mediaSearchQuery = e.target.value.toLowerCase().trim();
                this.renderLibrary();
            });
        }

        const sortSelect = document.getElementById('mediaSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.mediaSortBy = e.target.value;
                this.renderLibrary();
            });
        }

        const filterBtns = document.querySelectorAll('.media-filter-btn, [data-media-filter]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mediaFilter = btn.dataset.mediaFilter || btn.dataset.filter || 'all';
                this.renderLibrary();
            });
        });

        const viewToggleBtn = document.getElementById('mediaViewToggle');
        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', () => {
                this.mediaViewMode = this.mediaViewMode === 'grid' ? 'list' : 'grid';
                viewToggleBtn.textContent = this.mediaViewMode === 'grid' ? '☰' : '⊞';
                this.renderLibrary();
            });
        }

        // Timeline Drag & Drop Receivers
        this.initTimelineDropZones();
    }

    async fetchMediaLibrary() {
        try {
            const res = await fetch('/api/editor/media/library');
            const data = await res.json();
            if (data.success && Array.isArray(data.assets)) {
                this.mediaLibrary = data.assets;
                this.renderLibrary();
            }
        } catch (e) {
            console.warn("Failed to fetch media library:", e);
        }
    }

    renderLibrary() {
        const list = document.getElementById('mediaLibraryList');
        if (!list) return;
        list.innerHTML = '';
        list.className = `media-library-container view-${this.mediaViewMode}`;

        let items = [...this.mediaLibrary];

        // 1. Filter
        if (this.mediaFilter && this.mediaFilter !== 'all') {
            items = items.filter(a => a.type === this.mediaFilter);
        }

        // 2. Search
        if (this.mediaSearchQuery) {
            items = items.filter(a => 
                (a.label && a.label.toLowerCase().includes(this.mediaSearchQuery)) ||
                (a.filename && a.filename.toLowerCase().includes(this.mediaSearchQuery)) ||
                (a.type && a.type.toLowerCase().includes(this.mediaSearchQuery))
            );
        }

        // 3. Sort
        items.sort((a, b) => {
            if (this.mediaSortBy === 'name') return (a.label || a.filename).localeCompare(b.label || b.filename);
            if (this.mediaSortBy === 'type') return (a.type || '').localeCompare(b.type || '');
            if (this.mediaSortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
            if (this.mediaSortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
            return (b.modifiedAt || '').localeCompare(a.modifiedAt || '');
        });

        if (items.length === 0) {
            list.innerHTML = `
                <div class="media-empty-state" style="text-align:center; padding:var(--space-6); color:var(--text-muted); font-size:12px;">
                    <div style="font-size:24px; margin-bottom:8px;">📁</div>
                    <div>No media assets match your criteria</div>
                </div>
            `;
            return;
        }

        items.forEach(asset => {
            const card = document.createElement('div');
            card.className = `media-card media-card-${asset.type}`;
            card.draggable = true;
            card.dataset.mediaId = asset.id;
            card.dataset.filename = asset.filename;
            card.dataset.type = asset.type;

            const icon = asset.type === 'video' ? '🎬' : (asset.type === 'audio' ? '🎵' : '🖼');
            const durText = asset.duration ? `${this.formatTime(asset.duration)}` : (asset.width ? `${asset.width}x${asset.height}` : '');
            const thumbImg = asset.thumbnailUrl ? `<img src="${asset.thumbnailUrl}" class="media-thumb-img" alt="${asset.label}" loading="lazy"/>` : `<div class="media-thumb-fallback">${icon}</div>`;

            card.innerHTML = `
                <div class="media-thumb-box">
                    ${thumbImg}
                    <span class="media-badge badge-${asset.type}">${asset.type.toUpperCase()}</span>
                    ${durText ? `<span class="media-duration-tag">${durText}</span>` : ''}
                </div>
                <div class="media-info-box">
                    <div class="media-title" title="${asset.filename}">${asset.label || asset.filename}</div>
                    <div class="media-meta">${asset.type} • ${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB</div>
                </div>
                <div class="media-card-actions">
                    <button class="btn btn-icon btn-sm add-timeline-btn" title="Add to Timeline">+</button>
                    <button class="btn btn-icon btn-sm context-menu-btn" title="More Options">⋮</button>
                </div>
            `;

            // Drag Start
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(asset));
                e.dataTransfer.effectAllowed = 'copy';
            });

            // Click -> Select & Inspect
            card.addEventListener('click', (e) => {
                if (e.target.closest('.add-timeline-btn') || e.target.closest('.context-menu-btn')) return;
                this.showMediaDetailsModal(asset);
            });

            // Quick Add Button
            card.querySelector('.add-timeline-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.addMediaAssetToTimeline(asset, this.playheadTime);
            });

            // Context Menu Button
            card.querySelector('.context-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showMediaContextMenu(e, asset);
            });

            list.appendChild(card);
        });
    }

    initTimelineDropZones() {
        const dropLanes = [
            { el: this.videoTrackLane, targetType: 'video' },
            { el: this.graphicsTrackLane, targetType: 'image' },
            { el: document.getElementById('laneVideoAudio'), targetType: 'audio', trackId: 'track_video_audio' },
            { el: document.getElementById('laneMusic'), targetType: 'audio', trackId: 'track_music' },
            { el: document.getElementById('laneVoice'), targetType: 'audio', trackId: 'track_voice' },
            { el: document.getElementById('laneSfx'), targetType: 'audio', trackId: 'track_sfx' }
        ];

        dropLanes.forEach(({ el, targetType, trackId }) => {
            if (!el) return;
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                el.classList.add('drop-target-active');
            });

            el.addEventListener('dragleave', () => {
                el.classList.remove('drop-target-active');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drop-target-active');
                try {
                    const raw = e.dataTransfer.getData('application/json');
                    if (!raw) return;
                    const asset = JSON.parse(raw);
                    const rect = el.getBoundingClientRect();
                    const dropX = e.clientX - rect.left + el.scrollLeft;
                    const dropTime = Math.max(0, dropX / this.zoom);
                    this.addMediaAssetToTimeline(asset, dropTime, trackId);
                } catch (err) {
                    console.error("Timeline drop error:", err);
                }
            });
        });
    }

    addMediaAssetToTimeline(asset, dropTime = 0, targetTrackId = null) {
        if (asset.type === 'video') {
            const dur = asset.duration || 10;
            const newClip = {
                id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                filename: asset.filename,
                start: 0,
                end: dur,
                duration: dur,
                timelineStart: parseFloat(dropTime.toFixed(2)),
                track: 'video',
                transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }
            };
            this.clips.push(newClip);
            this.selectClip(newClip.id);
            this.showToast(`Added video clip '${asset.label}' to timeline`, 'success');
        } else if (asset.type === 'audio') {
            const dur = asset.duration || 5;
            const trackId = targetTrackId || 'track_music';
            const newAudio = {
                id: 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                trackId: trackId,
                name: asset.label || asset.filename,
                filename: asset.filename,
                url: asset.url,
                start: parseFloat(dropTime.toFixed(2)),
                end: parseFloat((dropTime + dur).toFixed(2)),
                duration: dur,
                sourceStart: 0,
                sourceEnd: dur,
                volume: 100,
                pan: 0,
                fadeIn: 0,
                fadeOut: 0,
                speed: 1.0,
                muted: false
            };
            this.audioClips.push(newAudio);
            this.selectAudioClip(newAudio.id);
            this.showToast(`Added audio track '${asset.label}' to timeline`, 'success');
        } else if (asset.type === 'image') {
            this.addGraphicLayer({
                type: 'image',
                name: asset.label || asset.filename,
                imageUrl: asset.url,
                fill: '#FFFFFF',
                icon: '🖼'
            });
        }

        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
    }

    showMediaContextMenu(e, asset) {
        const existing = document.getElementById('mediaContextMenu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'mediaContextMenu';
        menu.className = 'custom-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.zIndex = '99999';

        menu.innerHTML = `
            <div class="menu-item" data-action="add">➕ Add to Timeline at Playhead</div>
            <div class="menu-item" data-action="rename">✏️ Rename Asset Entry</div>
            <div class="menu-item" data-action="relink">🔗 Relink / Locate File</div>
            <div class="menu-item" data-action="details">ℹ️ View Metadata & Codec</div>
            <div class="menu-divider"></div>
            <div class="menu-item text-danger" data-action="remove">🗑 Remove from Project</div>
        `;

        const closeMenu = () => menu.remove();
        setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 10);

        menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action === 'add') {
                    this.addMediaAssetToTimeline(asset, this.playheadTime);
                } else if (action === 'rename') {
                    const newName = prompt("Rename media asset label:", asset.label || asset.filename);
                    if (newName && newName.trim()) {
                        asset.label = newName.trim();
                        this.renderLibrary();
                        this.showToast("Media asset renamed in project", "success");
                    }
                } else if (action === 'relink') {
                    this.showRelinkModal(asset);
                } else if (action === 'details') {
                    this.showMediaDetailsModal(asset);
                } else if (action === 'remove') {
                    this.mediaLibrary = this.mediaLibrary.filter(a => a.id !== asset.id);
                    this.renderLibrary();
                    this.showToast(`Removed '${asset.label}' from library`, "info");
                }
            });
        });

        document.body.appendChild(menu);
    }

    showRelinkModal(asset) {
        const newPath = prompt(`Enter absolute or relative path to relink '${asset.filename}':`, asset.filepath || '');
        if (!newPath || !newPath.trim()) return;

        fetch('/api/editor/media/relink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldFilename: asset.filename, newPath: newPath.trim() })
        })
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                this.showToast(`Relinked ${asset.filename}`, 'success');
                this.fetchMediaLibrary();
            } else {
                this.showToast(d.message || d.error || 'Relink failed', 'error');
            }
        })
        .catch(e => console.error("Relink error:", e));
    }

    showMediaDetailsModal(asset) {
        const durStr = asset.duration ? `${asset.duration}s (${this.formatTime(asset.duration)})` : 'N/A';
        const resStr = asset.width ? `${asset.width} × ${asset.height} px` : 'N/A';
        const fpsStr = asset.fps ? `${asset.fps} FPS` : 'N/A';
        const sizeStr = `${(asset.sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

        if (window.UpClipModal) {
            window.UpClipModal.create({
                title: `Asset Details: ${asset.label || asset.filename}`,
                content: `
                    <div style="display:flex; gap:16px; margin-bottom:16px;">
                        <div style="width:140px; height:100px; background:var(--surface-elevated); border-radius:var(--radius-md); overflow:hidden; display:flex; align-items:center; justify-content:center;">
                            ${asset.thumbnailUrl ? `<img src="${asset.thumbnailUrl}" style="width:100%; height:100%; object-fit:cover;"/>` : `<span style="font-size:32px;">📁</span>`}
                        </div>
                        <div style="flex:1; font-size:12px; line-height:1.6;">
                            <div><strong>Filename:</strong> ${asset.filename}</div>
                            <div><strong>Type:</strong> ${asset.type.toUpperCase()}</div>
                            <div><strong>Duration:</strong> ${durStr}</div>
                            <div><strong>Resolution:</strong> ${resStr}</div>
                            <div><strong>Framerate:</strong> ${fpsStr}</div>
                            <div><strong>File Size:</strong> ${sizeStr}</div>
                            <div><strong>Modified:</strong> ${asset.modifiedAt || 'N/A'}</div>
                        </div>
                    </div>
                `,
                buttons: [
                    { label: "Add to Timeline", variant: "primary", onClick: (m) => { this.addMediaAssetToTimeline(asset, this.playheadTime); m.close(); } },
                    { label: "Close", variant: "secondary", onClick: (m) => m.close() }
                ]
            });
        }
    }

    // ============================================================
    // AUDIO TIMELINE OPERATIONS (Split, Duplicate, Delete, Mute)
    // ============================================================
    splitAudioClipAtPlayhead() {
        const curTime = this.playheadTime;
        const target = this.selectedAudioClipId
            ? this.audioClips.find(c => c.id === this.selectedAudioClipId)
            : this.audioClips.find(c => curTime > c.start && curTime < c.end);

        if (!target) {
            this.showToast('No audio clip selected or under playhead to split', 'warning');
            return;
        }

        if (curTime <= target.start + 0.1 || curTime >= target.end - 0.1) {
            this.showToast('Playhead is too close to audio clip edge', 'warning');
            return;
        }

        const splitOffset = curTime - target.start;
        const origEnd = target.end;
        const origSrcStart = target.sourceStart || 0;

        // Clip 1 (First Half)
        target.end = parseFloat(curTime.toFixed(2));
        target.duration = parseFloat((target.end - target.start).toFixed(2));
        target.sourceEnd = origSrcStart + target.duration;

        // Clip 2 (Second Half)
        const secondHalf = {
            ...target,
            id: 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            start: parseFloat(curTime.toFixed(2)),
            end: origEnd,
            duration: parseFloat((origEnd - curTime).toFixed(2)),
            sourceStart: origSrcStart + splitOffset,
            sourceEnd: target.sourceEnd || (origSrcStart + splitOffset + (origEnd - curTime))
        };

        this.audioClips.push(secondHalf);
        this.selectAudioClip(secondHalf.id);
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Audio clip '${target.name}' split into 2 segments`, 'success');
    }

    duplicateSelectedAudioClip() {
        if (!this.selectedAudioClipId) {
            this.showToast('Select an audio clip to duplicate', 'warning');
            return;
        }
        const clip = this.audioClips.find(c => c.id === this.selectedAudioClipId);
        if (!clip) return;

        const clone = {
            ...clip,
            id: 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: `${clip.name} (Copy)`,
            start: parseFloat((clip.end + 0.2).toFixed(2)),
            end: parseFloat((clip.end + 0.2 + clip.duration).toFixed(2))
        };

        this.audioClips.push(clone);
        this.selectAudioClip(clone.id);
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Duplicated audio clip '${clip.name}'`, 'success');
    }

    deleteSelectedAudioClip() {
        if (!this.selectedAudioClipId) return;
        const clip = this.audioClips.find(c => c.id === this.selectedAudioClipId);
        const name = clip ? clip.name : 'Audio clip';
        this.audioClips = this.audioClips.filter(c => c.id !== this.selectedAudioClipId);
        this.selectAudioClip(null);
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Deleted ${name}`, 'success');
    }

    toggleSelectedAudioClipMute() {
        if (!this.selectedAudioClipId) return;
        const clip = this.audioClips.find(c => c.id === this.selectedAudioClipId);
        if (!clip) return;
        clip.muted = !clip.muted;
        this.renderTimeline();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`${clip.name} is now ${clip.muted ? 'Muted' : 'Unmuted'}`, 'info');
    }

    // ============================================================
    // GRAPHICS LAYER ORDERING (Bring Forward, Send Backward, To Front, To Back)
    // ============================================================
    bringGraphicForward() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        layer.layerOrder = (layer.layerOrder || 0) + 1;
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Moved '${layer.name}' forward`, 'info');
    }

    sendGraphicBackward() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        layer.layerOrder = Math.max(0, (layer.layerOrder || 0) - 1);
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Moved '${layer.name}' backward`, 'info');
    }

    bringGraphicToFront() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        const maxOrder = Math.max(0, ...this.graphics.map(g => g.layerOrder || 0));
        layer.layerOrder = maxOrder + 1;
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Brought '${layer.name}' to front`, 'info');
    }

    sendGraphicToBack() {
        if (!this.selectedGraphicId) return;
        const layer = this.graphics.find(g => g.id === this.selectedGraphicId);
        if (!layer) return;
        const minOrder = Math.min(0, ...this.graphics.map(g => g.layerOrder || 0));
        layer.layerOrder = minOrder - 1;
        this.renderGraphicsCanvas();
        this.renderLayersStack();
        this.markDirty();
        this.saveHistoryState();
        this.showToast(`Sent '${layer.name}' to back`, 'info');
    }

    // ============================================================
    // GLOBAL SETTINGS MODAL DIALOG
    // ============================================================
    showSettingsModal() {
        if (!window.UpClipModal) return;
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

        window.UpClipModal.create({
            title: "Application & Project Settings",
            content: `
                <div class="settings-modal-tabs" style="display:flex; border-bottom:1px solid var(--border); margin-bottom:16px; gap:8px;">
                    <button class="btn btn-ghost btn-sm set-tab-btn active" data-tab="general">General</button>
                    <button class="btn btn-ghost btn-sm set-tab-btn" data-tab="appearance">Appearance</button>
                    <button class="btn btn-ghost btn-sm set-tab-btn" data-tab="editing">Editing</button>
                    <button class="btn btn-ghost btn-sm set-tab-btn" data-tab="audio">Audio</button>
                    <button class="btn btn-ghost btn-sm set-tab-btn" data-tab="export">Export</button>
                </div>
                <div id="setTabContent" style="font-size:12px;">
                    <div class="set-pane" id="paneAppearance">
                        <div class="form-group" style="margin-bottom:12px;">
                            <label style="display:block; margin-bottom:4px; font-weight:600;">Theme Mode</label>
                            <select id="setThemeSelect" class="form-control" style="width:100%; padding:6px; background:var(--surface); color:var(--text-primary); border:1px solid var(--border); border-radius:4px;">
                                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Studio Mode (Default)</option>
                                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light Theme Mode</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label style="display:block; margin-bottom:4px; font-weight:600;">Accent Color</label>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <button class="btn btn-sm" style="background:#8B5CF6; width:28px; height:28px; border-radius:50%;" onclick="document.documentElement.style.setProperty('--primary', '#8B5CF6')"></button>
                                <button class="btn btn-sm" style="background:#38BDF8; width:28px; height:28px; border-radius:50%;" onclick="document.documentElement.style.setProperty('--primary', '#38BDF8')"></button>
                                <button class="btn btn-sm" style="background:#10B981; width:28px; height:28px; border-radius:50%;" onclick="document.documentElement.style.setProperty('--primary', '#10B981')"></button>
                                <button class="btn btn-sm" style="background:#F43F5E; width:28px; height:28px; border-radius:50%;" onclick="document.documentElement.style.setProperty('--primary', '#F43F5E')"></button>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            buttons: [
                {
                    label: "Apply Changes",
                    variant: "primary",
                    onClick: (modal) => {
                        const themeSel = document.getElementById('setThemeSelect');
                        if (themeSel) {
                            const val = themeSel.value;
                            document.documentElement.setAttribute('data-theme', val);
                            localStorage.setItem('upclip_theme', val);
                            this.showToast(`Applied ${val} theme mode`, 'success');
                        }
                        modal.close();
                    }
                },
                { label: "Close", variant: "secondary", onClick: (m) => m.close() }
            ]
        });
    }

    // ============================================================
    // COMMAND PALETTE INTEGRATION
    // ============================================================
    initCommandPalette() {
        if (!window.UpClipCommands) return;

        // Project Commands
        window.UpClipCommands.register({
            id: "editor_save_project",
            label: "Save Project",
            category: "Project",
            shortcut: "Ctrl+S",
            keywords: ["save", "persist", "disk"],
            action: () => this.saveProject(false)
        });

        window.UpClipCommands.register({
            id: "editor_open_settings",
            label: "Open Settings & Theme Preferences",
            category: "Project",
            keywords: ["settings", "theme", "dark", "light", "appearance"],
            action: () => this.showSettingsModal()
        });

        window.UpClipCommands.register({
            id: "editor_open_media_bin",
            label: "Open Media Bin / Central Library",
            category: "Project",
            shortcut: "M",
            keywords: ["media", "library", "bin", "assets"],
            action: () => {
                const mediaTab = document.querySelector('.sidebar-tab-btn[data-tab="media"]');
                if (mediaTab) mediaTab.click();
            }
        });

        // Timeline Video & Audio Commands
        window.UpClipCommands.register({
            id: "editor_split_clip",
            label: "Split Video Clip at Playhead",
            category: "Timeline",
            shortcut: "S",
            keywords: ["cut", "slice", "split", "video"],
            action: () => this.splitClipAtPlayhead()
        });

        window.UpClipCommands.register({
            id: "editor_split_audio",
            label: "Split Audio Clip at Playhead",
            category: "Audio",
            keywords: ["audio", "split", "cut", "sound"],
            action: () => this.splitAudioClipAtPlayhead()
        });

        window.UpClipCommands.register({
            id: "editor_duplicate_clip",
            label: "Duplicate Selected Video Clip",
            category: "Timeline",
            shortcut: "Ctrl+D",
            keywords: ["clone", "copy", "duplicate", "video"],
            action: () => this.duplicateSelectedClip()
        });

        window.UpClipCommands.register({
            id: "editor_duplicate_audio",
            label: "Duplicate Selected Audio Clip",
            category: "Audio",
            keywords: ["clone", "copy", "duplicate", "audio"],
            action: () => this.duplicateSelectedAudioClip()
        });

        window.UpClipCommands.register({
            id: "editor_delete_clip",
            label: "Delete Selected Object",
            category: "Timeline",
            shortcut: "Delete",
            keywords: ["remove", "trash", "delete"],
            action: () => {
                if (this.selectedClipId) this.deleteSelectedClip();
                else if (this.selectedAudioClipId) this.deleteSelectedAudioClip();
                else if (this.selectedGraphicId) this.deleteSelectedGraphic();
            }
        });

        // Graphics Layer Commands
        window.UpClipCommands.register({
            id: "editor_add_keyframe",
            label: "Add Graphic Keyframe at Playhead",
            category: "Graphics",
            shortcut: "K",
            keywords: ["keyframe", "animate", "motion"],
            action: () => this.addKeyframeAtPlayhead()
        });

        window.UpClipCommands.register({
            id: "editor_bring_forward",
            label: "Bring Graphic Layer Forward",
            category: "Graphics",
            keywords: ["layer", "order", "front", "forward"],
            action: () => this.bringGraphicForward()
        });

        window.UpClipCommands.register({
            id: "editor_send_backward",
            label: "Send Graphic Layer Backward",
            category: "Graphics",
            keywords: ["layer", "order", "back", "backward"],
            action: () => this.sendGraphicBackward()
        });

        // Export Commands
        window.UpClipCommands.register({
            id: "editor_open_export",
            label: "Export Master Video",
            category: "Project",
            shortcut: "Ctrl+E",
            keywords: ["render", "export", "mp4", "download"],
            action: () => {
                const exportModal = document.getElementById('exportModal') || document.getElementById('renderCenterModal');
                if (exportModal) {
                    exportModal.classList.remove('hidden');
                    exportModal.style.display = 'flex';
                }
            }
        });

        window.UpClipCommands.register({
            id: "editor_remove_silence",
            label: "AI Remove Dead Air & Silence",
            category: "Timeline",
            keywords: ["silence", "dead air", "trim", "ai"],
            action: () => {
                const aiBtn = document.getElementById('autoSilenceTrimBtn');
                if (aiBtn) aiBtn.click();
            }
        });
    }

    showToast(message, type = 'success') {
        if (window.UpClipToast) window.UpClipToast.show(message, type);
        else console.log(`[Toast ${type}] ${message}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.upclipEditor = new UpClipEditor();
});
