"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Award, Clock, DollarSign, BarChart3 } from "lucide-react";
import { projectService } from "../../lib/projectService";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const tooltipStyle = {
  contentStyle: {
    background: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(100,150,255,0.15)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "#e2e8f0",
  },
};

interface RepMetrics {
  id: string;
  name: string;
  totalDeals: number;
  wonDeals: number;
  winRate: number;
  avgDealSize: number;
  avgDaysToClose: number;
  totalRevenue: number;
  totalCommission: number;
  pipelineValue: number;
}

export default function SalesPerformance() {
  const [metrics, setMetrics] = useState<RepMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [profiles, projects, commissions] = await Promise.all([
          projectService.getProfiles(),
          projectService.getProjects(),
          projectService.getAllCommissions(),
        ]);

        const repMetrics: RepMetrics[] = (profiles || []).map((profile: any) => {
          const repProjects = (projects || []).filter((p: any) => p.sales_rep_id === profile.id);
          const repCommissions = (commissions || []).filter((c: any) => c.sales_rep_id === profile.id);

          const completed = repProjects.filter((p: any) => p.status === "completed");
          const totalDeals = repProjects.length;
          const wonDeals = completed.length;
          const winRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
          const avgDealSize = wonDeals > 0
            ? completed.reduce((s: number, p: any) => s + Number(p.contract_value ?? 0), 0) / wonDeals
            : 0;

          // Avg days to close: difference between created_at and when status changed to completed
          // Since we don't track status change date, use created_at to now for completed ones
          let avgDaysToClose = 0;
          if (completed.length > 0) {
            const now = new Date();
            const totalDays = completed.reduce((s: number, p: any) => {
              const created = new Date(p.created_at);
              return s + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            }, 0);
            avgDaysToClose = Math.round(totalDays / completed.length);
          }

          const totalRevenue = repProjects.reduce((s: number, p: any) => s + Number(p.revenue_collected ?? 0), 0);
          const totalCommission = repCommissions.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
          const pipelineValue = repProjects
            .filter((p: any) => p.status !== "completed" && p.status !== "cancelled")
            .reduce((s: number, p: any) => s + Number(p.contract_value ?? 0), 0);

          return {
            id: profile.id,
            name: profile.full_name || "Unknown",
            totalDeals,
            wonDeals,
            winRate,
            avgDealSize,
            avgDaysToClose,
            totalRevenue,
            totalCommission,
            pipelineValue,
          };
        });

        repMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue);
        setMetrics(repMetrics);
      } catch {
        console.error("Failed to load performance data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartData = useMemo(() =>
    metrics.map((m) => ({
      name: m.name.split(" ")[0],
      revenue: m.totalRevenue,
      pipeline: m.pipelineValue,
    })), [metrics]);

  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  if (loading) {
    return (
      <div className="glass-card-elevated rounded-2xl p-8 text-center text-gray-500 text-sm">
        <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-2" />
        Loading performance data...
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-8 text-center text-gray-500 text-sm">
        No sales data available yet.
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-6">
      {/* Chart */}
      {chartData.length > 0 && (
        <div className="glass-card-elevated rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-[var(--accent)]" />
            Revenue by Rep
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={50} />
              <Tooltip {...tooltipStyle} formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, ""]} />
              <Bar dataKey="revenue" fill="rgba(52,211,153,0.6)" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="pipeline" fill="rgba(0,170,255,0.4)" radius={[4, 4, 0, 0]} name="Pipeline" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.id} className="glass-card-elevated rounded-2xl p-5 hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center text-sm font-bold text-white/80">
                {m.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{m.name}</p>
                <p className="text-[10px] text-gray-500">{m.totalDeals} deal{m.totalDeals !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 flex items-center gap-1"><Award size={9} /> Win Rate</p>
                <p className={`text-sm font-bold ${m.winRate >= 50 ? "text-emerald-400" : m.winRate >= 25 ? "text-amber-400" : "text-red-400"}`}>
                  {m.winRate.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 flex items-center gap-1"><DollarSign size={9} /> Avg Deal</p>
                <p className="text-sm font-bold text-white/80">{fmt(m.avgDealSize)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={9} /> Avg Close</p>
                <p className="text-sm font-bold text-white/80">{m.avgDaysToClose}d</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 flex items-center gap-1"><TrendingUp size={9} /> Revenue</p>
                <p className="text-sm font-bold text-emerald-400">{fmt(m.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Commission</p>
                <p className="text-sm font-bold text-amber-400">{fmt(m.totalCommission)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Pipeline</p>
                <p className="text-sm font-bold text-[var(--accent)]">{fmt(m.pipelineValue)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
