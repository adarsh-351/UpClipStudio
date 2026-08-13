import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { CaptionSegment, CaptionStyle, ProjectState, DragState } from "../types";

const DEFAULT_STYLE: CaptionStyle = {
  id: "tiktok-pop",
  name: "TikTok Pop",
  fontFamily: "Arial Black",
  fontWeight: 800,
  fontSize: 42,
  letterSpacing: 0,
  lineHeight: 1.2,
  textColor: "#ffffff",
  activeWordColor: "#fbbf24",
  backgroundColor: "#000000",
  backgroundOpacity: 0.0,
  outlineColor: "#000000",
  outlineWidth: 3,
  shadowColor: "#000000",
  shadowBlur: 4,
  shadowOffsetY: 2,
  position: "bottom",
  x: 0,
  y: 0,
  maxWidth: 800,
  padding: 12,
  animation: "pop",
  animationSpeed: 1,
  maxLines: 2,
};

const PRESET_STYLES: CaptionStyle[] = [
  DEFAULT_STYLE,
  {
    id: "karaoke",
    name: "Karaoke",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 1.2,
    textColor: "#ffffff",
    activeWordColor: "#fbbf24",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 3,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetY: 2,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "word-highlight",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "neon",
    name: "Neon",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 42,
    letterSpacing: 2,
    lineHeight: 1.2,
    textColor: "#00ffcc",
    activeWordColor: "#ff00ff",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#00ffcc",
    outlineWidth: 2,
    shadowColor: "#00ffcc",
    shadowBlur: 20,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "glow",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "minimal",
    name: "Minimal",
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 32,
    letterSpacing: 1,
    lineHeight: 1.4,
    textColor: "#ffffff",
    activeWordColor: "#ffffff",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 0,
    shadowColor: "#000000",
    shadowBlur: 0,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 8,
    animation: "fade",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "typewriter",
    name: "Typewriter",
    fontFamily: "Courier New",
    fontWeight: 700,
    fontSize: 40,
    letterSpacing: 2,
    lineHeight: 1.2,
    textColor: "#fbbf24",
    activeWordColor: "#fbbf24",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 2,
    shadowColor: "#000000",
    shadowBlur: 0,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "typewriter",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "bounce",
    name: "Bounce",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 44,
    letterSpacing: 0,
    lineHeight: 1.2,
    textColor: "#ffffff",
    activeWordColor: "#f472b6",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 3,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetY: 2,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "bounce",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "pop",
    name: "Pop",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 44,
    letterSpacing: 0,
    lineHeight: 1.2,
    textColor: "#ffffff",
    activeWordColor: "#fbbf24",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 3,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetY: 2,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "pop",
    animationSpeed: 1.2,
    maxLines: 2,
  },
  {
    id: "highlight-box",
    name: "Highlight Box",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 1.2,
    textColor: "#ffffff",
    activeWordColor: "#000000",
    backgroundColor: "#fbbf24",
    backgroundOpacity: 1.0,
    outlineColor: "#fbbf24",
    outlineWidth: 0,
    shadowColor: "#fbbf24",
    shadowBlur: 12,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 10,
    animation: "word-highlight",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "dynamic",
    name: "Dynamic",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 1.2,
    textColor: "#ffffff",
    activeWordColor: "#06b6d4",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 3,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetY: 2,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "slide",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "glitch",
    name: "Glitch",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 44,
    letterSpacing: 1,
    lineHeight: 1.2,
    textColor: "#ff0055",
    activeWordColor: "#00ffff",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#ff0055",
    outlineWidth: 2,
    shadowColor: "#00ffff",
    shadowBlur: 12,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "glitch",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "wave",
    name: "Wave",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 1.3,
    textColor: "#ffffff",
    activeWordColor: "#f472b6",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#000000",
    outlineWidth: 3,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetY: 2,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "wave",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "neon-flicker",
    name: "Neon Flicker",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 44,
    letterSpacing: 2,
    lineHeight: 1.2,
    textColor: "#ff00ff",
    activeWordColor: "#00ffcc",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#ff00ff",
    outlineWidth: 2,
    shadowColor: "#ff00ff",
    shadowBlur: 20,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "neon-flicker",
    animationSpeed: 1,
    maxLines: 2,
  },
  {
    id: "retro",
    name: "Retro Wave",
    fontFamily: "Arial Black",
    fontWeight: 800,
    fontSize: 42,
    letterSpacing: 1,
    lineHeight: 1.2,
    textColor: "#ffcc00",
    activeWordColor: "#ff66cc",
    backgroundColor: "#000000",
    backgroundOpacity: 0.0,
    outlineColor: "#ffcc00",
    outlineWidth: 2,
    shadowColor: "#ff00ff",
    shadowBlur: 8,
    shadowOffsetY: 0,
    position: "bottom",
    x: 0,
    y: 0,
    maxWidth: 800,
    padding: 12,
    animation: "float",
    animationSpeed: 1,
    maxLines: 2,
  },
];

const getInitialState = (inheritedStyle?: CaptionStyle | null): ProjectState => {
  const initialId = inheritedStyle ? `inherited-${inheritedStyle.id}` : DEFAULT_STYLE.id;
  return {
    id: uuidv4(),
    name: "Untitled Project",
    videoFileName: null,
    videoUrl: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    captions: [],
    selectedCaptionId: null,
    timelineZoom: 1,
    selectedStyleId: initialId,
    styles: inheritedStyle ? [inheritedStyle, ...PRESET_STYLES.filter(s => s.id !== inheritedStyle.id)] : PRESET_STYLES,
    canvasSettings: {
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
    },
    exportSettings: {
      quality: "social",
      format: "mp4",
    },
    history: [],
    historyIndex: -1,
    autosaveStatus: "saved",
  };
};

export type EditorStore = ProjectState & {
  setVideo: (fileName: string, url: string, duration: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  addCaption: (caption?: CaptionSegment) => void;
  updateCaption: (id: string, updates: Partial<CaptionSegment>) => void;
  deleteCaption: (id: string) => void;
  duplicateCaption: (id: string) => void;
  splitCaption: (id: string, time: number) => void;
  mergeCaptions: (id1: string, id2: string) => void;
  selectCaption: (id: string | null) => void;
  setTimelineZoom: (zoom: number) => void;
  setSelectedStyle: (styleId: string) => void;
  updateStyle: (styleId: string, updates: Partial<CaptionStyle>) => void;
  addStyle: (style: CaptionStyle) => void;
  deleteStyle: (styleId: string) => void;
  setCanvasSettings: (settings: Partial<ProjectState["canvasSettings"]>) => void;
  setExportSettings: (settings: Partial<ProjectState["exportSettings"]>) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setAutosaveStatus: (status: ProjectState["autosaveStatus"]) => void;
  loadProject: (state: Partial<ProjectState>) => void;
  reset: () => void;
  applyInheritedStyle: (style: CaptionStyle | null) => void;
  setProjectId: (projectId: string) => void;
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...getInitialState(),

  setVideo: (fileName, url, duration) =>
    set({
      videoFileName: fileName,
      videoUrl: url,
      duration,
      currentTime: 0,
      isPlaying: false,
    }),

  setCurrentTime: (currentTime) => set({ currentTime }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  addCaption: (caption) =>
    set((state) => {
      const newCaption: CaptionSegment = caption || {
        id: uuidv4(),
        text: "New caption",
        start: state.currentTime,
        end: Math.min(state.currentTime + 3, state.duration || state.currentTime + 3),
      };
      return { captions: [...state.captions, newCaption].sort((a, b) => a.start - b.start) };
    }),

  updateCaption: (id, updates) =>
    set((state) => ({
      captions: state.captions.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ).sort((a, b) => a.start - b.start),
    })),

  deleteCaption: (id) =>
    set((state) => ({
      captions: state.captions.filter((c) => c.id !== id),
      selectedCaptionId: state.selectedCaptionId === id ? null : state.selectedCaptionId,
    })),

  duplicateCaption: (id) =>
    set((state) => {
      const caption = state.captions.find((c) => c.id === id);
      if (!caption) return state;
      const newCaption: CaptionSegment = {
        ...caption,
        id: uuidv4(),
        start: caption.end,
        end: Math.min(caption.end + (caption.end - caption.start), state.duration || caption.end + 3),
      };
      return { captions: [...state.captions, newCaption].sort((a, b) => a.start - b.start) };
    }),

  splitCaption: (id, time) =>
    set((state) => {
      const caption = state.captions.find((c) => c.id === id);
      if (!caption || time <= caption.start || time >= caption.end) return state;
      const first: CaptionSegment = { ...caption, end: time };
      const second: CaptionSegment = {
        id: uuidv4(),
        text: caption.text,
        start: time,
        end: caption.end,
        words: caption.words,
      };
      return { captions: state.captions.map((c) => c.id === id ? first : c).concat(second).sort((a, b) => a.start - b.start) };
    }),

  mergeCaptions: (id1, id2) =>
    set((state) => {
      const c1 = state.captions.find((c) => c.id === id1);
      const c2 = state.captions.find((c) => c.id === id2);
      if (!c1 || !c2) return state;
      const merged: CaptionSegment = {
        id: uuidv4(),
        text: `${c1.text} ${c2.text}`,
        start: Math.min(c1.start, c2.start),
        end: Math.max(c1.end, c2.end),
      };
      return { captions: state.captions.filter((c) => c.id !== id1 && c.id !== id2).concat(merged).sort((a, b) => a.start - b.start) };
    }),

  selectCaption: (selectedCaptionId) => set({ selectedCaptionId }),

  setTimelineZoom: (timelineZoom) => set({ timelineZoom }),

  setSelectedStyle: (selectedStyleId) => set({ selectedStyleId }),

  updateStyle: (styleId, updates) =>
    set((state) => ({
      styles: state.styles.map((s) => (s.id === styleId ? { ...s, ...updates } : s)),
    })),

  addStyle: (style) =>
    set((state) => ({
      styles: [...state.styles, style],
      selectedStyleId: style.id,
    })),

  deleteStyle: (styleId) =>
    set((state) => {
      if (state.styles.length <= 1) return state;
      const newStyles = state.styles.filter((s) => s.id !== styleId);
      return {
        styles: newStyles,
        selectedStyleId: state.selectedStyleId === styleId ? newStyles[0].id : state.selectedStyleId,
      };
    }),

  setCanvasSettings: (canvasSettings) =>
    set((state) => ({ canvasSettings: { ...state.canvasSettings, ...canvasSettings } })),

  setExportSettings: (exportSettings) =>
    set((state) => ({ exportSettings: { ...state.exportSettings, ...exportSettings } })),

  pushHistory: () =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ captions: JSON.parse(JSON.stringify(state.captions)) });
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        captions: JSON.parse(JSON.stringify(state.history[newIndex].captions)),
        historyIndex: newIndex,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        captions: JSON.parse(JSON.stringify(state.history[newIndex].captions)),
        historyIndex: newIndex,
      };
    }),

  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),

  loadProject: (projectState) =>
    set((state) => ({
      ...state,
      ...projectState,
      captions: projectState.captions || state.captions,
      styles: projectState.styles || state.styles,
    })),

  reset: () => set(getInitialState()),

  applyInheritedStyle: (inheritedStyle) => {
    if (!inheritedStyle) return;
    set((state) => {
      const exists = state.styles.find((s) => s.id === inheritedStyle.id);
      if (exists) {
        return {
          styles: state.styles.map((s) => s.id === inheritedStyle.id ? { ...s, ...inheritedStyle } : s),
          selectedStyleId: inheritedStyle.id,
        };
      }
      return {
        styles: [inheritedStyle, ...state.styles],
        selectedStyleId: inheritedStyle.id,
      };
    });
  },

  setProjectId: (projectId) => set({ id: projectId }),
}));
