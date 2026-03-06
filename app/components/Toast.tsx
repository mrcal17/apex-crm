"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem { id: string; message: string; type: ToastType; }
interface ToastContextValue { toast: (message: string, type?: ToastType) => void; }

const DISMISS_MS = 3000;
const MAX_TOASTS = 3;

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-400 shrink-0" />,
  error: <AlertCircle size={18} className="text-red-400 shrink-0" />,
  info: <Info size={18} className="text-cyan-400 shrink-0" />,
};

const BAR_COLORS: Record<ToastType, string> = {
  success: "bg-gradient-to-r from-emerald-400 to-[var(--accent)]",
  error: "bg-gradient-to-r from-red-400 to-rose-400",
  info: "bg-gradient-to-r from-cyan-400 to-[var(--accent-secondary)]",
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "border-emerald-500/20",
  error: "border-red-500/20",
  info: "border-cyan-500/20",
};

const ACCENT_GLOW: Record<ToastType, string> = {
  success: "shadow-[0_0_20px_rgba(6,214,160,0.08)]",
  error: "shadow-[0_0_20px_rgba(248,113,113,0.08)]",
  info: "shadow-[0_0_20px_rgba(0,180,216,0.08)]",
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ProgressBar({ type }: { type: ToastType }) {
  const [width, setWidth] = useState(100);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function animate(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const remaining = Math.max(0, 100 - ((ts - startRef.current) / DISMISS_MS) * 100);
      setWidth(remaining);
      if (remaining > 0) rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.03] overflow-hidden">
      <div className={`h-full ${BAR_COLORS[type]}`} style={{ width: `${width}%`, transition: 'none' }} />
    </div>
  );
}

function SingleToast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div
      role="alert"
      className={`relative glass-card-elevated rounded-xl px-4 py-3 min-w-[320px] max-w-[420px] overflow-hidden ${BORDER_COLORS[item.type]} ${ACCENT_GLOW[item.type]}`}
      style={{ animation: "toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
    >
      <div className="flex items-start gap-3 pr-6">
        {ICONS[item.type]}
        <p className="text-white/90 text-sm leading-snug break-words flex-1">{item.message}</p>
      </div>
      <button onClick={() => onDismiss(item.id)} className="absolute top-2.5 right-2.5 text-white/20 hover:text-white/60 transition-colors">
        <X size={14} />
      </button>
      <ProgressBar type={item.type} />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setTimeout(() => dismiss(id), DISMISS_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <style>{`@keyframes toast-in { from { opacity:0; transform:translateX(110%) scale(0.95); } to { opacity:1; transform:translateX(0) scale(1); } }`}</style>
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <SingleToast item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string, type?: ToastType) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
