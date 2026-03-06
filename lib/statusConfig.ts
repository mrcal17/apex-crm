export const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  chartColor: string;
}> = {
  lead: { label: "Lead", color: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-cyan-500/20", dot: "bg-cyan-400", chartColor: "#22d3ee" },
  in_progress: { label: "In Progress", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/20", dot: "bg-amber-400", chartColor: "#fbbf24" },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/20", dot: "bg-emerald-400", chartColor: "#06d6a0" },
  cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/20", dot: "bg-red-400", chartColor: "#f87171" },
};

export function formatStatus(status: string): string {
  return STATUS_CONFIG[status]?.label ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusClasses(status: string): string {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return "text-gray-400 bg-gray-500/15";
  return `${cfg.color} ${cfg.bg}`;
}
