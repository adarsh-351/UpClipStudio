import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Package,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Flag,
  Shield,
  Folder,
  Upload,
  Image,
  Save,
  RefreshCw,
  Trash2,
  Plus,
} from "lucide-react";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

interface UploadDefaults {
  visibility: "public" | "private" | "unlisted" | "scheduled";
  category: string;
  language: string;
  playlist: string;
  defaultTemplate: string;
}

interface SchedulingDefaults {
  timezone: string;
  defaultPublishTime: string;
  uploadFrequency: "once" | "daily" | "weekdays" | "custom";
}

interface Template {
  id: string;
  name: string;
  titlePattern: string;
  description: string;
  tags: string[];
  category: string;
  language: string;
  visibility: string;
  scheduleRule: string;
}

const DEFAULT_UPLOAD: UploadDefaults = {
  visibility: "public",
  category: "22",
  language: "en",
  playlist: "",
  defaultTemplate: "",
};

const DEFAULT_SCHEDULING: SchedulingDefaults = {
  timezone: "UTC",
  defaultPublishTime: "",
  uploadFrequency: "once",
};

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "1",
    name: "Gaming Upload",
    titlePattern: "{title} | Gaming Highlights",
    description: "{description}",
    tags: ["gaming", "gameplay", "highlights"],
    category: "22",
    language: "en",
    visibility: "public",
    scheduleRule: "next available slot",
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { projects } = useStore();

  const [uploadDefaults, setUploadDefaults] = useState<UploadDefaults>(DEFAULT_UPLOAD);
  const [schedulingDefaults, setSchedulingDefaults] = useState<SchedulingDefaults>(DEFAULT_SCHEDULING);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null);

  // Fetch defaults from backend
  useEffect(() => {
    fetchDefaults();
  }, []);

  const fetchDefaults = async () => {
    try {
      const res = await fetch("/youtube/settings/defaults"); // This endpoint would need to be added
      const data = await res.json();
      if (data.success) {
        setUploadDefaults(data.uploadDefaults || DEFAULT_UPLOAD);
        setSchedulingDefaults(data.schedulingDefaults || DEFAULT_SCHEDULING);
        setTemplates(data.templates || DEFAULT_TEMPLATES);
      }
    } catch (e) {
      console.error("Failed to fetch settings:", e);
    }
  };

  // Save upload defaults
  const handleSaveUpload = async () => {
    setIsSaving(true);
    try {
      await fetch("/youtube/settings/upload-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: uploadDefaults }),
      });
      setIsSaving(false);
      // Show success
      setTimeout(() => setIsSaving(false), 500);
    } catch (e) {
      console.error("Failed to save upload defaults:", e);
      setIsSaving(false);
    }
  };

  // Save scheduling defaults
  const handleSaveScheduling = async () => {
    setIsSaving(true);
    try {
      await fetch("/youtube/settings/scheduling-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: schedulingDefaults }),
      });
      setIsSaving(false);
      setTimeout(() => setIsSaving(false), 500);
    } catch (e) {
      console.error("Failed to save scheduling defaults:", e);
      setIsSaving(false);
    }
  };

  // Create template
  const handleCreateTemplate = () => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: "New Template",
      titlePattern: "{title}",
      description: "",
      tags: [],
      category: "22",
      language: "en",
      visibility: "public",
      scheduleRule: "next available slot",
    };
    setTemplates((prev) => [...prev, newTemplate]);
  };

  // Update template
  const handleUpdateTemplate = (id: string, updates: Partial<Template>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  // Delete template
  const handleDeleteTemplate = (id: string) => {
    setDeletingTemplate(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate));
    setDeletingTemplate(null);
    setShowDeleteConfirm(false);
  };

  const cancelDeleteTemplate = () => {
    setDeletingTemplate(null);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <nav className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <button onClick={() => navigate("/youtube/dashboard")} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          ← Back
        </button>
        <h1 className="font-semibold">YouTube Settings</h1>
      </nav>

      <main className="p-6">
        {/* Upload Defaults Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass-panel rounded-2xl p-6 mb-6 border-white/10"
        >
          <h2 className="text-xl font-semibold mb-4">Upload Defaults</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Visibility</label>
              <select
                value={uploadDefaults.visibility}
                onChange={(e) => setUploadDefaults({ ...uploadDefaults, visibility: e.target.value as UploadDefaults["visibility"] })}
                className="input-field"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Category</label>
              <select
                value={uploadDefaults.category}
                onChange={(e) => setUploadDefaults({ ...uploadDefaults, category: e.target.value })}
                className="input-field"
              >
                <option value="22">People & Blogs</option>
                <option value="23">Entertainment</option>
                <option value="24">Education</option>
                <option value="25">Science & Technology</option>
                <option value="26">Nonprofits & Activism</option>
                <option value="27">Sports</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Language</label>
              <select
                value={uploadDefaults.language}
                onChange={(e) => setUploadDefaults({ ...uploadDefaults, language: e.target.value })}
                className="input-field"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Playlist</label>
              <select
                value={uploadDefaults.playlist}
                onChange={(e) => setUploadDefaults({ ...uploadDefaults, playlist: e.target.value })}
                className="input-field"
              >
                <option value="">None</option>
                {/* Playlists would be fetched from YouTube API */}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Default Template</label>
            <select
              value={uploadDefaults.defaultTemplate}
              onChange={(e) => setUploadDefaults({ ...uploadDefaults, defaultTemplate: e.target.value })}
              className="input-field"
            >
              <option value="">Use custom template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Scheduling Defaults Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass-panel rounded-2xl p-6 mb-6 border-white/10"
        >
          <h2 className="text-xl font-semibold mb-4">Scheduling Defaults</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Timezone</label>
              <select
                value={schedulingDefaults.timezone}
                onChange={(e) =>
                  setSchedulingDefaults({
                    ...schedulingDefaults,
                    timezone: e.target.value,
                  })
                }
                className="input-field"
              >
                <option value="UTC">UTC</option>
                <option value="EST">Eastern Time (US & Canada)</option>
                <option value="PST">Pacific Time (US & Canada)</option>
                <option value="CET">Central European Time</option>
                <option value="IST">India Standard Time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Default Publish Time</label>
              <input
                type="time"
                value={schedulingDefaults.defaultPublishTime}
                onChange={(e) =>
                  setSchedulingDefaults({
                    ...schedulingDefaults,
                    defaultPublishTime: e.target.value,
                  })
                }
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Upload Frequency</label>
            <select
              value={schedulingDefaults.uploadFrequency}
              onChange={(e) =>
                setSchedulingDefaults({
                  ...schedulingDefaults,
                  uploadFrequency: e.target.value as
                    | "once"
                    | "daily"
                    | "weekdays"
                    | "custom",
                })
              }
              className="input-field"
            >
              <option value="once">Once (after previous publish)</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays only</option>
              <option value="custom">Custom interval</option>
            </select>
          </div>
        </motion.div>

        {/* Templates Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass-panel rounded-2xl p-6 mb-6 border-white/10"
        >
          <h2 className="text-xl font-semibold mb-4">Metadata Templates</h2>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleCreateTemplate}
              className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Template
            </button>
          </div>

          {templates.length === 0 ? (
            <p className="text-white/50 italic mb-4">No templates yet. Create your first one above.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <motion.div
                  key={template.id}
                  className="glass-panel rounded-xl p-5 border-white/10 flex items-start gap-4"
                  whileHover={{ boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{template.name}</h3>
                    <p className="text-xs text-white/50 truncate">
                      {template.titlePattern}
                    </p>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs text-white/50 mb-1">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full px-2 py-1 text-xs border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleUpdateTemplate(template.id, { name: "Edited Template" })}
                      className="btn-secondary text-xs py-1"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="btn-secondary text-xs py-1 text-red-400"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {showDeleteConfirm && deletingTemplate && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm mb-2">
                Are you sure you want to delete "<strong>{deletingTemplate}</strong>"?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteTemplate}
                  className="btn-primary px-3 py-1 rounded-xl"
                >
                  Delete
                </button>
                <button onClick={cancelDeleteTemplate} className="btn-secondary px-3 py-1 rounded-xl">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Save buttons */}
        <div className="pt-6 border-t border-white/10">
          <button
            onClick={handleSaveUpload}
            className="btn-secondary me-3 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            Reset Upload Defaults
          </button>
          <button
            onClick={handleSaveScheduling}
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
                Save All Settings
              </span>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}