export type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

export type CaptionSegment = {
  id: string;
  text: string;
  start: number;
  end: number;
  words?: CaptionWord[];
};

export type CaptionStyle = {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textColor: string;
  activeWordColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  position: "top" | "center" | "bottom";
  x: number;
  y: number;
  maxWidth: number;
  padding: number;
  animation: "pop" | "fade" | "bounce" | "slide" | "zoom" | "word-highlight" | "typewriter" | "glow" | "none" | "float" | "glitch" | "wave" | "neon-flicker" | "retro";
  animationSpeed: number;
  maxLines: number;
};

export type ProjectState = {
  id: string;
  name: string;
  videoFileName: string | null;
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  captions: CaptionSegment[];
  selectedCaptionId: string | null;
  timelineZoom: number;
  selectedStyleId: string;
  styles: CaptionStyle[];
  canvasSettings: {
    aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
    width: number;
    height: number;
  };
  exportSettings: {
    quality: "social" | "landscape" | "square";
    format: "mp4" | "webm";
  };
  history: { captions: CaptionSegment[] }[];
  historyIndex: number;
  autosaveStatus: "saved" | "saving" | "unsaved";
};

export type DragState = {
  type: "move" | "resize-start" | "resize-end" | null;
  captionId: string | null;
  startX: number;
  originalStart: number;
  originalEnd: number;
};
