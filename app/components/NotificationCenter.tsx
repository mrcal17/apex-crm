"use client";

import { useState, useEffect, useMemo } from "react";
import { Bell, AlertCircle, Clock, DollarSign, X, Briefcase, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { projectService } from "../../lib/projectService";
import { _rl, type Role } from "../../lib/roles";

interface Notification {
  id: string;
  type: "permit_expiring" | "commission_unpaid" | "project_stale" | "pending_completion";
  title: string;
  message: string;
  severity: "warning" | "info" | "danger" | "action";
  pendingId?: string;
}

interface NotificationCenterProps {
  role: Role;
  onProjectRefresh?: () => void;
}

export default function NotificationCenter({ role, onProjectRefresh }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canReview = _rl(role) >= 2;

  async function load() {
    try {
      const fetches: Promise<any>[] = [
        projectService.getAllPermits(),
        projectService.getAllCommissions(),
        projectService.getProjects(),
      ];
      if (canReview) {
        fetches.push(projectService.getPendingCompletions());
      }

      const results = await Promise.all(fetches);
      const [permits, commissions, projects] = results;
      const pendingCompletions = canReview ? results[3] : [];

      const notifs: Notification[] = [];
      const now = new Date();
      const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Pending completion requests (shown first for managers/admins)
      for (const pc of pendingCompletions || []) {
        const projectName = pc.projects?.name || "Unknown";
        const requester = pc.profiles?.full_name || "A team member";
        const value = pc.projects?.contract_value ? `$${Number(pc.projects.contract_value).toLocaleString()}` : "";
        notifs.push({
          id: `pending-${pc.id}`,
          type: "pending_completion",
          title: "Completion Approval Needed",
          message: `${requester} wants to mark "${projectName}" as completed${value ? ` (${value})` : ""}`,
          severity: "action",
          pendingId: pc.id,
        });
      }

      // Expiring permits
      for (const p of permits || []) {
        if (!p.expiration_date || p.status === "expired") continue;
        const exp = new Date(p.expiration_date);
        if (exp >= now && exp <= fourteenDays) {
          const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          notifs.push({
            id: `permit-${p.id}`,
            type: "permit_expiring",
            title: "Permit Expiring Soon",
            message: `${p.permit_number || p.agency || "Permit"} expires in ${days} day${days !== 1 ? "s" : ""}`,
            severity: days <= 7 ? "danger" : "warning",
          });
        }
      }

      // Unpaid commissions > 30 days old
      for (const c of commissions || []) {
        if (c.status !== "unpaid" || !c.created_at) continue;
        const created = new Date(c.created_at);
        const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 30) {
          notifs.push({
            id: `commission-${c.id}`,
            type: "commission_unpaid",
            title: "Overdue Commission",
            message: `$${Number(c.amount || 0).toLocaleString()} for ${c.profiles?.full_name || "Unknown"} — ${daysSince} days unpaid`,
            severity: daysSince > 60 ? "danger" : "warning",
          });
        }
      }

      // Stale projects
      for (const p of projects || []) {
        if (!p.created_at) continue;
        const created = new Date(p.created_at);
        const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (p.status === "in_progress" && daysSince > 60) {
          notifs.push({
            id: `stale-${p.id}`,
            type: "project_stale",
            title: "Stale Project",
            message: `"${p.name}" has been in progress for ${daysSince} days`,
            severity: "info",
          });
        }
        if (p.status === "lead" && daysSince > 30) {
          notifs.push({
            id: `stale-lead-${p.id}`,
            type: "project_stale",
            title: "Aging Lead",
            message: `"${p.name}" has been a lead for ${daysSince} days`,
            severity: "info",
          });
        }
      }

      setNotifications(notifs);
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(pendingId: string) {
    setProcessingId(pendingId);
    try {
      await projectService.approveCompletion(pendingId);
      setDismissed((prev) => new Set(prev).add(`pending-${pendingId}`));
      load();
      onProjectRefresh?.();
    } catch (err) {
      console.error("Failed to approve completion:", err);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(pendingId: string) {
    setProcessingId(pendingId);
    try {
      await projectService.rejectCompletion(pendingId);
      setDismissed((prev) => new Set(prev).add(`pending-${pendingId}`));
      load();
    } catch (err) {
      console.error("Failed to reject completion:", err);
    } finally {
      setProcessingId(null);
    }
  }

  const active = useMemo(() => notifications.filter((n) => !dismissed.has(n.id)), [notifications, dismissed]);
  const dangerCount = active.filter((n) => n.severity === "danger").length;
  const actionCount = active.filter((n) => n.severity === "action").length;
  const hasNotifications = active.length > 0;

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "danger": return <AlertCircle size={14} className="text-red-400 shrink-0" />;
      case "warning": return <Clock size={14} className="text-amber-400 shrink-0" />;
      case "action": return <CheckCircle size={14} className="text-purple-400 shrink-0" />;
      default: return <Briefcase size={14} className="text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setOpen(!open)}
        className={`p-2.5 rounded-xl glass-card text-gray-400 hover:text-white transition-all duration-200 relative ${
          hasNotifications ? "text-amber-400" : ""
        }`}
        title="Notifications"
      >
        <Bell size={18} />
        {hasNotifications && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white ${
            actionCount > 0 ? "bg-purple-500" : dangerCount > 0 ? "bg-red-500" : "bg-amber-500"
          }`}>
            {active.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[70] w-96 glass-card-elevated rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Bell size={14} className="text-[var(--accent)]" />
                Notifications
              </h3>
              {active.length > 0 && (
                <button
                  onClick={() => setDismissed(new Set(notifications.map((n) => n.id)))}
                  className="text-[10px] text-gray-500 hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {active.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-600 text-xs">
                  {loaded ? "All clear! No notifications." : "Loading..."}
                </div>
              ) : (
                active.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group ${
                    n.type === "pending_completion" ? "bg-purple-500/[0.03]" : ""
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {severityIcon(n.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/90">{n.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{n.message}</p>
                        {n.type === "pending_completion" && n.pendingId && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => handleApprove(n.pendingId!)}
                              disabled={processingId === n.pendingId}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2 py-1 transition-all disabled:opacity-50"
                            >
                              {processingId === n.pendingId ? (
                                <RefreshCw size={10} className="animate-spin" />
                              ) : (
                                <CheckCircle size={10} />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(n.pendingId!)}
                              disabled={processingId === n.pendingId}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-2 py-1 transition-all disabled:opacity-50"
                            >
                              <XCircle size={10} />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                      {n.type !== "pending_completion" && (
                        <button
                          onClick={() => setDismissed((prev) => new Set(prev).add(n.id))}
                          className="text-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
