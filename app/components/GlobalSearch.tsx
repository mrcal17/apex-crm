"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, Briefcase, FileText, DollarSign, User, ArrowRight } from "lucide-react";

interface GlobalSearchProps {
  projects: any[];
  onSelectProject: (id: string) => void;
  onNavigateTab: (tab: string) => void;
}

interface SearchResult {
  type: "project" | "permit" | "commission" | "lead";
  id: string;
  title: string;
  subtitle: string;
  tab: string;
}

export default function GlobalSearch({ projects, onSelectProject, onNavigateTab }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [permits, setPermits] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load searchable data on open
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    import("../../lib/projectService").then(({ projectService }) => {
      projectService.getAllPermits().then(setPermits).catch(() => {});
      projectService.getAllCommissions().then(setCommissions).catch(() => {});
    });
    import("../../lib/leadService").then(({ leadService }) => {
      leadService.getActiveLeads().then(setLeads).catch(() => {});
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keyboard shortcut: Ctrl+K or /
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    for (const p of projects) {
      if (
        p.name?.toLowerCase().includes(q) ||
        p.client_name?.toLowerCase().includes(q) ||
        p.profiles?.full_name?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "project",
          id: p.id,
          title: p.name || "Untitled",
          subtitle: `${p.client_name || "No client"} · $${Number(p.contract_value || 0).toLocaleString()} · ${p.status}`,
          tab: "dashboard",
        });
      }
    }

    for (const pm of permits) {
      if (
        pm.agency?.toLowerCase().includes(q) ||
        pm.permit_number?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "permit",
          id: pm.id,
          title: pm.permit_number || pm.agency || "Permit",
          subtitle: `${pm.agency || "—"} · ${pm.status}`,
          tab: "permits",
        });
      }
    }

    for (const c of commissions) {
      if (
        c.profiles?.full_name?.toLowerCase().includes(q) ||
        c.projects?.name?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "commission",
          id: c.id,
          title: `$${Number(c.amount || 0).toLocaleString()} — ${c.projects?.name || "Unknown"}`,
          subtitle: `${c.profiles?.full_name || "Unknown rep"} · ${c.status}`,
          tab: "commissions",
        });
      }
    }

    for (const l of leads) {
      if (
        l.name?.toLowerCase().includes(q) ||
        l.street?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "lead",
          id: l.id,
          title: l.name,
          subtitle: [l.street, l.city, l.state].filter(Boolean).join(", ") || l.email || "No details",
          tab: "site-explorer",
        });
      }
    }

    return out.slice(0, 20);
  }, [query, projects, permits, commissions, leads]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "project": return <Briefcase size={14} className="text-[var(--accent)]" />;
      case "permit": return <FileText size={14} className="text-amber-400" />;
      case "commission": return <DollarSign size={14} className="text-emerald-400" />;
      case "lead": return <User size={14} className="text-violet-400" />;
      default: return null;
    }
  };

  function handleSelect(result: SearchResult) {
    if (result.type === "project") {
      onSelectProject(result.id);
    }
    onNavigateTab(result.tab);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card text-gray-400 hover:text-white transition-all duration-200 text-sm"
        title="Search (Ctrl+K)"
      >
        <Search size={16} />
        <span className="hidden sm:inline text-gray-500">Search...</span>
        <kbd className="hidden sm:inline text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-gray-500">⌘K</kbd>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] modal-backdrop">
          <div ref={containerRef} className="w-full max-w-lg glass-card-elevated rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <Search size={18} className="text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, permits, commissions, leads..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
                autoComplete="off"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-gray-500 hover:text-white">
                  <X size={16} />
                </button>
              )}
              <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-gray-500">Esc</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {query && results.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">No results for &ldquo;{query}&rdquo;</div>
              )}
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="shrink-0">{typeIcon(r.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 font-medium truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
                </button>
              ))}
              {!query && (
                <div className="px-4 py-6 text-center text-gray-600 text-xs">
                  Start typing to search across all data...
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
