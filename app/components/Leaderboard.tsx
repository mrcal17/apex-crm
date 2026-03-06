"use client";

import { useState, useEffect } from "react";
import { Trophy, TrendingUp } from "lucide-react";
import { projectService } from "../../lib/projectService";

interface RankedRep {
  id: string;
  name: string;
  totalCommission: number;
  dealCount: number;
}

const TROPHY_COLORS = ["text-yellow-400", "text-gray-300", "text-amber-600"];
const TROPHY_GLOWS = ["shadow-[0_0_12px_rgba(250,204,21,0.15)]", "shadow-[0_0_12px_rgba(209,213,219,0.10)]", "shadow-[0_0_12px_rgba(180,83,9,0.10)]"];

export default function Leaderboard() {
  const [rankings, setRankings] = useState<RankedRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxCommission, setMaxCommission] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profiles, allCommissions] = await Promise.all([
          projectService.getProfiles(),
          projectService.getAllCommissions(),
        ]);
        if (!profiles || profiles.length === 0) {
          setRankings([]);
          setLoading(false);
          return;
        }
        // Group commissions by sales_rep_id client-side
        const commsByRep = new Map<string, { total: number; count: number }>();
        for (const c of allCommissions || []) {
          const repId = c.sales_rep_id;
          if (!repId) continue;
          const entry = commsByRep.get(repId) || { total: 0, count: 0 };
          entry.total += Number(c.amount ?? 0);
          entry.count += 1;
          commsByRep.set(repId, entry);
        }
        const ranked: RankedRep[] = profiles.map((p: any) => {
          const entry = commsByRep.get(p.id) || { total: 0, count: 0 };
          return { id: p.id, name: p.full_name || "Unknown", totalCommission: entry.total, dealCount: entry.count };
        });
        ranked.sort((a, b) => b.totalCommission - a.totalCommission);
        setMaxCommission(ranked[0]?.totalCommission || 0);
        setRankings(ranked);
      } catch {
        console.error("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-yellow-500/[0.04] to-transparent">
        <h2 className="text-lg font-display font-bold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-yellow-500/10">
            <Trophy size={18} className="text-yellow-400" />
          </div>
          Leaderboard
        </h2>
      </div>

      {loading ? (
        <div className="px-6 py-8 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-blue-900/15 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : rankings.length === 0 || maxCommission === 0 ? (
        <div className="px-6 py-10 text-center">
          <Trophy size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Complete projects to see rankings</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {rankings.map((rep, i) => {
            const barWidth = maxCommission > 0 ? (rep.totalCommission / maxCommission) * 100 : 0;
            return (
              <div key={rep.id} className="px-5 py-3.5 relative overflow-hidden hover:bg-blue-900/15 transition-all duration-200">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent)]/[0.06] to-transparent transition-all duration-700 ease-out"
                  style={{ width: `${barWidth}%` }}
                />
                <div className="relative flex items-center gap-4">
                  <div className="w-8 text-center shrink-0">
                    {i < 3 ? (
                      <div className={`inline-flex p-1 rounded-lg ${TROPHY_GLOWS[i]}`}>
                        <Trophy size={18} className={TROPHY_COLORS[i]} />
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm font-bold">#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-medium truncate">{rep.name}</p>
                    <p className="text-gray-500 text-xs flex items-center gap-1">
                      <TrendingUp size={10} />
                      {rep.dealCount} deal{rep.dealCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-bold text-sm">
                      ${rep.totalCommission.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
