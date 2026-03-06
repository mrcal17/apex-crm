// Customer Health Score — rates active projects green/yellow/red

export type HealthLevel = "green" | "yellow" | "red";

export interface HealthResult {
  score: number; // 0-100
  level: HealthLevel;
  label: string;
  factors: string[];
}

const DAY = 86400000;

export function computeHealthScore(project: any, permits: any[], commissions: any[]): HealthResult {
  const now = Date.now();
  let score = 100;
  const factors: string[] = [];

  // 1. Stage duration penalty
  if (project.created_at) {
    const age = (now - new Date(project.created_at).getTime()) / DAY;
    if (project.status === "lead" && age > 14) {
      score -= Math.min(30, Math.round((age - 14) / 7) * 10);
      factors.push(`Lead for ${Math.round(age)} days`);
    } else if (project.status === "in_progress" && age > 30) {
      score -= Math.min(25, Math.round((age - 30) / 14) * 8);
      factors.push(`In progress for ${Math.round(age)} days`);
    }
  }

  // 2. Permit health
  const projectPermits = permits.filter((p: any) => p.project_id === project.id);
  for (const permit of projectPermits) {
    if (permit.status === "expired") {
      score -= 25;
      factors.push("Expired permit");
      break;
    }
    if (permit.expiration_date) {
      const daysLeft = (new Date(permit.expiration_date).getTime() - now) / DAY;
      if (daysLeft > 0 && daysLeft <= 14) {
        score -= 15;
        factors.push(`Permit expires in ${Math.round(daysLeft)}d`);
      }
    }
  }

  // 3. Revenue collection
  const contractVal = Number(project.contract_value || 0);
  const collected = Number(project.revenue_collected || 0);
  if (contractVal > 0 && project.status === "completed") {
    const collectionPct = collected / contractVal;
    if (collectionPct < 0.5) {
      score -= 20;
      factors.push(`Only ${Math.round(collectionPct * 100)}% collected`);
    } else if (collectionPct < 1) {
      score -= 10;
      factors.push(`${Math.round(collectionPct * 100)}% collected`);
    }
  }

  // 4. Interconnection / PTO delays
  if (project.interconnection_status === "denied") {
    score -= 20;
    factors.push("Interconnection denied");
  }
  if (project.interconnection_status === "submitted" && project.interconnection_submitted_at) {
    const waitDays = (now - new Date(project.interconnection_submitted_at).getTime()) / DAY;
    if (waitDays > 30) {
      score -= 10;
      factors.push(`Interconnection pending ${Math.round(waitDays)}d`);
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  const level: HealthLevel = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  const label = level === "green" ? "Healthy" : level === "yellow" ? "At Risk" : "Critical";

  return { score, level, label, factors };
}

export const HEALTH_COLORS: Record<HealthLevel, { text: string; bg: string; border: string; dot: string }> = {
  green: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  yellow: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-400" },
  red: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400" },
};
