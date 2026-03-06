"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, X, CheckCircle, Circle, Clock, AlertTriangle,
  Trash2, Calendar, Briefcase, User, ChevronDown,
} from "lucide-react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  project_id: string | null;
  contact_id: string | null;
  organization_id: string | null;
  created_at: string;
  projects?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

interface TasksPanelProps {
  projects?: any[];
  onTasksLoaded?: (tasks: Task[]) => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  urgent: { label: "Urgent", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", order: 0 },
  high: { label: "High", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", order: 1 },
  medium: { label: "Medium", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", order: 2 },
  low: { label: "Low", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", order: 3 },
};

export default function TasksPanel({ projects = [], onTasksLoaded }: TasksPanelProps) {
  const { profileId, organizationId } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "overdue" | "completed">("all");
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    project_id: "",
  });

  async function loadTasks() {
    try {
      const { data } = await supabase
        .from("tasks")
        .select("*, projects(name), profiles!tasks_assigned_to_fkey(full_name)")
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      const loaded = data || [];
      setTasks(loaded);
      onTasksLoaded?.(loaded);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTasks(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await supabase.from("tasks").insert([{
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        priority: form.priority,
        project_id: form.project_id || null,
        assigned_to: profileId,
        created_by: profileId,
        organization_id: organizationId,
      }]);
      setForm({ title: "", description: "", due_date: "", priority: "medium", project_id: "" });
      setShowForm(false);
      loadTasks();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(task: Task) {
    const newCompleted = !task.completed;
    try {
      await supabase.from("tasks").update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      }).eq("id", task.id);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteTask(id: string) {
    if (!window.confirm("Delete this task?")) return;
    try {
      await supabase.from("tasks").delete().eq("id", id);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  const now = Date.now();

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "mine") list = list.filter(t => t.assigned_to === profileId);
    else if (filter === "overdue") list = list.filter(t => !t.completed && t.due_date && new Date(t.due_date).getTime() < now);
    else if (filter === "completed") list = list.filter(t => t.completed);
    else list = list.filter(t => !t.completed); // "all" = active only

    // Sort: overdue first, then by priority, then by due date
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aOverdue = !a.completed && a.due_date && new Date(a.due_date).getTime() < now;
      const bOverdue = !b.completed && b.due_date && new Date(b.due_date).getTime() < now;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const aPri = PRIORITY_CONFIG[a.priority]?.order ?? 2;
      const bPri = PRIORITY_CONFIG[b.priority]?.order ?? 2;
      if (aPri !== bPri) return aPri - bPri;
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }, [tasks, filter, profileId, now]);

  const overdueCt = useMemo(() => tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date).getTime() < now).length, [tasks, now]);

  function formatDue(dateStr: string) {
    const due = new Date(dateStr);
    const diff = Math.round((due.getTime() - now) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `${diff}d`;
  }

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40";

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] bg-gradient-to-r from-blue-500/[0.04] to-transparent">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <CheckCircle size={14} className="text-blue-400" />
            </div>
            Tasks & Reminders
            <span className="text-[10px] text-gray-500 font-normal">{tasks.filter(t => !t.completed).length} active</span>
            {overdueCt > 0 && (
              <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 font-medium">{overdueCt} overdue</span>
            )}
          </h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20"
          >
            {showForm ? <X size={12} /> : <Plus size={12} />}
            {showForm ? "Cancel" : "New Task"}
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {([
            { key: "all", label: "Active" },
            { key: "mine", label: "My Tasks" },
            { key: "overdue", label: `Overdue${overdueCt > 0 ? ` (${overdueCt})` : ""}` },
            { key: "completed", label: "Done" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                filter === f.key
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  : "text-gray-500 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-4 border-b border-white/[0.06] space-y-3 bg-white/[0.01]">
          <input type="text" placeholder="Task title *" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className={inputCls} autoFocus />
          <textarea placeholder="Description (optional)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2} className={`${inputCls} resize-none`} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Due Date</label>
              <input type="date" value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className={inputCls}>
                <option value="low" className="bg-[#0c1222]">Low</option>
                <option value="medium" className="bg-[#0c1222]">Medium</option>
                <option value="high" className="bg-[#0c1222]">High</option>
                <option value="urgent" className="bg-[#0c1222]">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Project</label>
              <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                className={inputCls}>
                <option value="" className="bg-[#0c1222]">None</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0c1222]">{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={handleCreate} disabled={!form.title.trim() || saving}
            className="btn-primary text-white px-4 py-2 rounded-xl font-medium text-sm disabled:opacity-50 w-full">
            {saving ? "Creating..." : "Create Task"}
          </button>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          Loading tasks...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <CheckCircle size={20} className="mx-auto mb-2 opacity-40" />
          <p>{filter === "completed" ? "No completed tasks." : filter === "overdue" ? "No overdue tasks!" : "No tasks yet."}</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
          {filtered.map(task => {
            const isOverdue = !task.completed && task.due_date && new Date(task.due_date).getTime() < now;
            const priConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

            return (
              <div key={task.id} className={`px-4 py-4 flex items-start gap-3 group transition-colors hover:bg-white/[0.02] ${task.completed ? "opacity-50" : ""}`}>
                <button
                  onClick={() => toggleComplete(task)}
                  className={`mt-0.5 shrink-0 transition-colors ${task.completed ? "text-emerald-400" : "text-gray-600 hover:text-emerald-400"}`}
                >
                  {task.completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium truncate ${task.completed ? "line-through text-gray-500" : "text-white/90"}`}>{task.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${priConfig.color} ${priConfig.bg}`}>{priConfig.label}</span>
                  </div>
                  {task.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {task.due_date && (
                      <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? "text-red-400 font-medium" : "text-gray-500"}`}>
                        {isOverdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                        {formatDue(task.due_date)}
                      </span>
                    )}
                    {task.projects?.name && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Briefcase size={10} /> {task.projects.name}
                      </span>
                    )}
                    {task.profiles?.full_name && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <User size={10} /> {task.profiles.full_name}
                      </span>
                    )}
                  </div>
                </div>

                <button onClick={() => deleteTask(task.id)}
                  className="shrink-0 p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
