"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { STATUS_CONFIG, formatStatus } from "../../lib/statusConfig";

interface DashboardChartsProps {
  projects: any[];
  commissions: any[];
}

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.chartColor])
);

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const tooltipStyle = {
  contentStyle: {
    background: "rgba(14, 21, 41, 0.95)",
    border: "1px solid rgba(6,214,160,0.12)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "#e2e8f0",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 0 16px rgba(6,214,160,0.04)",
  },
  cursor: { fill: "rgba(6,214,160,0.04)" },
};

export default function DashboardCharts({ projects, commissions }: DashboardChartsProps) {
  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    const now = new Date();
    const months: { name: string; pipeline: number; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ name: MONTH_NAMES[d.getMonth()], pipeline: 0, collected: 0 });
    }
    for (const p of projects) {
      if (!p.created_at) continue;
      const d = new Date(p.created_at);
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      if (monthsDiff >= 0 && monthsDiff < 6) {
        const idx = 5 - monthsDiff;
        months[idx].pipeline += Number(p.contract_value ?? 0);
        months[idx].collected += Number(p.revenue_collected ?? 0);
      }
    }
    return months;
  }, [projects]);

  // Project status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: formatStatus(name),
      value,
      fill: STATUS_COLORS[name] || "#94a3b8",
    }));
  }, [projects]);

  // Commission trend (last 6 months)
  const commissionTrend = useMemo(() => {
    const now = new Date();
    const months: { name: string; paid: number; unpaid: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ name: MONTH_NAMES[d.getMonth()], paid: 0, unpaid: 0 });
    }
    for (const c of commissions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      if (monthsDiff >= 0 && monthsDiff < 6) {
        const idx = 5 - monthsDiff;
        const amt = Number(c.amount ?? 0);
        if (c.status === "paid") months[idx].paid += amt;
        else months[idx].unpaid += amt;
      }
    }
    return months;
  }, [commissions]);

  if (projects.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
      {/* Revenue Bar Chart */}
      <div className="glass-card-elevated rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-4">Revenue (6 mo)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenueByMonth} barGap={2}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={45} />
            <Tooltip {...tooltipStyle} formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, ""]} />
            <Bar dataKey="pipeline" fill="rgba(0,180,216,0.5)" radius={[4, 4, 0, 0]} name="Pipeline" />
            <Bar dataKey="collected" fill="rgba(52,211,153,0.7)" radius={[4, 4, 0, 0]} name="Collected" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status Donut */}
      <div className="glass-card-elevated rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-4">Project Status</h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {statusData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
          {statusData.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
              {s.name} ({s.value})
            </span>
          ))}
        </div>
      </div>

      {/* Commission Trend Area */}
      <div className="glass-card-elevated rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-4">Commissions (6 mo)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={commissionTrend}>
            <defs>
              <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradUnpaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={45} />
            <Tooltip {...tooltipStyle} formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, ""]} />
            <Area type="monotone" dataKey="paid" stroke="#34d399" fill="url(#gradPaid)" strokeWidth={2} name="Paid" />
            <Area type="monotone" dataKey="unpaid" stroke="#fbbf24" fill="url(#gradUnpaid)" strokeWidth={2} name="Unpaid" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
