"use client";

import { useMemo } from "react";
import { TrendingUp, Target, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface RevenueForecastProps {
  projects: any[];
  revenueGoal: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const tooltipStyle = {
  contentStyle: {
    background: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(100,150,255,0.15)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "#e2e8f0",
  },
};

export default function RevenueForecast({ projects, revenueGoal }: RevenueForecastProps) {
  const forecast = useMemo(() => {
    const now = new Date();

    // Historical: last 6 months of collected revenue
    const historical: { name: string; actual: number; forecast: number | null; month: number; year: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      historical.push({
        name: MONTH_NAMES[d.getMonth()],
        actual: 0,
        forecast: null,
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    }

    for (const p of projects) {
      if (!p.created_at || !p.revenue_collected || Number(p.revenue_collected) === 0) continue;
      const d = new Date(p.created_at);
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      if (monthsDiff >= 0 && monthsDiff < 6) {
        historical[5 - monthsDiff].actual += Number(p.revenue_collected);
      }
    }

    // Calculate historical close rate and avg deal value
    const completed = projects.filter((p: any) => p.status === "completed");
    const totalProjects = projects.length;
    const closeRate = totalProjects > 0 ? completed.length / totalProjects : 0;
    const avgDealValue = completed.length > 0
      ? completed.reduce((s: number, p: any) => s + Number(p.contract_value ?? 0), 0) / completed.length
      : 0;

    // Pipeline value
    const pipelineProjects = projects.filter((p: any) => p.status === "lead" || p.status === "in_progress");
    const pipelineValue = pipelineProjects.reduce((s: number, p: any) => s + Number(p.contract_value ?? 0), 0);

    // Monthly avg from last 3 months that had revenue
    const recentMonths = historical.slice(-3).filter((m) => m.actual > 0);
    const monthlyAvg = recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.actual, 0) / recentMonths.length
      : 0;

    // Forecast next 6 months
    const forecastData: typeof historical = [];
    let cumForecast = historical.reduce((s, m) => s + m.actual, 0);

    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      // Forecast = monthly avg + weighted pipeline conversion
      const pipelineContribution = (pipelineValue * closeRate) / 6;
      const monthForecast = monthlyAvg + pipelineContribution;
      cumForecast += monthForecast;
      forecastData.push({
        name: MONTH_NAMES[d.getMonth()],
        actual: 0,
        forecast: Math.round(monthForecast),
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    }

    // Bridge: last actual month connects to first forecast
    const lastActual = historical[historical.length - 1];
    const bridgedForecast = [...forecastData];
    if (bridgedForecast.length > 0) {
      bridgedForecast[0] = { ...bridgedForecast[0], actual: lastActual.actual };
    }

    const totalCollected = historical.reduce((s, m) => s + m.actual, 0);
    const forecastTotal = forecastData.reduce((s, m) => s + (m.forecast || 0), 0);
    const projectedAnnual = totalCollected + forecastTotal;

    // Compute Y-axis domain that scales around the data
    const allValues = [
      ...historical.map((m) => m.actual),
      ...forecastData.map((m) => m.forecast || 0),
    ].filter((v) => v > 0);
    const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
    const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
    const goalMonthly = revenueGoal > 0 ? revenueGoal / 12 : 0;
    const domainMax = Math.max(maxVal, goalMonthly);
    const padding = domainMax * 0.15;
    const yMin = Math.max(0, Math.floor((minVal - padding) / 1000) * 1000);
    const yMax = Math.ceil((domainMax + padding) / 1000) * 1000;

    return {
      chartData: [...historical, ...bridgedForecast],
      closeRate,
      avgDealValue,
      pipelineValue,
      monthlyAvg,
      projectedAnnual,
      totalCollected,
      forecastTotal,
      yDomain: [yMin, yMax] as [number, number],
    };
  }, [projects, revenueGoal]);

  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtK = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-purple-500/[0.04] to-transparent">
        <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <TrendingUp size={18} className="text-purple-400" />
          </div>
          Revenue Forecast
        </h2>
      </div>

      <div className="p-5">
        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="glass-card rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-500 flex items-center gap-1"><Target size={9} /> Close Rate</p>
            <p className="text-lg font-display font-bold text-white">{(forecast.closeRate * 100).toFixed(0)}%</p>
          </div>
          <div className="glass-card rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-500 flex items-center gap-1"><Zap size={9} /> Avg Deal</p>
            <p className="text-lg font-display font-bold text-white">{fmtK(forecast.avgDealValue)}</p>
          </div>
          <div className="glass-card rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-500">Pipeline</p>
            <p className="text-lg font-display font-bold text-[var(--accent)]">{fmtK(forecast.pipelineValue)}</p>
          </div>
          <div className="glass-card rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-500">Projected (12mo)</p>
            <p className={`text-lg font-display font-bold ${forecast.projectedAnnual >= revenueGoal ? "text-emerald-400" : "text-amber-400"}`}>
              {fmtK(forecast.projectedAnnual)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={forecast.chartData}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis domain={forecast.yDomain} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} width={50} />
            <Tooltip {...tooltipStyle} formatter={(value: any) => [fmt(Number(value || 0)), ""]} />
            {revenueGoal > 0 && (
              <ReferenceLine y={revenueGoal / 12} stroke="rgba(251,191,36,0.3)" strokeDasharray="6 4" label={{ value: "Goal", fontSize: 10, fill: "#fbbf24", position: "right" }} />
            )}
            <Area type="monotone" dataKey="actual" stroke="var(--accent)" fill="url(#gradActual)" strokeWidth={2} name="Actual" connectNulls={false} />
            <Area type="monotone" dataKey="forecast" stroke="#a78bfa" fill="url(#gradForecast)" strokeWidth={2} strokeDasharray="6 4" name="Forecast" connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>

        <div className="flex items-center justify-center gap-6 mt-3">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-3 h-0.5 bg-[var(--accent)] rounded" /> Actual
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-3 h-0.5 bg-purple-400 rounded border-dashed" style={{ borderBottom: "1px dashed #a78bfa" }} /> Forecast
          </span>
        </div>
      </div>
    </div>
  );
}
