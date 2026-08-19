import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Clock,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Edit,
  Plus,
  Trash2,
  CalendarX,
} from "lucide-react";
import { glass, glassPanel, btnPrimary, btnSecondary, inputField } from "../index.css";

interface ScheduledVideo {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  scheduledAt: string;
  timezone: string;
  status: "scheduled" | "published" | "cancelled";
}

interface SchedulerState {
  schedules: ScheduledVideo[];
  view: "month" | "week" | "list";
  selectedDate: Date;
}

const DEFAULT_STATE: SchedulerState = {
  schedules: [],
  view: "month",
  selectedDate: new Date(),
};

export default function Scheduler() {
  const navigate = useNavigate();
  const { projects, selectedProject } = useStore();

  const [state, setState] = useState<SchedulerState>(DEFAULT_STATE);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledVideo | null>(null);

  // Fetch schedules from backend
  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await fetch("/youtube/schedules"); // This endpoint would need to be added
      const data = await res.json();
      if (data.success) {
        setState((prev) => ({ ...prev, schedules: data.schedules || [] }));
      }
    } catch (e) {
      console.error("Failed to fetch schedules:", e);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    // Would open a modal to create a new schedule
    setTimeout(() => {
      setIsCreating(false);
      fetchSchedules();
    }, 500);
  };

  const handleEdit = (schedule: ScheduledVideo) => {
    setEditingSchedule(schedule);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editingSchedule) return;
    try {
      await fetch("/youtube/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: editingSchedule.id,
          title: editingSchedule.title,
          description: editingSchedule.description,
          scheduled_at: editingSchedule.scheduledAt,
          timezone: editingSchedule.timezone,
        }),
      });
      setIsEditing(false);
      setEditingSchedule(null);
      fetchSchedules();
    } catch (e) {
      console.error("Failed to save schedule:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled upload?")) return;
    try {
      await fetch("/youtube/schedules/" + id, { method: "DELETE" });
      fetchSchedules();
    } catch (e) {
      console.error("Failed to delete schedule:", e);
    }
  };

  // Render calendar view
  const renderCalendar = () => {
    const { schedules, view } = state;
    const date = state.selectedDate;

    // Format date for display
    const formatDate = (d: Date) => {
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: view === "month" ? "long" : "short",
        day: view === "month" ? "numeric" : undefined,
      };
      return d.toLocaleDateString(undefined, options);
    };

    // Get scheduled videos for the current month/week
    const videoForDate = (d: Date) => {
      const daySchedules = schedules.filter((s) => {
        const schedDate = new Date(s.scheduledAt);
        return schedDate.getFullYear() === d.getFullYear() &&
          schedDate.getMonth() === d.getMonth() &&
          schedDate.getDate() === d.getDate();
      });
      return daySchedules;
    };

    if (view === "month") {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setState((prev) => ({
                ...prev,
                selectedDate: new Date(prev.selectedDate.getTime() - 30 * 24 * 60 * 60 * 1000),
              }))}
              className="btn-secondary text-sm px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Previous Month
            </button>
            <span className="font-medium text-lg">
              {formatDate(date)} {date.getFullYear()}
            </span>
            <button
              onClick={() => setState((prev) => ({
                ...prev,
                selectedDate: new Date(prev.selectedDate.getTime() + 30 * 24 * 60 * 60 * 1000),
              }))}
              className="btn-secondary text-sm px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              Next Month
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            <div className="font-semibold text-white/60 text-sm">Sun</div>
            <div className="font-semibold text-white/60 text-sm">Mon</div>
            <div className="font-semibold text-white/60 text-sm">Tue</div>
            <div className="font-semibold text-white/60 text-sm">Wed</div>
            <div className="font-semibold text-white/60 text-sm">Thu</div>
            <div className="font-semibold text-white/60 text-sm">Fri</div>
            <div className="font-semibold text-white/60 text-sm">Sat</div>
          </div>

          { /* Days of the month */ }
          { /* Simplified - would generate proper calendar grid */ }
          <div className="grid grid-cols-7 gap-2 py-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="text-xs text-white/50 rounded bg-white/5 p-1">
                {i + 1}
              </div>
            ))}
          </div>

          {videoForDate(date).map((s) => (
            <motion.div
              key={s.id}
              className="mt-2 text-xs text-white/70 bg-white/5 rounded p-2"
            >
              <span className="font-medium truncate">{s.title.substring(0, 20)}...</span>
              <span className="text-white/40 ml-2 text-xs">Scheduled</span>
            </motion.div>
          ))}
        </div>
      );
    }

    if (view === "week") {
      return (
        <div className="p-4 bg-white/5 rounded-lg mb-4">
          <h3 className="text-sm font-medium text-white/60 mb-2">Weekly Schedule</h3>
          <p className="text-white/50 text-xs">
            Week of {formatDate(new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000))}
          </p>
          <p className="text-white/50 italic">Week view coming soon</p>
        </div>
      );
    }

    if (view === "list") {
      return (
        <div className="space-y-3">
          {state.schedules.map((s) => (
            <motion.div
              key={s.id}
              className="glass-panel rounded-xl p-4 flex items-center gap-3"
              whileHover={{ background: "rgba(255,255,255,0.05)" }}
            >
              <div className="w-10 h-10 rounded-lg flex-shrink-0">
                <img
                  src={s.thumbnail || "/placeholder-thumbnail.svg"}
                  alt={s.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.title}</p>
                <p className="text-xs text-white/50">{s.timezone}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-white/60 text-sm capitalize">
                  {new Date(s.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-white/40 text-xs">Scheduled</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(s)}
                  className="btn-secondary text-xs py-1"
                  title="Edit"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                   className="btn-secondary text-xs py-1 text-brand-primary"
                  title="Cancel"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    return null;
  };

  // Render create schedule form
  const renderCreateForm = () => {
    const [form, setForm] = useState({
      title: selectedProject?.name || "New Video",
      scheduledAt: new Date().toISOString(),
      timezone: "UTC",
      visibility: "public" as "public" | "private" | "unlisted" | "scheduled",
    });

    return (
      <div className="glass-panel rounded-2xl p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Schedule New Upload</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-white/50 mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/50 mb-2">Time</label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="input-field w-full"
              />
              <input
                type="time"
                value={new Date(form.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                onChange={(e) => {
                  const date = new Date(form.scheduledAt);
                  date.setHours(parseInt(e.target.value.split(":")[0], 10));
                  date.setMinutes(parseInt(e.target.value.split(":")[1], 10));
                  setForm({ ...form, scheduledAt: date.toISOString() });
                }}
                className="input-field w-32"
              />
              <span className="text-white/50 text-sm">Your local timezone</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/50 mb-2">Visibility</label>
          <select
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value as typeof form.visibility })}
            className="input-field"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => {
              handleCreate();
              setIsCreating(false);
            }}
            className="btn-primary w-full px-4 py-2 rounded-lg hover:bg-brand-primary/20 transition-colors"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 mr-2" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 mr-2" />
                Schedule
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <nav className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <button onClick={() => navigate("/youtube/dashboard")} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          ← Back
        </button>
        <h1 className="font-semibold">Scheduler</h1>
      </nav>

      <main className="p-6">
        {/* View tabs */}
        <div className="glass-panel rounded-2xl p-4 mb-6 border-white/10">
          <div className="flex gap-1">
            <button
              onClick={() => setState((prev) => ({ ...prev, view: "month" }))}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                state.view === "month"
                  ? "bg-brand-primary/20 border border-brand-primary/40 text-brand-primary"
                  : "text-white/40 hover:bg-white/5"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, view: "week" }))}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                state.view === "week"
                  ? "bg-brand-primary/20 border border-brand-primary/40 text-brand-primary"
                  : "text-white/40 hover:bg-white/5"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, view: "list" }))}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                state.view === "list"
                  ? "bg-brand-primary/20 border border-brand-primary/40 text-brand-primary"
                  : "text-white/40 hover:bg-white/5"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Calendar / Schedule view */}
        {renderCalendar()}

        {/* Create schedule form */}
        {isCreating && <>{renderCreateForm()}</>}
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary mb-6 px-4 py-2 rounded-lg hover:bg-brand-primary/20 transition-colors"
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 mr-2" />
              Creating schedule
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 mr-2" />
              Schedule New Upload
            </span>
          )}
        </button>
      </main>
    </div>
  );
}