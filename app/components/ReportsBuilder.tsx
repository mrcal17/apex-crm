"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileBarChart, Save, Download, Trash2, Calendar, ChevronUp, ChevronDown,
  FolderOpen, Loader2, Check, X, TrendingUp, Hash, Percent, DollarSign,
  BarChart3, Users, FileText, Shield, Briefcase,
} from "lucide-react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";

type ReportType = "pipeline" | "revenue" | "commissions" | "permits" | "team";
type GroupBy = "status" | "sales_rep" | "month" | "quarter";
type Metric = "count" | "total_value" | "avg_value" | "win_rate";
type DatePreset = "7d" | "30d" | "90d" | "ytd" | "all";

interface ReportConfig {
  reportType: ReportType;
  datePreset: DatePreset | "custom";
  dateFrom: string;
  dateTo: string;
  groupBy: GroupBy;
  metrics: Metric[];
}

interface SavedReport { id: string; name: string; report_type: string; config: ReportConfig; created_at: string; }
interface ResultRow { group: string; count: number; total_value: number; avg_value: number; win_rate: number; }
interface ReportsBuilderProps { projects: any[]; commissions: any[]; permits: any[]; }

const REPORT_TYPES: { value: ReportType; label: string; icon: any; color: string }[] = [
  { value: "pipeline", label: "Pipeline", icon: BarChart3, color: "var(--accent)" },
  { value: "revenue", label: "Revenue", icon: DollarSign, color: "var(--accent)" },
  { value: "commissions", label: "Commissions", icon: Briefcase, color: "var(--accent-secondary)" },
  { value: "permits", label: "Permits", icon: FileText, color: "var(--accent-secondary)" },
  { value: "team", label: "Team", icon: Users, color: "var(--accent-tertiary)" },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

const METRIC_OPTIONS: { value: Metric; label: string; icon: any }[] = [
  { value: "count", label: "Count", icon: Hash },
  { value: "total_value", label: "Total Value", icon: DollarSign },
  { value: "avg_value", label: "Avg Value", icon: TrendingUp },
  { value: "win_rate", label: "Win Rate", icon: Percent },
];

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

function getPresetRange(preset: DatePreset): [Date, Date] {
  const now = new Date();
  switch (preset) {
    case "7d": return [new Date(now.getTime() - 7 * 86400000), now];
    case "30d": return [new Date(now.getTime() - 30 * 86400000), now];
    case "90d": return [new Date(now.getTime() - 90 * 86400000), now];
    case "ytd": return [new Date(now.getFullYear(), 0, 1), now];
    case "all": return [new Date(2000, 0, 1), now];
  }
}

function toQuarter(d: Date) { return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`; }
function toMonth(d: Date) { return d.toLocaleString("default", { month: "short", year: "2-digit" }); }
function fmt(n: number, currency: boolean) {
  if (currency) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

const DEFAULT_CONFIG: ReportConfig = {
  reportType: "pipeline", datePreset: "all", dateFrom: "", dateTo: "", groupBy: "status", metrics: ["count", "total_value"],
};

export default function ReportsBuilder({ projects, commissions, permits }: ReportsBuilderProps) {
  const { profileId } = useAuth();
  const [config, setConfig] = useState<ReportConfig>({ ...DEFAULT_CONFIG });
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [sortCol, setSortCol] = useState<string>("group");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const fetchSavedReports = useCallback(async () => {
    setLoadingReports(true);
    const { data } = await supabase.from("saved_reports").select("*").order("created_at", { ascending: false });
    if (data) setSavedReports(data as SavedReport[]);
    setLoadingReports(false);
  }, []);

  useEffect(() => { fetchSavedReports(); }, [fetchSavedReports]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    await supabase.from("saved_reports").insert({ name: saveName.trim(), report_type: config.reportType, config: config as any, created_by: profileId });
    setSaveName(""); setShowSaveInput(false);
    await fetchSavedReports();
    setSaving(false);
  };

  const handleDelete = async (id: string) => { await supabase.from("saved_reports").delete().eq("id", id); fetchSavedReports(); };
  const loadReport = (report: SavedReport) => { setConfig(report.config); };

  const toggleMetric = (m: Metric) => {
    setConfig((prev) => {
      const has = prev.metrics.includes(m);
      const next = has ? prev.metrics.filter((x) => x !== m) : [...prev.metrics, m];
      return { ...prev, metrics: next.length ? next : prev.metrics };
    });
  };

  const [dateFrom, dateTo] = useMemo(() => {
    if (config.datePreset === "custom") {
      return [config.dateFrom ? new Date(config.dateFrom) : new Date(2000, 0, 1), config.dateTo ? new Date(config.dateTo) : new Date()];
    }
    return getPresetRange(config.datePreset as DatePreset);
  }, [config.datePreset, config.dateFrom, config.dateTo]);

  const sourceData = useMemo(() => {
    let data: any[];
    switch (config.reportType) {
      case "commissions": data = commissions; break;
      case "permits": data = permits; break;
      default: data = projects;
    }
    return data.filter((item) => {
      const d = new Date(item.created_at || "");
      return d >= dateFrom && d <= dateTo;
    });
  }, [config.reportType, projects, commissions, permits, dateFrom, dateTo]);

  const results: ResultRow[] = useMemo(() => {
    const groups: Record<string, any[]> = {};
    sourceData.forEach((item) => {
      let key: string;
      const d = new Date(item.created_at || "");
      switch (config.groupBy) {
        case "status": key = item.status || "Unknown"; break;
        case "sales_rep":
          key = item.profiles?.full_name || item.full_name || "Unassigned"; break;
        case "month": key = toMonth(d); break;
        case "quarter": key = toQuarter(d); break;
        default: key = "All";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).map(([group, items]) => {
      const values = items.map((i) => Number(i.contract_value || i.amount || i.value || 0));
      const total = values.reduce((s, v) => s + v, 0);
      const won = items.filter((i) => i.status === "completed" || i.status === "approved" || i.status === "paid").length;
      return { group, count: items.length, total_value: total, avg_value: items.length ? total / items.length : 0, win_rate: items.length ? (won / items.length) * 100 : 0 };
    });
  }, [sourceData, config.groupBy]);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = (a as any)[sortCol]; const bVal = (b as any)[sortCol];
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [results, sortCol, sortDir]);

  const totals = useMemo(() => {
    const tc = results.reduce((s, r) => s + r.count, 0);
    const tv = results.reduce((s, r) => s + r.total_value, 0);
    return { group: "Total", count: tc, total_value: tv, avg_value: tc ? tv / tc : 0, win_rate: tc ? (results.reduce((s, r) => s + (r.win_rate / 100) * r.count, 0) / tc) * 100 : 0 };
  }, [results]);

  // Visual bar data for the mini chart
  const maxValue = useMemo(() => Math.max(...results.map((r) => r.total_value), 1), [results]);

  const exportCsv = () => {
    const cols = ["Group", ...config.metrics.map((m) => METRIC_OPTIONS.find((o) => o.value === m)!.label)];
    const rows = sortedResults.map((r) => [r.group, ...config.metrics.map((m) => (r as any)[m])].join(","));
    rows.push([totals.group, ...config.metrics.map((m) => (totals as any)[m])].join(","));
    const blob = new Blob([[cols.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report-${config.reportType}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortArrow = ({ col }: { col: string }) =>
    sortCol === col ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-[var(--accent)]" /> : <ChevronDown className="w-3 h-3 inline ml-0.5 text-[var(--accent)]" />) : null;

  const activeType = REPORT_TYPES.find((t) => t.value === config.reportType);

  return (
    <div className="space-y-5">
      {/* ── Top bar: Report type selector + actions ── */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Report type pills */}
          <div className="flex items-center gap-1.5">
            {REPORT_TYPES.map((t) => {
              const Icon = t.icon;
              const active = config.reportType === t.value;
              return (
                <button key={t.value} onClick={() => setConfig((c) => ({ ...c, reportType: t.value }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${active ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"}`}>
                  <Icon size={13} style={active ? { color: t.color } : undefined} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} disabled={!results.length}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-[var(--accent-secondary)] bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.06] transition-all disabled:opacity-30">
              <Download size={12} /> CSV
            </button>
            {!showSaveInput ? (
              <button onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-[var(--accent)] bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.06] transition-all">
                <Save size={12} /> Save
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="Report name..." autoFocus
                  className="bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 w-36 focus:outline-none focus:border-[var(--accent)]/40" />
                <button onClick={handleSave} disabled={saving || !saveName.trim()}
                  className="p-1.5 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 disabled:opacity-40 transition-colors">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
                <button onClick={() => { setShowSaveInput(false); setSaveName(""); }}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Config bar: Filters row ── */}
      <div className="glass-card rounded-2xl px-4 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-gray-500" />
            <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5">
              {DATE_PRESETS.map((p) => (
                <button key={p.value} onClick={() => setConfig((c) => ({ ...c, datePreset: p.value }))}
                  className={`px-2 py-1 text-[11px] rounded-md transition-all ${config.datePreset === p.value ? "bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]" : "text-gray-500 hover:text-white"}`}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => setConfig((c) => ({ ...c, datePreset: "custom" }))}
                className={`px-2 py-1 text-[11px] rounded-md transition-all ${config.datePreset === "custom" ? "bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]" : "text-gray-500 hover:text-white"}`}>
                Custom
              </button>
            </div>
            {config.datePreset === "custom" && (
              <div className="flex items-center gap-1.5 ml-1">
                <input type="date" value={config.dateFrom} onChange={(e) => setConfig((c) => ({ ...c, dateFrom: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-1 text-[11px] text-white/80" />
                <span className="text-[10px] text-gray-600">—</span>
                <input type="date" value={config.dateTo} onChange={(e) => setConfig((c) => ({ ...c, dateTo: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-1 text-[11px] text-white/80" />
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Group by */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Group</span>
            <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5">
              {GROUP_OPTIONS.map((g) => (
                <button key={g.value} onClick={() => setConfig((c) => ({ ...c, groupBy: g.value }))}
                  className={`px-2 py-1 text-[11px] rounded-md transition-all ${config.groupBy === g.value ? "bg-[var(--accent-tertiary)]/15 text-[var(--accent-tertiary)]" : "text-gray-500 hover:text-white"}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Metrics */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Show</span>
            {METRIC_OPTIONS.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.value} onClick={() => toggleMetric(m.value)}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all ${config.metrics.includes(m.value) ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "text-gray-600 hover:text-gray-300"}`}>
                  <Icon size={10} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main content: Results + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
        {/* Results */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Summary bar */}
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400">
                {sortedResults.length} group{sortedResults.length !== 1 ? "s" : ""} &middot; {totals.count} record{totals.count !== 1 ? "s" : ""}
              </span>
              {totals.total_value > 0 && (
                <span className="text-xs font-medium text-white/70">{fmt(totals.total_value, true)} total</span>
              )}
            </div>
          </div>

          {sortedResults.length === 0 ? (
            <div className="text-center py-16">
              <FileBarChart className="w-8 h-8 mx-auto mb-3 text-gray-700" />
              <p className="text-sm text-gray-500">No data matches the current filters</p>
              <p className="text-xs text-gray-600 mt-1">Try adjusting the date range or report type</p>
            </div>
          ) : (
            <div>
              {/* Visual bars + table hybrid */}
              <div className="divide-y divide-white/[0.04]">
                {sortedResults.map((row) => (
                  <div key={row.group} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                    {/* Group name */}
                    <div className="w-28 shrink-0">
                      <span className="text-sm text-white/80 font-medium capitalize">{row.group.replace(/_/g, " ")}</span>
                    </div>

                    {/* Visual bar */}
                    <div className="flex-1 h-7 bg-white/[0.02] rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-500"
                        style={{
                          width: `${Math.max((row.total_value / maxValue) * 100, 2)}%`,
                          background: `linear-gradient(90deg, ${activeType?.color || "var(--accent)"}25, ${activeType?.color || "var(--accent)"}15)`,
                          borderRight: `2px solid ${activeType?.color || "var(--accent)"}60`,
                        }}
                      />
                      {row.total_value > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">
                          {fmt(row.total_value, true)}
                        </span>
                      )}
                    </div>

                    {/* Metric values */}
                    <div className="flex items-center gap-4 shrink-0">
                      {config.metrics.includes("count") && (
                        <div className="text-right w-12">
                          <p className="text-xs font-medium text-white/70 tabular-nums">{row.count}</p>
                          <p className="text-[9px] text-gray-600">count</p>
                        </div>
                      )}
                      {config.metrics.includes("avg_value") && (
                        <div className="text-right w-16">
                          <p className="text-xs font-medium text-white/70 tabular-nums">{fmt(row.avg_value, true)}</p>
                          <p className="text-[9px] text-gray-600">avg</p>
                        </div>
                      )}
                      {config.metrics.includes("win_rate") && (
                        <div className="text-right w-12">
                          <p className={`text-xs font-medium tabular-nums ${row.win_rate >= 50 ? "text-emerald-400" : row.win_rate > 0 ? "text-amber-400" : "text-gray-500"}`}>{row.win_rate.toFixed(0)}%</p>
                          <p className="text-[9px] text-gray-600">win</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="flex items-center gap-4 px-5 py-3 border-t border-white/[0.08] bg-white/[0.02]">
                <div className="w-28 shrink-0">
                  <span className="text-sm font-semibold text-[var(--accent)]">Total</span>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-4 shrink-0">
                  {config.metrics.includes("count") && (
                    <div className="text-right w-12"><p className="text-xs font-bold text-[var(--accent)] tabular-nums">{totals.count}</p></div>
                  )}
                  {config.metrics.includes("avg_value") && (
                    <div className="text-right w-16"><p className="text-xs font-bold text-[var(--accent)] tabular-nums">{fmt(totals.avg_value, true)}</p></div>
                  )}
                  {config.metrics.includes("win_rate") && (
                    <div className="text-right w-12"><p className="text-xs font-bold text-[var(--accent)] tabular-nums">{totals.win_rate.toFixed(0)}%</p></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Saved Reports Sidebar */}
        <div className="glass-card rounded-2xl p-4 h-fit">
          <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1.5">
            <FolderOpen size={11} /> Saved Reports
          </h3>
          {loadingReports ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-600" /></div>
          ) : savedReports.length === 0 ? (
            <p className="text-[11px] text-gray-600 text-center py-4">No saved reports yet.<br />Configure filters above and click Save.</p>
          ) : (
            <div className="space-y-1 max-h-[350px] overflow-y-auto">
              {savedReports.map((r) => (
                <div key={r.id} onClick={() => loadReport(r)}
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs text-white/80 truncate">{r.name}</p>
                    <p className="text-[10px] text-gray-600">{REPORT_TYPES.find((t) => t.value === r.report_type)?.label || r.report_type}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400/60 hover:text-red-400 transition-all">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
