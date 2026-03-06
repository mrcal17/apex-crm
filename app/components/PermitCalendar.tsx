"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Clock, FileText } from "lucide-react";

interface PermitCalendarProps {
  permits: any[];
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getPermitColor(status: string) {
  switch (status) {
    case "approved": return "bg-emerald-500/20 border-emerald-500/30 text-emerald-400";
    case "submitted": return "bg-blue-500/20 border-blue-500/30 text-blue-400";
    case "pending": return "bg-amber-500/20 border-amber-500/30 text-amber-400";
    case "expired": return "bg-red-500/20 border-red-500/30 text-red-400";
    default: return "bg-gray-500/20 border-gray-500/30 text-gray-400";
  }
}

export default function PermitCalendar({ permits }: PermitCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Map permits by expiration date
  const permitsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of permits) {
      if (!p.expiration_date) continue;
      const key = p.expiration_date.split("T")[0];
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [permits]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const days: { date: number; key: string; inMonth: boolean }[] = [];

    // Previous month padding
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({ date: d, key: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: d, key: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({ date: d, key: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
    }

    return days;
  }, [year, month]);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const selectedPermits = selectedDate ? (permitsByDate.get(selectedDate) || []) : [];

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-blue-500/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <FileText size={18} className="text-blue-400" />
            </div>
            Permit Calendar
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg glass-card hover:bg-white/[0.04] text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-white min-w-[140px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg glass-card hover:bg-white/[0.04] text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] text-gray-500 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            const dayPermits = permitsByDate.get(day.key) || [];
            const isToday = day.key === today;
            const isSelected = day.key === selectedDate;
            const hasExpiring = dayPermits.some((p: any) => p.status !== "expired" && p.status !== "approved");

            return (
              <button
                key={i}
                onClick={() => dayPermits.length > 0 ? setSelectedDate(day.key === selectedDate ? null : day.key) : null}
                className={`relative h-10 rounded-lg text-xs transition-all ${
                  !day.inMonth ? "text-gray-700" :
                  isSelected ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20" :
                  isToday ? "bg-white/[0.06] text-white font-bold ring-1 ring-[var(--accent)]/30" :
                  dayPermits.length > 0 ? "text-white hover:bg-white/[0.04] cursor-pointer" :
                  "text-gray-400"
                }`}
              >
                {day.date}
                {dayPermits.length > 0 && day.inMonth && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayPermits.slice(0, 3).map((p: any, j: number) => (
                      <span key={j} className={`w-1.5 h-1.5 rounded-full ${
                        p.status === "expired" ? "bg-red-400" :
                        p.status === "approved" ? "bg-emerald-400" :
                        hasExpiring ? "bg-amber-400" : "bg-blue-400"
                      }`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date details */}
        {selectedDate && selectedPermits.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-400 font-medium">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
            {selectedPermits.map((p: any) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${getPermitColor(p.status)}`}>
                {p.status === "approved" ? <CheckCircle size={14} /> :
                 p.status === "expired" ? <AlertCircle size={14} /> :
                 <Clock size={14} />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.permit_number || p.agency || "Permit"}</p>
                  <p className="text-[10px] opacity-70">{p.agency || "—"} · {p.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400" /> Pending/Submitted</span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Approved</span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400" /> Expired</span>
        </div>
      </div>
    </div>
  );
}
