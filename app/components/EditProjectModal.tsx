"use client";

import { useState, useEffect } from "react";
import { X, Save, Trash2, PlusCircle, DollarSign } from "lucide-react";
import { projectService } from "../../lib/projectService";
import { useToast } from "./Toast";
import { _rl, type Role } from "../../lib/roles";

interface EditProjectModalProps {
  isOpen: boolean;
  project: any;
  onClose: () => void;
  onUpdated: () => void;
  role?: Role;
}

const STATUS_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "completed": return "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20";
    case "in_progress": return "text-amber-400 bg-amber-500/15 border border-amber-500/20";
    case "lead": return "text-blue-400 bg-blue-500/15 border border-blue-500/20";
    case "cancelled": return "text-red-400 bg-red-500/15 border border-red-500/20";
    case "unpaid": return "text-amber-400 bg-amber-500/15 border border-amber-500/20";
    case "paid": return "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20";
    default: return "text-white/50 bg-white/5 border border-white/10";
  }
}

function getPermitBadgeClass(status: string) {
  switch (status) {
    case "approved": return "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20";
    case "submitted": return "text-blue-400 bg-blue-500/15 border border-blue-500/20";
    case "pending": return "text-amber-400 bg-amber-500/15 border border-amber-500/20";
    case "expired": return "text-red-400 bg-red-500/15 border border-red-500/20";
    default: return "text-white/50 bg-white/5 border border-white/10";
  }
}

const inputClass = "w-full input-field";
const inputSmClass = "w-full input-field-sm";

export default function EditProjectModal({ isOpen, project, onClose, onUpdated, role }: EditProjectModalProps) {
  const toast = useToast();
  const [formData, setFormData] = useState({ name: "", address: "", client_name: "", contract_value: "", revenue_collected: "", status: "lead" });
  const [permits, setPermits] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loadingPermits, setLoadingPermits] = useState(false);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssignPermit, setShowAssignPermit] = useState(false);
  const [assigningPermit, setAssigningPermit] = useState(false);
  const [allPermits, setAllPermits] = useState<any[]>([]);

  useEffect(() => {
    if (!project) return;
    setFormData({
      name: project.name || "", address: project.address || "", client_name: project.client_name || "",
      contract_value: project.contract_value != null ? String(project.contract_value) : "",
      revenue_collected: project.revenue_collected != null ? String(project.revenue_collected) : "",
      status: project.status || "lead",
    });
    setError(null);
    async function fetchRelated() {
      setLoadingPermits(true); setLoadingCommissions(true);
      try {
        const [p, c, ap] = await Promise.all([
          projectService.getPermitsByProject(project.id),
          projectService.getCommissionsByProject(project.id),
          projectService.getAllPermits(),
        ]);
        setPermits(p || []); setCommissions(c || []);
        setAllPermits(ap || []);
      } catch (err) { console.error("Failed to fetch related data:", err); }
      finally { setLoadingPermits(false); setLoadingCommissions(false); }
    }
    fetchRelated();
  }, [project]);

  if (!isOpen || !project) return null;

  const unassignedPermits = allPermits.filter((p) => !p.project_id);

  async function handleAssignPermit(permitId: string) {
    if (!project || !permitId) return;
    setAssigningPermit(true);
    try {
      await projectService.updatePermit(permitId, { project_id: project.id });
      const assigned = allPermits.find((p) => p.id === permitId);
      if (assigned) setPermits((prev) => [{ ...assigned, project_id: project.id }, ...prev]);
      setAllPermits((prev) => prev.map((p) => p.id === permitId ? { ...p, project_id: project.id } : p));
      setShowAssignPermit(false);
    } catch (err) { console.error("Failed to assign permit:", err); }
    finally { setAssigningPermit(false); }
  }

  async function handleCommissionUpdate(commissionId: string, updates: Record<string, string | undefined>) {
    try {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(updates)) { if (v !== undefined) clean[k] = v; }
      await projectService.updateCommission(commissionId, clean);
      setCommissions((prev) => prev.map((c) => (c.id === commissionId ? { ...c, ...clean } : c)));
    } catch (err) { console.error("Failed to update commission:", err); }
  }

  async function handleSave() {
    setError(null); setSaving(true);
    try {
      if (formData.status === "completed" && project.status !== "completed") {
        if (role && _rl(role) < 2) {
          await projectService.requestCompletion(project.id);
          toast("Completion request submitted — awaiting manager/admin approval.", "success");
          onClose();
          return;
        }
        await projectService.completeProject(project.id);
      } else {
        await projectService.updateProject(project.id, {
          name: formData.name, address: formData.address, client_name: formData.client_name,
          contract_value: parseFloat(formData.contract_value) || 0,
          revenue_collected: parseFloat(formData.revenue_collected) || 0, status: formData.status,
        });
      }
      toast("Project saved successfully!", "success"); onUpdated(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save project."); toast("Failed to save project.", "error");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${project.name}"? This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try { await projectService.deleteProject(project.id); toast("Project deleted.", "info"); onUpdated(); onClose(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to delete project."); toast("Failed to delete project.", "error"); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
      <div className="glass-card-elevated rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/60 sticky top-0 bg-white/95 backdrop-blur-xl z-10 rounded-t-2xl">
          <h2 className="text-gray-900 font-semibold text-lg">Edit Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}

          <div>
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Project Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-white/50 text-sm mb-1.5">Project Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-white/50 text-sm mb-1.5">Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-white/50 text-sm mb-1.5">Client Name</label>
                <input type="text" value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/50 text-sm mb-1.5">Contract Value ($)</label>
                  <input type="number" value={formData.contract_value} onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })} className={inputClass} min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-white/50 text-sm mb-1.5">Revenue Collected ($)</label>
                  <input type="number" value={formData.revenue_collected} onChange={(e) => setFormData({ ...formData, revenue_collected: e.target.value })} className={inputClass} min="0" step="0.01" />
                </div>
              </div>
              <div>
                <label className="block text-white/50 text-sm mb-1.5">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputClass}>
                  {STATUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(formData.status)}`}>
                    {STATUS_OPTIONS.find((o) => o.value === formData.status)?.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Permits */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest">Permits</h3>
              <button type="button" onClick={() => setShowAssignPermit((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[#00ccff] transition-colors">
                <PlusCircle size={14} /> Assign Permit
              </button>
            </div>

            {showAssignPermit && (
              <div className="bg-blue-900/20 border border-white/[0.06] rounded-xl p-4 mb-3 space-y-3">
                <label className="block text-white/50 text-xs mb-1">Select an unassigned permit</label>
                {unassignedPermits.length === 0 ? (
                  <p className="text-white/30 text-xs italic">No unassigned permits available. Create permits in the Permits tab first.</p>
                ) : (
                  <select
                    defaultValue=""
                    onChange={(e) => handleAssignPermit(e.target.value)}
                    disabled={assigningPermit}
                    className={inputSmClass}
                  >
                    <option value="" disabled>Choose a permit...</option>
                    {unassignedPermits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {[p.agency, p.permit_number, p.status].filter(Boolean).join(" — ") || "Untitled permit"}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" onClick={() => setShowAssignPermit(false)}
                  className="glass-card text-gray-400 rounded-lg px-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors">Cancel</button>
              </div>
            )}

            {loadingPermits ? (
              <p className="text-white/30 text-sm">Loading permits...</p>
            ) : permits.length === 0 ? (
              <p className="text-white/20 text-sm italic">No permits on record.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permits.map((permit) => (
                  <span key={permit.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${getPermitBadgeClass(permit.status)}`}>
                    {permit.agency || permit.permit_number || "Permit"}
                    <span className="opacity-60">&middot;</span>
                    {permit.status}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Commissions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest">Commissions</h3>
              <DollarSign size={14} className="text-white/20" />
            </div>
            {loadingCommissions ? (
              <p className="text-white/30 text-sm">Loading commissions...</p>
            ) : commissions.length === 0 ? (
              <p className="text-white/20 text-sm italic">No commissions on record.</p>
            ) : (
              <ul className="space-y-3">
                {commissions.map((c) => (
                  <li key={c.id} className="bg-blue-900/20 border border-white/[0.05] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold text-sm">
                        ${Number(c.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-white/30 text-xs mb-0.5">Status</label>
                        <select value={c.status} onChange={(e) => handleCommissionUpdate(c.id, { status: e.target.value })} className={inputSmClass}>
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-white/30 text-xs mb-0.5">Payout Date</label>
                        <input type="date" defaultValue={c.payout_date ? c.payout_date.split("T")[0] : ""}
                          onBlur={(e) => {
                            const val = e.target.value;
                            const existing = c.payout_date ? c.payout_date.split("T")[0] : "";
                            if (val !== existing) handleCommissionUpdate(c.id, { payout_date: val || undefined });
                          }} className={inputSmClass} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-gray-200/60 flex items-center justify-between sticky bottom-0 bg-white/95 backdrop-blur-xl rounded-b-2xl">
          <button onClick={handleDelete} disabled={deleting || saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50">
            <Trash2 size={15} /> {deleting ? "Deleting..." : "Delete"}
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={saving || deleting} className="px-4 py-2.5 text-white/50 hover:text-white text-sm font-medium transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || deleting}
              className="flex items-center gap-2 px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl disabled:opacity-50">
              <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
