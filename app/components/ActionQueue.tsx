"use client";

import { useMemo } from "react";
import {
  Phone, AlertTriangle, Clock, DollarSign, FileText,
  Zap, ArrowRight, CheckCircle, UserPlus,
} from "lucide-react";

interface ActionItem {
  id: string;
  priority: number; // lower = higher priority
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  label: string;
  detail: string;
  category: "lead" | "project" | "permit" | "commission" | "task";
  action?: () => void;
}

interface ActionQueueProps {
  projects: any[];
  leads?: any[];
  permits?: any[];
  commissions?: any[];
  tasks?: any[];
  onSelectProject?: (id: string) => void;
  onNavigateTab?: (tab: string) => void;
  maxItems?: number;
}

export default function ActionQueue({
  projects,
  leads = [],
  permits = [],
  commissions = [],
  tasks = [],
  onSelectProject,
  onNavigateTab,
  maxItems = 8,
}: ActionQueueProps) {
  const actions = useMemo(() => {
    const items: ActionItem[] = [];
    const now = Date.now();
    const DAY = 86400000;

    // --- STALLED PROJECTS ---
    // Calculate average time per stage
    const stageTimes: Record<string, number[]> = {};
    for (const p of projects) {
      if (!p.created_at) continue;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      const status = p.status || "lead";
      if (status === "completed" || status === "cancelled") continue;
      if (!stageTimes[status]) stageTimes[status] = [];
      stageTimes[status].push(age);
    }
    const stageAvg: Record<string, number> = {};
    for (const [status, times] of Object.entries(stageTimes)) {
      stageAvg[status] = times.reduce((a, b) => a + b, 0) / times.length;
    }

    for (const p of projects) {
      if (!p.created_at || p.status === "completed" || p.status === "cancelled") continue;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      const avg = stageAvg[p.status] || 14;
      if (age > avg * 2 && age > 7) {
        const val = Number(p.contract_value || 0);
        items.push({
          id: `stall-${p.id}`,
          priority: 2,
          icon: Clock,
          iconColor: "text-amber-400",
          iconBg: "bg-amber-500/10",
          label: `${p.name} stalled`,
          detail: `${Math.round(age)} days in ${p.status === "lead" ? "lead" : "in progress"}${val > 0 ? ` — $${(val / 1000).toFixed(0)}k` : ""}`,
          category: "project",
          action: () => onSelectProject?.(p.id),
        });
      }
    }

    // --- STALLED DEALS SUMMARY ---
    const stalledDeals = projects.filter((p: any) => {
      if (!p.created_at || p.status === "completed" || p.status === "cancelled") return false;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      const avg = stageAvg[p.status] || 14;
      return age > avg * 2 && age > 7;
    });
    const stalledValue = stalledDeals.reduce((s: number, p: any) => s + Number(p.contract_value || 0), 0);
    if (stalledDeals.length >= 3) {
      // Replace individual stall items with a summary if there are many
      const stalledIds = new Set(stalledDeals.map((p: any) => `stall-${p.id}`));
      const filtered = items.filter(i => !stalledIds.has(i.id));
      filtered.push({
        id: "stall-summary",
        priority: 2,
        icon: AlertTriangle,
        iconColor: "text-amber-400",
        iconBg: "bg-amber-500/10",
        label: `${stalledDeals.length} deals stalled in pipeline`,
        detail: `$${(stalledValue / 1000).toFixed(0)}k total value — 14+ days without progress`,
        category: "project",
        action: () => onNavigateTab?.("kanban"),
      });
      items.length = 0;
      items.push(...filtered);
    }

    // --- EXPIRING PERMITS ---
    for (const permit of permits) {
      if (!permit.expiration_date || permit.status === "expired") continue;
      const exp = new Date(permit.expiration_date).getTime();
      const daysLeft = Math.round((exp - now) / DAY);
      if (daysLeft > 0 && daysLeft <= 14) {
        items.push({
          id: `permit-${permit.id}`,
          priority: daysLeft <= 3 ? 1 : 3,
          icon: FileText,
          iconColor: daysLeft <= 3 ? "text-red-400" : "text-amber-400",
          iconBg: daysLeft <= 3 ? "bg-red-500/10" : "bg-amber-500/10",
          label: `Permit ${permit.permit_number || ""} expires in ${daysLeft}d`,
          detail: `${permit.projects?.name || "Unknown project"} — ${permit.agency || "No agency"}`,
          category: "permit",
          action: () => onNavigateTab?.("permits"),
        });
      }
    }

    // --- UNPAID COMMISSIONS ---
    const unpaidComms = commissions.filter((c: any) => c.status === "unpaid");
    if (unpaidComms.length > 0) {
      const totalUnpaid = unpaidComms.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      items.push({
        id: "unpaid-commissions",
        priority: 4,
        icon: DollarSign,
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
        label: `${unpaidComms.length} commission${unpaidComms.length > 1 ? "s" : ""} pending payout`,
        detail: `$${totalUnpaid.toLocaleString()} total awaiting payment`,
        category: "commission",
        action: () => onNavigateTab?.("team"),
      });
    }

    // --- OVERDUE TASKS ---
    const overdueTasks = tasks.filter((t: any) => !t.completed && t.due_date && new Date(t.due_date).getTime() < now);
    if (overdueTasks.length > 0) {
      items.push({
        id: "overdue-tasks",
        priority: 1,
        icon: Zap,
        iconColor: "text-red-400",
        iconBg: "bg-red-500/10",
        label: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}`,
        detail: overdueTasks.length <= 2
          ? overdueTasks.map((t: any) => t.title).join(", ")
          : `${overdueTasks[0].title} and ${overdueTasks.length - 1} more`,
        category: "task",
      });
    }

    // --- UPCOMING TASKS (due within 2 days) ---
    const upcomingTasks = tasks.filter((t: any) => {
      if (t.completed || !t.due_date) return false;
      const due = new Date(t.due_date).getTime();
      return due >= now && due <= now + 2 * DAY;
    });
    if (upcomingTasks.length > 0) {
      items.push({
        id: "upcoming-tasks",
        priority: 3,
        icon: CheckCircle,
        iconColor: "text-blue-400",
        iconBg: "bg-blue-500/10",
        label: `${upcomingTasks.length} task${upcomingTasks.length > 1 ? "s" : ""} due soon`,
        detail: upcomingTasks.length <= 2
          ? upcomingTasks.map((t: any) => t.title).join(", ")
          : `${upcomingTasks[0].title} and ${upcomingTasks.length - 1} more`,
        category: "task",
      });
    }

    // --- NEW LEADS NEEDING ATTENTION ---
    const coldLeads = leads.filter((l: any) => {
      if (!l.created_at) return false;
      const age = (now - new Date(l.created_at).getTime()) / DAY;
      return age >= 3 && age <= 14 && !l.archived;
    });
    if (coldLeads.length > 0) {
      items.push({
        id: "aging-leads",
        priority: 3,
        icon: UserPlus,
        iconColor: "text-violet-400",
        iconBg: "bg-violet-500/10",
        label: `${coldLeads.length} lead${coldLeads.length > 1 ? "s" : ""} aging without conversion`,
        detail: coldLeads.length <= 2
          ? coldLeads.map((l: any) => l.name).join(", ")
          : `${coldLeads[0].name} and ${coldLeads.length - 1} more (3-14 days old)`,
        category: "lead",
        action: () => onNavigateTab?.("site-explorer"),
      });
    }

    // Sort by priority
    items.sort((a, b) => a.priority - b.priority);
    return items.slice(0, maxItems);
  }, [projects, leads, permits, commissions, tasks, maxItems, onSelectProject, onNavigateTab]);

  if (actions.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <CheckCircle size={16} className="text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white/90">Action Queue</h3>
        </div>
        <p className="text-sm text-gray-500">All clear — no urgent actions right now.</p>
      </div>
    );
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden mb-6">
      <div className="p-4 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/[0.04] to-transparent flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Zap size={14} className="text-violet-400" />
          </div>
          What To Do Next
          <span className="text-[10px] text-gray-500 font-normal ml-1">{actions.length} action{actions.length !== 1 ? "s" : ""}</span>
        </h3>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {actions.map((item) => (
          <div
            key={item.id}
            className={`px-4 py-3 flex items-center gap-3 transition-colors ${item.action ? "hover:bg-white/[0.02] cursor-pointer" : ""}`}
            onClick={item.action}
          >
            <div className={`p-2 rounded-lg ${item.iconBg} shrink-0`}>
              <item.icon size={14} className={item.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 font-medium truncate">{item.label}</p>
              <p className="text-xs text-gray-500 truncate">{item.detail}</p>
            </div>
            {item.action && <ArrowRight size={14} className="text-gray-600 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
