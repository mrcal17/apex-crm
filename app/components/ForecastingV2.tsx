"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Target, Calendar, DollarSign, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface ForecastingV2Props {
  projects: any[];
  revenueGoal: number;
}

const STAGE_PROBABILITIES: Record<string, number> = {
  lead: 0.2,
  in_progress: 0.6,
  completed: 1.0,
  cancelled: 0,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ForecastingV2({ projects, revenueGoal }: ForecastingV2Props) {
  const [forecastMonths, setForecastMonths] = useState(6);
  const [view, setView] = useState<"weighted" | "goals" | "monthly">("weighted");

  // Weighted pipeline: contract_value * stage_probability
  const weightedPipeline = useMemo(() => {
    let total = 0;
    const byStage: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const p of projects) {
      const prob = p.stage_probability ?? STAGE_PROBABILITIES[p.status] ?? 0;
      const val = Number(p.contract_value || 0);
      const w = val * prob;
      total += w;
      if (!byStage[p.status]) byStage[p.status] = { count: 0, value: 0, weighted: 0 };
      byStage[p.status].count++;
      byStage[p.status].value += val;
      byStage[p.status].weighted += w;
    }
    return { total, byStage };
  }, [projects]);

  // Monthly projections based on historical close rates
  const monthlyProjections = useMemo(() => {
    const now = new Date();
    const completedProjects = projects.filter((p) => p.status === "completed");
    const months: { label: string; actual: number; projected: number }[] = [];

    // Last 6 months actual
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      const monthRevenue = completedProjects
        .filter((p) => {
          const cd = new Date(p.created_at);
          return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
        })
        .reduce((s, p) => s + Number(p.contract_value || 0), 0);
      months.push({ label, actual: monthRevenue, projected: 0 });
    }

    // Average monthly revenue for projections
    const avgMonthly = months.reduce((s, m) => s + m.actual, 0) / Math.max(months.filter((m) => m.actual > 0).length, 1);

    // Future months projected
    for (let i = 1; i <= forecastMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      // Apply growth/decline trend
      const trend = months.length >= 2
        ? (months[months.length - 1].actual - months[months.length - 2].actual) / Math.max(months[months.length - 2].actual, 1)
        : 0;
      const projected = Math.max(0, avgMonthly * (1 + trend * 0.5));
      months.push({ label, actual: 0, projected });
    }

    return months;
  }, [projects, forecastMonths]);

  // Goal tracking
  const goalTracking = useMemo(() => {
    const totalCollected = projects
      .filter((p) => p.status === "completed")
      .reduce((s, p) => s + Number(p.revenue_collected || 0), 0);
    const pct = revenueGoal > 0 ? (totalCollected / revenueGoal) * 100 : 0;
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const expectedPct = (dayOfYear / 365) * 100;
    const pace = expectedPct > 0 ? pct / expectedPct : 0;
    return { totalCollected, pct, expectedPct, pace, gap: revenueGoal - totalCollected };
  }, [projects, revenueGoal]);

  const maxBar = useMemo(() => Math.max(...monthlyProjections.map((m) => m.actual + m.projected), 1), [monthlyProjections]);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--accent)]" /> Revenue Forecast
        </h3>
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {(["weighted", "goals", "monthly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${view === v ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-gray-500 hover:text-white"}`}
            >
              {v === "weighted" ? "Pipeline" : v === "goals" ? "Goals" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {view === "weighted" && (
        <div className="space-y-4">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-bold text-white">${(weightedPipeline.total / 1000).toFixed(1)}k</span>
            <span className="text-xs text-gray-500">weighted pipeline</span>
          </div>
          <div className="space-y-2">
            {Object.entries(weightedPipeline.byStage)
              .sort((a, b) => b[1].weighted - a[1].weighted)
              .map(([status, data]) => {
                const prob = STAGE_PROBABILITIES[status] ?? 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-24 capitalize">{status.replace(/_/g, " ")}</span>
                    <div className="flex-1 h-6 bg-white/[0.04] rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-[var(--accent)]/30 rounded-lg transition-all"
                        style={{ width: `${weightedPipeline.total > 0 ? (data.weighted / weightedPipeline.total) * 100 : 0}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/60">
                        ${(data.weighted / 1000).toFixed(1)}k ({Math.round(prob * 100)}%)
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{data.count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {view === "goals" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Goal</p>
              <p className="text-sm font-bold text-white">${(revenueGoal / 1000).toFixed(0)}k</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Collected</p>
              <p className="text-sm font-bold text-emerald-400">${(goalTracking.totalCollected / 1000).toFixed(0)}k</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Remaining</p>
              <p className="text-sm font-bold text-amber-400">${(goalTracking.gap / 1000).toFixed(0)}k</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)] rounded-full transition-all" style={{ width: `${Math.min(goalTracking.pct, 100)}%` }} />
            </div>
            {/* Expected pace marker */}
            <div className="absolute top-0 h-4 w-0.5 bg-white/30" style={{ left: `${Math.min(goalTracking.expectedPct, 100)}%` }} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500">{goalTracking.pct.toFixed(1)}% achieved</span>
              <span className="text-[10px] text-gray-500">{goalTracking.expectedPct.toFixed(0)}% expected</span>
            </div>
          </div>

          {/* Pace indicator */}
          <div className={`flex items-center gap-2 p-3 rounded-xl ${goalTracking.pace >= 1 ? "bg-emerald-500/10 text-emerald-400" : goalTracking.pace >= 0.8 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
            {goalTracking.pace >= 1 ? <ArrowUp size={14} /> : goalTracking.pace >= 0.8 ? <Minus size={14} /> : <ArrowDown size={14} />}
            <span className="text-xs font-medium">
              {goalTracking.pace >= 1 ? "Ahead of pace" : goalTracking.pace >= 0.8 ? "On track" : "Behind pace"} — {(goalTracking.pace * 100).toFixed(0)}% of expected
            </span>
          </div>
        </div>
      )}

      {view === "monthly" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Forecast months:</span>
            <select value={forecastMonths} onChange={(e) => setForecastMonths(Number(e.target.value))} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white/80">
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </div>
          <div className="space-y-1">
            {monthlyProjections.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-14 shrink-0">{m.label}</span>
                <div className="flex-1 h-5 bg-white/[0.03] rounded overflow-hidden flex">
                  {m.actual > 0 && (
                    <div className="h-full bg-[var(--accent)]/40" style={{ width: `${(m.actual / maxBar) * 100}%` }} />
                  )}
                  {m.projected > 0 && (
                    <div className="h-full bg-[var(--accent-secondary)]/25 border-l border-dashed border-white/10" style={{ width: `${(m.projected / maxBar) * 100}%` }} />
                  )}
                </div>
                <span className="text-[10px] text-gray-400 w-16 text-right">
                  ${((m.actual + m.projected) / 1000).toFixed(1)}k
                  {m.projected > 0 && <span className="text-[var(--accent-secondary)]"> *</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[var(--accent)]/40 rounded" /> Actual</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[var(--accent-secondary)]/25 rounded" /> Projected</span>
          </div>
        </div>
      )}
    </div>
  );
}
