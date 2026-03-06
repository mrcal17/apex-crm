"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, MessageCircle, Send, ArrowUpRight, ArrowDownLeft, Trash2, FileText, ChevronDown } from "lucide-react";
import { projectService, supabase } from "../../lib/projectService";
import { relativeTime } from "../hooks/useRelativeTime";
import { _rl, type Role } from "../../lib/roles";

interface CommunicationTimelineProps {
  projectId: string;
  role?: Role;
}

interface Communication {
  id: string;
  project_id: string;
  contact_id: string | null;
  channel: "email" | "sms";
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string;
  from: string;
  to: string;
  sent_at: string;
  status: string;
  metadata: Record<string, unknown>;
  client_contacts?: { name: string; email: string; phone: string } | null;
}

interface MessageTemplate {
  id: string;
  name: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
}

export default function CommunicationTimeline({ projectId, role = "sales_rep" }: CommunicationTimelineProps) {
  const [comms, setComms] = useState<Communication[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Compose state
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commData, templateData] = await Promise.all([
        projectService.getCommunicationsByProject(projectId).catch(() => []),
        projectService.getMessageTemplates().catch(() => []),
      ]);
      setComms((commData || []) as Communication[]);
      setTemplates((templateData || []) as MessageTemplate[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSend() {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          channel,
          to: to.trim(),
          subject: channel === "email" ? subject.trim() : undefined,
          message: body.trim(),
          project_id: projectId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Send failed");

      // Refresh
      await loadData();
      setTo("");
      setSubject("");
      setBody("");
      setShowCompose(false);
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(t: MessageTemplate) {
    setChannel(t.channel);
    if (t.subject) setSubject(t.subject);
    setBody(t.body);
    setShowTemplates(false);
  }

  async function handleDelete(id: string) {
    try {
      await projectService.deleteCommunication(id);
      setComms((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  }

  const channelIcon = (ch: string) =>
    ch === "email" ? <Mail size={12} /> : <MessageCircle size={12} />;

  const directionIcon = (dir: string) =>
    dir === "outbound"
      ? <ArrowUpRight size={10} className="text-blue-400" />
      : <ArrowDownLeft size={10} className="text-emerald-400" />;

  const statusColor = (s: string) => {
    switch (s) {
      case "delivered": return "text-emerald-400 bg-emerald-500/15 border-emerald-500/20";
      case "sent": return "text-blue-400 bg-blue-500/15 border-blue-500/20";
      case "failed": return "text-red-400 bg-red-500/15 border-red-500/20";
      case "received": return "text-purple-400 bg-purple-500/15 border-purple-500/20";
      default: return "text-gray-400 bg-gray-500/15 border-gray-500/20";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase text-gray-500 font-semibold tracking-wider flex items-center gap-1.5">
          <Mail size={12} /> Communications ({comms.length})
        </h3>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="text-[10px] font-medium text-[var(--accent)] hover:text-[#00ccff] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/20 rounded-lg px-2.5 py-1 transition-all"
        >
          {showCompose ? "Cancel" : "Compose"}
        </button>
      </div>

      {/* Compose Form */}
      {showCompose && (
        <div className="glass-card rounded-xl p-3 mb-3 space-y-2.5">
          <div className="flex gap-2">
            <button
              onClick={() => setChannel("email")}
              className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                channel === "email"
                  ? "text-[var(--accent)] bg-[var(--accent)]/15 border-[var(--accent)]/30"
                  : "text-gray-500 bg-white/[0.02] border-white/[0.06] hover:text-white"
              }`}
            >
              <Mail size={10} /> Email
            </button>
            <button
              onClick={() => setChannel("sms")}
              className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                channel === "sms"
                  ? "text-[var(--accent)] bg-[var(--accent)]/15 border-[var(--accent)]/30"
                  : "text-gray-500 bg-white/[0.02] border-white/[0.06] hover:text-white"
              }`}
            >
              <MessageCircle size={10} /> SMS
            </button>

            {templates.length > 0 && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-white bg-white/[0.02] border border-white/[0.06] rounded-lg px-2.5 py-1 transition-all"
                >
                  <FileText size={10} /> Template <ChevronDown size={8} />
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-full mt-1 w-48 glass-card-elevated rounded-lg border border-white/[0.08] py-1 z-10">
                    {templates
                      .filter((t) => t.channel === channel)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t)}
                          className="block w-full text-left px-3 py-1.5 text-[10px] text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors"
                        >
                          {t.name}
                        </button>
                      ))}
                    {templates.filter((t) => t.channel === channel).length === 0 && (
                      <p className="px-3 py-1.5 text-[10px] text-gray-600 italic">No {channel} templates</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={channel === "email" ? "recipient@example.com" : "+1 (555) 000-0000"}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
          />

          {channel === "email" && (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40"
            />
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-[var(--accent)]/40 resize-none"
          />

          <button
            onClick={handleSend}
            disabled={!to.trim() || !body.trim() || sending}
            className="w-full flex items-center justify-center gap-1.5 btn-primary text-white font-medium rounded-lg px-4 py-2 text-xs disabled:opacity-40 transition-colors"
          >
            {sending ? (
              <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
            ) : (
              <><Send size={12} />Send {channel === "email" ? "Email" : "SMS"}</>
            )}
          </button>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      ) : comms.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No communications yet. Send the first message.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {comms.map((c) => (
            <div key={c.id} className="glass-card rounded-lg px-3 py-2 group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {channelIcon(c.channel)}
                  {directionIcon(c.direction)}
                  <span className="text-[10px] font-medium text-white/80">
                    {c.direction === "outbound" ? `To: ${c.to}` : `From: ${c.from}`}
                  </span>
                  {c.client_contacts?.name && (
                    <span className="text-[9px] text-gray-500">({c.client_contacts.name})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                  <span className="text-[9px] text-gray-600">{relativeTime(c.sent_at)}</span>
                  {_rl(role) >= 2 && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
              {c.subject && (
                <p className="text-[10px] font-medium text-white/60 mb-0.5">{c.subject}</p>
              )}
              <p className="text-xs text-white/80 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
