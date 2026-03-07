"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Trash2, ChevronDown, ChevronUp,
  Copy, ListChecks, DollarSign, Tag, FileText,
} from "lucide-react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";

interface TemplateTask {
  name: string;
  description: string;
  due_offset_days: number;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  default_status: string;
  default_value: number;
  category: string;
  tasks: TemplateTask[];
  created_by: string;
  created_at: string;
}

interface ProjectTemplatesProps {
  onCreateFromTemplate: (template: any) => void;
  role: string;
}

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "residential", label: "Residential", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  { value: "commercial", label: "Commercial", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  { value: "battery", label: "Battery", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  { value: "custom", label: "Custom", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "residential",
  default_value: 0,
};

const EMPTY_TASK: TemplateTask = { name: "", description: "", due_offset_days: 0 };

export default function ProjectTemplates({ onCreateFromTemplate, role }: ProjectTemplatesProps) {
  const { profileId, organizationId } = useAuth();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);

  useEffect(() => { fetchTemplates(); }, [organizationId]);

  async function fetchTemplates() {
    setLoading(true);
    const q = supabase.from("project_templates").select("*").order("created_at", { ascending: false });
    const { data } = await q;
    setTemplates((data as ProjectTemplate[]) || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      default_value: form.default_value,
      default_status: "lead",
      tasks: tasks.filter((t) => t.name.trim()),
      created_by: profileId,
    };
    const { error } = await supabase.from("project_templates").insert(payload);
    if (!error) {
      setForm(EMPTY_FORM);
      setTasks([]);
      setShowForm(false);
      fetchTemplates();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("project_templates").delete().eq("id", id);
    setDeleteId(null);
    fetchTemplates();
  }

  function addTask() {
    setTasks([...tasks, { ...EMPTY_TASK }]);
  }

  function updateTask(idx: number, field: keyof TemplateTask, value: string | number) {
    const next = [...tasks];
    (next[idx] as any)[field] = value;
    setTasks(next);
  }

  function removeTask(idx: number) {
    setTasks(tasks.filter((_, i) => i !== idx));
  }

  function getCategoryBadge(cat: string) {
    const c = CATEGORIES.find((x) => x.value === cat) || CATEGORIES[3];
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.color}`}>
        {c.label}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <FileText size={20} className="text-[var(--accent)]" />
          Project Templates
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors"
        >
          {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "Create Template"}
        </button>
      </div>

      {/* Create Template Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4 border border-[var(--accent)]/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Template name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-[var(--text-muted)]" />
            <input
              type="number"
              placeholder="Default contract value"
              value={form.default_value || ""}
              onChange={(e) => setForm({ ...form, default_value: parseFloat(e.target.value) || 0 })}
              className="w-48 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Task Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <ListChecks size={13} /> Tasks ({tasks.length})
              </span>
              <button onClick={addTask} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                <Plus size={12} /> Add task
              </button>
            </div>
            {tasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px] gap-2">
                  <input
                    placeholder="Task name"
                    value={t.name}
                    onChange={(e) => updateTask(i, "name", e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none"
                  />
                  <input
                    placeholder="Description"
                    value={t.description}
                    onChange={(e) => updateTask(i, "description", e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Days"
                    title="Due offset (days after project creation)"
                    value={t.due_offset_days || ""}
                    onChange={(e) => updateTask(i, "due_offset_days", parseInt(e.target.value) || 0)}
                    className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none"
                  />
                </div>
                <button onClick={() => removeTask(i)} className="mt-1 text-red-400/60 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      )}

      {/* Template Cards */}
      {templates.length === 0 && !showForm && (
        <div className="glass-card p-8 text-center">
          <FileText size={32} className="mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No templates yet. Create one to speed up project setup.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className="glass-card p-4 flex flex-col gap-3 group hover:border-[var(--accent)]/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{tpl.name}</h4>
                {tpl.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{tpl.description}</p>
                )}
              </div>
              {getCategoryBadge(tpl.category)}
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <DollarSign size={12} />
                {(tpl.default_value || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <ListChecks size={12} />
                {(tpl.tasks || []).length} task{(tpl.tasks || []).length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-white/5">
              <button
                onClick={() => onCreateFromTemplate(tpl)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors"
              >
                <Copy size={12} /> Use Template
              </button>
              <button
                onClick={() => setDeleteId(tpl.id)}
                className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete template"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Delete confirmation */}
            {deleteId === tpl.id && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                <span className="text-red-400 flex-1">Delete this template?</span>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-2.5 py-1 rounded bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 font-medium transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
