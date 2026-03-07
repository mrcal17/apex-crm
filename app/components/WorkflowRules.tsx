"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  Clock,
  AlertTriangle,
  FolderPlus,
  ArrowRightLeft,
  X,
  Save,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";

interface WorkflowRulesProps {
  role: string;
}

interface Action {
  type: "create_task" | "send_notification" | "update_field" | "send_email";
  config: Record<string, string>;
}

interface WorkflowRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, string>;
  actions: Action[];
  enabled: boolean;
  created_by: string;
  created_at: string;
}

const TRIGGER_TYPES = [
  { value: "status_change", label: "Status Change", icon: ArrowRightLeft },
  { value: "permit_expiring", label: "Permit Expiring", icon: Clock },
  { value: "task_overdue", label: "Task Overdue", icon: AlertTriangle },
  { value: "project_created", label: "Project Created", icon: FolderPlus },
];

const ACTION_TYPES = [
  { value: "create_task", label: "Create Task" },
  { value: "send_notification", label: "Send Notification" },
  { value: "update_field", label: "Update Field" },
  { value: "send_email", label: "Send Email" },
];

const STATUS_OPTIONS = [
  "New", "Contacted", "Qualified", "Proposal", "Negotiation",
  "Permit Submitted", "Permit Approved", "Scheduled", "In Progress",
  "Inspection", "Completed", "Cancelled",
];

function getTriggerIcon(triggerType: string) {
  const found = TRIGGER_TYPES.find((t) => t.value === triggerType);
  return found ? found.icon : Zap;
}

function getTriggerLabel(triggerType: string) {
  const found = TRIGGER_TYPES.find((t) => t.value === triggerType);
  return found ? found.label : triggerType;
}

function summarizeActions(actions: Action[]): string {
  if (!actions || actions.length === 0) return "No actions";
  const labels = actions.map((a) => {
    const found = ACTION_TYPES.find((t) => t.value === a.type);
    return found ? found.label : a.type;
  });
  return labels.join(", ");
}

export default function WorkflowRules({ role }: WorkflowRulesProps) {
  const { session } = useAuth();
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState("status_change");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<Action[]>([]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("workflow_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRules(data as WorkflowRule[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleRule = async (rule: WorkflowRule) => {
    const { error } = await supabase
      .from("workflow_rules")
      .update({ enabled: !rule.enabled })
      .eq("id", rule.id);
    if (!error) {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
    }
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from("workflow_rules")
      .delete()
      .eq("id", id);
    if (!error) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
    }
  };

  const resetForm = () => {
    setRuleName("");
    setTriggerType("status_change");
    setTriggerConfig({});
    setActions([]);
    setShowForm(false);
  };

  const addAction = () => {
    setActions((prev) => [
      ...prev,
      { type: "create_task", config: {} },
    ]);
  };

  const updateAction = (index: number, field: string, value: string) => {
    setActions((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        if (field === "type") {
          return { type: value as Action["type"], config: {} };
        }
        return { ...a, config: { ...a.config, [field]: value } };
      })
    );
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const saveRule = async () => {
    if (!ruleName.trim() || actions.length === 0 || !session?.user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("workflow_rules").insert({
      name: ruleName.trim(),
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      actions,
      enabled: true,
      created_by: session.user.id,
    });
    if (!error) {
      resetForm();
      fetchRules();
    }
    setSaving(false);
  };

  const renderTriggerConfig = () => {
    if (triggerType === "status_change") {
      return (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">From Status</label>
            <select
              value={triggerConfig.from_status || ""}
              onChange={(e) =>
                setTriggerConfig((c) => ({ ...c, from_status: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            >
              <option value="">Any Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">To Status</label>
            <select
              value={triggerConfig.to_status || ""}
              onChange={(e) =>
                setTriggerConfig((c) => ({ ...c, to_status: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            >
              <option value="">Any Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    if (triggerType === "permit_expiring") {
      return (
        <div className="mt-3">
          <label className="text-xs text-white/50 mb-1 block">Days Before Expiry</label>
          <input
            type="number"
            min={1}
            max={90}
            value={triggerConfig.days_before || ""}
            onChange={(e) =>
              setTriggerConfig((c) => ({ ...c, days_before: e.target.value }))
            }
            placeholder="e.g. 7"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>
      );
    }
    return null;
  };

  const renderActionConfig = (action: Action, index: number) => {
    switch (action.type) {
      case "create_task":
        return (
          <div className="space-y-2 mt-2">
            <input
              value={action.config.task_name || ""}
              onChange={(e) => updateAction(index, "task_name", e.target.value)}
              placeholder="Task name"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
            <input
              value={action.config.task_description || ""}
              onChange={(e) => updateAction(index, "task_description", e.target.value)}
              placeholder="Task description"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>
        );
      case "send_notification":
        return (
          <div className="mt-2">
            <input
              value={action.config.message || ""}
              onChange={(e) => updateAction(index, "message", e.target.value)}
              placeholder="Notification message"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>
        );
      case "update_field":
        return (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              value={action.config.field_name || ""}
              onChange={(e) => updateAction(index, "field_name", e.target.value)}
              placeholder="Field name"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
            <input
              value={action.config.field_value || ""}
              onChange={(e) => updateAction(index, "field_value", e.target.value)}
              placeholder="Field value"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>
        );
      case "send_email":
        return (
          <div className="mt-2">
            <input
              value={action.config.template_name || ""}
              onChange={(e) => updateAction(index, "template_name", e.target.value)}
              placeholder="Email template name"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent)]/15">
            <Zap size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Workflow Rules</h2>
            <p className="text-xs text-white/50">Automate actions based on triggers</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent)]/80 transition-colors"
          >
            <Plus size={16} />
            Create Rule
          </button>
        )}
      </div>

      {/* Create Rule Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4 border border-[var(--accent)]/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">New Workflow Rule</h3>
            <button onClick={resetForm} className="text-white/40 hover:text-white/70 transition-colors">
              <X size={18} />
            </button>
          </div>

          <input
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Rule name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none transition-colors"
          />

          <div>
            <label className="text-xs text-white/50 mb-1 block">Trigger Type</label>
            <div className="relative">
              <select
                value={triggerType}
                onChange={(e) => {
                  setTriggerType(e.target.value);
                  setTriggerConfig({});
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors appearance-none"
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
            {renderTriggerConfig()}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/50">Actions</label>
              <button
                onClick={addAction}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-secondary)] transition-colors"
              >
                <Plus size={12} /> Add Action
              </button>
            </div>
            {actions.length === 0 && (
              <p className="text-xs text-white/30 italic">No actions added yet</p>
            )}
            <div className="space-y-3">
              {actions.map((action, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(i, "type", e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[var(--accent)] focus:outline-none transition-colors"
                    >
                      {ACTION_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAction(i)}
                      className="p-1 text-white/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {renderActionConfig(action, i)}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveRule}
              disabled={saving || !ruleName.trim() || actions.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Rule
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-white/30" />
        </div>
      ) : rules.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Zap size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">No workflow rules yet</p>
          <p className="text-xs text-white/25 mt-1">Create your first automation rule to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const TriggerIcon = getTriggerIcon(rule.trigger_type);
            return (
              <div
                key={rule.id}
                className={`glass-card p-4 flex items-center gap-4 transition-opacity ${
                  !rule.enabled ? "opacity-50" : ""
                }`}
              >
                <div className="p-2 rounded-lg bg-[var(--accent-secondary)]/10 shrink-0">
                  <TriggerIcon size={16} className="text-[var(--accent-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">{rule.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--accent)]/15 text-[var(--accent)] shrink-0">
                      {getTriggerLabel(rule.trigger_type)}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 truncate">
                    {summarizeActions(rule.actions)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleRule(rule)}
                    className="text-white/40 hover:text-[var(--accent)] transition-colors"
                    title={rule.enabled ? "Disable" : "Enable"}
                  >
                    {rule.enabled ? (
                      <ToggleRight size={22} className="text-[var(--accent)]" />
                    ) : (
                      <ToggleLeft size={22} />
                    )}
                  </button>
                  {deleteConfirm === rule.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 rounded text-xs text-white/40 hover:text-white/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(rule.id)}
                      className="p-1 text-white/20 hover:text-red-400 transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
