"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Upload, FileText, X, Loader2, Trash2, Edit3, Check, FolderOpen } from "lucide-react";
import { supabase, projectService } from "../../lib/projectService";
import type { Role } from "../../lib/roles";

interface Blueprint {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface BlueprintVaultProps {
  projectId: string | null;
  projects?: { id: string; name: string }[];
  onProjectChange?: (id: string) => void;
  role?: Role;
  compact?: boolean;
}

export default function BlueprintVault({ projectId, projects, onProjectChange, role = "sales_rep", compact = false }: BlueprintVaultProps) {
  const canDeleteRename = role !== "sales_rep";
  const [selectedId, setSelectedId] = useState<string | null>(projectId);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSelectedId(projectId); }, [projectId]);

  const activeProjectId = selectedId;

  const fetchBlueprints = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true); setError(null);
    try {
      const data = await projectService.getBlueprintsByProject(activeProjectId);
      setBlueprints(data || []);
    } catch { setError("Failed to load blueprints."); }
    finally { setLoading(false); }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) fetchBlueprints();
    else setBlueprints([]);
  }, [activeProjectId, fetchBlueprints]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !activeProjectId) return;
    setUploading(true); setError(null);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${activeProjectId}/${Date.now()}_${safeName}`;
      try {
        const { error: uploadError } = await supabase.storage.from("blueprints").upload(filePath, file);
        if (uploadError) {
          errors.push(`Failed: "${file.name}": ${uploadError.message}`);
          continue;
        }
        const { data: urlData } = supabase.storage.from("blueprints").getPublicUrl(filePath);
        if (!urlData?.publicUrl) { errors.push(`No URL for "${file.name}".`); continue; }
        await projectService.uploadBlueprint(activeProjectId, file.name, urlData.publicUrl);
      } catch (err) {
        errors.push(`Error: "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (errors.length > 0) setError(errors.join(" "));
    await fetchBlueprints(); setUploading(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await projectService.deleteBlueprint(id);
      await fetchBlueprints();
    } catch { setError("Failed to delete file."); }
  }

  function startRename(bp: Blueprint) { setRenamingId(bp.id); setRenameValue(bp.file_name); }

  async function submitRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await projectService.renameBlueprint(id, renameValue.trim());
      setRenamingId(null);
      await fetchBlueprints();
    } catch { setError("Failed to rename file."); }
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (activeProjectId) handleUpload(e.dataTransfer.files);
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return dateStr; }
  }

  // --- Compact mode for sidebar ---
  if (compact) {
    if (!activeProjectId) {
      return <p className="text-xs text-gray-600 italic">No project selected</p>;
    }
    return (
      <div className="space-y-2">
        {/* Upload drop zone - compact */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex items-center justify-center gap-2 border border-dashed rounded-lg py-3 cursor-pointer transition-all text-xs ${
            dragActive ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.04]" : "border-white/[0.08] hover:border-[var(--accent)]/30 hover:bg-white/[0.02]"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
          {uploading ? (
            <><Loader2 size={14} className="text-[var(--accent)] animate-spin" /><span className="text-white/50">Uploading...</span></>
          ) : (
            <><Upload size={14} className="text-white/30" /><span className="text-gray-500">Drop files or <span className="text-[var(--accent)]">browse</span></span></>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/15 rounded-lg px-2 py-1.5">
            <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-400 text-[10px]">{error}</p>
          </div>
        )}

        {/* File list - compact */}
        {loading ? (
          <div className="flex items-center justify-center py-3 gap-2">
            <Loader2 size={14} className="text-[var(--accent)] animate-spin" />
            <span className="text-white/40 text-[10px]">Loading...</span>
          </div>
        ) : blueprints.length === 0 ? (
          <p className="text-[10px] text-gray-600 italic text-center py-2">No files uploaded yet</p>
        ) : (
          <div className="space-y-0.5">
            {blueprints.map((bp) => (
              <div key={bp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors group">
                <FileText size={12} className="text-[var(--accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  {renamingId === bp.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); submitRename(bp.id); }} className="flex items-center gap-1">
                      <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus
                        onKeyDown={(e) => { if (e.key === "Escape") setRenamingId(null); }}
                        className="input-field text-[10px] py-0.5 px-1.5 w-full" />
                      <button type="submit" className="p-0.5 text-emerald-400"><Check size={10} /></button>
                      <button type="button" onClick={() => setRenamingId(null)} className="p-0.5 text-gray-500"><X size={10} /></button>
                    </form>
                  ) : (
                    <p className="text-[11px] text-white/80 truncate">{bp.file_name}</p>
                  )}
                </div>
                {renamingId !== bp.id && (
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={bp.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-[var(--accent)] text-[10px] font-medium hover:text-[#00ccff] px-1">View</a>
                    {canDeleteRename && (
                      <>
                        <button onClick={() => startRename(bp)} className="p-0.5 text-gray-500 hover:text-[var(--accent)]" title="Rename"><Edit3 size={10} /></button>
                        <button onClick={() => handleDelete(bp.id, bp.file_name)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete"><Trash2 size={10} /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {canDeleteRename && blueprints.length > 1 && (
              <button
                onClick={() => {
                  if (!window.confirm("Delete all files? Cannot be undone.")) return;
                  Promise.all(blueprints.map((bp) => projectService.deleteBlueprint(bp.id)))
                    .then(() => fetchBlueprints())
                    .catch(() => setError("Failed to delete all files."));
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-300 px-2 pt-1 transition-colors"
              >
                <Trash2 size={10} /> Delete All
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Full mode (standalone page) ---
  const projectSelector = projects && projects.length > 0 ? (
    <div className="max-w-3xl mx-auto mb-4">
      <div className="glass-card rounded-xl p-3 flex items-center gap-3">
        <FolderOpen size={16} className="text-[var(--accent)] shrink-0" />
        <select
          value={selectedId || ""}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedId(id || null);
            if (id && onProjectChange) onProjectChange(id);
          }}
          className="input-field text-sm py-1.5 flex-1"
        >
          <option value="">Select a project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  ) : null;

  if (!activeProjectId) {
    return (
      <div>
        {projectSelector}
      </div>
    );
  }

  return (
    <div>
    {projectSelector}
    <div className="max-w-3xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Upload Panel */}
      <div className="glass-card-elevated p-6 rounded-2xl">
        <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
            <Upload size={18} className="text-[var(--accent)]" />
          </div>
          Upload
        </h2>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-all duration-200 ${
            dragActive ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.04] shadow-[0_0_20px_rgba(0,170,255,0.1)]" : "border-white/[0.06] hover:border-[var(--accent)]/30 hover:bg-white/[0.02]"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
              <p className="text-white/50 text-sm">Uploading...</p>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--accent)]/10 to-purple-500/10">
                <Upload className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-xs text-gray-500">
                Drag files here or <span className="text-[var(--accent)]">click to browse</span>
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/15 rounded-lg px-4 py-3 mt-4">
            <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* File List Panel */}
      <div className="glass-card-elevated rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent flex items-center justify-between">
          <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
              <FileText size={18} className="text-[var(--accent)]" />
            </div>
            Files
          </h2>
          {blueprints.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{blueprints.length}</span>
              {canDeleteRename && (
                <button
                  onClick={() => {
                    if (!window.confirm("Are you really sure you want to delete everything? Cannot be undone.")) return;
                    Promise.all(blueprints.map((bp) => projectService.deleteBlueprint(bp.id)))
                      .then(() => fetchBlueprints())
                      .catch(() => setError("Failed to delete all files."));
                  }}
                  className="flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-all hover:drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]"
                  style={{ color: "#f87171" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Delete All
                </button>
              )}
            </div>
          )}
        </div>

        <div className="divide-y divide-white/[0.04]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
              <span className="ml-2 text-white/40 text-sm">Loading...</span>
            </div>
          ) : blueprints.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-10">No files uploaded yet.</p>
          ) : (
            blueprints.map((bp) => (
              <div key={bp.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 shrink-0">
                  <FileText className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  {renamingId === bp.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); submitRename(bp.id); }} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Escape") setRenamingId(null); }}
                        className="input-field text-xs py-1 px-2 w-48"
                      />
                      <button type="submit" className="p-1 rounded-lg hover:bg-white/10 text-emerald-400 transition-colors" title="Save">
                        <Check size={14} />
                      </button>
                      <button type="button" onClick={() => setRenamingId(null)} className="p-1 rounded-lg hover:bg-white/10 text-gray-500 transition-colors" title="Cancel">
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="text-white/80 text-sm font-medium truncate">{bp.file_name}</p>
                      <p className="text-white/30 text-xs mt-0.5">{formatDate(bp.uploaded_at)}</p>
                    </>
                  )}
                </div>
                {renamingId !== bp.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={bp.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-[var(--accent)] text-xs font-medium hover:text-[#00ccff] transition-colors px-1.5">View</a>
                    {canDeleteRename && (
                      <>
                        <button onClick={() => startRename(bp)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-[var(--accent)] transition-colors" title="Rename">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDelete(bp.id, bp.file_name)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
