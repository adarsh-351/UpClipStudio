import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Image,
  ExternalLink,
  Copy,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

interface VideoHistoryItem {
  id: string;
  youtubeVideoId: string;
  title: string;
  description?: string;
  thumbnail: string;
  visibility: "public" | "private" | "unlisted" | "scheduled";
  publishedAt: number;
  viewCount: number;
  likeCount: number;
  watchTimeSeconds: number;
  status: "published" | "scheduled" | "failed";
  youtubeUrl?: string;
}

interface HistoryFilters {
  status: "all" | "published" | "scheduled" | "failed" | "private" | "unlisted";
  search: string;
}

const DEFAULT_FILTERS: HistoryFilters = {
  status: "all",
  search: "",
};

export default function History() {
  const navigate = useNavigate();
  const { projects, selectedProject } = useStore();

  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch history from backend
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/youtube/history"); // This endpoint would need to be added
      const data = await res.json();
      if (data.success) {
        setVideos(data.history || []);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value } = target;
    const checked = (target as HTMLInputElement).checked;
    if (name === "status") {
      setFilters({ ...filters, status: (checked ? value : "all") as HistoryFilters["status"] });
    } else if (name === "search") {
      setFilters({ ...filters, search: value });
    }
  };

  const filteredVideos = videos.filter((video) => {
    // Filter by status
    if (filters.status !== "all") {
      const statusMap: Record<string, string> = {
        published: "published",
        scheduled: "scheduled",
        failed: "failed",
        private: "private",
        unlisted: "unlisted",
      };
      if (video.status !== statusMap[filters.status]) return false;
    }

    // Filter by search
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      return video.title.toLowerCase().includes(searchLower);
    }

    return true;
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this from history?")) return;
    setDeleteId(id);
    try {
      await fetch("/youtube/history/" + id, { method: "DELETE" });
      setDeleteId(null);
      fetchHistory();
    } catch (e) {
      console.error("Failed to delete from history:", e);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-8 rounded-2xl text-center">
          <Loader2 className="w-12 h-12 text-brand-accent mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold mb-4">Video History</h2>
          <p className="text-white/60">Loading video history...</p>
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
        <h1 className="font-semibold">Video History</h1>
      </nav>

      <main className="p-6">
        {/* Filters */}
        <div className="glass-panel rounded-2xl p-4 mb-6 border-white/10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white/50 mb-1">Status</label>
              <div className="flex gap-2">
                <label
                  className={`flex items-center gap-2 rounded-bg px-3 py-1.5 text-sm cursor-pointer ${
                    filters.status === "all"
                      ? "bg-brand-primary/20 border border-brand-primary/40"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                  onClick={() => setFilters({ ...filters, status: "all" })}
                >
                  <CheckCircle className="w-3 h-3 text-brand-accent" />
                  <span>All</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-bg px-3 py-1.5 text-sm cursor-pointer ${
                    filters.status === "published"
                      ? "bg-green-500/20 border border-green-500/20"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                  onClick={() => setFilters({ ...filters, status: "published" })}
                >
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span>Published</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-bg px-3 py-1.5 text-sm cursor-pointer ${
                    filters.status === "scheduled"
                      ? "bg-brand-accent/20 border border-brand-accent/40"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                  onClick={() => setFilters({ ...filters, status: "scheduled" })}
                >
                  <Clock className="w-3 h-3 text-brand-accent" />
                  <span>Scheduled</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-bg px-3 py-1.5 text-sm cursor-pointer ${
                    filters.status === "failed"
                      ? "bg-red-500/20 border border-red-500/20"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                  onClick={() => setFilters({ ...filters, status: "failed" })}
                >
                  <XCircle className="w-3 h-3 text-red-400" />
                  <span>Failed</span>
                </label>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-white/50 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={handleFilterChange}
                  className="input-field pl-8 w-full"
                  placeholder="Search by title..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Videos List */}
        {isLoading ? (
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="glass-panel p-8 rounded-2xl text-center">
              <Loader2 className="w-12 h-12 text-brand-accent mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold mb-4">Video History</h2>
              <p className="text-white/60">Loading video history...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <Search className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/50 mb-4">No videos in history yet</p>
            <p className="text-white/50 text-sm">
              Videos will appear here after successful uploads.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVideos.map((video) => (
              <motion.div
                key={video.id}
                className="glass-panel rounded-xl p-5 border-white/10 flex items-start gap-4 hover:border-white/20 transition-all duration-300"
                whileHover={{ boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
              >
                <div className="w-16 h-10 rounded-lg flex-shrink-0">
                  <img
                    src={video.thumbnail || "/placeholder-thumbnail.svg"}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{video.title}</h3>
                  <p className="text-xs text-white/50 truncate">
                    {new Date(video.publishedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex-1 text-right text-sm">
                  <div className="text-white/60">{video.viewCount} views</div>
                  <div className="text-white/60">{video.likeCount} likes</div>
                  <div className="text-white/60">{Math.round(video.watchTimeSeconds / 60)} min watch</div>
                </div>

                <div className="flex items-center gap-2 text-xs mt-3">
                  <span className={`text-white/60 capitalize ${video.visibility}`}>
                    {video.visibility}
                  </span>
                  <span className="text-white/50">
                    {new Date(video.publishedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  {video.youtubeUrl && (
                    <button
                      onClick={() => navigator.clipboard.writeText(video.youtubeUrl!)}
                      className="btn-secondary text-xs py-0.5 px-2"
                      title="Copy URL"
                    >
                      <Copy className="w-3 h-3" /> Link
                    </button>
                  )}

                  <button
                    onClick={() => window.open(video.youtubeUrl!, "_blank")}
                    className="btn-secondary text-xs py-0.5 px-2"
                    title="Open on YouTube"
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </button>

                  {video.status === "failed" && (
                    <button
                      onClick={() => setDeleteId(video.id)}
                      className="btn-secondary text-xs py-0.5 px-2 text-red-400"
                      title="Remove from history"
                    >
                      <XCircle className="w-3 h-3" /> Remove
                    </button>
                  )}

                  {video.status !== "failed" && (
                    <button
                      onClick={() => window.open(video.youtubeUrl!, "_blank")}
                      className="btn-secondary text-xs py-0.5 px-2"
                      title="View on YouTube"
                    >
                      <ExternalLink className="w-3 h-3" /> View
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* No results message */}
        {filteredVideos.length === 0 && filteredVideos.length > 0 && (
          <p className="text-white/50 text-center py-8">No videos match your filters</p>
        )}
      </main>
    </div>
  );
}