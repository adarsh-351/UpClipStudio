import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Landing from "./pages/Landing";
import Editor from "./pages/Editor";
import YouTubeDashboard from "./pages/YouTubeDashboard";
import ConnectYouTube from "./pages/ConnectYouTube";
import MetadataEditor from "./pages/MetadataEditor";
import UploadQueue from "./pages/UploadQueue";
import Scheduler from "./pages/Scheduler";
import History from "./pages/History";
import Settings from "./pages/Settings";

function PreloadRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // First check __CAPTION_STUDIO_PRELOAD__ (set by /studio/open-in-caption-studio bridge)
    const preload = (window as any).__CAPTION_STUDIO_PRELOAD__;
    if (preload && location.pathname === "/" && !location.state?.video) {
      const videoFilename = preload.video || preload.clip || "";
      const projectId = preload.project_id || "";
      const src = preload.clip || "";
      if (videoFilename) {
        const videoUrl = `/download/input/${encodeURIComponent(videoFilename)}`;
        navigate("/editor", {
          state: {
            video: {
              filename: videoFilename,
              video_url: videoUrl,
              metadata: { duration: 0 },
            },
            project_id: projectId,
            src,
            preload_srt: preload.srt || "",
            preload_vtt: preload.vtt || "",
            preload_style: preload.style || null,
          },
          replace: true,
        });
      }
      return;
    }

    // Also check __UPCLIP_INITIAL_STATE__ (set by caption_studio.html template via ?src= or ?video=)
    const initState = (window as any).__UPCLIP_INITIAL_STATE__;
    if (initState && location.pathname === "/" && !location.state?.video && !preload) {
      const preloadVideo = initState.preload_video;
      if (preloadVideo) {
        const src = initState.source_filename || "";
        const projectId = initState.project_id || "";
        const inheritedStyle = initState.inherited_style;
        navigate("/editor", {
          state: {
            video: {
              filename: preloadVideo.filename,
              video_url: preloadVideo.video_url,
              metadata: preloadVideo.metadata || { duration: 0 },
            },
            project_id: projectId,
            src,
            preload_style: inheritedStyle || null,
          },
          replace: true,
        });
      }
    }
  }, [navigate, location]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter basename="/caption-studio">
      <Routes>
        <Route path="/" element={
          <>
            <PreloadRouter />
            <Landing />
          </>
        } />
        <Route path="/editor" element={<Editor />} />
        <Route path="/youtube/dashboard" element={<YouTubeDashboard />} />
        <Route path="/youtube/connect" element={<ConnectYouTube />} />
        <Route path="/youtube/metadata-editor" element={<MetadataEditor />} />
        <Route path="/youtube/upload-queue" element={<UploadQueue />} />
        <Route path="/youtube/scheduler" element={<Scheduler />} />
        <Route path="/youtube/history" element={<History />} />
        <Route path="/youtube/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
