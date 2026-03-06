"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FileText, AlertCircle, CheckCircle, PlusCircle, X, Edit3, Trash2, Save } from "lucide-react";
import { projectService, supabase } from "../../lib/projectService";
import { _rl, type Role } from "../../lib/roles";

interface Permit {
  id: string;
  project_id: string | null;
  agency: string | null;
  permit_number: string | null;
  status: string;
  expiration_date: string | null;
  created_at: string;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "expired", label: "Expired" },
];

const PERMIT_STATUS_OPTIONS = ["pending", "submitted", "approved", "expired"];

function getPermitBadgeClass(status: string) {
  switch (status) {
    case "approved": return "text-emerald-400 bg-emerald-500/15 border-emerald-500/20";
    case "submitted": return "text-blue-400 bg-blue-500/15 border-blue-500/20";
    case "pending": return "text-amber-400 bg-amber-500/15 border-amber-500/20";
    case "expired": return "text-red-400 bg-red-500/15 border-red-500/20";
    default: return "text-white/50 bg-white/5 border-white/10";
  }
}

const inputSmClass = "w-full input-field-sm";

interface PermitsPanelProps {
  role?: Role;
}

export default function PermitsPanel({ role = "sales_rep" }: PermitsPanelProps) {
  const canCreateEdit = _rl(role) >= 2;
  const canDelete = _rl(role) >= 3;
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showNewPermit, setShowNewPermit] = useState(false);
  const [savingPermit, setSavingPermit] = useState(false);
  const [newPermit, setNewPermit] = useState({ agency: "", permit_number: "", status: "pending", expiration_date: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ agency: "", permit_number: "", status: "", expiration_date: "" });

  const fetchPermits = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await projectService.getAllPermits();
      setPermits(data || []);
    } catch (err) {
      console.error("Failed to fetch permits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPermits(); }, [fetchPermits]);

  useEffect(() => {
    const channel = supabase
      .channel("permits-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "permits" }, () => fetchPermits(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPermits]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let active = 0, expiringSoon = 0;
    for (const p of permits) {
      if (p.status !== "expired") active++;
      if (p.expiration_date) {
        const exp = new Date(p.expiration_date);
        if (exp >= now && exp <= thirtyDays) expiringSoon++;
      }
    }
    return { active, expiringSoon, total: permits.length };
  }, [permits]);

  const filtered = useMemo(() => {
    if (filter === "all") return permits;
    return permits.filter((p) => p.status === filter);
  }, [permits, filter]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: permits.length };
    for (const p of permits) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [permits]);

  async function handlePermitUpdate(permitId: string, updates: Record<string, string | null>) {
    try {
      await projectService.updatePermit(permitId, updates);
      setPermits((prev) => prev.map((p) => (p.id === permitId ? { ...p, ...updates } : p)));
    } catch (err) {
      console.error("Failed to update permit:", err);
    }
  }

  async function handleCreatePermit() {
    setSavingPermit(true);
    try {
      const payload: any = { status: newPermit.status };
      if (newPermit.agency) payload.agency = newPermit.agency;
      if (newPermit.permit_number) payload.permit_number = newPermit.permit_number;
      if (newPermit.expiration_date) payload.expiration_date = newPermit.expiration_date;
      await projectService.createPermit(payload);
      setNewPermit({ agency: "", permit_number: "", status: "pending", expiration_date: "" });
      setShowNewPermit(false);
      fetchPermits(true);
    } catch (err) {
      console.error("Failed to create permit:", err);
    } finally {
      setSavingPermit(false);
    }
  }

  function startEditing(permit: Permit) {
    setEditingId(permit.id);
    setEditData({
      agency: permit.agency || "",
      permit_number: permit.permit_number || "",
      status: permit.status,
      expiration_date: permit.expiration_date || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const updates: Record<string, string> = {};
    const permit = permits.find((p) => p.id === editingId);
    if (!permit) return;
    if (editData.agency !== (permit.agency || "")) updates.agency = editData.agency;
    if (editData.permit_number !== (permit.permit_number || "")) updates.permit_number = editData.permit_number;
    if (editData.status !== permit.status) updates.status = editData.status;
    if (editData.expiration_date !== (permit.expiration_date || "")) updates.expiration_date = editData.expiration_date;
    if (Object.keys(updates).length > 0) await handlePermitUpdate(editingId, updates);
    setEditingId(null);
  }

  async function handleDeletePermit(permitId: string) {
    if (!window.confirm("Delete this permit? This cannot be undone.")) return;
    try {
      await projectService.deletePermit(permitId);
      setPermits((prev) => prev.filter((p) => p.id !== permitId));
    } catch (err) {
      console.error("Failed to delete permit:", err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 group hover:border-blue-500/20 transition-all">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/15 to-blue-500/5">
            <FileText className="text-blue-400" size={16} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-lg font-display font-bold text-blue-300">{stats.active}</p>
          </div>
        </div>
        <div className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 group hover:border-amber-500/20 transition-all">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-500/5">
            <AlertCircle className="text-amber-400" size={16} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Expiring Soon</p>
            <p className="text-lg font-display font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">{stats.expiringSoon}</p>
          </div>
        </div>
        <div className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 group hover:border-emerald-500/20 transition-all">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5">
            <CheckCircle className="text-emerald-400" size={16} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-display font-bold text-emerald-300">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card-elevated rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
                <FileText size={16} className="text-[var(--accent)]" />
              </div>
              All Permits
            </h2>
            {canCreateEdit && (
              <button
                onClick={() => setShowNewPermit((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:text-[#00ccff] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/20 rounded-lg px-3 py-1.5 transition-all"
              >
                <PlusCircle size={14} /> Add Permit
              </button>
            )}
          </div>

          {/* New Permit Form */}
          {showNewPermit && (
            <div className="bg-blue-900/20 border border-white/[0.06] rounded-xl p-3 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-xs font-medium">New Permit</span>
                <button onClick={() => setShowNewPermit(false)} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-white/50 text-[10px] mb-0.5">Agency</label>
                  <input type="text" value={newPermit.agency} onChange={(e) => setNewPermit({ ...newPermit, agency: e.target.value })}
                    placeholder="e.g. City of Miami" className={inputSmClass} />
                </div>
                <div>
                  <label className="block text-white/50 text-[10px] mb-0.5">Permit #</label>
                  <input type="text" value={newPermit.permit_number} onChange={(e) => setNewPermit({ ...newPermit, permit_number: e.target.value })}
                    placeholder="e.g. BLD-2026-001" className={inputSmClass} />
                </div>
                <div>
                  <label className="block text-white/50 text-[10px] mb-0.5">Status</label>
                  <select value={newPermit.status} onChange={(e) => setNewPermit({ ...newPermit, status: e.target.value })} className={inputSmClass}>
                    {PERMIT_STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/50 text-[10px] mb-0.5">Expiration</label>
                  <input type="date" value={newPermit.expiration_date} onChange={(e) => setNewPermit({ ...newPermit, expiration_date: e.target.value })} className={inputSmClass} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNewPermit(false)}
                  className="flex-1 glass-card text-gray-400 rounded-lg px-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors">Cancel</button>
                <button type="button" onClick={handleCreatePermit} disabled={savingPermit}
                  className="flex-1 btn-primary text-white font-bold rounded-lg px-3 py-1.5 text-xs disabled:opacity-60">
                  {savingPermit ? "Adding..." : "Add Permit"}
                </button>
              </div>
            </div>
          )}

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
          <table className="w-full text-center">
            <thead className="text-xs uppercase text-gray-500 bg-blue-900/20">
              <tr>
                <th className="px-2 py-3">Agency</th>
                <th className="px-2 py-3">Permit #</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Expiration</th>
                {(canCreateEdit || canDelete) && <th className="px-2 py-3 w-[80px]"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
                      Loading permits...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                    {filter !== "all" ? "No permits match this filter." : "No permits yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((permit) => (
                  <tr key={permit.id} className="table-row-hover">
                    {editingId === permit.id ? (
                      <>
                        <td className="px-2 py-2.5">
                          <input type="text" value={editData.agency} onChange={(e) => setEditData({ ...editData, agency: e.target.value })}
                            className="bg-white/[0.04] border border-white/[0.08] text-white/80 text-sm text-center rounded px-1 py-1 w-full focus:outline-none focus:border-[var(--accent)]/40" />
                        </td>
                        <td className="px-2 py-2.5">
                          <input type="text" value={editData.permit_number} onChange={(e) => setEditData({ ...editData, permit_number: e.target.value })}
                            className="bg-white/[0.04] border border-white/[0.08] text-white/80 text-sm text-center rounded px-1 py-1 w-full focus:outline-none focus:border-[var(--accent)]/40" />
                        </td>
                        <td className="px-2 py-2.5">
                          <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                            className="bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs text-center rounded px-1 py-1 w-full focus:outline-none focus:border-[var(--accent)]/40">
                            {PERMIT_STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                          </select>
                        </td>
                        <td className="px-2 py-2.5">
                          <input type="date" value={editData.expiration_date} onChange={(e) => setEditData({ ...editData, expiration_date: e.target.value })}
                            className="bg-white/[0.04] border border-white/[0.08] text-white/80 text-sm text-center rounded px-1 py-1 w-full focus:outline-none focus:border-[var(--accent)]/40" />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={saveEdit}
                              className="p-1 rounded-lg hover:bg-emerald-500/10 text-emerald-400 hover:shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-200" title="Save">
                              <Save size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all duration-200" title="Cancel">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2.5">
                          <p className="text-white/80 text-sm truncate">{permit.agency || <span className="text-gray-600">—</span>}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="text-white/80 text-sm truncate">{permit.permit_number || <span className="text-gray-600">—</span>}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex items-center border text-xs font-medium rounded-full px-2.5 py-0.5 ${getPermitBadgeClass(permit.status)}`}>
                            {permit.status.charAt(0).toUpperCase() + permit.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="text-white/80 text-sm">
                            {permit.expiration_date
                              ? new Date(permit.expiration_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : <span className="text-gray-600">—</span>}
                          </p>
                        </td>
                        {(canCreateEdit || canDelete) && (
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-center gap-0.5">
                              {canCreateEdit && (
                                <button onClick={() => startEditing(permit)}
                                  className="p-1 rounded-lg hover:bg-[var(--accent)]/10 text-gray-500 hover:text-[var(--accent)] hover:shadow-[0_0_8px_rgba(0,170,255,0.3)] transition-all duration-200" title="Edit">
                                  <Edit3 size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => handleDeletePermit(permit.id)}
                                  className="p-1 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all duration-200" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-white/[0.04] bg-blue-950/30 text-xs text-gray-500">
            {filtered.length} permit{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
