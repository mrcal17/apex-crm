"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Target,
  Users,
  ChevronRight,
  Trophy,
  XCircle,
} from "lucide-react";

interface WinLossAnalysisProps {
  projects: any[];
}

export default function WinLossAnalysis({ projects }: WinLossAnalysisProps) {
  const stats = useMemo(() => {
    const total = projects.length;
    const leads = projects.filter((p) => p.status === "lead").length;
    const inProgress = projects.filter((p) => p.status === "in_progress").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const cancelled = projects.filter((p) => p.status === "cancelled").length;
    const decided = completed + cancelled;

    const winRate = decided > 0 ? (completed / decided) * 100 : 0;
    const lossRate = total > 0 ? (cancelled / total) * 100 : 0;

    // Avg deal size of completed
    const completedProjects = projects.filter((p) => p.status === "completed");
    const totalWonValue = completedProjects.reduce(
      (s, p) => s + Number(p.contract_value ?? 0),
      0
    );
    const avgDealSize = completedProjects.length > 0 ? totalWonValue / completedProjects.length : 0;

    // Avg time to close (created_at -> updated_at for completed)
    let totalDays = 0;
    let countWithDates = 0;
    for (const p of completedProjects) {
      if (p.created_at && p.updated_at) {
        const days =
          (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / 86400000;
        if (days >= 0) {
          totalDays += days;
          countWithDates++;
        }
      }
    }
    const avgDaysToClose = countWithDates > 0 ? totalDays / countWithDates : 0;

    return { total, leads, inProgress, completed, cancelled, winRate, lossRate, avgDealSize, avgDaysToClose, totalWonValue };
  }, [projects]);

  // Close reasons breakdown
  const closeReasons = useMemo(() => {
    const wonReasons: Record<string, number> = {};
    const lostReasons: Record<string, number> = {};
    let wonTotal = 0;
    let lostTotal = 0;

    for (const p of projects) {
      if (!p.close_reason) continue;
      if (p.status === "completed") {
        wonReasons[p.close_reason] = (wonReasons[p.close_reason] || 0) + 1;
        wonTotal++;
      } else if (p.status === "cancelled") {
        lostReasons[p.close_reason] = (lostReasons[p.close_reason] || 0) + 1;
        lostTotal++;
      }
    }

    const toSorted = (obj: Record<string, number>, total: number) =>
      Object.entries(obj)
        .map(([reason, count]) => ({ reason, count, pct: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);

    return {
      won: toSorted(wonReasons, wonTotal),
      lost: toSorted(lostReasons, lostTotal),
      hasData: wonTotal + lostTotal > 0,
    };
  }, [projects]);

  // Monthly trends (last 12 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { label: string; key: string; won: number; lost: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months.push({ label, key, won: 0, lost: 0 });
    }

    for (const p of projects) {
      if (!p.created_at) continue;
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const month = months.find((m) => m.key === key);
      if (!month) continue;
      if (p.status === "completed") month.won++;
      else if (p.status === "cancelled") month.lost++;
    }

    const maxVal = Math.max(...months.map((m) => Math.max(m.won, m.lost)), 1);
    return { months, maxVal };
  }, [projects]);

  // Rep performance
  const repData = useMemo(() => {
    const reps: Record<string, { name: string; total: number; wins: number; losses: number; valueWon: number }> = {};

    for (const p of projects) {
      const repId = p.sales_rep_id || "unassigned";
      const repName = p.sales_rep_name || p.profiles?.full_name || "Unassigned";
      if (!reps[repId]) reps[repId] = { name: repName, total: 0, wins: 0, losses: 0, valueWon: 0 };
      reps[repId].total++;
      if (p.status === "completed") {
        reps[repId].wins++;
        reps[repId].valueWon += Number(p.contract_value ?? 0);
      } else if (p.status === "cancelled") {
        reps[repId].losses++;
      }
    }

    return Object.values(reps)
      .map((r) => ({
        ...r,
        winRate: r.wins + r.losses > 0 ? (r.wins / (r.wins + r.losses)) * 100 : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [projects]);

  const fmtCurrency = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v.toFixed(0)}`;

  const funnelStages = [
    { label: "Total Leads", count: stats.total, color: "bg-blue-500", pctOf: null as number | null },
    { label: "In Progress", count: stats.inProgress, color: "bg-[var(--accent-secondary)]", pctOf: stats.total },
    { label: "Won", count: stats.completed, color: "bg-[var(--accent)]", pctOf: stats.inProgress || stats.total },
    { label: "Lost", count: stats.cancelled, color: "bg-red-500", pctOf: stats.inProgress || stats.total },
  ];
  const maxFunnel = Math.max(...funnelStages.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Conversion Funnel */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--accent)]" />
          Conversion Funnel
        </h3>
        <div className="space-y-3">
          {funnelStages.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="text-sm text-[var(--text-secondary)] w-24 shrink-0">{stage.label}</span>
              <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full ${stage.color} rounded-lg transition-all duration-700`}
                  style={{ width: `${(stage.count / maxFunnel) * 100}%`, minWidth: stage.count > 0 ? "2rem" : 0 }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-sm font-medium text-white">
                  {stage.count}
                  {stage.pctOf !== null && stage.pctOf > 0 && (
                    <span className="text-white/60 ml-1">
                      ({((stage.count / stage.pctOf) * 100).toFixed(0)}%)
                    </span>
                  )}
                </span>
              </div>
              {i < funnelStages.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, icon: Trophy, color: "text-[var(--accent)]" },
          { label: "Avg Deal Size", value: fmtCurrency(stats.avgDealSize), icon: DollarSign, color: "text-[var(--accent-secondary)]" },
          { label: "Avg Time to Close", value: `${stats.avgDaysToClose.toFixed(0)}d`, icon: Clock, color: "text-[var(--accent-tertiary)]" },
          { label: "Loss Rate", value: `${stats.lossRate.toFixed(1)}%`, icon: TrendingDown, color: "text-red-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-[var(--text-secondary)]">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Close Reasons Breakdown */}
      {closeReasons.hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {closeReasons.won.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[var(--accent)]" />
                Won Reasons
              </h3>
              <div className="space-y-2">
                {closeReasons.won.map((r) => (
                  <div key={r.reason}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-secondary)]">{r.reason}</span>
                      <span className="text-[var(--text-tertiary)]">{r.count} ({r.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {closeReasons.lost.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                Lost Reasons
              </h3>
              <div className="space-y-2">
                {closeReasons.lost.map((r) => (
                  <div key={r.reason}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-secondary)]">{r.reason}</span>
                      <span className="text-[var(--text-tertiary)]">{r.count} ({r.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly Trends */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--accent-secondary)]" />
          Monthly Win/Loss Trends
        </h3>
        <div className="flex items-end gap-1 h-40">
          {monthlyData.months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
              {m.won > 0 && (
                <div
                  className="w-full bg-[var(--accent)] rounded-t opacity-80 hover:opacity-100 transition-opacity relative group"
                  style={{ height: `${(m.won / monthlyData.maxVal) * 100}%`, minHeight: "4px" }}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.won}
                  </span>
                </div>
              )}
              {m.lost > 0 && (
                <div
                  className="w-full bg-red-500 rounded-t opacity-80 hover:opacity-100 transition-opacity relative group"
                  style={{ height: `${(m.lost / monthlyData.maxVal) * 100}%`, minHeight: "4px" }}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.lost}
                  </span>
                </div>
              )}
              <span className="text-[9px] text-[var(--text-tertiary)] mt-1 truncate w-full text-center">
                {m.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[var(--accent)] inline-block" /> Won
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Lost
          </span>
        </div>
      </div>

      {/* Rep Performance Table */}
      {repData.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--accent-tertiary)]" />
            Rep Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-tertiary)] text-xs border-b border-white/10">
                  <th className="text-left py-2 pr-4">Rep</th>
                  <th className="text-center py-2 px-2">Total</th>
                  <th className="text-center py-2 px-2">Wins</th>
                  <th className="text-center py-2 px-2">Losses</th>
                  <th className="text-center py-2 px-2">Win Rate</th>
                  <th className="text-right py-2 pl-2">Value Won</th>
                </tr>
              </thead>
              <tbody>
                {repData.map((rep) => (
                  <tr key={rep.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2 pr-4 text-[var(--text-primary)] font-medium">{rep.name}</td>
                    <td className="py-2 px-2 text-center text-[var(--text-secondary)]">{rep.total}</td>
                    <td className="py-2 px-2 text-center text-[var(--accent)]">{rep.wins}</td>
                    <td className="py-2 px-2 text-center text-red-400">{rep.losses}</td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`font-semibold ${
                          rep.winRate >= 50 ? "text-[var(--accent)]" : "text-red-400"
                        }`}
                      >
                        {rep.winRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right text-[var(--text-secondary)]">
                      {fmtCurrency(rep.valueWon)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
