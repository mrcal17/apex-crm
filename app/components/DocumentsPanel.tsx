"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";
import {
  Upload, FileText, Image, File, Download, Trash2, Loader2, AlertCircle,
  FileSpreadsheet, FileCheck, Camera, Receipt, FolderOpen,
} from "lucide-react";

interface DocumentsPanelProps {
  projectId: string;
  role: string;
}

interface Document {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  category: string;
  uploaded_by: string;
  created_at: string;
}

const CATEGORIES = ["All", "Contracts", "Proposals", "Photos", "Permits", "Invoices", "General"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryIcons: Record<string, React.ReactNode> = {
  contracts: <FileCheck size={14} />,
  proposals: <FileSpreadsheet size={14} />,
  photos: <Camera size={14} />,
  permits: <FileText size={14} />,
  invoices: <Receipt size={14} />,
  general: <FolderOpen size={14} />,
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image size={20} className="text-[var(--accent-secondary)]" />;
  if (type === "application/pdf") return <FileText size={20} className="text-red-400" />;
  return <File size={20} className="text-gray-400" />;
}

export default function DocumentsPanel({ projectId, role }: DocumentsPanelProps) {
  const { profileId } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>("All");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [dragOver, setDragOver] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setDocs(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!profileId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const path = `${projectId}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("project-documents")
          .upload(path, file);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("project-documents")
          .getPublicUrl(path);

        const { error: insertErr } = await supabase.from("documents").insert({
          project_id: projectId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type,
          category: uploadCategory,
          uploaded_by: profileId,
        });
        if (insertErr) throw insertErr;
      }
      await fetchDocs();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    }
    setUploading(false);
  };

  const deleteDoc = async (doc: Document) => {
    const path = `${doc.project_id}/${doc.file_url.split(`${doc.project_id}/`).pop()}`;
    await supabase.storage.from("project-documents").remove([path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const downloadDoc = (doc: Document) => {
    const a = document.createElement("a");
    a.href = doc.file_url;
    a.download = doc.file_name;
    a.target = "_blank";
    a.click();
  };

  const filtered = activeTab === "All" ? docs : docs.filter((d) => d.category === activeTab.toLowerCase());

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className={`glass-card p-6 border-2 border-dashed transition-all duration-300 rounded-xl cursor-pointer
          ${dragOver ? "border-[var(--accent)] bg-[var(--accent)]/10 scale-[1.01]" : "border-white/10 hover:border-white/20"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("doc-file-input")?.click()}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          {uploading ? (
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          ) : (
            <Upload size={28} className="text-[var(--accent)]" />
          )}
          <p className="text-sm text-white/70">
            {uploading ? "Uploading..." : "Drag & drop files or click to browse"}
          </p>
          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs text-white/50">Category:</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 outline-none"
            >
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c.toLowerCase()} className="bg-gray-900">{c}</option>
              ))}
            </select>
          </div>
        </div>
        <input
          id="doc-file-input"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm glass-card p-3 rounded-lg">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${activeTab === cat
                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                : "text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">
          No documents {activeTab !== "All" ? `in ${activeTab}` : "yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="glass-card rounded-xl p-4 group hover:border-white/20 transition-all duration-200 hover:scale-[1.01] flex flex-col gap-3"
            >
              {/* Thumbnail / icon */}
              <div className="h-24 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                {doc.file_type.startsWith("image/") ? (
                  <img src={doc.file_url} alt={doc.file_name} className="h-full w-full object-cover rounded-lg" />
                ) : (
                  fileIcon(doc.file_type)
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium truncate" title={doc.file_name}>
                  {doc.file_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-tertiary)]/20 text-[var(--accent-tertiary)] border border-[var(--accent-tertiary)]/20">
                    {categoryIcons[doc.category] || <FolderOpen size={10} />}
                    {doc.category}
                  </span>
                  <span className="text-[10px] text-white/40">{formatSize(doc.file_size)}</span>
                </div>
                <p className="text-[10px] text-white/30 mt-1">
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => downloadDoc(doc)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-[var(--accent)]/20 text-white/60 hover:text-[var(--accent)] transition-colors"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => deleteDoc(doc)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
