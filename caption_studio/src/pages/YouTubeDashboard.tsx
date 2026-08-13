import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Upload,
  Film,
  Play,
  Sparkles,
  Users,
  CheckCircle,
  Clock,
  Flag,
  AlertCircle,
  LogOut,
  ExternalLink,
  Copy,
  LogIn,
  Save,
  Plus,
  ArrowUp,
  Calendar,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useStore } from "../store";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

export default function YouTubeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState<{ name: string; avatar: string; id: string } | null>(null);
  const [quickActions, setQuickActions] = useState<{ label: string; icon: string; action: () => void }[]>([]);
  const { projects, selectedProject } = useStore();

  // Check YouTube connection on mount
  useEffect(() => {
    checkYouTubeConnection();
  }, []);

  const checkYouTubeConnection = async () => {
    try {
      const res = await fetch("/youtube/status");
      const data = await res.json();
      setConnected(data.connected || false);
      if (data.channel_name) {
        setChannel({
          name: data.channel_name,
          avatar: data.channel_avatar,
          id: data.channel_id,
        });
      }
    } catch (e) {
      console.error("YouTube connection check failed:", e);
    }
  };

  const handleConnect = () => {
    navigate("/youtube/connect");
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/youtube/disconnect", { method: "POST" });
      setConnected(false);
      setChannel(null);
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

  // Quick actions data
  const actions = [
    { label: "Upload Video", icon: Upload, href: "/youtube/upload-queue", variant: "primary" },
    { label: "Create from Clip", icon: Film, href: "/editor", variant: "secondary" },
    { label: "Schedule", icon: Clock, href: "/youtube/scheduler", variant: "secondary" },
    { label: "Templates", icon: Settings, href: "/youtube/settings", variant: "secondary" },
    { label: "Queue", icon: Sparkles, href: "/youtube/upload-queue", variant: "secondary" },
    { label: "History", icon: Users, href: "/youtube/history", variant: "secondary" },
    { label: "Connect YouTube", icon: LogIn, href: "/youtube/connect", variant: "primary" },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <div className="relative overflow-hidden">
        {/* Gradient background blob */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/30 rounded-full blur-3xl animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-accent/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-brand-pink/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
        </div>
      </div>

      <div className="min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {connected ? (
              <div className="flex items-center gap-3">
                <img
                  src={channel?.avatar || "/placeholder-channel.svg"}
                  alt={channel?.name || "YouTube Channel"}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="font-medium text-lg">{channel?.name || "Connected Channel"}</span>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="btn-secondary px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <LogIn className="w-4 h-4 mr-2" /> Connect YouTube
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Save className="w-3 h-3" /> Saved
            </span>
            <button onClick={() => navigate("/settings")} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Settings">
              <Settings className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* Channel Status Card */}
          <div className="glass-panel rounded-2xl p-6 mb-6 border-white/10">
            <div className="flex items-center gap-3 mb-4">
              {connected ? (
                <div className="p-3 rounded-xl bg-brand-primary/10 border border-brand-primary/40">
                  <span className="text-xl">✓</span>
                  <span className="text-sm text-white/60">YouTube Connected</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xl">✗</span>
                  <span className="text-sm text-white/40">Disconnected</span>
                </div>
              )}
            </div>

            {connected && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={channel?.avatar || "/placeholder-avatar.svg"}
                    alt={channel?.name || "Channel"}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="font-medium">{channel?.name || "Unknown Channel"}</p>
                    <p className="text-xs text-white/40">Channel ID: {channel?.id || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-white/60 uppercase tracking-wider">Subscribers</p>
                    <p className="text-xl font-medium">--</p>
                  </div>
                  <div>
                    <p className="text-white/60 uppercase tracking-wider">Videos</p>
                    <p className="text-xl font-medium">--</p>
                  </div>
                </div>

                <p className="text-xs text-white/50">
                  Total uploaded videos, scheduled, and processing
                </p>
              </div>
            )}

            {!connected && (
              <p className="text-sm text-white/50 mt-2">
                Connect your YouTube channel to start publishing.
              </p>
            )}
          </div>

          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Uploads Today card */}
            <div className="glass-panelp-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wired">Uploads Today</p>
                  <p className="text-2xl font-bold" id="uploads-today">0</p>
                </div>
                <ArrowUp className="w-6 h-6 text-brand-accent" />
              </div>
            </div>

            {/* Scheduled card */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wired">Scheduled</p>
                  <p className="text-2xl font-bold" id="scheduled-videos">0</p>
                </div>
                <Calendar className="w-6 h-6 text-brand-accent" />
              </div>
            </div>

            {/* Processing card */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wired">Processing</p>
                  <p className="text-2xl font-bold" id="processing-videos">0</p>
                </div>
                <RefreshCw className="w-6 h-6 text-brand-accent" />
              </div>
            </div>

            {/* Failed card */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wired">Failed</p>
                  <p className="text-2xl font-bold" id="failed-uploads">0</p>
                </div>
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>

            {/* Published card */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wired">Published</p>
                  <p className="text-2xl font-bold" id="published-videos">0</p>
                </div>
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Upload Queue Summary */}
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <h3 className="text-semibold mb-4">Upload Queue</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Items in queue</span>
                <span className="font-medium" id="queue-count">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Processing now</span>
                <span className="font-medium" id="processing-now">0</span>
              </div>
            </div>
          </div>

          {/* Recent Videos */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-semibold mb-4">Recent Videos</h3>
            <div className="space-y-3 text-sm" id="recent-videos">
              {connected ? (
                <p className="text-white/50 italic">Loading recent videos...</p>
              ) : (
                <p className="text-white/50 italic">Connect YouTube to view recent videos</p>
              )}
            </div>
          </div>

          {/* Upcoming Scheduled Videos */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-semibold mb-4">Upcoming Scheduled</h3>
            <div className="space-y-3 text-sm" id="upcoming-scheduled">
              {connected ? (
                <p className="text-white/50 italic">Loading scheduled videos...</p>
              ) : (
                <p className="text-white/50 italic">Connect YouTube to view scheduled videos</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {connected && (
            <div className="glass-panel rounded-2xl p-6 mt-6">
              <h3 className="text-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {actions.map((action) => (
                  <motion.a
                    key={action.label}
                    href={action.href}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`glass-panel p-4 flex flex-col items-center gap-2 text-sm ${
                      action.variant === "primary"
                        ? "border border-brand-primary/40 hover:bg-brand-primary/10"
                        : "border border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <action.icon className="w-5 h-5 text-brand-accent mb-1" />
                    <span className="text-white/70 truncate">{action.label}</span>
                  </motion.a>
                ))}
              </div>
            </div>
          )}

          {!connected && (
            <div className="glass-panel rounded-2xl p-6 mt-6 text-center">
              <ConnectYouTubeCompact />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Compact connect component for empty state
function ConnectYouTubeCompact() {
  return (
    <div className="p-8">
      <Upload className="w-16 h-16 text-brand-accent mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">Connect your YouTube channel</h3>
      <p className="text-white/50 mb-6">Start publishing to YouTube directly from Clip Cutter.</p>
      <button
        onClick={() => window.location.href = "/youtube/connect"}
        className="btn-primary px-6 py-3 rounded-xl"
      >
        <LogIn className="w-4 h-4 mr-2" /> Connect YouTube
      </button>
    </div>
  );
}