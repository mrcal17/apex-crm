"use client";

import { useState } from "react";
import { X, CheckCircle, XCircle } from "lucide-react";
import { projectService } from "../../lib/projectService";

interface CloseReasonModalProps {
  projectId: string;
  projectName: string;
  outcome: "completed" | "cancelled";
  onClose: () => void;
  onSaved: () => void;
}

const WIN_REASONS = [
  "Price competitiveness",
  "Quality of service",
  "Customer referral",
  "Strong relationship",
  "Fast turnaround",
  "Unique capability",
  "Other",
];

const LOSS_REASONS = [
  "Competitor pricing",
  "Permit delays",
  "Customer changed mind",
  "Budget constraints",
  "Poor communication",
  "Timeline too long",
  "Scope disagreement",
  "Other",
];

export default function CloseReasonModal({ projectId, projectName, outcome, onClose, onSaved }: CloseReasonModalProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const isWin = outcome === "completed";
  const reasons = isWin ? WIN_REASONS : LOSS_REASONS;

  async function handleSave() {
    setSaving(true);
    try {
      await projectService.updateProject(projectId, {
        close_reason: reason || null,
        close_notes: notes.trim() || null,
      } as any);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save close reason:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={onClose}>
      <div className="glass-card-elevated rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            {isWin ? (
              <><CheckCircle size={18} className="text-emerald-400" /> Win Analysis</>
            ) : (
              <><XCircle size={18} className="text-red-400" /> Loss Analysis</>
            )}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Why was <span className="text-white font-medium">{projectName}</span> {isWin ? "won" : "lost"}?
        </p>

        {/* Reason chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                reason === r
                  ? isWin
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/15 text-red-400 border-red-500/30"
                  : "bg-white/[0.04] text-gray-400 border-white/[0.06] hover:border-white/[0.12]"
              }`}
            >{r}</button>
          ))}
        </div>

        {/* Notes */}
        <textarea
          placeholder="Additional notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40 resize-none mb-4"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Skip
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
