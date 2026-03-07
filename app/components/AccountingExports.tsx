"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, DollarSign, Users, Loader2 } from "lucide-react";
import { supabase } from "../../lib/projectService";

const EXPORT_TYPES = [
  { key: "invoices", label: "Invoices & Projects", icon: FileSpreadsheet, description: "All projects with contract values, collections, and outstanding balances" },
  { key: "commissions", label: "Commission Details", icon: DollarSign, description: "Individual commission records with rep, project, amount, and status" },
  { key: "payroll", label: "Payroll Summary", icon: Users, description: "Aggregated unpaid commissions by sales rep for payroll processing" },
];

export default function AccountingExports() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleExport(type: string) {
    setDownloading(type);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch(`/api/export?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2 mb-4">
        <Download size={16} className="text-[var(--accent-secondary)]" /> Accounting Exports
      </h3>
      <p className="text-xs text-gray-500 mb-4">Export data as CSV for QuickBooks, Xero, or payroll processing.</p>
      <div className="space-y-2">
        {EXPORT_TYPES.map((exp) => {
          const Icon = exp.icon;
          return (
            <button
              key={exp.key}
              onClick={() => handleExport(exp.key)}
              disabled={downloading === exp.key}
              className="w-full flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] rounded-xl p-3 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-secondary)]/10 flex items-center justify-center shrink-0">
                {downloading === exp.key ? <Loader2 size={16} className="text-[var(--accent-secondary)] animate-spin" /> : <Icon size={16} className="text-[var(--accent-secondary)]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{exp.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{exp.description}</p>
              </div>
              <Download size={14} className="text-gray-600 group-hover:text-[var(--accent-secondary)] transition-colors shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
