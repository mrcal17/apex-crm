"use client";

import { useState } from "react";
import { Link, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "../../lib/projectService";

interface CustomerPortalButtonProps {
  projectId: string;
  projectName: string;
}

export default function CustomerPortalButton({ projectId, projectName }: CustomerPortalButtonProps) {
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(30);

  async function generateLink() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch("/api/portal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, expiresInDays }),
      });
      const data = await res.json();
      if (data.url) setPortalUrl(data.url);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[var(--accent)] transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--accent)]/10"
      >
        <Link size={13} /> Share Portal
      </button>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white/80 flex items-center gap-1.5">
          <Link size={14} className="text-[var(--accent)]" /> Customer Portal
        </h4>
        <button onClick={() => setShowPanel(false)} className="text-xs text-gray-500 hover:text-white">Close</button>
      </div>

      {portalUrl ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Share this link with {projectName}&apos;s client:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={portalUrl}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/80 font-mono"
            />
            <button onClick={copyLink} className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors">
              <ExternalLink size={14} />
            </a>
          </div>
          <button onClick={() => { setPortalUrl(null); }} className="text-xs text-gray-500 hover:text-white mt-1">Generate new link</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Generate a read-only portal link for the client to track project status.</p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Expires in:</label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white/80"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
          <button
            onClick={generateLink}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />}
            Generate Portal Link
          </button>
        </div>
      )}
    </div>
  );
}
