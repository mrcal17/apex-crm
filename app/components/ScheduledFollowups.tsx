"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, X, CheckCircle, Circle, Clock, AlertTriangle,
  Trash2, Calendar, Mail, Phone, MessageSquare, ChevronDown,
  Bell, User,
} from "lucide-react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";

interface Followup {
  id: string;
  project_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_at: string;
  completed: boolean;
  completed_at: string | null;
  channel: string;
  created_at: string;
  projects?: { name: string } | null;
}

interface ScheduledFollowupsProps {
  projectId?: string;
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  email: { label: "Email", icon: Mail, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  sms: { label: "SMS", icon: MessageSquare, color: "text-green-400 bg-green-500/10 border-green-500/20" },
  call: { label: "Call", icon: Phone, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

function classifyFollowup(due: string): "overdue" | "today" | "upcoming" {
  const now = new Date();
  const dueDate = new Date(due);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  if (dueDate < todayStart) return "overdue";
  if (dueDate < todayEnd) return "today";
  return "upcoming";
}

function formatDue(due: string): string {
  const d = new Date(due);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ScheduledFollowups({ projectId }: ScheduledFollowupsProps) {
  const { profileId, organizationId } = useAuth();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_at: "",
    channel: "email",
    project_id: projectId || "",
  });

  const fetchFollowups = async () => {
    let query = supabase
      .from("scheduled_followups")
      .select("*, projects(name)")
      .order("due_at", { ascending: true });

    if (projectId) query = query.eq("project_id", projectId);

    const { data } = await query;
    setFollowups(data || []);
    setLoading(false);
  };

  const fetchProjects = async () => {
    if (projectId) return;
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name");
    setProjects(data || []);
  };

  useEffect(() => {
    fetchFollowups();
    fetchProjects();
  }, [projectId]);

  const grouped = useMemo(() => {
    const groups = { overdue: [] as Followup[], today: [] as Followup[], upcoming: [] as Followup[] };
    followups
      .filter((f) => !f.completed)
      .forEach((f) => groups[classifyFollowup(f.due_at)].push(f));
    return groups;
  }, [followups]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.due_at) return;
    setSaving(true);
    const { error } = await supabase.from("scheduled_followups").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_at: new Date(form.due_at).toISOString(),
      channel: form.channel,
      project_id: form.project_id || projectId || null,
      assigned_to: profileId,
      completed: false,
      created_at: new Date().toISOString(),
    });
    if (!error) {
      setForm({ title: "", description: "", due_at: "", channel: "email", project_id: projectId || "" });
      setShowForm(false);
      fetchFollowups();
    }
    setSaving(false);
  };

  const toggleComplete = async (f: Followup) => {
    const nowComplete = !f.completed;
    await supabase
      .from("scheduled_followups")
      .update({
        completed: nowComplete,
        completed_at: nowComplete ? new Date().toISOString() : null,
      })
      .eq("id", f.id);
    fetchFollowups();
  };

  const deleteFollowup = async (id: string) => {
    await supabase.from("scheduled_followups").delete().eq("id", id);
    fetchFollowups();
  };

  const renderBadge = (label: string, count: number, color: string) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
      <span className="font-bold">{count}</span>
    </span>
  );

  const renderItem = (f: Followup, group: "overdue" | "today" | "upcoming") => {
    const ch = CHANNEL_CONFIG[f.channel] || CHANNEL_CONFIG.email;
    const ChannelIcon = ch.icon;
    const borderColor =
      group === "overdue" ? "border-l-red-500" :
      group === "today" ? "border-l-amber-400" : "border-l-[var(--accent)]";

    return (
      <div
        key={f.id}
        className={`flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] border-l-2 ${borderColor} hover:bg-white/[0.06] transition-colors`}
      >
        <button onClick={() => toggleComplete(f)} className="mt-0.5 shrink-0">
          {f.completed ? (
            <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
          ) : (
            <Circle className="w-5 h-5 text-white/30 hover:text-white/60" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${f.completed ? "line-through text-white/40" : "text-white/90"}`}>
            {f.title}
          </p>
          {f.description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{f.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-white/50">
              <Calendar className="w-3 h-3" />
              {formatDue(f.due_at)}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${ch.color}`}>
              <ChannelIcon className="w-3 h-3" />
              {ch.label}
            </span>
            {f.projects?.name && (
              <span className="text-xs text-white/40 truncate max-w-[120px]">{f.projects.name}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => deleteFollowup(f.id)}
          className="shrink-0 p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderGroup = (label: string, items: Followup[], group: "overdue" | "today" | "upcoming") => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</h4>
        {items.map((f) => renderItem(f, group))}
      </div>
    );
  };

  const completedList = followups.filter((f) => f.completed);

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="w-5 h-5 text-[var(--accent)]" />
          <h3 className="text-base font-semibold text-white/90">Scheduled Follow-ups</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Schedule"}
        </button>
      </div>

      {/* Count Badges */}
      <div className="flex flex-wrap gap-2">
        {renderBadge("Overdue", grouped.overdue.length, "text-red-400 bg-red-500/10 border-red-500/20")}
        {renderBadge("Today", grouped.today.length, "text-amber-400 bg-amber-500/10 border-amber-500/20")}
        {renderBadge("Upcoming", grouped.upcoming.length, "text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20")}
      </div>

      {/* Form */}
      {showForm && (
        <div className="space-y-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <input
            type="text"
            placeholder="Follow-up title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-[var(--accent)]/40"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-[var(--accent)]/40 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm({ ...form, due_at: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm text-white/90 focus:outline-none focus:border-[var(--accent)]/40"
            />
            <div className="relative">
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm text-white/90 focus:outline-none focus:border-[var(--accent)]/40 appearance-none"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="call">Call</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>
          {!projectId && projects.length > 0 && (
            <div className="relative">
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm text-white/90 focus:outline-none focus:border-[var(--accent)]/40 appearance-none"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={saving || !form.title.trim() || !form.due_at}
            className="w-full py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving..." : "Schedule Follow-up"}
          </button>
        </div>
      )}

      {/* Follow-up Lists */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {renderGroup("Overdue", grouped.overdue, "overdue")}
          {renderGroup("Today", grouped.today, "today")}
          {renderGroup("Upcoming", grouped.upcoming, "upcoming")}

          {grouped.overdue.length === 0 && grouped.today.length === 0 && grouped.upcoming.length === 0 && (
            <p className="text-center text-sm text-white/30 py-6">No pending follow-ups</p>
          )}

          {completedList.length > 0 && (
            <details className="group">
              <summary className="text-xs font-semibold uppercase tracking-wider text-white/30 cursor-pointer hover:text-white/50 transition-colors list-none flex items-center gap-1.5">
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                Completed ({completedList.length})
              </summary>
              <div className="space-y-2 mt-2 opacity-60">
                {completedList.map((f) => renderItem(f, "upcoming"))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
