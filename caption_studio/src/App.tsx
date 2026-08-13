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
