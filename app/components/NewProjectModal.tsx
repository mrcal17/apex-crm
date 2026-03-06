"use client";

import { useState, useEffect } from "react";
import { X, PlusCircle, Trash2 } from "lucide-react";
import { projectService } from "../../lib/projectService";
import { useToast } from "./Toast";
import { PERMISSIONS, type Role } from "../../lib/roles";

interface Profile { id: string; full_name: string; }

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  role?: Role;
  profileId?: string | null;
}

export default function NewProjectModal({ isOpen, onClose, onCreated, role = "sales_rep", profileId }: NewProjectModalProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [value, setValue] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allPermits, setAllPermits] = useState<any[]>([]);
  const [selectedPermitIds, setSelectedPermitIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChooseRep = PERMISSIONS.canChooseSalesRep(role);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchData() {
      try {
        const [profileData, permitData] = await Promise.all([
          projectService.getProfiles(),
          projectService.getAllPermits(),
        ]);
        setProfiles(profileData || []);
        setAllPermits(permitData || []);
        // Auto-assign sales rep for sales_rep role
        if (!canChooseRep && profileId) {
          setSalesRepId(profileId);
        }
      } catch (err) { console.error("Failed to fetch data:", err); }
    }
    fetchData();
  }, [isOpen, canChooseRep, profileId]);

  if (!isOpen) return null;

  const unassignedPermits = allPermits.filter((p) => !p.project_id && !selectedPermitIds.includes(p.id));

  function resetForm() { setName(""); setClient(""); setValue(""); setSalesRepId(""); setSelectedPermitIds([]); setError(null); }
  function handleClose() { resetForm(); onClose(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const project = await projectService.createProject({ name, client, value: parseFloat(value), salesRepId });
      // Assign selected permits to this project
      for (const permitId of selectedPermitIds) {
        await projectService.updatePermit(permitId, { project_id: project.id });
      }
      toast(`"${name}" created successfully!`, "success");
      resetForm(); onCreated(); onClose();
    } catch (err: any) {
      setError(err?.message || err?.error_description || JSON.stringify(err));
    } finally { setLoading(false); }
  }

  function handleAddPermit(permitId: string) {
    if (permitId && !selectedPermitIds.includes(permitId)) {
      setSelectedPermitIds([...selectedPermitIds, permitId]);
    }
  }

  function handleRemovePermit(permitId: string) {
    setSelectedPermitIds(selectedPermitIds.filter((id) => id !== permitId));
  }

  function getPermitLabel(permitId: string) {
    const p = allPermits.find((x) => x.id === permitId);
    if (!p) return "Unknown permit";
    return [p.agency, p.permit_number, p.status].filter(Boolean).join(" — ") || "Untitled permit";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="w-full max-w-md glass-card-elevated rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-name" className="text-sm text-gray-400">Project Name</label>
            <input id="project-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Westside Office Renovation"
              className="input-field py-2.5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-name" className="text-sm text-gray-400">Client Name</label>
            <input id="client-name" type="text" value={client} onChange={(e) => setClient(e.target.value)} required
              placeholder="e.g. Acme Corp"
              className="input-field py-2.5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contract-value" className="text-sm text-gray-400">Contract Value</label>
            <input id="contract-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} required
              min="0" step="0.01" placeholder="e.g. 250000"
              className="input-field py-2.5" />
          </div>
          {canChooseRep ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sales-rep" className="text-sm text-gray-400">Sales Rep</label>
              <select id="sales-rep" value={salesRepId} onChange={(e) => setSalesRepId(e.target.value)} required
                className="input-field py-2.5">
                <option value="" disabled>Select a sales rep</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" value={salesRepId} />
          )}
          {/* Permits — select from existing unassigned permits */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">Permits</label>
            </div>
            {selectedPermitIds.length > 0 && (
              <div className="space-y-1.5">
                {selectedPermitIds.map((id) => (
                  <div key={id} className="flex items-center justify-between bg-blue-900/20 border border-white/[0.06] rounded-lg px-3 py-2">
                    <span className="text-white/70 text-xs truncate">{getPermitLabel(id)}</span>
                    <button type="button" onClick={() => handleRemovePermit(id)}
                      className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 ml-2 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {unassignedPermits.length > 0 ? (
              <select
                value=""
                onChange={(e) => handleAddPermit(e.target.value)}
                className="input-field-sm"
              >
                <option value="" disabled>+ Assign a permit...</option>
                {unassignedPermits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.agency, p.permit_number, p.status].filter(Boolean).join(" — ") || "Untitled permit"}
                  </option>
                ))}
              </select>
            ) : selectedPermitIds.length === 0 ? (
              <p className="text-white/20 text-xs italic">No unassigned permits available. Create permits in the Permits tab.</p>
            ) : null}
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={handleClose}
              className="flex-1 glass-card text-gray-400 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-white/[0.04] hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 btn-primary text-white font-bold rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
              ) : (
                <><PlusCircle size={16} />Create Project</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
