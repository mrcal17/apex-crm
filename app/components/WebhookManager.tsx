"use client";

import { useState, useEffect } from "react";
import { Webhook, Plus, Trash2, Zap, Check, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/projectService";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  created_at: string;
}

const EVENT_OPTIONS = [
  { value: "*", label: "All Events" },
  { value: "project.created", label: "Project Created" },
  { value: "project.updated", label: "Project Updated" },
  { value: "project.completed", label: "Project Completed" },
  { value: "permit.updated", label: "Permit Updated" },
  { value: "commission.created", label: "Commission Created" },
];

export default function WebhookManager() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["*"]);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; status?: number }>>({});

  async function fetchEndpoints() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch("/api/webhooks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEndpoints(data.endpoints || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEndpoints(); }, []);

  async function addEndpoint() {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "register", url: newUrl.trim(), events: newEvents }),
      });
      const data = await res.json();
      if (data.endpoints) setEndpoints(data.endpoints);
      setNewUrl("");
      setNewEvents(["*"]);
      setShowForm(false);
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function removeEndpoint(id: string) {
    if (!confirm("Remove this webhook endpoint?")) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    const res = await fetch("/api/webhooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.endpoints) setEndpoints(data.endpoints);
  }

  async function testEndpoint(url: string, id: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "test", url }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: { ok: data.success, status: data.status } }));
      setTimeout(() => setTestResults((prev) => { const n = { ...prev }; delete n[id]; return n; }), 5000);
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false } }));
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) => {
      if (event === "*") return ["*"];
      const without = prev.filter((e) => e !== "*");
      if (without.includes(event)) {
        const next = without.filter((e) => e !== event);
        return next.length === 0 ? ["*"] : next;
      }
      return [...without, event];
    });
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Webhook size={16} className="text-[var(--accent-tertiary)]" /> Webhook Endpoints
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors"
        >
          <Plus size={13} /> Add Endpoint
        </button>
      </div>

      {showForm && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-3">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-gray-600"
          />
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Events:</p>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleEvent(opt.value)}
                  className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${newEvents.includes(opt.value) || (newEvents.includes("*") && opt.value === "*") ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]" : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-white"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={addEndpoint}
            disabled={adding || !newUrl.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50 transition-colors"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Register
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="text-gray-500 animate-spin" />
        </div>
      ) : endpoints.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6">No webhook endpoints configured.</p>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <div key={ep.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2.5">
              <Zap size={13} className="text-[var(--accent-tertiary)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 font-mono truncate">{ep.url}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {ep.events.includes("*") ? "All events" : ep.events.join(", ")} &bull; Added {new Date(ep.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {testResults[ep.id] && (
                  <span className={`text-[10px] flex items-center gap-0.5 ${testResults[ep.id].ok ? "text-emerald-400" : "text-red-400"}`}>
                    {testResults[ep.id].ok ? <Check size={10} /> : <AlertCircle size={10} />}
                    {testResults[ep.id].ok ? testResults[ep.id].status : "Failed"}
                  </span>
                )}
                <button onClick={() => testEndpoint(ep.url, ep.id)} className="p-1 text-gray-500 hover:text-[var(--accent)] transition-colors" title="Test">
                  <Zap size={12} />
                </button>
                <button onClick={() => removeEndpoint(ep.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="Remove">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
