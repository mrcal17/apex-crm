"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DollarSign, CheckCircle, Clock, RefreshCw, Undo2, Search, ChevronDown, X } from "lucide-react";
import { projectService, supabase } from "../../lib/projectService";
import Leaderboard from "./Leaderboard";
import { PERMISSIONS, _rl, type Role } from "../../lib/roles";

interface Commission {
  id: string;
  amount: number;
  status: string;
  payout_date: string | null;
  created_at: string;
  sales_rep_id?: string;
  profiles?: { full_name: string };
  projects?: { name: string };
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
];

export default function CommissionsPanel({ role = "admin" as Role, profileId }: { role?: Role; profileId?: string }) {
  const isSalesRep = _rl(role) < 2;
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [markingUnpaid, setMarkingUnpaid] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState<string>("all");
  const [repSearch, setRepSearch] = useState("");
  const [repDropdownOpen, setRepDropdownOpen] = useState(false);

  const fetchCommissions = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await projectService.getAllCommissions();
      setCommissions(data || []);
    } catch (err) {
      console.error("Failed to fetch commissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  useEffect(() => {
    const channel = supabase
      .channel("commissions-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "commissions" }, () => fetchCommissions(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCommissions]);

  // For sales reps, filter to only their own commissions
  const scopedCommissions = useMemo(() => {
    if (!isSalesRep || !profileId) return commissions;
    return commissions.filter(c => c.sales_rep_id === profileId);
  }, [commissions, isSalesRep, profileId]);

  const stats = useMemo(() => {
    let totalUnpaid = 0, totalPaid = 0, count = 0;
    for (const c of scopedCommissions) {
      const amt = Number(c.amount ?? 0);
      if (c.status === "paid") totalPaid += amt;
      else totalUnpaid += amt;
      count++;
    }
    return { totalUnpaid, totalPaid, count };
  }, [scopedCommissions]);

  const salesReps = useMemo(() => {
    const names = new Set<string>();
    for (const c of scopedCommissions) {
      if (c.profiles?.full_name) names.add(c.profiles.full_name);
    }
    return Array.from(names).sort();
  }, [scopedCommissions]);

  const filteredRepOptions = useMemo(() => {
    if (!repSearch) return salesReps;
    const q = repSearch.toLowerCase();
    return salesReps.filter((name) => name.toLowerCase().includes(q));
  }, [salesReps, repSearch]);

  const filtered = useMemo(() => {
    return scopedCommissions.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (repFilter !== "all" && c.profiles?.full_name !== repFilter) return false;
      return true;
    });
  }, [scopedCommissions, filter, repFilter]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scopedCommissions.length, unpaid: 0, paid: 0 };
    for (const c of scopedCommissions) {
      if (c.status === "unpaid") counts.unpaid++;
      else if (c.status === "paid") counts.paid++;
    }
    return counts;
  }, [commissions]);

  async function handleMarkPaid(id: string) {
    setMarkingPaid(id);
    try {
      await projectService.updateCommission(id, {
        status: "paid",
        payout_date: new Date().toISOString(),
      });
      fetchCommissions(true);
    } catch (err) {
      console.error("Failed to mark commission as paid:", err);
    } finally {
      setMarkingPaid(null);
    }
  }

  async function handleMarkUnpaid(id: string) {
    setMarkingUnpaid(id);
    try {
      await projectService.updateCommission(id, {
        status: "unpaid",
        payout_date: null as any,
      });
      fetchCommissions(true);
    } catch (err) {
      console.error("Failed to mark commission as unpaid:", err);
    } finally {
      setMarkingUnpaid(null);
    }
  }

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl group hover:border-amber-500/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm font-medium">Total Unpaid</span>
            <div className="icon-glow icon-glow-amber group-hover:scale-110 transition-transform">
              <Clock className="text-amber-400" size={18} />
            </div>
          </div>
          <div className="text-2xl font-display font-bold tracking-tight bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            ${fmt(stats.totalUnpaid)}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl group hover:border-emerald-500/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm font-medium">Total Paid</span>
            <div className="icon-glow icon-glow-green group-hover:scale-110 transition-transform">
              <CheckCircle className="text-emerald-400" size={18} />
            </div>
          </div>
          <div className="text-2xl font-display font-bold tracking-tight bg-gradient-to-r from-green-300 to-emerald-400 bg-clip-text text-transparent">
            ${fmt(stats.totalPaid)}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl group hover:border-blue-500/20 transition-all duration-300">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm font-medium">Commission Count</span>
            <div className="icon-glow icon-glow-blue group-hover:scale-110 transition-transform">
              <DollarSign className="text-blue-400" size={18} />
            </div>
          </div>
          <div className="text-2xl font-display font-bold tracking-tight text-blue-300">
            {stats.count}
          </div>
        </div>
      </div>

      {/* Table + Leaderboard (hidden for sales reps) */}
      {!isSalesRep && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      <div className="lg:col-span-3 glass-card-elevated rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
                <DollarSign size={18} className="text-[var(--accent)]" />
              </div>
              All Commissions
            </h2>
            {/* Salesperson Filter */}
            <div className="relative">
              <button
                onClick={() => { setRepDropdownOpen((v) => !v); if (!repDropdownOpen) setTimeout(() => document.getElementById("rep-search-input")?.focus(), 50); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  repFilter !== "all"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/20"
                    : "text-gray-400 hover:text-white border-white/[0.06] hover:border-white/10 glass-card"
                }`}
              >
                <Search size={12} />
                {repFilter !== "all" ? repFilter : "All Reps"}
                {repFilter !== "all" ? (
                  <span onClick={(e) => { e.stopPropagation(); setRepFilter("all"); setRepDropdownOpen(false); setRepSearch(""); }}
                    className="hover:text-white ml-0.5"><X size={12} /></span>
                ) : (
                  <ChevronDown size={12} />
                )}
              </button>
              {repDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setRepDropdownOpen(false); setRepSearch(""); }} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 glass-card-elevated rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-white/[0.06]">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-2 text-gray-500" />
                        <input
                          id="rep-search-input"
                          type="text"
                          value={repSearch}
                          onChange={(e) => setRepSearch(e.target.value)}
                          placeholder="Search reps..."
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-gray-500 pl-7 pr-3 py-1.5 focus:outline-none focus:border-[var(--accent)]/40"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto py-1">
                      <button
                        onClick={() => { setRepFilter("all"); setRepDropdownOpen(false); setRepSearch(""); }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${repFilter === "all" ? "text-[var(--accent)] bg-[var(--accent)]/10" : "text-gray-400 hover:text-white hover:bg-white/[0.04]"}`}
                      >All Reps</button>
                      {filteredRepOptions.map((name) => (
                        <button
                          key={name}
                          onClick={() => { setRepFilter(name); setRepDropdownOpen(false); setRepSearch(""); }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${repFilter === name ? "text-[var(--accent)] bg-[var(--accent)]/10" : "text-gray-400 hover:text-white hover:bg-white/[0.04]"}`}
                        >{name}</button>
                      ))}
                      {filteredRepOptions.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-600 italic">No matching reps</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Filter Tabs */}
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  filter === f.key
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-[0_0_10px_rgba(0,170,255,0.1)]"
                    : "text-gray-500 hover:text-white hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${filter === f.key ? "text-[var(--accent)]/70" : "text-gray-600"}`}>
                  {filterCounts[f.key] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center min-w-[600px]">
            <thead className="text-xs uppercase text-gray-500 bg-blue-900/20">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Sales Rep</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
                      Loading commissions...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    {filter !== "all" ? "No commissions match this filter." : "No commissions yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <p className="text-white/90 text-sm font-medium">{c.projects?.name || "Unknown"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white/80 text-sm">{c.profiles?.full_name || "Unknown"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-semibold text-sm">${fmt(Number(c.amount ?? 0))}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        c.status === "paid"
                          ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/20"
                          : "text-amber-400 bg-amber-500/15 border-amber-500/20"
                      }`}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-500 text-xs">
                        {c.payout_date
                          ? new Date(c.payout_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : c.created_at
                            ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {PERMISSIONS.canMarkCommissionPaid(role) ? (
                        c.status === "unpaid" ? (
                          <button
                            onClick={() => handleMarkPaid(c.id)}
                            disabled={markingPaid === c.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
                          >
                            {markingPaid === c.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            {markingPaid === c.id ? "Saving..." : "Mark Paid"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkUnpaid(c.id)}
                            disabled={markingUnpaid === c.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
                          >
                            {markingUnpaid === c.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Undo2 size={12} />
                            )}
                            {markingUnpaid === c.id ? "Saving..." : "Mark Unpaid"}
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/[0.04] bg-blue-950/30 flex justify-between items-center text-xs text-gray-500">
            <span>{filtered.length} commission{filtered.length !== 1 ? "s" : ""}</span>
            <span>Total: ${fmt(filtered.reduce((s, c) => s + Number(c.amount ?? 0), 0))}</span>
          </div>
        )}
      </div>
      <div className="lg:col-span-1">
        <Leaderboard />
      </div>
      </div>
      )}
    </div>
  );
}
