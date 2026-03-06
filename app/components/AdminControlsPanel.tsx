"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Shield, Plus, Trash2, Copy, Check, RefreshCw, Building2,
  UserCheck, UserX, Clock, Users, TrendingUp, TrendingDown,
  BarChart3, Activity, Search, ChevronDown, ChevronUp,
  Ban, Undo2, DollarSign, Briefcase,
} from "lucide-react";
import { supabase } from "../../lib/projectService";

interface Organization {
  id: string;
  name: string;
  slug: string;
  join_code: string;
  created_at: string;
  member_count: number;
}

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  approval_status: string;
  organization_id: string | null;
  created_at: string;
  organizations: { name: string } | null;
}

interface SystemStats {
  kpis: {
    totalOrgs: number;
    totalUsers: number;
    approvedUsers: number;
    pendingUsers: number;
    totalProjects: number;
    completedProjects: number;
    activeProjects: number;
    totalPipeline: number;
    totalCollected: number;
    totalCommissionValue: number;
    recentSignups: number;
    priorSignups: number;
    recentProjects: number;
    priorProjects: number;
  };
  orgStats: { name: string; members: number; projects: number; pipeline: number; collected: number }[];
  roleCounts: Record<string, number>;
  monthlySignups: { month: string; count: number }[];
  recentActivity: { id: string; entity_type: string; action: string; details: any; created_at: string; org_name: string }[];
}

type AdminTab = "dashboard" | "users" | "orgs" | "activity";

export default function AdminControlsPanel() {
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pending users
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({});

  // All users
  const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [allUsersFetched, setAllUsersFetched] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");

  // System stats
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  async function getAuthToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchOrgs() {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/organizations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load organizations");
      setOrgs(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingUsers() {
    setPendingLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load pending users");
      const data = await res.json();
      setPendingUsers(data);
      const defaults: Record<string, string> = {};
      for (const u of data) defaults[u.id] = "admin";
      setRoleSelections((prev) => ({ ...defaults, ...prev }));
    } catch (err: any) {
      console.error(err);
    } finally {
      setPendingLoading(false);
    }
  }

  async function fetchAllUsers() {
    setAllUsersLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users?filter=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
        setAllUsersFetched(true);
      } else {
        console.error("Failed to fetch users:", res.status, await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAllUsersLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgs();
    fetchPendingUsers();
    fetchStats();
  }, []);

  useEffect(() => {
    if (adminTab === "users" && !allUsersFetched) fetchAllUsers();
  }, [adminTab]);

  async function handleCreate() {
    if (!newOrgName.trim()) return;
    setCreating(true);
    setError(null);
    setCreatedCode(null);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }
      const org = await res.json();
      setCreatedCode(org.join_code);
      setNewOrgName("");
      fetchOrgs();
      fetchStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(orgId: string, orgName: string) {
    if (!window.confirm(`Delete "${orgName}"? This will permanently remove ALL members, projects, and data. This cannot be undone.`)) return;
    setDeletingId(orgId);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/organizations", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete organization");
      }
      fetchOrgs();
      fetchStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleApproveUser(profileId: string) {
    setProcessingUserId(profileId);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action: "approve", role: roleSelections[profileId] || "admin" }),
      });
      if (!res.ok) throw new Error("Failed to approve user");
      fetchPendingUsers();
      fetchOrgs();
      fetchStats();
    } catch (err: any) {
      console.error(err);
    } finally {
      setProcessingUserId(null);
    }
  }

  async function handleRejectUser(profileId: string) {
    if (!window.confirm("Reject this user?")) return;
    setProcessingUserId(profileId);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action: "reject" }),
      });
      if (!res.ok) throw new Error("Failed to reject user");
      fetchPendingUsers();
      fetchStats();
    } catch (err: any) {
      console.error(err);
    } finally {
      setProcessingUserId(null);
    }
  }

  async function handleUpdateUserRole(profileId: string, role: string) {
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, role }),
      });
      if (res.ok) fetchAllUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleUserActive(profileId: string, currentlyApproved: boolean) {
    const action = currentlyApproved ? "deactivate" : "reactivate";
    if (!window.confirm(`${currentlyApproved ? "Deactivate" : "Reactivate"} this user?`)) return;
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, deactivate: currentlyApproved }),
      });
      if (res.ok) {
        fetchAllUsers();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const filteredUsers = useMemo(() => {
    let list = allUsers;
    if (userFilter !== "all") {
      if (userFilter === "active") list = list.filter(u => u.approval_status === "approved");
      else if (userFilter === "inactive") list = list.filter(u => u.approval_status === "rejected");
      else if (userFilter === "pending") list = list.filter(u => u.approval_status === "pending");
    }
    if (userSearch) {
      const q = userSearch.toLowerCase();
      list = list.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.organizations?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allUsers, userFilter, userSearch]);

  const ADMIN_TABS = [
    { key: "dashboard" as const, label: "System Dashboard", icon: BarChart3 },
    { key: "users" as const, label: "All Users", icon: Users },
    { key: "orgs" as const, label: "Organizations", icon: Building2 },
    { key: "activity" as const, label: "Activity Log", icon: Activity },
  ];

  function growthBadge(recent: number, prior: number) {
    if (prior === 0 && recent > 0) return <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><TrendingUp size={10} /> new</span>;
    if (prior === 0) return null;
    const pct = Math.round(((recent - prior) / prior) * 100);
    if (pct > 0) return <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><TrendingUp size={10} /> +{pct}%</span>;
    if (pct < 0) return <span className="text-[10px] text-red-400 flex items-center gap-0.5"><TrendingDown size={10} /> {pct}%</span>;
    return <span className="text-[10px] text-gray-500">—</span>;
  }

  return (
    <div className="space-y-6">
      {/* Admin Sub-Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {ADMIN_TABS.map((t) => (
          <button key={t.key} onClick={() => setAdminTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              adminTab === t.key
                ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                : "text-gray-500 hover:text-white hover:bg-white/[0.04] border border-transparent"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
        {pendingUsers.length > 0 && (
          <span className="ml-2 flex items-center text-xs text-amber-400 bg-amber-500/15 border border-amber-500/20 rounded-full px-2.5 py-0.5">
            {pendingUsers.length} pending
          </span>
        )}
      </div>

      {/* === SYSTEM DASHBOARD === */}
      {adminTab === "dashboard" && (
        <div className="space-y-5">
          {/* KPI Cards */}
          {statsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              Loading system stats...
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Organizations", value: stats.kpis.totalOrgs, icon: Building2, color: "purple" },
                  { label: "Total Users", value: stats.kpis.totalUsers, sub: `${stats.kpis.approvedUsers} active`, icon: Users, color: "blue", growth: growthBadge(stats.kpis.recentSignups, stats.kpis.priorSignups) },
                  { label: "Total Projects", value: stats.kpis.totalProjects, sub: `${stats.kpis.activeProjects} active`, icon: Briefcase, color: "cyan", growth: growthBadge(stats.kpis.recentProjects, stats.kpis.priorProjects) },
                  { label: "Total Pipeline", value: `$${(stats.kpis.totalPipeline / 1000).toFixed(stats.kpis.totalPipeline >= 1000000 ? 0 : 1)}k`, sub: `$${(stats.kpis.totalCollected / 1000).toFixed(1)}k collected`, icon: DollarSign, color: "emerald" },
                ].map((kpi) => (
                  <div key={kpi.label} className="glass-card-elevated rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">{kpi.label}</span>
                      <kpi.icon size={14} className={`text-${kpi.color}-400`} />
                    </div>
                    <p className="text-xl font-display font-bold text-white">{kpi.value}</p>
                    <div className="flex items-center justify-between mt-1">
                      {kpi.sub && <span className="text-[10px] text-gray-500">{kpi.sub}</span>}
                      {kpi.growth}
                    </div>
                  </div>
                ))}
              </div>

              {/* Org Breakdown */}
              <div className="glass-card-elevated rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <Building2 size={14} className="text-purple-400" /> Organization Breakdown
                  </h3>
                  <button onClick={fetchStats} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <RefreshCw size={12} className={statsLoading ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-[10px] uppercase tracking-wider">
                        <th className="px-4 py-2.5 font-medium">Organization</th>
                        <th className="px-4 py-2.5 font-medium text-center">Members</th>
                        <th className="px-4 py-2.5 font-medium text-center">Projects</th>
                        <th className="px-4 py-2.5 font-medium text-right">Pipeline</th>
                        <th className="px-4 py-2.5 font-medium text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {stats.orgStats.map((o) => (
                        <tr key={o.name} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-2.5 text-white/90 font-medium">{o.name}</td>
                          <td className="px-4 py-2.5 text-center text-gray-400">{o.members}</td>
                          <td className="px-4 py-2.5 text-center text-gray-400">{o.projects}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--accent)]">${o.pipeline.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-400">${o.collected.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Role Distribution + Monthly Signups */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card-elevated rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white/90 mb-3">Role Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.roleCounts).map(([role, count]) => {
                      const total = stats.kpis.totalUsers || 1;
                      const pct = Math.round((count / total) * 100);
                      const colors: Record<string, string> = { superadmin: "bg-red-500", admin: "bg-purple-500", manager: "bg-amber-500", sales_rep: "bg-blue-500" };
                      return (
                        <div key={role}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-400 capitalize">{role.replace('_', ' ')}</span>
                            <span className="text-gray-500">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/[0.04]">
                            <div className={`h-full rounded-full ${colors[role] || "bg-gray-500"} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass-card-elevated rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white/90 mb-3">Monthly Signups</h3>
                  <div className="flex items-end gap-2 h-28">
                    {stats.monthlySignups.map((m) => {
                      const max = Math.max(...stats.monthlySignups.map(s => s.count), 1);
                      const h = (m.count / max) * 100;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-500">{m.count}</span>
                          <div className="w-full rounded-t bg-purple-500/40 transition-all" style={{ height: `${Math.max(h, 4)}%` }} />
                          <span className="text-[9px] text-gray-600">{m.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Pending Approvals (inline) */}
          {pendingUsers.length > 0 && (
            <div className="glass-card-elevated rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06] bg-gradient-to-r from-amber-500/[0.04] to-transparent">
                <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  <UserCheck size={14} className="text-amber-400" />
                  Pending Approvals ({pendingUsers.length})
                </h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-xs font-bold text-white/80 shrink-0">
                        {(user.full_name || "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white/90 text-sm font-medium truncate">{user.full_name || "No Name"}</p>
                        <p className="text-gray-500 text-[10px] truncate">{user.email} {user.organizations?.name ? `· ${user.organizations.name}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={roleSelections[user.id] || "admin"} onChange={(e) => setRoleSelections((prev) => ({ ...prev, [user.id]: e.target.value }))}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-[10px] text-gray-400 px-1.5 py-1 focus:outline-none">
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="sales_rep">Sales Rep</option>
                      </select>
                      <button onClick={() => handleApproveUser(user.id)} disabled={processingUserId === user.id}
                        className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 hover:bg-emerald-500/20 disabled:opacity-50">
                        {processingUserId === user.id ? <RefreshCw size={10} className="animate-spin" /> : "Approve"}
                      </button>
                      <button onClick={() => handleRejectUser(user.id)} disabled={processingUserId === user.id}
                        className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 hover:bg-red-500/20 disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === ALL USERS === */}
      {adminTab === "users" && (
        <div className="glass-card-elevated rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Users size={14} className="text-blue-400" /> All Users ({allUsers.length})
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1.5 text-gray-500" size={12} />
                <input type="text" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] text-white placeholder-gray-600 pl-7 pr-3 py-1.5 w-40 focus:outline-none focus:border-[var(--accent)]/40" />
              </div>
              <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] text-gray-400 px-2 py-1.5 focus:outline-none">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
                <option value="pending">Pending</option>
              </select>
              <button onClick={fetchAllUsers} className="text-gray-500 hover:text-gray-300">
                <RefreshCw size={12} className={allUsersLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {allUsersLoading ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-4 py-2.5 font-medium">Organization</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Joined</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="text-white/90 text-xs font-medium">{u.full_name || "—"}</p>
                          <p className="text-gray-500 text-[10px]">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{u.organizations?.name || "—"}</td>
                      <td className="px-4 py-2.5">
                        <select value={u.role}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          className="bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-gray-400 px-1.5 py-0.5 focus:outline-none">
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="sales_rep">Sales Rep</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          u.approval_status === "approved" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/20" :
                          u.approval_status === "pending" ? "text-amber-400 bg-amber-500/15 border-amber-500/20" :
                          "text-red-400 bg-red-500/15 border-red-500/20"
                        }`}>
                          {u.approval_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-[10px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleToggleUserActive(u.id, u.approval_status === "approved")}
                          className={`text-[10px] font-medium px-2 py-1 rounded-lg border transition-all ${
                            u.approval_status === "approved"
                              ? "text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20"
                              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}>
                          {u.approval_status === "approved" ? (
                            <span className="flex items-center gap-1"><Ban size={10} /> Deactivate</span>
                          ) : (
                            <span className="flex items-center gap-1"><Undo2 size={10} /> Reactivate</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === ORGANIZATIONS === */}
      {adminTab === "orgs" && (
        <div className="space-y-5">
          {/* Create */}
          <div className="glass-card-elevated rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-gray-300">Create Organization</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Building2 size={14} className="absolute left-3 top-2.5 text-gray-500" />
                  <input type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="Organization name..."
                    className="input-field py-2 w-full text-sm" style={{ paddingLeft: "2.25rem" }} />
                </div>
                <button onClick={handleCreate} disabled={creating || !newOrgName.trim()}
                  className="btn-primary text-white font-bold rounded-xl px-4 py-2 flex items-center gap-1.5 text-sm disabled:opacity-60">
                  {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} Create
                </button>
              </div>
              {createdCode && (
                <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
                  <span>Created! Join code: <span className="font-mono font-bold">{createdCode}</span></span>
                  <button onClick={() => copyCode(createdCode)} className="ml-2 hover:text-emerald-300">
                    {copiedCode === createdCode ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              )}
              {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
            </div>
          </div>

          {/* Table */}
          <div className="glass-card-elevated rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-300">All Organizations ({orgs.length})</h3>
              <button onClick={fetchOrgs} className="text-gray-500 hover:text-gray-300">
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Join Code</th>
                      <th className="px-4 py-2.5 font-medium text-center">Members</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                      <th className="px-4 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {orgs.map((org) => (
                      <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-white/90 font-medium">{org.name}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-mono text-xs text-[var(--accent)]">{org.join_code}</span>
                            <button onClick={() => copyCode(org.join_code)} className="text-gray-500 hover:text-[var(--accent)]">
                              {copiedCode === org.join_code ? <Check size={10} /> : <Copy size={10} />}
                            </button>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">{org.member_count}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(org.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDelete(org.id, org.name)} disabled={deletingId === org.id}
                            className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1">
                            {deletingId === org.id ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === ACTIVITY LOG === */}
      {adminTab === "activity" && (
        <div className="glass-card-elevated rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" /> Cross-Organization Activity
            </h3>
            <button onClick={fetchStats} className="text-gray-500 hover:text-gray-300">
              <RefreshCw size={12} className={statsLoading ? "animate-spin" : ""} />
            </button>
          </div>
          {statsLoading || !stats ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : stats.recentActivity.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">No recent activity</div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        a.action === 'created' ? 'text-emerald-400 bg-emerald-500/10' :
                        a.action === 'updated' ? 'text-blue-400 bg-blue-500/10' :
                        a.action === 'deleted' ? 'text-red-400 bg-red-500/10' :
                        a.action === 'completed' ? 'text-amber-400 bg-amber-500/10' :
                        'text-gray-400 bg-gray-500/10'
                      }`}>{a.action}</span>
                      <span className="text-xs text-white/80 truncate">
                        {a.entity_type}{a.details?.name ? `: ${a.details.name}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5">{a.org_name}</span>
                      <span className="text-[10px] text-gray-600">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
