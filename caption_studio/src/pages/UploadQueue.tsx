import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Trash2,
  Redo,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Flag,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  Copy,
  Plus,
} from "lucide-react";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

interface UploadQueueItem {
  id: string;
  thumbnail: string;
  title: string;
  duration: string;
  status: "queued" | "preparing" | "uploading" | "processing" | "scheduled" | "published" | "failed" | "cancelled";
  progress: number;
  error?: string;
  scheduledAt?: string;
  youtubeUrl?: string;
}

interface UploadQueueState {
  items: UploadQueueItem[];
  isFetching: boolean;
  retryFailed: () => void;
}

const defaultItems: UploadQueueItem[] = [];

export default function UploadQueue() {
  const navigate = useNavigate();
  const { projects, selectedProject } = useStore();

  const [queue, setQueue] = useState<UploadQueueItem[]>(defaultItems);
  const [isLoading, setIsLoading] = useState(true);
  const [retryAll, setRetryAll] = useState(false);

  // Fetch upload queue from backend
  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/youtube/upload-queue"); // This endpoint would need to be added
      const data = await res.json();
      if (data.success) {
        setQueue(data.items || []);
      }
    } catch (e) {
      console.error("Failed to fetch queue:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Render status badge
  const statusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      queued: { bg: "white/10", text: "Queued" },
      preparing: { bg: "white/10", text: "Preparing" },
      uploading: { bg: "brand-primary/20", text: "Uploading" },
      processing: { bg: "white/10", text: "Processing" },
      scheduled: { bg: "brand-accent/20", text: "Scheduled" },
      published: { bg: "green-500/20", text: "Published" },
      failed: { bg: "red-500/20", text: "Failed" },
      cancelled: { bg: "white/10", text: "Cancelled" },
    };
    const badge = badges[status] || { bg: "white/10", text: status };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
          badge.bg
        }`}
      >
        {badge.text}
      </span>
    );
  };

  // Render progress bar
  const progressBar = (progress: number) => {
    return (
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-primary to-brand-accent rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  // Render error message
  const errorBadge = (error?: string) => {
    if (!error) return null;
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20"
      >
        <AlertCircle className="w-3 h-3 mr-1" /> {error}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-8 rounded-2xl text-center">
          <Loader2 className="w-12 h-12 text-brand-accent mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold mb-4">Upload Queue</h2>
          <p className="text-white/60">Loading upload queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <nav className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <button onClick={() => navigate("/youtube/dashboard")} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          ← Back
        </button>
        <h1 className="font-semibold">Upload Queue</h1>
      </nav>

      <main className="p-6">
        {/* Queue Summary */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Upload Queue</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-white/60">Total:</span>
              <span className="font-medium" id="total-queue-items">
                {queue.length}
              </span>
              <span className="text-white/50">|</span>
              <span className="font-medium" id="queue-status-pending">
                {queue.filter((i) => i.status !== "published").length} pending
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/60 uppercase tracking-wider">Queued</p>
              <p className="text-2xl font-medium" id="queued-count">
                {queue.filter((i) => i.status === "queued").length}
              </p>
            </div>
            <div>
              <p className="text-white/60 uppercase tracking-wired">Uploading</p>
              <p className="text-2xl font-medium" id="uploading-count">
                {queue.filter((i) => i.status === "uploading").length}
              </p>
            </div>
            <div>
              <p className="text-white/60 uppercase tracking-wired">Processing</p>
              <p className="text-2xl font-medium" id="processing-count">
                {queue.filter((i) => i.status === "processing").length}
              </p>
            </div>
            <div>
              <p className="text-white/60 uppercase tracking-wired">Published</p>
              <p className="text-2xl font-medium" id="published-count">
                {queue.filter((i) => i.status === "published").length}
              </p>
            </div>
          </div>
        </div>

        {/* Upload Queue Items */}
        {queue.length === 0 && !isLoading && (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <Play className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/50 mb-4">Your upload queue is empty</p>
            <button
              onClick={() => navigate("/editor")}
              className="btn-primary px-6 py-3 rounded-xl"
            >
              Upload Video
            </button>
          </div>
        )}

        {queue.length > 0 && (
          <div className="space-y-4">
            {queue.map((item) => (
              <motion.div
                key={item.id}
                className="glass-panel rounded-xl p-5 border-white/10 transition-all duration-300"
                whileHover={{ boxShadow: "0 4px 20px rgba(124, 58, 237, 0.2)" }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={item.thumbnail || "/placeholder-thumbnail.svg"}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{item.title}</h3>
                    <p className="text-xs text-white/50 truncate">{item.duration}</p>
                  </div>

                  {/* Status & Controls */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/60">{item.status}:</span>
                    {item.status === "uploading" || item.status === "processing" ? (
                      <span>{progressBar(item.progress)}</span>
                    ) : null}
                    {statusBadge(item.status)}
                  </div>

                  {/* Progress text */}
                  {item.progress > 0 && item.progress < 100 && (
                    <p className="text-xs text-white/50 mt-1">
                      {item.progress}%
                    </p>
                  )}

                  {/* Error message */}
                  {errorBadge(item.error)}

                  {/* Controls */}
                  <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                    {item.status === "failed" && (
                      <button
                        onClick={() => {
                          // Trigger retry
                          console.log(`Retry: ${item.id}`);
                        }}
                        className="btn-secondary text-xs py-1"
                        title="Retry"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    )}

                    {item.status === "failed" && (
                      <button
                        onClick={() => {
                          // Cancel
                          console.log(`Cancel: ${item.id}`);
                        }}
                        className="btn-secondary text-xs py-1"
                        title="Cancel"
                      >
                        <XCircle className="w-3 h-3" /> Cancel
                      </button>
                    )}

                    {item.status === "queued" && (
                      <button
                        onClick={() => {
                          // Start upload
                          console.log(`Start: ${item.id}`);
                        }}
                        className="btn-primary text-xs py-1"
                        title="Start Upload"
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}

                    {item.status === "scheduled" && (
                      <button
                        onClick={() => {
                          // Cancel schedule
                          console.log(`Cancel schedule: ${item.id}`);
                        }}
                        className="btn-secondary text-xs py-1"
                        title="Cancel Schedule"
                      >
                        <Clock className="w-3 h-3" /> Cancel
                      </button>
                    )}

                    {item.youtubeUrl && (
                      <button
                        onClick={() => navigator.clipboard.writeText(item.youtubeUrl!)}
                        className="btn-secondary text-xs py-1"
                        title="Copy URL"
                      >
                        <Copy className="w-3 h-3" /> Link
                      </button>
                    )}

                    {item.status === "published" && (
                      <button
                        onClick={() => window.open(item.youtubeUrl, "_blank")}
                        className="btn-secondary text-xs py-1"
                        title="Open on YouTube"
                      >
                        <ExternalLink className="w-3 h-3" /> Open
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Bulk actions */}
        <div className="glass-panel mt-6 rounded-xl p-6 border-white/10">
          <h3 className="text-semibold mb-4">Bulk Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              className="glass-panel p-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
            >
              <Plus className="w-4 h-4 text-brand-accent" /> Add to Queue
            </button>
            <button
              className="glass-panel p-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
            >
              <Loader2 className="w-4 h-4 text-brand-accent" /> Retry All
            </button>
            <button
              className="glass-panel p-3 rounded-lg border border-red-500/20 border-red-500/20 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" /> Clear Queue
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}