"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X, Plus, Trash2, Save, Send, Download, FileText,
  Calendar, DollarSign, Percent, ChevronDown, Eye,
  CheckCircle, XCircle, Clock, AlertCircle,
} from "lucide-react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";

interface ProposalBuilderProps {
  projectId: string;
  projectName?: string;
  clientName?: string;
  onClose: () => void;
}

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

interface Proposal {
  id: string;
  project_id: string;
  title: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  discount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:    { label: "Draft",    color: "bg-gray-500/20 text-gray-300",          icon: <Clock size={12} /> },
  sent:     { label: "Sent",     color: "bg-blue-500/20 text-blue-300",          icon: <Send size={12} /> },
  viewed:   { label: "Viewed",   color: "bg-amber-500/20 text-amber-300",       icon: <Eye size={12} /> },
  accepted: { label: "Accepted", color: "bg-emerald-500/20 text-emerald-300",   icon: <CheckCircle size={12} /> },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-300",           icon: <XCircle size={12} /> },
};

const emptyLineItem = (order: number): LineItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
  sort_order: order,
});

export default function ProposalBuilder({ projectId, projectName, clientName, onClose }: ProposalBuilderProps) {
  const { profileId } = useAuth();

  // Existing proposals list
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);

  // Active proposal state
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [title, setTitle] = useState("New Proposal");
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem(0)]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Calculations
  const subtotal = useMemo(() => lineItems.reduce((sum, li) => sum + li.total, 0), [lineItems]);
  const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const grandTotal = useMemo(() => subtotal + taxAmount - discount, [subtotal, taxAmount, discount]);

  const fetchProposals = useCallback(async () => {
    try {
      setLoadingProposals(true);
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProposals(data || []);
    } catch (err) {
      console.error("Failed to fetch proposals:", err);
    } finally {
      setLoadingProposals(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const loadProposal = useCallback(async (proposal: Proposal) => {
    setActiveProposalId(proposal.id);
    setTitle(proposal.title);
    setTaxRate(proposal.tax_rate || 0);
    setDiscount(proposal.discount || 0);
    setNotes(proposal.notes || "");
    setValidUntil(proposal.valid_until || "");

    const { data, error } = await supabase
      .from("proposal_line_items")
      .select("*")
      .eq("proposal_id", proposal.id)
      .order("sort_order", { ascending: true });

    if (!error && data?.length) {
      setLineItems(data.map((li: any) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        total: li.total,
        sort_order: li.sort_order,
      })));
    } else {
      setLineItems([emptyLineItem(0)]);
    }
  }, []);

  const resetForm = () => {
    setActiveProposalId(null);
    setTitle("New Proposal");
    setLineItems([emptyLineItem(0)]);
    setTaxRate(0);
    setDiscount(0);
    setNotes("");
    setValidUntil("");
  };

  // Line item handlers
  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        item.total = Number(item.quantity) * Number(item.unit_price);
      }
      updated[index] = item;
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, emptyLineItem(prev.length)]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index).map((li, i) => ({ ...li, sort_order: i })));
  };

  // Save / Send
  const saveProposal = async (markAsSent = false) => {
    if (markAsSent) setSending(true); else setSaving(true);

    try {
      const status = markAsSent ? "sent" : "draft";
      const proposalData = {
        project_id: projectId,
        title,
        status,
        subtotal,
        tax_rate: taxRate,
        discount,
        total: grandTotal,
        notes: notes || null,
        valid_until: validUntil || null,
        sent_at: markAsSent ? new Date().toISOString() : null,
        created_by: profileId,
      };

      let proposalId = activeProposalId;

      if (proposalId) {
        const { error } = await supabase
          .from("proposals")
          .update(proposalData)
          .eq("id", proposalId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("proposals")
          .insert(proposalData)
          .select("id")
          .single();
        if (error) throw error;
        proposalId = data.id;
        setActiveProposalId(proposalId);
      }

      // Upsert line items: delete existing, re-insert
      await supabase.from("proposal_line_items").delete().eq("proposal_id", proposalId);

      const itemsToInsert = lineItems
        .filter(li => li.description.trim())
        .map((li, i) => ({
          proposal_id: proposalId,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total: li.total,
          sort_order: i,
        }));

      if (itemsToInsert.length) {
        const { error } = await supabase.from("proposal_line_items").insert(itemsToInsert);
        if (error) throw error;
      }

      await fetchProposals();
    } catch (err) {
      console.error("Failed to save proposal:", err);
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const downloadPdf = () => {
    const lines = [
      `PROPOSAL: ${title}`,
      `Project: ${projectName || projectId}`,
      `Client: ${clientName || "N/A"}`,
      `Date: ${new Date().toLocaleDateString()}`,
      validUntil ? `Valid Until: ${new Date(validUntil).toLocaleDateString()}` : "",
      "",
      "LINE ITEMS",
      "-".repeat(60),
      ...lineItems
        .filter(li => li.description.trim())
        .map(li => `  ${li.description}  |  Qty: ${li.quantity}  |  $${li.unit_price.toFixed(2)}  |  $${li.total.toFixed(2)}`),
      "-".repeat(60),
      `Subtotal: $${subtotal.toFixed(2)}`,
      `Tax (${taxRate}%): $${taxAmount.toFixed(2)}`,
      `Discount: -$${discount.toFixed(2)}`,
      `GRAND TOTAL: $${grandTotal.toFixed(2)}`,
      "",
      notes ? `Notes/Terms:\n${notes}` : "",
    ].filter(Boolean).join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-5xl max-h-[92vh] overflow-y-auto mx-4 p-0 rounded-2xl border border-white/10">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[var(--surface-primary)]/80 backdrop-blur-md rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={20} className="text-[var(--accent)] shrink-0" />
            <div className="min-w-0">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-transparent text-lg font-semibold text-[var(--text-primary)] outline-none border-b border-transparent focus:border-[var(--accent)] transition-colors w-full"
                placeholder="Proposal title..."
              />
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
                {projectName && <span>{projectName}</span>}
                {projectName && clientName && <span className="opacity-40">|</span>}
                {clientName && <span>{clientName}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Existing proposals */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">Existing Proposals</h3>
              <button onClick={resetForm} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors">
                + New
              </button>
            </div>
            {loadingProposals ? (
              <div className="text-sm text-[var(--text-secondary)] py-2">Loading...</div>
            ) : proposals.length === 0 ? (
              <div className="text-sm text-[var(--text-tertiary)] py-2">No proposals yet. Create your first one below.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {proposals.map(p => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                  const isActive = p.id === activeProposalId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => loadProposal(p)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isActive
                          ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                          : "border-white/5 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate mr-2">{p.title}</span>
                        <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                        <span>${fmt(p.total)}</span>
                        <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Line items table */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-tertiary)] text-xs uppercase tracking-wider">
                    <th className="text-left pb-2 pr-3 w-[45%]">Description</th>
                    <th className="text-right pb-2 px-3 w-[15%]">Qty</th>
                    <th className="text-right pb-2 px-3 w-[18%]">Unit Price</th>
                    <th className="text-right pb-2 px-3 w-[17%]">Total</th>
                    <th className="pb-2 pl-3 w-[5%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lineItems.map((item, i) => (
                    <tr key={i} className="group">
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateLineItem(i, "description", e.target.value)}
                          placeholder="Item description..."
                          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={e => updateLineItem(i, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-right text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-xs">$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unit_price}
                            onChange={e => updateLineItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-6 pr-3 py-2 text-right text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)] font-medium tabular-nums">
                        ${fmt(item.total)}
                      </td>
                      <td className="py-2 pl-3">
                        <button
                          onClick={() => removeLineItem(i)}
                          disabled={lineItems.length <= 1}
                          className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addLineItem}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-secondary)] transition-colors px-3 py-2 rounded-lg hover:bg-[var(--accent)]/10"
            >
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          {/* Summary + Details */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Notes + Valid Until */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Notes / Terms</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Payment terms, warranty info, scope of work..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)]/50 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  <Calendar size={12} className="inline mr-1 -mt-0.5" />
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>
            </div>

            {/* Right: Financial summary */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-3 self-start">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Subtotal</span>
                <span className="text-[var(--text-primary)] font-medium tabular-nums">${fmt(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Percent size={13} />
                  <span>Tax Rate</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-white/[0.05] border border-white/10 rounded px-2 py-1 text-right text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
                  />
                  <span className="text-[var(--text-tertiary)] text-xs">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <span>Tax Amount</span>
                <span className="tabular-nums">${fmt(taxAmount)}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <DollarSign size={13} />
                  <span>Discount</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-tertiary)] text-xs">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-white/[0.05] border border-white/10 rounded px-2 py-1 text-right text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--text-primary)]">Grand Total</span>
                <span className="text-xl font-bold text-[var(--accent)] tabular-nums">${fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
            <button
              onClick={() => saveProposal(false)}
              disabled={saving || sending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/10 text-[var(--text-primary)] hover:bg-white/[0.1] transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => saveProposal(true)}
              disabled={saving || sending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent)] text-black hover:brightness-110 transition-all disabled:opacity-50"
            >
              <Send size={15} />
              {sending ? "Sending..." : "Send Proposal"}
            </button>
            <button
              onClick={downloadPdf}
              disabled={!lineItems.some(li => li.description.trim())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/20 hover:bg-[var(--accent-secondary)]/25 transition-colors disabled:opacity-50"
            >
              <Download size={15} />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="ml-auto text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
