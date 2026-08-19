import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize,
  Type,
  Palette,
  Wand2,
  Download,
  Undo2,
  Redo2,
  Save,
  Plus,
  Trash2,
  Copy,
  Scissors,
  Merge,
  Gauge,
  Monitor,
  Square,
  Crop,
  WandSparkles,
  Languages,
  Import,
  Move,
  Mic,
  ArrowLeft,
  Youtube,
  Search,
  Replace,
  Split,
  FileText,
  Eraser,
} from "lucide-react";
import { useEditorStore } from "../store/editorStore";
import type { CaptionStyle } from "../types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export default function Editor() {
  const location = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [activePanel, setActivePanel] = useState<"text" | "style" | "effects" | "export">("text");
  const [showExport, setShowExport] = useState(false);
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showAutoSplit, setShowAutoSplit] = useState(false);
  const [autoSplitMaxDur, setAutoSplitMaxDur] = useState(7.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoCaptionLang, setAutoCaptionLang] = useState("en");
  const [isAutoCaptioning, setIsAutoCaptioning] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragState, setDragState] = useState<{ captionId: string; type: "move" | "resize-start" | "resize-end" } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [inheritedStyle, setInheritedStyle] = useState<CaptionStyle | null>(null);
  const [navSource, setNavSource] = useState("");

  const {
    videoUrl,
    videoFileName,
    duration,
    currentTime,
    isPlaying,
    captions,
    selectedCaptionId,
    timelineZoom,
    selectedStyleId,
    styles,
    canvasSettings,
    setVideo,
    setCurrentTime,
    setIsPlaying,
    addCaption,
    updateCaption,
    deleteCaption,
    duplicateCaption,
    selectCaption,
    setTimelineZoom,
    undo,
    redo,
    pushHistory,
    setAutosaveStatus,
    setCanvasSettings,
    applyInheritedStyle,
    setProjectId: setStoreProjectId,
  } = useEditorStore();

  const selectedCaption = captions.find((c) => c.id === selectedCaptionId) || null;
  const selectedStyle = styles.find((s) => s.id === selectedStyleId) || styles[0];

  useEffect(() => {
    const initState = (window as any).__UPCLIP_INITIAL_STATE__ || {};
    const inherited = initState.inherited_style;
    if (inherited) {
      const style: CaptionStyle = {
        id: inherited.id || "inherited",
        name: inherited.name || "Inherited Style",
        fontFamily: inherited.font_family || "Arial Black",
        fontWeight: inherited.font_weight || 800,
        fontSize: inherited.font_size || 34,
        letterSpacing: inherited.letter_spacing || 0,
        lineHeight: inherited.line_height || 1.2,
        textColor: inherited.text_color || "#FFFFFF",
        activeWordColor: inherited.active_word_color || "#fbbf24",
        backgroundColor: inherited.background_color || "#000000",
        backgroundOpacity: inherited.background_opacity ?? 0.0,
        outlineColor: inherited.outline_color || "#000000",
        outlineWidth: inherited.outline_width || 3,
        shadowColor: inherited.shadow_color || "#000000",
        shadowBlur: inherited.shadow_blur || 4,
        shadowOffsetY: inherited.shadow_offset_y || 2,
        position: inherited.position || "bottom",
        x: inherited.x || 0,
        y: inherited.y || 0,
        maxWidth: inherited.max_width || 800,
        padding: inherited.padding || 12,
        animation: (inherited.animation as CaptionStyle["animation"]) || "pop",
        animationSpeed: inherited.animation_speed || 1,
        maxLines: inherited.max_lines || 2,
      };
      setInheritedStyle(style);
      applyInheritedStyle(style);
    }

    const state = location.state as { video?: { filename: string; video_url: string; metadata: { duration: number } }; demo?: boolean; project_id?: string; src?: string; preload_srt?: string; preload_vtt?: string; preload_style?: any } | null;
    if (state?.video) {
      setVideo(state.video.filename, state.video.video_url, state.video.metadata.duration);
      if (state.project_id) {
        setProjectId(state.project_id);
        setStoreProjectId(state.project_id);
      }
      if (state.src) setNavSource(state.src);
      if (state.demo) {
        setTimeout(() => {
          useEditorStore.getState().addCaption({
            id: "demo-1",
            text: "Welcome to Caption Studio",
            start: 0,
            end: 3,
          });
          useEditorStore.getState().addCaption({
            id: "demo-2",
            text: "Make every word pop",
            start: 3.5,
            end: 7,
          });
          useEditorStore.getState().pushHistory();
        }, 500);
      }
      // Auto-import preloaded SRT/VTT captions
      const preloadCaptionUrl = state.preload_srt || state.preload_vtt;
      if (preloadCaptionUrl) {
        setTimeout(async () => {
          try {
            const res = await fetch(preloadCaptionUrl);
            if (!res.ok) return;
            const blob = await res.blob();
            const ext = preloadCaptionUrl.endsWith(".vtt") ? ".vtt" : ".srt";
            const file = new File([blob], `preloaded${ext}`, { type: "text/plain" });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("project_id", state.project_id || "");
            const importRes = await fetch("/api/caption-studio/import", { method: "POST", body: formData });
            const importData = await importRes.json();
            if (importData.success && importData.captions.length) {
              useEditorStore.getState().captions = [];
              importData.captions.forEach((cap: any) => useEditorStore.getState().addCaption(cap));
              useEditorStore.getState().pushHistory();
            }
          } catch (e) {
            console.error("Preload captions failed:", e);
          }
        }, 600);
      }
      // Apply preloaded caption style
      if (state.preload_style) {
        setTimeout(() => {
          try {
            const store = useEditorStore.getState();
            const existing = store.styles.find(s => s.id === state.preload_style.id);
            if (existing) {
              store.setSelectedStyle(existing.id);
            } else {
              const newStyle: any = {
                id: state.preload_style.id || "inherited-custom",
                name: state.preload_style.name || "Inherited",
                fontFamily: state.preload_style.font_family || "Arial Black",
                fontWeight: state.preload_style.font_weight || 800,
                fontSize: state.preload_style.font_size || 42,
                letterSpacing: state.preload_style.letter_spacing || 0,
                lineHeight: state.preload_style.line_height || 1.2,
                textColor: state.preload_style.text_color || "#ffffff",
                activeWordColor: state.preload_style.active_word_color || "#fbbf24",
                backgroundColor: state.preload_style.background_color || "#000000",
                backgroundOpacity: state.preload_style.background_opacity ?? 0,
                outlineColor: state.preload_style.outline_color || "#000000",
                outlineWidth: state.preload_style.outline_width || 3,
                shadowColor: state.preload_style.shadow_color || "#000000",
                shadowBlur: state.preload_style.shadow_blur || 4,
                shadowOffsetY: state.preload_style.shadow_offset_y || 2,
                position: state.preload_style.position || "bottom",
                animation: state.preload_style.animation || "pop",
                animationSpeed: 1,
                maxLines: state.preload_style.max_lines || 2,
              };
              store.addStyle(newStyle);
              store.setSelectedStyle(newStyle.id);
            }
          } catch (e) {
            console.error("Preload style failed:", e);
          }
        }, 600);
      }
    } else {
      navigate("/");
    }
  }, [location.state, navigate, setVideo, setProjectId, setStoreProjectId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedCaptionId) deleteCaption(selectedCaptionId);
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentTime(Math.max(0, currentTime - 1 / 30));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentTime(Math.min(duration, currentTime + 1 / 30));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPlaying, selectedCaptionId, deleteCaption, undo, redo, setCurrentTime, currentTime, duration, setIsPlaying]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, setCurrentTime]);

  useEffect(() => {
    setAutosaveStatus("saved");
  }, [captions, setAutosaveStatus]);

  const onTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoLoaded(true);
      if (!duration) setCurrentTime(0);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * duration;
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const handleAutoCaption = async () => {
    const { videoFileName } = useEditorStore.getState();
    if (!videoFileName) return;
    setIsAutoCaptioning(true);
    try {
      const res = await fetch("/api/caption-studio/auto-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoFileName, language: autoCaptionLang, project_id: projectId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Auto-caption failed");
      useEditorStore.getState().captions = [];
      data.captions.forEach((cap: any) => useEditorStore.getState().addCaption(cap));
      useEditorStore.getState().pushHistory();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Auto-caption failed");
    } finally {
      setIsAutoCaptioning(false);
    }
  };

  const handleImportCaptions = async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (projectId) formData.append("project_id", projectId);
      const res = await fetch("/api/caption-studio/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Import failed");
      useEditorStore.getState().captions = [];
      data.captions.forEach((cap: any) => useEditorStore.getState().addCaption(cap));
      useEditorStore.getState().pushHistory();
      setImportFile(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSearchReplace = async () => {
    if (!searchText.trim()) return;
    setIsSearching(true);
    try {
      const { captions } = useEditorStore.getState();
      const res = await fetch("/api/caption-studio/search-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captions,
          search: searchText,
          replace: replaceText,
          case_sensitive: searchCaseSensitive,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Search/Replace failed");
      useEditorStore.getState().captions = data.captions;
      useEditorStore.getState().pushHistory();
      setShowSearchReplace(false);
      setSearchText("");
      setReplaceText("");
      alert(`Replaced ${data.replaceCount} caption(s).`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Search/Replace failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAutoSplit = async () => {
    const { captions } = useEditorStore.getState();
    if (!captions.length) return;
    try {
      const res = await fetch("/api/caption-studio/auto-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captions,
          max_duration: autoSplitMaxDur,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Auto-split failed");
      useEditorStore.getState().captions = data.captions;
      useEditorStore.getState().pushHistory();
      setShowAutoSplit(false);
      alert(`Split captions. Now ${data.captions.length} segments.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Auto-split failed");
    }
  };

  const handleExportCaptions = async () => {
    const { captions, selectedStyleId, styles, canvasSettings, exportSettings } = useEditorStore.getState();
    if (!captions.length) {
      alert("No captions to export.");
      return;
    }
    const format = exportSettings.format === "webm" ? "srt" : "both";
    try {
      const res = await fetch("/api/caption-studio/export-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captions,
          videoFileName: videoFileName,
          project_id: projectId,
          format,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Export failed");
      if (data.files.srt) window.open(data.files.srt.url, "_blank");
      if (data.files.vtt) window.open(data.files.vtt.url, "_blank");
      alert("Captions exported!");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Export failed");
    }
  };

  const handleClearAllCaptions = () => {
    if (!confirm("Delete all captions? This cannot be undone.")) return;
    useEditorStore.getState().captions = [];
    useEditorStore.getState().pushHistory();
    useEditorStore.getState().selectCaption(null);
  };

  const handleSplitSelected = () => {
    const { captions, selectedCaptionId, currentTime } = useEditorStore.getState();
    const cap = captions.find((c) => c.id === selectedCaptionId);
    if (!cap) return;
    const splitTime = currentTime || (cap.start + cap.end) / 2;
    if (splitTime <= cap.start || splitTime >= cap.end) return;
    useEditorStore.getState().splitCaption(cap.id, splitTime);
    useEditorStore.getState().pushHistory();
  };

  const handleDuplicateSelected = () => {
    const { selectedCaptionId } = useEditorStore.getState();
    if (!selectedCaptionId) return;
    useEditorStore.getState().duplicateCaption(selectedCaptionId);
    useEditorStore.getState().pushHistory();
  };

  const handleMergeSelected = () => {
    const { captions, selectedCaptionId } = useEditorStore.getState();
    const selected = captions.find((c) => c.id === selectedCaptionId);
    if (!selected) return;
    const next = captions.find((c) => c.start >= selected.end);
    if (!next) {
      alert("No next caption to merge with.");
      return;
    }
    useEditorStore.getState().mergeCaptions(selected.id, next.id);
    useEditorStore.getState().pushHistory();
  };

  const handleDragStart = (e: React.MouseEvent, captionId: string, type: "move" | "resize-start" | "resize-end") => {
    e.stopPropagation();
    setDragState({ captionId, type });
  };

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * duration;
      const caption = useEditorStore.getState().captions.find((c) => c.id === dragState.captionId);
      if (!caption) return;
      if (dragState.type === "move") {
        const dur = caption.end - caption.start;
        const newStart = Math.max(0, Math.min(duration - dur, time - dur / 2));
        useEditorStore.getState().updateCaption(dragState.captionId, { start: newStart, end: newStart + dur });
      } else if (dragState.type === "resize-start") {
        const newStart = Math.max(0, Math.min(caption.end - 0.1, time));
        useEditorStore.getState().updateCaption(dragState.captionId, { start: newStart });
      } else if (dragState.type === "resize-end") {
        const newEnd = Math.max(caption.start + 0.1, Math.min(duration, time));
        useEditorStore.getState().updateCaption(dragState.captionId, { end: newEnd });
      }
    };
    const handleMouseUp = () => {
      setDragState(null);
      useEditorStore.getState().pushHistory();
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, duration]);

  const captionStyle = selectedStyle
    ? {
        fontFamily: selectedStyle.fontFamily,
        fontWeight: selectedStyle.fontWeight,
        fontSize: selectedStyle.fontSize,
        letterSpacing: selectedStyle.letterSpacing,
        lineHeight: selectedStyle.lineHeight,
        color: selectedStyle.textColor,
        textShadow: `${selectedStyle.shadowOffsetY}px ${selectedStyle.shadowBlur}px ${selectedStyle.shadowBlur}px ${selectedStyle.shadowColor}`,
        WebkitTextStroke: `${selectedStyle.outlineWidth}px ${selectedStyle.outlineColor}`,
      }
    : {};

  const activeCaptions = captions.filter((c) => currentTime >= c.start && currentTime <= c.end);

  const sendToYouTube = () => {
    if (!videoFileName) return;
    const params = new URLSearchParams();
    params.set("file", videoFileName);
    if (projectId) params.set("project_id", projectId);
    window.location.href = `/youtube-desk?${params.toString()}`;
  };

  const goBack = () => {
    if (navSource === "clip_cutter") {
      window.location.href = "/dashboard";
    } else if (navSource === "yt_downloader") {
      window.location.href = "/yt-downloader";
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="h-screen flex flex-col bg-brand-bg text-white overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {inheritedStyle && (
            <span className="text-xs px-2 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              Style: {inheritedStyle.name}
            </span>
          )}
          <h1 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-accent">
            Caption Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 flex items-center gap-1">
            <Save className="w-3 h-3" /> Saved
          </span>
          <button onClick={undo} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4 text-white/70" />
          </button>
          <button onClick={redo} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="w-4 h-4 text-white/70" />
          </button>
           <button onClick={sendToYouTube} className="btn-secondary flex items-center gap-1 text-xs">
             <Youtube className="w-4 h-4" /> YouTube
           </button>
           <button onClick={() => setShowSearchReplace(true)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Search & Replace">
             <Search className="w-4 h-4 text-white/70" />
           </button>
           <button onClick={() => setShowAutoSplit(true)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Auto-Split Long Captions">
             <Split className="w-4 h-4 text-white/70" />
           </button>
           <button onClick={handleClearAllCaptions} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Clear All Captions">
             <Eraser className="w-4 h-4 text-white/70" />
           </button>
           <button onClick={() => setShowExport(true)} className="btn-primary flex items-center gap-2">
             <Download className="w-4 h-4" />
             Export
           </button>
         </div>
       </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-white/5 bg-black/10 overflow-y-auto hidden md:flex flex-col">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Style Presets</h3>
              <div className="grid grid-cols-2 gap-2">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => useEditorStore.getState().setSelectedStyle(style.id)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedStyleId === style.id
                        ? "bg-brand-primary/20 border border-brand-primary/40"
                        : "bg-white/5 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="text-sm font-medium">{style.name}</span>
                    <span className="block text-[10px] text-white/40 mt-0.5 capitalize">{style.animation}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Aspect Ratio</h3>
              <div className="grid grid-cols-2 gap-2">
                {(["9:16", "16:9", "1:1", "4:5"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => {
                      const map: Record<string, { width: number; height: number }> = {
                        "9:16": { width: 1080, height: 1920 },
                        "16:9": { width: 1920, height: 1080 },
                        "1:1": { width: 1080, height: 1080 },
                        "4:5": { width: 1080, height: 1350 },
                      };
                      setCanvasSettings({ aspectRatio: ratio, ...map[ratio] });
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      canvasSettings.aspectRatio === ratio
                        ? "bg-brand-primary/20 border border-brand-primary/40"
                        : "bg-white/5 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-black/20">
            <div
              className="relative bg-black rounded-2xl overflow-hidden shadow-2xl"
              style={{
                aspectRatio: `${canvasSettings.width} / ${canvasSettings.height}`,
                maxHeight: "calc(100vh - 280px)",
                maxWidth: "100%",
              }}
            >
              <video
                ref={videoRef}
                src={videoUrl || undefined}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <AnimatePresence>
                  {activeCaptions.map((caption) => {
                    const words = caption.words || caption.text.split(" ");
                    const currentWordIndex = words.findIndex((w) => {
                      if (typeof w === "string") return false;
                      return currentTime >= w.start && currentTime <= w.end;
                    });
                    return (
                      <motion.div
                        key={caption.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-center px-4 py-2"
                        style={selectedStyle?.position === "center" ? { top: "50%", transform: "translateY(-50%)" } : selectedStyle?.position === "top" ? { top: "10%" } : { bottom: "10%" }}
                      >
                        <div className="flex flex-wrap justify-center gap-x-1" style={captionStyle}>
                          {words.map((word, i) => {
                            const isActive = i === currentWordIndex;
                            const wordText = typeof word === "string" ? word : word.text;
                            return (
                              <span
                                key={i}
                                className="transition-all duration-200"
                                style={{
                                  color: isActive ? selectedStyle?.activeWordColor : selectedStyle?.textColor,
                                  transform: isActive ? "scale(1.1)" : "scale(1)",
                                  textShadow: isActive ? `0 0 20px ${selectedStyle?.activeWordColor}40` : selectedStyle?.textColor ? undefined : undefined,
                                }}
                              >
                                {wordText}
                              </span>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 bg-black/20 backdrop-blur-md px-4 py-3">
            <div className="flex items-center gap-4 mb-3">
              <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={() => setCurrentTime(0)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <span className="text-sm font-mono text-white/70 w-24">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-white/40" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={timelineZoom}
                  onChange={(e) => setTimelineZoom(Number(e.target.value))}
                  className="w-24 accent-brand-primary"
                />
              </div>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                {isFullscreen ? <Square className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
            <div
              ref={timelineRef}
              onClick={handleSeek}
              className="relative h-16 bg-white/5 rounded-xl cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 flex items-center px-1">
                {captions.map((caption) => (
                  <div
                    key={caption.id}
                    onClick={(e) => { e.stopPropagation(); selectCaption(caption.id); }}
                    className={`absolute h-10 rounded-lg flex items-center text-xs truncate cursor-pointer transition-all ${
                      selectedCaptionId === caption.id
                        ? "bg-brand-primary/40 border border-brand-primary/60 z-10"
                        : "bg-white/10 border border-white/10 hover:bg-white/20"
                    }`}
                    style={{
                      left: `${(caption.start / (duration || 1)) * 100}%`,
                      width: `${((caption.end - caption.start) / (duration || 1)) * 100}%`,
                      minWidth: "40px",
                    }}
                  >
                    <div
                      onMouseDown={(e) => handleDragStart(e, caption.id, "resize-start")}
                      className="w-2 h-full cursor-ew-resize hover:bg-white/20 rounded-l-lg"
                    />
                    <span className="px-2 truncate flex-1">{caption.text}</span>
                    <div
                      onMouseDown={(e) => handleDragStart(e, caption.id, "resize-end")}
                      className="w-2 h-full cursor-ew-resize hover:bg-white/20 rounded-r-lg"
                    />
                  </div>
                ))}
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand-accent z-20 pointer-events-none"
                style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-accent rounded-full" />
              </div>
            </div>
          </div>
        </main>

        <aside className="w-80 border-l border-white/5 bg-black/10 overflow-y-auto hidden lg:flex flex-col">
          <div className="p-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4">
              {([
                { id: "text", icon: Type, label: "Text" },
                { id: "style", icon: Palette, label: "Style" },
                { id: "effects", icon: Wand2, label: "Effects" },
                { id: "export", icon: Download, label: "Export" },
              ] as const).map((panel) => (
                <button
                  key={panel.id}
                  onClick={() => setActivePanel(panel.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-all ${
                    activePanel === panel.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <panel.icon className="w-4 h-4" />
                  {panel.label}
                </button>
              ))}
            </div>

            {activePanel === "text" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Selected Caption</label>
                  {selectedCaption ? (
                    <div className="space-y-3">
                      <textarea
                        value={selectedCaption.text}
                        onChange={(e) => updateCaption(selectedCaption.id, { text: e.target.value })}
                        onBlur={() => pushHistory()}
                        className="input-field text-sm min-h-[80px] resize-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Start (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedCaption.start.toFixed(2)}
                            onChange={(e) => updateCaption(selectedCaption.id, { start: Number(e.target.value) })}
                            onBlur={() => pushHistory()}
                            className="input-field text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1">End (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedCaption.end.toFixed(2)}
                            onChange={(e) => updateCaption(selectedCaption.id, { end: Number(e.target.value) })}
                            onBlur={() => pushHistory()}
                            className="input-field text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSplitSelected} className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2" title="Split at current position">
                          <Scissors className="w-3 h-3" /> Split
                        </button>
                        <button onClick={handleDuplicateSelected} className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2">
                          <Copy className="w-3 h-3" /> Duplicate
                        </button>
                        <button onClick={handleMergeSelected} className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs py-2" title="Merge with next">
                          <Merge className="w-3 h-3" /> Merge
                        </button>
                        <button onClick={() => deleteCaption(selectedCaption.id)} className="px-3 py-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/30 italic">Select a caption to edit</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Captions</label>
                  <div className="space-y-1">
                    {captions.length === 0 && (
                      <p className="text-sm text-white/30 italic">No captions yet</p>
                    )}
                    {captions.map((caption) => (
                      <div
                        key={caption.id}
                        onClick={() => selectCaption(caption.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-all text-sm ${
                          selectedCaptionId === caption.id
                            ? "bg-brand-primary/20 border border-brand-primary/40"
                            : "bg-white/5 border border-transparent hover:border-white/10"
                        }`}
                      >
                        <div className="truncate">{caption.text}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {formatTime(caption.start)} - {formatTime(caption.end)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { addCaption(); pushHistory(); }} className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-xs py-2">
                    <Plus className="w-3 h-3" /> Add Caption
                  </button>

                  <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">AI Auto Caption</h4>
                    <div className="flex gap-2">
                      <select
                        value={autoCaptionLang}
                        onChange={(e) => setAutoCaptionLang(e.target.value)}
                        className="input-field text-xs flex-1"
                      >
                        <option value="en">English</option>
                        <option value="hinglish">Hinglish</option>
                        <option value="hi">Hindi</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="auto">Auto Detect</option>
                      </select>
                      <button
                        onClick={handleAutoCaption}
                        disabled={isAutoCaptioning || !videoFileName}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <Mic className="w-3 h-3" />
                        {isAutoCaptioning ? "Generating..." : "Auto Caption"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Import Captions</h4>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".srt,.vtt"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="caption-import"
                      />
                      <label
                        htmlFor="caption-import"
                        className="btn-secondary text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Import className="w-3 h-3" />
                        {importFile ? importFile.name : "Choose SRT/VTT"}
                      </label>
                      <button
                        onClick={handleImportCaptions}
                        disabled={!importFile || isImporting}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        {isImporting ? "Importing..." : "Import"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "style" && selectedStyle && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Typography</label>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Font Family</label>
                      <select
                        value={selectedStyle.fontFamily}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { fontFamily: e.target.value }); pushHistory(); }}
                        className="input-field text-sm"
                      >
                        <option value="Arial Black">Arial Black</option>
                        <option value="Inter">Inter</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Impact">Impact</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Poppins">Poppins</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Anton">Anton</option>
                        <option value="Bebas Neue">Bebas Neue</option>
                        <option value="Oswald">Oswald</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Size</label>
                        <input
                          type="number"
                          value={selectedStyle.fontSize}
                          onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { fontSize: Number(e.target.value) }); pushHistory(); }}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Weight</label>
                        <input
                          type="number"
                          min="100"
                          max="900"
                          step="100"
                          value={selectedStyle.fontWeight}
                          onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { fontWeight: Number(e.target.value) }); pushHistory(); }}
                          className="input-field text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Letter Spacing</label>
                        <input
                          type="number"
                          value={selectedStyle.letterSpacing}
                          onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { letterSpacing: Number(e.target.value) }); pushHistory(); }}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Line Height</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedStyle.lineHeight}
                          onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { lineHeight: Number(e.target.value) }); pushHistory(); }}
                          className="input-field text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Colors</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40 w-20">Text</label>
                      <input
                        type="color"
                        value={selectedStyle.textColor}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { textColor: e.target.value }); pushHistory(); }}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40 w-20">Active</label>
                      <input
                        type="color"
                        value={selectedStyle.activeWordColor}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { activeWordColor: e.target.value }); pushHistory(); }}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40 w-20">Background</label>
                      <input
                        type="color"
                        value={selectedStyle.backgroundColor}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { backgroundColor: e.target.value }); pushHistory(); }}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "effects" && selectedStyle && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Outline</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40 w-20">Color</label>
                      <input
                        type="color"
                        value={selectedStyle.outlineColor}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { outlineColor: e.target.value }); pushHistory(); }}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Width</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={selectedStyle.outlineWidth}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { outlineWidth: Number(e.target.value) }); pushHistory(); }}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Shadow</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40 w-20">Color</label>
                      <input
                        type="color"
                        value={selectedStyle.shadowColor}
                        onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { shadowColor: e.target.value }); pushHistory(); }}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Blur</label>
                        <input
                          type="number"
                          value={selectedStyle.shadowBlur}
                          onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { shadowBlur: Number(e.target.value) }); pushHistory(); }}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Offset Y</label>
                        <input
                          type="number"
                          value={selectedStyle.shadowOffsetY}
                          onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { shadowOffsetY: Number(e.target.value) }); pushHistory(); }}
                          className="input-field text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Animation</label>
                  <select
                    value={selectedStyle.animation}
                    onChange={(e) => { useEditorStore.getState().updateStyle(selectedStyleId, { animation: e.target.value as CaptionStyle["animation"] }); pushHistory(); }}
                    className="input-field text-sm"
                  >
                    <option value="pop">Pop</option>
                    <option value="fade">Fade</option>
                    <option value="bounce">Bounce</option>
                    <option value="slide">Slide</option>
                    <option value="zoom">Zoom</option>
                    <option value="word-highlight">Word Highlight</option>
                    <option value="typewriter">Typewriter</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Position</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["top", "center", "bottom"] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => { useEditorStore.getState().updateStyle(selectedStyleId, { position: pos }); pushHistory(); }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                          selectedStyle.position === pos
                            ? "bg-brand-primary/20 border border-brand-primary/40"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === "export" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Quality</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["social", "landscape", "square"] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => useEditorStore.getState().setExportSettings({ quality: q })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                          useEditorStore.getState().exportSettings.quality === q
                            ? "bg-brand-primary/20 border border-brand-primary/40"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["mp4", "webm"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => useEditorStore.getState().setExportSettings({ format: f })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all uppercase ${
                          useEditorStore.getState().exportSettings.format === f
                            ? "bg-brand-primary/20 border border-brand-primary/40"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowExport(true)} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Video
                </button>
                <button onClick={handleExportCaptions} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  Export Captions Only
                </button>
                {projectId && (
                  <button onClick={sendToYouTube} className="btn-secondary w-full flex items-center justify-center gap-2">
                    <Youtube className="w-4 h-4" /> Send to YouTube
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showExport && (
          <ExportModal onClose={() => setShowExport(false)} projectId={projectId} videoFileName={videoFileName} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearchReplace && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSearchReplace(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-brand-accent" />
                Search & Replace
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Search</label>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Text to find..."
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Replace</label>
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replacement text..."
                    className="input-field"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={searchCaseSensitive}
                    onChange={(e) => setSearchCaseSensitive(e.target.checked)}
                    className="rounded bg-white/10 border-white/20"
                  />
                  Case sensitive
                </label>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowSearchReplace(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handleSearchReplace}
                  disabled={isSearching || !searchText.trim()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSearching ? <span className="spinner" /> : <Replace className="w-4 h-4" />}
                  Replace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAutoSplit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAutoSplit(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Split className="w-5 h-5 text-brand-accent" />
                Auto-Split Captions
              </h2>
              <p className="text-sm text-white/60 mb-4">
                Split captions longer than the specified duration into smaller segments for better readability.
              </p>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">
                  Max Duration per Segment ({autoSplitMaxDur}s)
                </label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="0.5"
                  value={autoSplitMaxDur}
                  onChange={(e) => setAutoSplitMaxDur(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>3s</span>
                  <span>15s</span>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowAutoSplit(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handleAutoSplit}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Split className="w-4 h-4" />
                  Split Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExportModal({ onClose, projectId, videoFileName }: { onClose: () => void; projectId: string; videoFileName: string | null }) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { captions, selectedStyleId, styles, canvasSettings, exportSettings } = useEditorStore();
  const selectedStyle = styles.find((s) => s.id === selectedStyleId) || styles[0];

  const startExport = async () => {
    setExporting(true);
    setProgress(0);
    setError(null);
    try {
      const res = await fetch("/api/caption-studio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captions,
          style: selectedStyle,
          canvasSettings,
          exportSettings,
          videoFileName,
          project_id: projectId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Export failed");
      setProgress(100);
      setDone(true);
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel p-6 w-full max-w-md"
      >
        <h2 className="text-xl font-semibold mb-4">Export Video</h2>
        {!exporting && !done && !error && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              Export {captions.length} captions in {exportSettings.format.toUpperCase()} format at {canvasSettings.width}x{canvasSettings.height}.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={startExport} className="btn-primary flex-1">Start Export</button>
            </div>
          </div>
        )}
        {exporting && (
          <div className="space-y-3">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-primary to-brand-accent"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-white/60 text-center">Rendering captions... {Math.round(progress)}%</p>
          </div>
        )}
        {done && (
          <div className="space-y-3 text-center">
            <p className="text-brand-accent font-medium">Export complete!</p>
            <button onClick={onClose} className="btn-primary w-full">Close</button>
          </div>
        )}
        {error && (
          <div className="space-y-3">
            <p className="text-brand-primary text-sm">{error}</p>
            <button onClick={startExport} className="btn-primary w-full">Retry</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
