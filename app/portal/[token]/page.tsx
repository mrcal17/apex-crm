"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Clock, FileText, AlertCircle, Loader2, Shield, Home, Zap } from "lucide-react";

interface PortalProject {
  id: string;
  name: string;
  client_name: string;
  status: string;
  contract_value: number;
  revenue_collected: number;
  created_at: string;
  interconnection_status: string | null;
  pto_status: string | null;
  address: string | null;
}

interface PortalPermit {
  id: string;
  agency: string;
  permit_number: string;
  status: string;
  expiration_date: string | null;
}

const STATUS_STEPS = [
  { key: "lead", label: "Lead Received", icon: Home },
  { key: "in_progress", label: "In Progress", icon: Zap },
  { key: "completed", label: "Completed", icon: CheckCircle },
];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
  const activeIdx = currentStatus === "cancelled" ? -1 : idx;

  return (
    <div className="flex items-center gap-0 w-full my-8">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= activeIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${done ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"}`}>
                <Icon size={18} />
              </div>
              <span className={`text-xs font-medium ${done ? "text-emerald-400" : "text-gray-500"}`}>{step.label}</span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-20px] ${i < activeIdx ? "bg-emerald-500/50" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PermitCard({ permit }: { permit: PortalPermit }) {
  const statusColor: Record<string, string> = {
    pending: "text-amber-400 bg-amber-500/15",
    submitted: "text-blue-400 bg-blue-500/15",
    approved: "text-emerald-400 bg-emerald-500/15",
    expired: "text-red-400 bg-red-500/15",
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <FileText size={18} className="text-gray-400" />
        <div>
          <p className="text-sm font-medium text-white/90">{permit.agency || "Permit"}</p>
          {permit.permit_number && <p className="text-xs text-gray-500">#{permit.permit_number}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {permit.expiration_date && (
          <span className="text-xs text-gray-500">Exp: {new Date(permit.expiration_date).toLocaleDateString()}</span>
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[permit.status] || "text-gray-400 bg-gray-500/15"}`}>
          {permit.status}
        </span>
      </div>
    </div>
  );
}

export default function CustomerPortalPage({ params }: { params: { token: string } }) {
  const [project, setProject] = useState<PortalProject | null>(null);
  const [permits, setPermits] = useState<PortalPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${params.token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Invalid or expired link");
          return;
        }
        const data = await res.json();
        setProject(data.project);
        setPermits(data.permits || []);
      } catch {
        setError("Failed to load project status");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-gray-400 text-sm">{error || "This portal link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const collectionPct = project.contract_value > 0 ? (project.revenue_collected / project.contract_value) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#080d1a] text-white">
      {/* Gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.03]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-500/20 mb-4">
            <Shield size={12} /> Secure Project Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{project.name}</h1>
          <p className="text-gray-400">{project.client_name}</p>
          {project.address && <p className="text-gray-500 text-sm mt-1">{project.address}</p>}
        </div>

        {/* Status Timeline */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Project Status</h2>
          {project.status === "cancelled" ? (
            <div className="flex items-center gap-2 text-red-400 mt-4">
              <AlertCircle size={18} />
              <span className="font-medium">Project Cancelled</span>
            </div>
          ) : (
            <StatusTimeline currentStatus={project.status} />
          )}
        </div>

        {/* Key Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Contract Value</p>
            <p className="text-lg font-bold text-white">${project.contract_value.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Collected</p>
            <p className="text-lg font-bold text-emerald-400">${project.revenue_collected.toLocaleString()}</p>
            <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(collectionPct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Utility Status */}
        {(project.interconnection_status || project.pto_status) && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Utility Status</h2>
            <div className="grid grid-cols-2 gap-4">
              {project.interconnection_status && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${project.interconnection_status === "approved" ? "bg-emerald-400" : project.interconnection_status === "submitted" ? "bg-amber-400" : "bg-gray-500"}`} />
                  <div>
                    <p className="text-xs text-gray-500">Interconnection</p>
                    <p className="text-sm font-medium text-white/80 capitalize">{project.interconnection_status.replace(/_/g, " ")}</p>
                  </div>
                </div>
              )}
              {project.pto_status && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${project.pto_status === "granted" ? "bg-emerald-400" : project.pto_status === "submitted" ? "bg-amber-400" : "bg-gray-500"}`} />
                  <div>
                    <p className="text-xs text-gray-500">PTO</p>
                    <p className="text-sm font-medium text-white/80 capitalize">{project.pto_status.replace(/_/g, " ")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Permits */}
        {permits.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              <span className="flex items-center gap-2"><FileText size={14} /> Permits ({permits.length})</span>
            </h2>
            <div className="space-y-2">
              {permits.map((p) => <PermitCard key={p.id} permit={p} />)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-xs text-gray-600">
            Started {new Date(project.created_at).toLocaleDateString()} &bull; Last updated {new Date().toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-700 mt-1">Powered by GCH CRM</p>
        </div>
      </div>
    </div>
  );
}
