import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { motion } from "framer-motion";
import {
  TextCursor,
  Tags,
  Palette,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Trash,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  Folder,
  Image,
  Save,
  ArrowLeft,
} from "lucide-react";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

interface Tag {
  id: string;
  text: string;
}

interface MetadataState {
  title: string;
  description: string;
  tags: Tag[];
  category: string;
  language: string;
  recordingDate: string;
  location: string;
  playlist: string;
  visibility: "public" | "private" | "unlisted" | "scheduled";
  scheduledTime: string | null;
  showTitleCounter: boolean;
  showDescriptionCounter: boolean;
  titleLength: number;
  descriptionLength: number;
  newTag: string;
}

const DEFAULT_METADATA: MetadataState = {
  title: "",
  description: "",
  tags: [],
  category: "22",
  language: "en",
  recordingDate: new Date().toISOString().split("T")[0],
  location: "",
  playlist: "",
  visibility: "public",
  scheduledTime: null,
  showTitleCounter: false,
  showDescriptionCounter: false,
  titleLength: 0,
  descriptionLength: 0,
  newTag: "",
};

export default function MetadataEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, selectedProject } = useStore();

  const [metadata, setMetadata] = useState<MetadataState>(DEFAULT_METADATA);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(false);

  // Update metadata state
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const { name, value, type } = target;

    if (name === "tags") {
      const selectedTags: Tag[] = [];
      const opts = target as HTMLSelectElement;
      Array.from(opts.options).filter((opt) => opt.selected).forEach((opt) => {
        selectedTags.push({ id: opt.value, text: opt.value });
      });
      setMetadata((prev) => ({ ...prev, tags: selectedTags }));
      return;
    }

    setMetadata((prev) => ({ ...prev, [name]: type === "number" ? Number(value) : value }));
  };

  // Title counter
  useEffect(() => {
    const counter = setTimeout(() => {
      setMetadata((prev) => ({
        ...prev,
        titleLength: Math.min(prev.title.length, 100),
        showTitleCounter: true,
      }));
    }, 500);

    return () => clearTimeout(counter);
  }, [metadata.title]);

  // Description counter
  useEffect(() => {
    const counter = setTimeout(() => {
      setMetadata((prev) => ({
        ...prev,
        descriptionLength: Math.min(prev.description.length, 5000),
        showDescriptionCounter: true,
      }));
    }, 500);

    return () => clearTimeout(counter);
  }, [metadata.description]);

  // Category options
  const categories = [
    { value: "22", label: "People & Blogs" },
    { value: "23", label: "Entertainment" },
    { value: "24", label: "Education" },
    { value: "25", label: "Science & Technology" },
    { value: "26", label: "Nonprofits & Activism" },
    { value: "27", label: "Sports" },
  ];

  // Languages
  const languages = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "hi", label: "Hindi" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
  ];

  // Visibility options
  const visibilities = [
    { value: "public", label: "Public" },
    { value: "private", label: "Private" },
    { value: "unlisted", label: "Unlisted" },
    { value: "scheduled", label: "Scheduled" },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <nav className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <button
          onClick={() => navigate("/youtube/dashboard")}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="font-semibold">YouTube Metadata Editor</h1>
      </nav>

      <main className="p-6">
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Video Metadata</h2>

          {/* Title Field */}
          <div className="space-y-3 mb-4">
            <label className="block text-sm font-medium text-white/50 mb-2">
              Title
              {metadata.showTitleCounter && (
                <span className="text-xs text-white/40 ml-2">
                  ({metadata.titleLength}/100)
                </span>
              )}
            </label>
            <input
              type="text"
              name="title"
              value={metadata.title}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="Enter video title"
              maxLength={100}
            />
            {metadata.showTitleCounter && (
              <p className="text-xs text-white/50">
                Recommended: 60 characters for optimal display in search results
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-3 mb-4">
            <label className="block text-sm font-medium text-white/50 mb-2">
              Description
              {metadata.showDescriptionCounter && (
                <span className="text-xs text-white/40 ml-2">
                  ({metadata.descriptionLength}/5000)
                </span>
              )}
            </label>
             <textarea
               name="description"
               value={metadata.description}
               onChange={handleChange}
               className="input-field w-full min-h-[200px] resize-none"
               placeholder="Add description, links, hashtags..."
             ></textarea>
            {metadata.showDescriptionCounter && (
              <p className="text-xs text-white/50">
                You have {metadata.descriptionLength} characters. Description can be
up to 5000 characters.
              </p>
            )}
          </div>

          {/* Tags Field */}
          <div className="space-y-3 mb-4">
            <label className="block text-sm font-medium text-white/50 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {metadata.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full px-2 py-1 text-xs border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {tag.text}
                  <span
                    onClick={() =>
                      setMetadata((prev) => ({
                        ...prev,
                        tags: prev.tags.filter((t) => t.id !== tag.id),
                      }))
                    }
                    className="ml-2 w-2 h-2 rounded-full bg-red-500/20 border border-red-500/20"
                  />
                </span>
              ))}

              {/* Add tag input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  name="newTag"
                  className="input-field flex-1"
                  placeholder="Add a tag..."
                  onChange={(e) => setMetadata((prev) => ({ ...prev, newTag: e.target.value }))}
                />
                <button
                  onClick={() => {
                    if (metadata.newTag.trim()) {
                      setMetadata((prev) => ({
                        ...prev,
                        tags: [...prev.tags, { id: Date.now().toString(), text: metadata.newTag.trim() }],
                        newTag: "",
                      }));
                    }
                  }}
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  + Add
                </button>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={() => setMetadata((prev) => ({ ...prev, tags: [] }))}
                className="btn-secondary text-xs py-1"
              >
                Clear all tags
              </button>
            </div>
          </div>

          {/* Category & Language */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Category</label>
              <select name="category" value={metadata.category} onChange={handleChange} className="input-field">
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Language</label>
              <select name="language" value={metadata.language} onChange={handleChange} className="input-field">
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recording Date & Location */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Recording Date</label>
              <input
                type="date"
                name="recordingDate"
                value={metadata.recordingDate}
                onChange={handleChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Location</label>
              <input
                type="text"
                name="location"
                value={metadata.location}
                onChange={handleChange}
                className="input-field"
                placeholder="City, Country"
              />
            </div>
          </div>

          {/* Playlist & Visibility */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Playlist</label>
              <select name="playlist" value={metadata.playlist} onChange={handleChange} className="input-field">
                <option value="">None</option>
                {selectedProject && (selectedProject.tags?.length || 0) > 0 ? (
                  <option value="project-{selectedProject.id}">New from project</option>
                ) : (
                  <option value="">None</option>
                )}
                {/* Playlists would be fetched from YouTube API */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-2">Visibility</label>
              <select name="visibility" value={metadata.visibility} onChange={handleChange} className="input-field">
                {visibilities.map((vis) => (
                  <option key={vis.value} value={vis.value}>
                    {vis.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scheduled Time (for scheduled visibility) */}
          {metadata.visibility === "scheduled" && (
            <div className="mb-4 pt-4 border-t border-white/10">
              <label className="block text-sm font-medium text-white/50 mb-2">
                Schedule For
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className="input-field w-48"
                />
                <input
                  type="time"
                  className="input-field w-32"
                />
                <span className="text-white/50 text-sm">Your local timezone</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={() => setMetadata(DEFAULT_METADATA)}
              className="btn-secondary me-3 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Reset
            </button>
             <button
               onClick={() => setIsSaving(true)}
               className="btn-primary px-4 py-2 rounded-lg hover:bg-brand-primary/20 transition-colors"
             >
               {isSaving ? (
                 <span className="flex items-center gap-2">
                   <Loader2 className="w-4 h-4 mr-2" />
                   Saving...
                 </span>
               ) : (
                 <span className="flex items-center gap-2">
                   <Save className="w-4 h-4 mr-2" />
                   Save Metadata
                 </span>
               )}
             </button>
          </div>
        </div>

        {/* Video Preview Section */}
        <div className="glass-panel rounded-2xl p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
          <div className="p-4 bg-white/10 rounded-xl text-center">
            <p className="text-white/50">
              {selectedProject
                ? `Previewing: ${selectedProject.name || "Project"}`
                : previewVideo
                  ? "Video preview loading..."
                  : "Select a video or project to preview"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}