import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Play, Sparkles, Film, ArrowRight } from "lucide-react";

export default function Landing() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const project_id = searchParams.get("project_id") || "";
  const src = searchParams.get("src") || "";

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      if (project_id) formData.append("project_id", project_id);
      const res = await fetch("/api/upload/video", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");
      navigate("/editor", { state: { video: data, project_id: data.project_id || project_id, src } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [navigate, project_id, src]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      handleFile(file);
    } else {
      setError("Please drop a valid video file.");
    }
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const loadDemo = useCallback(async () => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/caption-studio/demo", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Demo failed");
      navigate("/editor", { state: { video: data, project_id, src, demo: true } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Demo failed");
    } finally {
      setUploading(false);
    }
  }, [navigate, project_id, src]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-bg text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-accent/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-brand-pink/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <Sparkles className="w-4 h-4 text-brand-accent" />
            <span className="text-sm text-white/70">AI-Powered Caption Editor</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/60">
            Caption Studio
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
            Make every word pop. Turn your videos into engaging short-form content with beautiful animated captions.
          </p>
          {src && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20">
              <Film className="w-4 h-4 text-brand-primary" />
              <span className="text-sm text-white/70">Clip: {src}</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-2xl"
        >
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => document.getElementById("file-input")?.click()}
            className={`relative cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 ${
              isDragging
                ? "border-brand-primary bg-brand-primary/10 scale-[1.02]"
                : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
            }`}
          >
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${isDragging ? "bg-brand-primary/20" : "bg-white/5"}`}>
                <Upload className={`w-10 h-10 ${isDragging ? "text-brand-primary" : "text-white/60"}`} />
              </div>
              <p className="text-xl font-semibold mb-2">
                {uploading ? "Uploading..." : isDragging ? "Drop your video here" : "Upload Video"}
              </p>
              <p className="text-sm text-white/40 mb-6">MP4, WebM, MOV supported</p>
              <input
                id="file-input"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={onFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); loadDemo(); }}
                className="btn-secondary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Try Demo Video
              </button>
            </div>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-red-400 text-sm">
              {error}
            </motion.p>
          )}

          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: Film, label: "Upload Video" },
              { icon: Sparkles, label: "Auto Captions" },
              { icon: Upload, label: "Export" },
            ].map((feature, i) => (
              <div key={i} className="glass-panel p-4 flex flex-col items-center gap-2">
                <feature.icon className="w-6 h-6 text-brand-accent" />
                <span className="text-xs text-white/60">{feature.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
