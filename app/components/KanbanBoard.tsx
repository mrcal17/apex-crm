"use client";

import { useState, useMemo } from "react";
import { GripVertical, DollarSign, User, Clock, AlertTriangle } from "lucide-react";
import { projectService } from "../../lib/projectService";
import { relativeTime } from "../hooks/useRelativeTime";
import { computeHealthScore, HEALTH_COLORS } from "../../lib/healthScore";
import { _rl, type Role } from "../../lib/roles";

interface KanbanBoardProps {
  projects: any[];
  onRefresh: () => void;
  onSelectProject: (id: string) => void;
  role: Role;
}

const COLUMNS = [
  { key: "lead", label: "Leads", color: "border-cyan-500/30", headerBg: "bg-cyan-500/8", textColor: "text-cyan-400", dotColor: "bg-cyan-400" },
  { key: "in_progress", label: "In Progress", color: "border-amber-500/30", headerBg: "bg-amber-500/8", textColor: "text-amber-400", dotColor: "bg-amber-400" },
  { key: "completed", label: "Completed", color: "border-emerald-500/30", headerBg: "bg-emerald-500/8", textColor: "text-emerald-400", dotColor: "bg-emerald-400" },
  { key: "cancelled", label: "Cancelled", color: "border-red-500/30", headerBg: "bg-red-500/8", textColor: "text-red-400", dotColor: "bg-red-400" },
];

export default function KanbanBoard({ projects, onRefresh, onSelectProject, role }: KanbanBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = { lead: [], in_progress: [], completed: [], cancelled: [] };
    for (const p of projects) {
      if (map[p.status]) map[p.status].push(p);
    }
    return map;
  }, [projects]);

  // Stall detection
  const stalledIds = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    const stageTimes: Record<string, number[]> = {};
    for (const p of projects) {
      if (!p.created_at || p.status === "completed" || p.status === "cancelled") continue;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      if (!stageTimes[p.status]) stageTimes[p.status] = [];
      stageTimes[p.status].push(age);
    }
    const stageAvg: Record<string, number> = {};
    for (const [s, times] of Object.entries(stageTimes)) {
      stageAvg[s] = times.reduce((a, b) => a + b, 0) / times.length;
    }
    const stalled = new Set<string>();
    for (const p of projects) {
      if (!p.created_at || p.status === "completed" || p.status === "cancelled") continue;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      if (age > (stageAvg[p.status] || 14) * 2 && age > 7) stalled.add(p.id);
    }
    return stalled;
  }, [projects]);

  function handleDragStart(e: React.DragEvent, projectId: string) {
    setDragging(projectId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projectId);
  }

  function handleDragOver(e: React.DragEvent, columnKey: string) {
    e.preventDefault();
    setDragOver(columnKey);
  }

  async function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("text/plain");
    setDragging(null);
    setDragOver(null);
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.status === newStatus) return;
    try {
      if (newStatus === "completed") {
        if (_rl(role) < 2) {
          await projectService.requestCompletion(projectId);
          alert("Completion request submitted — awaiting manager/admin approval.");
        } else {
          await projectService.completeProject(projectId);
        }
      } else {
        await projectService.updateProject(projectId, { status: newStatus });
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to update project status:", err);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
      {COLUMNS.map((col, colIdx) => (
        <div
          key={col.key}
          onDragOver={(e) => handleDragOver(e, col.key)}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, col.key)}
          className={`glass-card-elevated rounded-2xl overflow-hidden border-t-2 ${col.color} transition-all duration-200 animate-slide-up opacity-0 stagger-${colIdx + 1}`}
          style={{ animationFillMode: 'forwards' }}
        >
          {dragOver === col.key && (
            <div className="absolute inset-0 rounded-2xl ring-1 ring-[var(--accent)]/25 bg-[var(--accent)]/[0.02] pointer-events-none z-10" />
          )}
          <div className={`px-4 py-3 ${col.headerBg} border-b border-white/[0.06]`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <h3 className={`text-sm font-display font-semibold ${col.textColor}`}>{col.label}</h3>
              </div>
              <span className="text-[11px] text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full font-mono">{grouped[col.key]?.length || 0}</span>
            </div>
          </div>
          <div className="p-3 space-y-2.5 min-h-[200px] max-h-[60vh] overflow-y-auto">
            {(grouped[col.key] || []).map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                onClick={() => onSelectProject(p.id)}
                className={`glass-card rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-white/10 hover:shadow-[0_0_12px_rgba(6,214,160,0.05)] transition-all duration-150 group ${
                  dragging === p.id ? "opacity-40 scale-95" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <GripVertical size={14} className="text-gray-700 group-hover:text-gray-500 mt-0.5 shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-white/90 truncate">{p.name}</p>
                      {p.status !== "completed" && p.status !== "cancelled" && (() => {
                        const h = computeHealthScore(p, [], []);
                        const c = HEALTH_COLORS[h.level];
                        return <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} title={h.label} />;
                      })()}
                    </div>
                    {p.client_name && (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{p.client_name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <DollarSign size={9} />${Number(p.contract_value || 0).toLocaleString()}
                      </span>
                      {p.profiles?.full_name && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5 truncate">
                          <User size={9} />{p.profiles.full_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {p.created_at && (
                        <p className="text-[9px] text-gray-600 flex items-center gap-0.5">
                          <Clock size={8} /> {relativeTime(p.created_at)}
                        </p>
                      )}
                      {stalledIds.has(p.id) && (
                        <span className="text-[9px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 font-medium">
                          <AlertTriangle size={8} /> Stalled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(grouped[col.key] || []).length === 0 && (
              <div className="flex items-center justify-center py-8 text-gray-600 text-xs border border-dashed border-white/[0.06] rounded-xl">
                Drop projects here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
