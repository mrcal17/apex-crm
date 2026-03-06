"use client";

import { useState, useEffect, useCallback } from "react";
import { Monitor, Smartphone, Tablet, Globe, Loader2, LogOut, Shield } from "lucide-react";

interface SessionInfo {
  id: string;
  session_token: string;
  device_info: string;
  ip_address: string;
  created_at: string;
  last_active_at: string;
}

function parseDevice(ua: string): { type: "desktop" | "mobile" | "tablet"; browser: string; os: string } {
  const lower = ua.toLowerCase();

  // OS detection
  let os = "Unknown OS";
  if (/windows nt 10/i.test(ua)) os = "Windows 10";
  else if (/windows nt 11|windows nt 10.*build\/(2[2-9]|[3-9])/i.test(ua)) os = "Windows 11";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone/i.test(ua)) os = "iOS";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "ChromeOS";

  // Browser detection
  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/brave/i.test(lower)) browser = "Brave";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox\//i.test(ua)) browser = "Firefox";

  // Device type
  let type: "desktop" | "mobile" | "tablet" = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua)) type = "tablet";
  else if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) type = "mobile";

  return { type, browser, os };
}

function DeviceIcon({ type }: { type: "desktop" | "mobile" | "tablet" }) {
  switch (type) {
    case "mobile": return <Smartphone size={20} />;
    case "tablet": return <Tablet size={20} />;
    default: return <Monitor size={20} />;
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const currentToken = typeof window !== "undefined" ? localStorage.getItem("gch-session-token") : null;

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/sessions");
      if (!res.ok) return;
      const { sessions: data } = await res.json();
      setSessions(data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function revokeSession(sessionId: string) {
    setRevoking(sessionId);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch { /* ignore */ }
    finally { setRevoking(null); }
  }

  if (loading) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
          Loading sessions...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10">
            <Shield size={18} className="text-cyan-400" />
          </div>
          Active Sessions
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Devices currently signed in to your account. You can sign out any session remotely.
        </p>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {sessions.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No active sessions found. Sessions are tracked on new logins.
          </div>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.session_token === currentToken;
            const device = parseDevice(s.device_info || "");

            return (
              <div
                key={s.id}
                className={`p-4 sm:px-6 flex items-center gap-4 transition-colors ${
                  isCurrent ? "bg-[var(--accent)]/[0.03]" : "hover:bg-white/[0.02]"
                }`}
              >
                {/* Device icon */}
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isCurrent
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "bg-white/[0.04] text-gray-400"
                }`}>
                  <DeviceIcon type={device.type} />
                </div>

                {/* Device info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {device.browser} on {device.os}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Globe size={11} />
                      {s.ip_address || "Unknown"}
                    </span>
                    <span>Active {timeAgo(s.last_active_at)}</span>
                    <span>Signed in {timeAgo(s.created_at)}</span>
                  </div>
                </div>

                {/* Revoke button */}
                {!isCurrent && (
                  <button
                    onClick={() => revokeSession(s.id)}
                    disabled={revoking === s.id}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-lg px-3 py-2 transition-all disabled:opacity-50"
                  >
                    {revoking === s.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <LogOut size={13} />
                    )}
                    Sign Out
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
