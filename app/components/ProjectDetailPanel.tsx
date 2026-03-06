"use client";

import { useState, useEffect, useCallback } from "react";
import { X, DollarSign, FileText, CheckCircle, Clock, User, Edit3, MessageSquare, Send, Trash2, ArrowRight } from "lucide-react";
import { projectService, supabase } from "../../lib/projectService";
import { relativeTime } from "../hooks/useRelativeTime";
import BlueprintVault from "./BlueprintVault";
import CommunicationTimeline from "./CommunicationTimeline";
import { _rl, type Role } from "../../lib/roles";
import { useAuth } from "./AuthProvider";
import { formatStatus, statusClasses } from "../../lib/statusConfig";

interface ProjectDetailPanelProps {
  projectId: string | null;
  onClose: () => void;
  onEdit: (project: any) => void;
  role?: Role;
}

interface Note {
  id: string;
  project_id: string;
  content: string;
  created_at: string;
}

interface Comment {
  id: string;
  project_id: string;
  content: string;
  author_id: string;
  created_at: string;
  profiles?: { full_name: string; role: string };
}

export default function ProjectDetailPanel({ projectId, onClose, onEdit, role = "sales_rep" }: ProjectDetailPanelProps) {
  const { profileId } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [permits, setPermits] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<{ id: string; name: string; total: number; paid: number; unpaid: number; count: number }[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [advancingPermit, setAdvancingPermit] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [perms, comms, commSummary, noteData, commentData] = await Promise.all([
        projectService.getPermitsByProject(projectId).catch(() => []),
        projectService.getCommissionsByProject(projectId).catch(() => []),
        projectService.getCommissionSummaryByRep().catch(() => []),
        supabase.from("project_notes").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).then(r => r.data || []),
        supabase.from("project_comments").select("*, profiles(full_name, role)").eq("project_id", projectId).order("created_at", { ascending: true }).then(r => r.data || []),
      ]);
      setPermits(perms || []);
      setCommissions(comms || []);
      setCommissionSummary(commSummary || []);
      setNotes(noteData);
      setComments(commentData as Comment[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Get project from parent data isn't passed directly, fetch it
  useEffect(() => {
    if (!projectId) { setProject(null); return; }
    projectService.getProjects().then((all) => {
      const found = all?.find((p: any) => p.id === projectId);
      setProject(found || null);
    });
  }, [projectId]);

  async function handleAddNote() {
    if (!newNote.trim() || !projectId) return;
    setSavingNote(true);
    try {
      const { data } = await supabase
        .from("project_notes")
        .insert([{ project_id: projectId, content: newNote.trim() }])
        .select()
        .single();
      if (data) setNotes((prev) => [data, ...prev]);
      setNewNote("");
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await supabase.from("project_notes").delete().eq("id", noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      // ignore
    }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !projectId || !profileId) return;
    setSavingComment(true);
    try {
      const { data } = await supabase
        .from("project_comments")
        .insert([{ project_id: projectId, author_id: profileId, content: newComment.trim() }])
        .select("*, profiles(full_name, role)")
        .single();
      if (data) setComments((prev) => [...prev, data as Comment]);
      setNewComment("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSavingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await supabase.from("project_comments").delete().eq("id", commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // ignore
    }
  }

  async function handleAdvancePermit(permitId: string) {
    setAdvancingPermit(permitId);
    try {
      const updated = await projectService.advancePermitStatus(permitId);
      setPermits((prev) => prev.map((p) => (p.id === permitId ? { ...p, status: updated.status } : p)));
    } catch (err) {
      console.error("Failed to advance permit:", err);
    } finally {
      setAdvancingPermit(null);
    }
  }

  if (!projectId) return null;

  const statusColor = (s: string) => {
    const cls = statusClasses(s);
    const border = s === "completed" ? "border-emerald-500/20" : s === "in_progress" ? "border-amber-500/20" : s === "lead" ? "border-cyan-500/20" : "border-red-500/20";
    return `${cls} ${border}`;
  };

  const totalCommission = commissions.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 h-full w-full max-w-md glass-card-elevated border-l border-white/[0.08] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-[var(--accent)]/[0.04] to-transparent backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-white truncate pr-2">{project?.name || "Loading..."}</h2>
            <div className="flex items-center gap-1 shrink-0">
              {project && (
                <button onClick={() => onEdit(project)} className="p-1.5 rounded-lg hover:bg-[var(--accent)]/10 text-gray-400 hover:text-[var(--accent)] transition-colors">
                  <Edit3 size={16} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
          {project && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center border text-xs font-medium rounded-full px-2.5 py-0.5 ${statusColor(project.status)}`}>
                {formatStatus(project.status)}
              </span>
              {project.profiles?.full_name && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <User size={10} /> {project.profiles.full_name}
                </span>
              )}
              {project.created_at && (
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock size={10} /> {relativeTime(project.created_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {project && (
          <div className="px-5 py-4 space-y-5">
            {/* Financials */}
            <div>
              <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">Financials</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-500">Contract Value</p>
                  <p className="text-sm font-bold text-white">${Number(project.contract_value || 0).toLocaleString()}</p>
                </div>
                <div className="glass-card rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-500">Collected</p>
                  <p className="text-sm font-bold text-emerald-400">${Number(project.revenue_collected || 0).toLocaleString()}</p>
                </div>
                <div className="glass-card rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-500">Client</p>
                  <p className="text-sm font-medium text-white/80">{project.client_name || "—"}</p>
                </div>
                <div className="glass-card rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-500">Commission</p>
                  <p className="text-sm font-bold text-amber-400">${totalCommission.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Permits */}
            <div>
              <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Permits ({permits.length})
              </h3>
              {permits.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No permits linked</p>
              ) : (
                <div className="space-y-1.5">
                  {permits.map((p) => {
                    const canAdvance = _rl(role) >= 2 && (p.status === "pending" || p.status === "submitted");
                    const nextLabel = p.status === "pending" ? "Submit" : p.status === "submitted" ? "Approve" : null;
                    return (
                      <div key={p.id} className="flex items-center justify-between glass-card rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs text-white/80 font-medium">{p.permit_number || p.agency || "Permit"}</p>
                          <p className="text-[10px] text-gray-500">{p.agency}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor(p.status === "approved" ? "completed" : p.status === "expired" ? "cancelled" : p.status === "submitted" ? "in_progress" : "lead")}`}>
                            {p.status}
                          </span>
                          {canAdvance && nextLabel && (
                            <button
                              onClick={() => handleAdvancePermit(p.id)}
                              disabled={advancingPermit === p.id}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:text-[#00ccff] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/20 rounded-lg px-2 py-0.5 transition-all disabled:opacity-50"
                            >
                              {advancingPermit === p.id ? "..." : <>{nextLabel} <ArrowRight size={10} /></>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Commissions */}
            <div>
              <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                <DollarSign size={12} /> Commissions ({commissions.length})
              </h3>
              {commissions.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No commissions yet</p>
              ) : (
                <div className="space-y-1.5">
                  {commissions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between glass-card rounded-lg px-3 py-2">
                      <p className="text-xs text-white/80 font-medium">${Number(c.amount || 0).toLocaleString()}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${c.status === "paid" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/20" : "text-amber-400 bg-amber-500/15 border-amber-500/20"}`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commission Summary by Rep */}
            {commissionSummary.length > 0 && (
              <div>
                <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                  <DollarSign size={12} /> Commission Summary by Rep
                </h3>
                <div className="space-y-1.5">
                  {commissionSummary.map((rep) => (
                    <div key={rep.id} className="glass-card rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-white/80 font-medium flex items-center gap-1.5">
                          <User size={10} className="text-gray-500" /> {rep.name}
                        </p>
                        <p className="text-xs font-bold text-white">${rep.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-emerald-400">${rep.paid.toLocaleString()} paid</span>
                        <span className="text-amber-400">${rep.unpaid.toLocaleString()} unpaid</span>
                        <span className="text-gray-500">{rep.count} deal{rep.count !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vault */}
            <div>
              <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Vault
              </h3>
              <BlueprintVault projectId={projectId} role={role} compact />
            </div>

            {/* Communications */}
            <div>
              <CommunicationTimeline projectId={projectId} role={role} />
            </div>

            {/* Comments */}
            <div>
              <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare size={12} /> Discussion ({comments.length})
              </h3>
              {comments.length === 0 ? (
                <p className="text-xs text-gray-600 italic mb-3">No comments yet. Start the conversation.</p>
              ) : (
                <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="glass-card rounded-lg px-3 py-2 group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/20 to-[var(--accent)]/20 flex items-center justify-center text-[8px] font-bold text-white/70">
                            {(c.profiles?.full_name || "?")[0]?.toUpperCase()}
                          </div>
                          <span className="text-[10px] font-medium text-white/80">{c.profiles?.full_name || "Unknown"}</span>
                          <span className="text-[8px] text-gray-600">{c.profiles?.role?.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-gray-600">{relativeTime(c.created_at)}</span>
                          {(c.author_id === profileId || _rl(role) >= 2) && (
                            <button onClick={() => handleDeleteComment(c.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-white/80">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
                  placeholder="Write a comment..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40" />
                <button onClick={handleAddComment} disabled={!newComment.trim() || savingComment}
                  className="p-2 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 disabled:opacity-40 transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>

            {/* System Notes */}
            {notes.length > 0 && (
              <div>
                <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
                  System Notes ({notes.length})
                </h3>
                <div className="space-y-1.5">
                  {notes.map((n) => (
                    <div key={n.id} className="glass-card rounded-lg px-3 py-1.5 group">
                      <p className="text-[10px] text-gray-400">{n.content}</p>
                      <p className="text-[9px] text-gray-600 mt-0.5">{relativeTime(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !project && (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
