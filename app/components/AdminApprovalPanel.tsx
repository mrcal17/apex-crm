"use client";

import { useState, useEffect } from "react";
import { UserCheck, UserX, RefreshCw, ShieldCheck, Clock } from "lucide-react";
import { authService, UserProfile } from "../../lib/authService";
import { supabase } from "../../lib/projectService";
import type { Role } from "../../lib/roles";

export default function AdminApprovalPanel() {
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [roleSelections, setRoleSelections] = useState<Record<string, Role>>({});

  async function fetchPending() {
    try {
      const data = await authService.getPendingUsers();
      setPending(data);
      const defaults: Record<string, Role> = {};
      for (const u of data) defaults[u.id] = "sales_rep";
      setRoleSelections((prev) => ({ ...defaults, ...prev }));
    } catch (err) {
      console.error("Failed to fetch pending users:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPending(); }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-approval-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleApprove(profileId: string) {
    setProcessingId(profileId);
    try {
      await authService.approveUser(profileId, roleSelections[profileId] || "sales_rep");
      fetchPending();
    } catch (err) {
      console.error("Failed to approve user:", err);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(profileId: string) {
    if (!window.confirm("Reject this user? They will not be able to access the CRM.")) return;
    setProcessingId(profileId);
    try {
      await authService.rejectUser(profileId);
      fetchPending();
    } catch (err) {
      console.error("Failed to reject user:", err);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/[0.06] flex justify-between items-center bg-gradient-to-r from-amber-500/[0.04] to-transparent">
        <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <ShieldCheck size={18} className="text-amber-400" />
          </div>
          User Approval
          {pending.length > 0 && (
            <span className="ml-2 text-xs font-medium text-amber-400 bg-amber-500/15 border border-amber-500/20 rounded-full px-2 py-0.5">
              {pending.length} pending
            </span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading...</div>
      ) : pending.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <ShieldCheck size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No pending user approvals</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {pending.map((user) => (
            <div key={user.id} className="px-5 py-4 flex items-center justify-between hover:bg-blue-900/15 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-xs font-bold text-white/80 shrink-0">
                  {(user.full_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">{user.full_name || "No Name"}</p>
                  <p className="text-gray-500 text-xs truncate flex items-center gap-1">
                    <Clock size={10} />
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={roleSelections[user.id] || "sales_rep"}
                  onChange={(e) => setRoleSelections((prev) => ({ ...prev, [user.id]: e.target.value as Role }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-gray-400 px-2 py-1.5 focus:outline-none"
                >
                  <option value="sales_rep">Sales Rep</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={processingId === user.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
                >
                  {processingId === user.id ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={12} />}
                  Approve
                </button>

                <button
                  onClick={() => handleReject(user.id)}
                  disabled={processingId === user.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
                >
                  <UserX size={12} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
