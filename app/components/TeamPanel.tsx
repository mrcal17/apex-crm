"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Users, PlusCircle, Edit3, Trash2, X, Save, Percent, ChevronDown, ChevronUp, DollarSign, CheckCircle, Briefcase, TrendingUp, Clock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { projectService } from "../../lib/projectService";
import { PERMISSIONS, type Role } from "../../lib/roles";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  commission_rate: number;
}

interface Commission {
  id: string;
  amount: number;
  status: string;
  payout_date: string | null;
  projects?: { name: string };
}

type TeamSortKey = "name" | "rate" | "earned" | "unpaid" | "completed" | "pipeline";

function TeamSortIcon({ column, sortKey, sortDir }: { column: TeamSortKey; sortKey: TeamSortKey; sortDir: "asc" | "desc" }) {
  if (column !== sortKey) return <ArrowUpDown size={10} className="text-gray-600 ml-0.5" />;
  return sortDir === "asc"
    ? <ArrowUp size={10} className="text-[var(--accent)] ml-0.5" />
    : <ArrowDown size={10} className="text-[var(--accent)] ml-0.5" />;
}

export default function TeamPanel({ role = "admin" as Role }: { role?: Role }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  const [allCommissions, setAllCommissions] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<TeamSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [formData, setFormData] = useState({
    full_name: "",
    role: "sales_rep",
    commission_rate: "0.10",
  });

  async function fetchProfiles() {
    setLoading(true);
    try {
      const [data, commData, projData] = await Promise.all([
        projectService.getProfiles(),
        projectService.getAllCommissions(),
        projectService.getProjects(),
      ]);
      setProfiles(data || []);
      setAllCommissions(commData || []);
      setAllProjects(projData || []);
    } catch {
      console.error("Failed to fetch profiles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProfiles(); }, []);

  function toggleExpand(profileId: string) {
    if (expandedId === profileId) { setExpandedId(null); setCommissions([]); return; }
    setExpandedId(profileId);
    setCommissions(allCommissions.filter((c: any) => c.sales_rep_id === profileId));
  }

  function resetForm() {
    setFormData({ full_name: "", role: "sales_rep", commission_rate: "0.10" });
    setEditingId(null); setShowForm(false); setError(null);
  }

  function startEdit(profile: Profile) {
    setFormData({ full_name: profile.full_name || "", role: profile.role || "sales_rep", commission_rate: String(profile.commission_rate ?? 0.10) });
    setEditingId(profile.id); setShowForm(true); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    const payload = { full_name: formData.full_name, role: formData.role, commission_rate: parseFloat(formData.commission_rate) || 0.10 };
    try {
      if (editingId) await projectService.updateProfile(editingId, payload);
      else await projectService.createProfile(payload);
      resetForm(); fetchProfiles();
    } catch (err: any) {
      setError(err?.message || err?.error_description || JSON.stringify(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from the team? This cannot be undone.`)) return;
    try {
      await projectService.deleteProfile(id);
      if (expandedId === id) { setExpandedId(null); setCommissions([]); }
      fetchProfiles();
    } catch (err) {
      console.error("Failed to delete profile:", err);
    }
  }

  const totalForExpanded = commissions.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
  const paidForExpanded = commissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
  const unpaidForExpanded = commissions.filter((c) => c.status === "unpaid").reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

  function getRepStats(repId: string) {
    const repCommissions = allCommissions.filter((c: any) => c.sales_rep_id === repId);
    const repProjects = allProjects.filter((p: any) => p.sales_rep_id === repId);
    const totalEarned = repCommissions.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
    const totalPaid = repCommissions.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
    const totalUnpaid = totalEarned - totalPaid;
    const completed = repProjects.filter((p: any) => p.status === "completed").length;
    const totalProjects = repProjects.length;
    const pipelineValue = repProjects.reduce((s: number, p: any) => s + Number(p.contract_value ?? 0), 0);
    return { totalEarned, totalPaid, totalUnpaid, completed, totalProjects, pipelineValue };
  }

  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Build stats map for all profiles
  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getRepStats>>();
    for (const p of profiles) {
      map.set(p.id, getRepStats(p.id));
    }
    return map;
  }, [profiles, allCommissions, allProjects]);

  function handleSort(key: TeamSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedProfiles = useMemo(() => [...profiles].sort((a, b) => {
    const sa = statsMap.get(a.id)!;
    const sb = statsMap.get(b.id)!;
    let cmp = 0;
    switch (sortKey) {
      case "name": cmp = (a.full_name || "").localeCompare(b.full_name || ""); break;
      case "rate": cmp = Number(a.commission_rate ?? 0) - Number(b.commission_rate ?? 0); break;
      case "earned": cmp = sa.totalEarned - sb.totalEarned; break;
      case "unpaid": cmp = sa.totalUnpaid - sb.totalUnpaid; break;
      case "completed": cmp = sa.completed - sb.completed; break;
      case "pipeline": cmp = sa.pipelineValue - sb.pipelineValue; break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  }), [profiles, statsMap, sortKey, sortDir]);

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/[0.06] flex justify-between items-center bg-gradient-to-r from-blue-500/[0.04] to-transparent">
        <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
            <Users size={18} className="text-[var(--accent)]" />
          </div>
          Sales Team
        </h2>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:text-[#00ccff] transition-colors">
            <PlusCircle size={16} /> Add Rep
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-5 py-5 border-b border-white/[0.06] bg-blue-950/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-sm font-semibold">{editingId ? "Edit Team Member" : "New Team Member"}</h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
          </div>
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-white/50 text-xs mb-1">Full Name</label>
              <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required placeholder="e.g. John Smith"
                className="w-full input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/50 text-xs mb-1">Role</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full input-field">
                  <option value="sales_rep">Sales Rep</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1">Commission Rate</label>
                <div className="relative">
                  <input type="number" value={formData.commission_rate} onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                    required min="0" max="1" step="0.01" placeholder="0.10"
                    className="w-full input-field pr-8" />
                  <Percent size={14} className="absolute right-2.5 top-2.5 text-gray-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={resetForm}
                className="flex-1 glass-card text-gray-400 rounded-lg px-3 py-2 text-xs font-medium hover:bg-white/[0.04] transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 btn-primary text-white font-bold rounded-lg px-3 py-2 text-xs disabled:opacity-60">
                <Save size={14} /> {saving ? "Saving..." : editingId ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading team...</div>
        ) : profiles.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">No team members yet. Add your first sales rep above.</div>
        ) : (
          <table className="w-full text-left min-w-[700px]">
            <thead className="text-xs uppercase text-gray-500 bg-blue-900/20">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("name")}>
                  <span className="flex items-center">Rep <TeamSortIcon column="name" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("rate")}>
                  <span className="flex items-center justify-center">Rate <TeamSortIcon column="rate" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("earned")}>
                  <span className="flex items-center justify-center">Earned <TeamSortIcon column="earned" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("unpaid")}>
                  <span className="flex items-center justify-center">Unpaid <TeamSortIcon column="unpaid" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("completed")}>
                  <span className="flex items-center justify-center">Completed <TeamSortIcon column="completed" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("pipeline")}>
                  <span className="flex items-center justify-center">Pipeline <TeamSortIcon column="pipeline" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sortedProfiles.map((profile) => {
                const s = statsMap.get(profile.id)!;
                return (
                  <React.Fragment key={profile.id}>
                    <tr className="table-row-hover hover:bg-white/[0.03] transition-all duration-200">
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(profile.id)}>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-white/80 shrink-0">
                            {(profile.full_name || "?")[0]?.toUpperCase()}
                          </div>
                          <div className="flex flex-col items-center">
                            <p className="text-white/90 text-sm font-medium">{profile.full_name}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${
                              profile.role === "admin"
                                ? "text-purple-400 bg-purple-500/15 border border-purple-500/20"
                                : profile.role === "manager"
                                ? "text-cyan-400 bg-cyan-500/15 border border-cyan-500/20"
                                : "text-blue-400 bg-blue-500/15 border border-blue-500/20"
                            }`}>
                              {profile.role === "admin" ? "Admin" : profile.role === "manager" ? "Manager" : "Sales Rep"}
                            </span>
                          </div>
                          {expandedId === profile.id ? <ChevronUp size={14} className="text-gray-500 shrink-0" /> : <ChevronDown size={14} className="text-gray-500 shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-400 text-sm font-medium">{(Number(profile.commission_rate) * 100).toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-400 text-sm font-semibold">{fmt(s.totalEarned)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${s.totalUnpaid > 0 ? "text-amber-400" : "text-gray-600"}`}>{fmt(s.totalUnpaid)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-blue-400 text-sm font-semibold">{s.completed}</span>
                        <span className="text-gray-600 text-xs">/{s.totalProjects}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-purple-400 text-sm font-semibold">{fmt(s.pipelineValue)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => startEdit(profile)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-[var(--accent)] transition-colors" title="Edit"><Edit3 size={14} /></button>
                          {PERMISSIONS.canDeleteTeamMembers(role) && (
                            <button onClick={() => handleDelete(profile.id, profile.full_name)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors" title="Remove"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedId === profile.id && (
                      <tr>
                        <td colSpan={7} className="px-4 pb-4 pt-0">
                          <div className="bg-blue-900/20 border border-white/[0.06] rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                              <span className="text-white/50 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
                                <DollarSign size={12} /> Commissions
                              </span>
                              {commissions.length > 0 && (
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-emerald-400">Paid: ${paidForExpanded.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                  <span className="text-amber-400">Unpaid: ${unpaidForExpanded.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                  <span className="text-white font-semibold">Total: ${totalForExpanded.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                            {loadingCommissions ? (
                              <div className="px-4 py-4 text-gray-500 text-xs text-center">Loading commissions...</div>
                            ) : commissions.length === 0 ? (
                              <div className="px-4 py-4 text-gray-500 text-xs text-center italic">No commissions yet.</div>
                            ) : (
                              <div className="divide-y divide-white/[0.04]">
                                {commissions.map((c) => (
                                  <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-blue-900/20 transition-colors">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white/80 text-xs font-medium truncate">{c.projects?.name || "Unknown Project"}</p>
                                      {c.payout_date && (
                                        <p className="text-gray-600 text-xs mt-0.5">
                                          Paid {new Date(c.payout_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-white font-semibold text-xs">
                                        ${Number(c.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                        c.status === "paid" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/20" : "text-amber-400 bg-amber-500/15 border-amber-500/20"
                                      }`}>{c.status}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
