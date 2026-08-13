import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { motion } from "framer-motion";
import {
  LogIn,
  LogOut,
  CheckCircle,
  XCircle,
  RefreshCw,
  Image,
  Folder,
  Upload,
  Settings,
  AlertCircle,
  Shield,
  Loader2,
} from "lucide-react";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

export default function ConnectYouTube() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"idle" | "oauth" | "callback" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: string;
    scope: string;
    id_token: any;
  } | null>(null);
  const [channel, setChannel] = useState<{
    id: string;
    name: string;
    avatar: string;
  } | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const { user } = useStore();

  useEffect(() => {
    // Check existing connection
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch("/youtube/status");
      const data = await res.json();
      if (data.connected) {
        setStep("success");
        setChannel({
          id: data.channel_id || "",
          name: data.channel_name || "Your Channel",
          avatar: data.channel_avatar || "/placeholder-avatar.svg",
        });
      } else {
        setStep("idle");
      }
    } catch (e) {
      setStep("idle");
    }
  };

  // Initiate OAuth
  const handleConnect = () => {
    setStep("oauth");
    // Generate OAuth URL on the backend
    // The backend will redirect to Google OAuth
    window.location.href = "/youtube/connect";
  };

  // Handle callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (code && state) {
      setStep("callback");
      fetch("/youtube/callback", {
        method: "GET",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setChannel({
              id: data.channel_id,
              name: data.channel_name,
              avatar: data.channel_avatar,
            });
            setStep("success");
            // Navigate away and refresh to check status
            setTimeout(() => {
              checkConnection();
            }, 500);
          } else {
            setStep("error");
            setError(data.error || "OAuth failed");
          }
        })
        .catch(() => {
          setStep("error");
          setError("OAuth callback failed");
        });
    }
  }, []);

  const handleDisconnect = async () => {
    try {
      await fetch("/youtube/disconnect", { method: "POST" });
      setChannel(null);
      setStep("idle");
      setShowDisconnect(false);
      checkConnection();
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

  // OAuth instructions
  if (step === "idle") {
    return (
      <div className="min-h-screen bg-brand-bg text-white p-6">
        <div className="max-w-2xl mx-auto py-12">
          <div className="glass-panel p-8 rounded-2xl text-center border-white/10 mb-8">
            <Shield className="w-14 h-14 text-brand-accent mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Connect YouTube Channel</h2>
            <p className="text-white/60 mb-8">
              Sign in with your Google account to publish videos to YouTube.
            </p>
            <button
              onClick={handleConnect}
              className="btn-primary px-8 py-3 rounded-xl text-lg"
            >
              <LogIn className="w-5 h-5 mr-2" /> Connect YouTube
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="glass-panel p-6 rounded-xl border-white/10">
              <h4 className="text-semibold mb-3">What we'll access</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li>Upload videos to your channel</li>
                <li>Manage video metadata (title, description, tags)</li>
                <li>Create and manage playlists</li>
                <li>Schedule videos for future publishing</li>
              </ul>
            </div>
            <div className="glass-panel p-6 rounded-xl border-white/10">
              <h4 className="text-semibold mb-3">What we won't access</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li>Your passwords</li>
                <li>Private videos outside this session</li>
                <li>Your Google account data beyond YouTube</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OAuth callback page - Google redirects here
  if (step === "oauth") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="glass-panel p-8 rounded-2xl text-center max-w-md">
          <Loader2 className="w-12 h-12 text-brand-accent mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold mb-4">Connecting to YouTube...</h2>
          <p className="text-white/60">
            You are being redirected to Google's OAuth page. Please complete the authorization.
          </p>
        </div>
      </div>
    );
  }

  // Callback handling page
  if (step === "callback") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="glass-panel p-8 rounded-2xl text-center max-w-md">
          <Loader2 className="w-12 h-12 text-brand-accent mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold mb-4">Handling Callback</h2>
          <p className="text-white/60">
            Processing OAuth callback from Google. This may take a moment.
          </p>
        </div>
      </div>
    );
  }

  // Success page - connected!
  if (step === "success") {
    return (
      <div className="min-h-screen bg-brand-bg text-white">
        <nav className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-3"
            >
              <img
                src={channel?.avatar || "/placeholder-avatar.svg"}
                alt={channel?.name || "Channel"}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="font-medium">{channel?.name || "Your Channel"}</p>
                <p className="text-xs text-white/50">YouTube Connected</p>
              </div>
            </motion.div>
            <button
              onClick={handleDisconnect}
              className="btn-secondary px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              Disconnect
            </button>
          </div>
        </nav>

        <main className="p-6">
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Welcome to YouTube Automation!</h2>
            <p className="text-white/60 mb-6">
              Your YouTube channel is now connected. You can start uploading videos, scheduling,
              and managing your YouTube presence directly from Clip Cutter.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/60 uppercase tracking-wider text-sm mb-2">Channel</p>
                <p className="text-2xl font-bold" id="connected-channel-name">
                  {channel?.name || "Loading..."}
                </p>
              </div>
              <div>
                <p className="text-white/60 uppercase tracking-wider text-sm mb-2">Channel ID</p>
                <p className="text-2xl font-mono" id="connected-channel-id">
                  {channel?.id || "Loading..."}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-semibold mb-3">Next Steps</h3>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <span className="font-medium">Upload a video</span> - Select a video and configure metadata
                </li>
                <li>
                  <span className="font-medium">Create a schedule</span> - Set a publish date and time
                </li>
                <li>
                  <span className="font-medium">Manage playlists</span> - Create and assign playlists
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error page
  if (step === "error") {
    return (
      <div className="min-h-screen bg-brand-bg text-white p-6 max-w-md mx-auto">
        <div className="glass-panel p-6 rounded-2xl text-center border-red-500/20">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Authentication Failed</h2>
          <p className="text-white/60 mb-6">{error || "Unknown error during OAuth flow"}</p>
          <button
            onClick={() => setStep("idle")}
            className="btn-primary px-6 py-3 rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </button>
          <button
            onClick={() => window.location.href = "/youtube/connect"}
            className="btn-secondary px-6 py-3 rounded-xl mt-4"
          >
            <LogIn className="w-4 h-4 mr-2" /> Start Over
          </button>
        </div>
      </div>
    );
  }

  return <div>Unexpected state</div>;
}