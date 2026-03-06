"use client";

import { useState, useEffect, useMemo } from "react";
import { Activity, Filter, ChevronDown, Clock, Trash2 } from "lucide-react";
import { supabase } from "../../lib/projectService";
import { _rl, type Role } from "../../lib/roles";
import { relativeTime } from "../hooks/useRelativeTime";
import { formatStatus } from "../../lib/statusConfig";

interface ActivityEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: "text-emerald-400 bg-emerald-500/15 border-emerald-500/20",
  updated: "text-amber-400 bg-amber-500/15 border-amber-500/20",
  deleted: "text-red-400 bg-red-500/15 border-red-500/20",
  completed: "text-purple-400 bg-purple-500/15 border-purple-500/20",
  status_changed: "text-blue-400 bg-blue-500/15 border-blue-500/20",
};

const ENTITY_FILTERS = ["all", "project", "permit", "commission", "lead"];

export default function ActivityLog({ role }: { role?: Role }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [limit, setLimit] = useState(50);

  const canClear = role ? _rl(role) >= 3 : false;

  async function handleClearLog() {
    if (!window.confirm("Clear the entire activity log for your organization? This cannot be undone.")) return;
    setClearing(true);
    try {
      const { error } = await supabase.from("activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setEntries([]);
    } catch (err) {
      console.error("Failed to clear activity log:", err);
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let query = supabase
          .from("activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (entityFilter !== "all") {
          query = query.eq("entity_type", entityFilter);
        }

        const { data } = await query;
        setEntries(data || []);
      } catch {
        // Table may not exist yet — show empty state
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("activity-log-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
        setEntries((prev) => [payload.new as ActivityEntry, ...prev].slice(0, limit));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [entityFilter, limit]);

  const groupedByDate = useMemo(() => {
    const groups: { label: string; entries: ActivityEntry[] }[] = [];
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    let currentLabel = "";
    let currentGroup: ActivityEntry[] = [];

    for (const entry of entries) {
      const d = new Date(entry.created_at);
      let label: string;
      if (d.toDateString() === today) label = "Today";
      else if (d.toDateString() === yesterday) label = "Yesterday";
      else label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      if (label !== currentLabel) {
        if (currentGroup.length > 0) groups.push({ label: currentLabel, entries: currentGroup });
        currentLabel = label;
        currentGroup = [entry];
      } else {
        currentGroup.push(entry);
      }
    }
    if (currentGroup.length > 0) groups.push({ label: currentLabel, entries: currentGroup });

    return groups;
  }, [entries]);

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden mt-6">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-[var(--accent)]/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
              <Activity size={18} className="text-[var(--accent)]" />
            </div>
            Activity Log
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {ENTITY_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setEntityFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all capitalize ${
                    entityFilter === f
                      ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
                      : "text-gray-500 hover:text-white hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {canClear && entries.length > 0 && (
              <button
                onClick={handleClearLog}
                disabled={clearing}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-2 py-1 transition-all disabled:opacity-50"
              >
                <Trash2 size={10} />
                {clearing ? "Clearing..." : "Clear Log"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mr-2" />
            Loading activity...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            <Activity size={24} className="mx-auto mb-2 opacity-40" />
            <p>No activity recorded yet.</p>
            <p className="text-xs text-gray-600 mt-1">Activity will appear here as you create, update, and manage records.</p>
          </div>
        ) : (
          <div className="px-5 py-3 space-y-4">
            {groupedByDate.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-2">{group.label}</p>
                <div className="space-y-1.5">
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 glass-card rounded-lg px-3 py-2.5 hover:border-white/10 transition-all group">
                      <div className="mt-0.5">
                        <span className={`inline-flex text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full border ${ACTION_COLORS[entry.action] || "text-gray-400 bg-gray-500/15 border-gray-500/20"}`}>
                          {formatStatus(entry.action)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80">
                          <span className="capitalize text-gray-400">{entry.entity_type}</span>
                          {entry.details && <span className="ml-1">{entry.details}</span>}
                        </p>
                        <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                          <Clock size={9} /> {relativeTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {entries.length >= limit && (
              <button
                onClick={() => setLimit((l) => l + 50)}
                className="w-full text-center text-xs text-gray-500 hover:text-[var(--accent)] py-2 transition-colors"
              >
                Load more...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
