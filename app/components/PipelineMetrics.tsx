"use client";

import { useMemo, useState, useEffect } from "react";
import { TrendingUp, Target, Zap, BarChart3, ArrowRight, Clock } from "lucide-react";
import { leadService } from "../../lib/leadService";

interface PipelineMetricsProps {
  projects: any[];
}

export default function PipelineMetrics({ projects }: PipelineMetricsProps) {
  const [conversionStats, setConversionStats] = useState<{
    total: number; converted: number; conversionRate: number; avgDaysToConvert: number;
  } | null>(null);

  useEffect(() => {
    leadService.getConversionStats().then(setConversionStats).catch(() => {});
  }, []);

  const metrics = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter(p => p.status === "completed").length;
    const cancelled = projects.filter(p => p.status === "cancelled").length;
    const active = projects.filter(p => p.status === "in_progress").length;
    const leads = projects.filter(p => p.status === "lead").length;

    // Win rate: completed / (completed + cancelled) — excludes active/leads
    const decided = completed + cancelled;
    const winRate = decided > 0 ? (completed / decided) * 100 : 0;

    // Pipeline velocity: avg days from creation to completion for completed projects
    let totalDays = 0;
    let completedWithDates = 0;
    for (const p of projects) {
      if (p.status === "completed" && p.created_at && p.updated_at) {
        const days = (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / 86400000;
        if (days >= 0) {
          totalDays += days;
          completedWithDates++;
        }
      }
    }
    const avgDaysToClose = completedWithDates > 0 ? totalDays / completedWithDates : 0;

    // Average deal size
    const totalValue = projects.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
    const avgDealSize = total > 0 ? totalValue / total : 0;

    // Completed deal avg size
    const completedValue = projects
      .filter(p => p.status === "completed")
      .reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
    const avgWonDealSize = completed > 0 ? completedValue / completed : 0;

    return { total, completed, cancelled, active, leads, winRate, avgDaysToClose, avgDealSize, avgWonDealSize };
  }, [projects]);

  if (projects.length === 0) return null;

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
        <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <BarChart3 size={18} className="text-purple-400" />
          </div>
          Pipeline Metrics
        </h2>
      </div>

      <div className="p-5">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Win Rate */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-display font-bold text-emerald-400">{metrics.winRate.toFixed(1)}%</p>
            <p className="text-[10px] text-gray-500 mt-1">Win Rate</p>
            <p className="text-[9px] text-gray-600">{metrics.completed}W / {metrics.cancelled}L</p>
          </div>

          {/* Avg Days to Close */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap size={16} className="text-amber-400" />
            </div>
            <p className="text-2xl font-display font-bold text-amber-400">{metrics.avgDaysToClose.toFixed(0)}</p>
            <p className="text-[10px] text-gray-500 mt-1">Avg Days to Close</p>
            <p className="text-[9px] text-gray-600">Pipeline Velocity</p>
          </div>

          {/* Average Deal Size */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp size={16} className="text-[var(--accent)]" />
            </div>
            <p className="text-2xl font-display font-bold text-[var(--accent)]">${(metrics.avgWonDealSize / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-gray-500 mt-1">Avg Won Deal</p>
            <p className="text-[9px] text-gray-600">{metrics.completed} deals</p>
          </div>

          {/* Lead Conversion */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <ArrowRight size={16} className="text-purple-400" />
            </div>
            {conversionStats ? (
              <>
                <p className="text-2xl font-display font-bold text-purple-400">{conversionStats.conversionRate.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-500 mt-1">Lead Conversion</p>
                <p className="text-[9px] text-gray-600">{conversionStats.converted}/{conversionStats.total} leads</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-display font-bold text-purple-400">—</p>
                <p className="text-[10px] text-gray-500 mt-1">Lead Conversion</p>
              </>
            )}
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div>
          <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-3">Pipeline Funnel</h3>
          <div className="space-y-2">
            {[
              { label: "Leads", count: metrics.leads, color: "bg-blue-500", width: metrics.total > 0 ? (metrics.leads / metrics.total) * 100 : 0 },
              { label: "In Progress", count: metrics.active, color: "bg-amber-500", width: metrics.total > 0 ? (metrics.active / metrics.total) * 100 : 0 },
              { label: "Won", count: metrics.completed, color: "bg-emerald-500", width: metrics.total > 0 ? (metrics.completed / metrics.total) * 100 : 0 },
              { label: "Lost", count: metrics.cancelled, color: "bg-red-500", width: metrics.total > 0 ? (metrics.cancelled / metrics.total) * 100 : 0 },
            ].map((stage) => (
              <div key={stage.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-400">{stage.label}</span>
                  <span className="text-gray-500">{stage.count}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.04]">
                  <div className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                    style={{ width: `${Math.max(stage.width, stage.count > 0 ? 2 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Avg conversion time */}
        {conversionStats && conversionStats.avgDaysToConvert > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Clock size={12} />
            Average lead-to-project conversion: <span className="text-white font-medium">{conversionStats.avgDaysToConvert.toFixed(1)} days</span>
          </div>
        )}
      </div>
    </div>
  );
}
