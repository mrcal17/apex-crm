'use client';

import React, { useState, useMemo } from 'react';
import { Sun, ChevronDown, ChevronUp, Loader2, AlertCircle, Zap, TreePine, Ruler, Clock } from 'lucide-react';

interface SolarPotential {
  maxArrayPanelsCount?: number;
  maxArrayAreaMeters2?: number;
  maxSunshineHoursPerYear?: number;
  carbonOffsetFactorKgPerMwh?: number;
  solarPanelConfigs?: Array<{
    panelsCount: number;
    yearlyEnergyDcKwh: number;
  }>;
}

interface SolarAnalysisPanelProps {
  solarData: SolarPotential | null;
  loading: boolean;
  error: string | null;
}

export default function SolarAnalysisPanel({ solarData, loading, error }: SolarAnalysisPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { maxConfig, yearlyEnergy, co2Offset, equivalentTrees, roofAreaSqFt } = useMemo(() => {
    const mc = solarData?.solarPanelConfigs?.length
      ? solarData.solarPanelConfigs[solarData.solarPanelConfigs.length - 1]
      : null;
    const ye = mc?.yearlyEnergyDcKwh ?? 0;
    const co2 = solarData?.carbonOffsetFactorKgPerMwh
      ? (solarData.carbonOffsetFactorKgPerMwh * ye) / 1000
      : 0;
    return {
      maxConfig: mc,
      yearlyEnergy: ye,
      co2Offset: co2,
      equivalentTrees: co2 > 0 ? Math.round(co2 / 21) : 0,
      roofAreaSqFt: solarData?.maxArrayAreaMeters2
        ? Math.round(solarData.maxArrayAreaMeters2 * 10.764)
        : 0,
    };
  }, [solarData]);

  if (!loading && !error && !solarData) return null;

  return (
    <div className="glass-card-elevated rounded-xl overflow-hidden border border-white/[0.08]">
      {/* Toggle bar */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/[0.08] to-transparent hover:from-amber-500/[0.12] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-white/90">
          <Sun size={14} className="text-amber-400" />
          Solar Analysis
        </span>
        {collapsed ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 size={16} className="text-amber-400 animate-spin" />
              <span className="text-xs text-white/50">Analyzing solar potential...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 py-3">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-300/80">{error}</span>
            </div>
          )}

          {solarData && !loading && (
            <div className="grid grid-cols-3 gap-3">
              <Metric icon={<Sun size={13} className="text-amber-400" />} label="Max Panels" value={`${solarData.maxArrayPanelsCount?.toLocaleString() ?? '—'} panels`} />
              <Metric icon={<Ruler size={13} className="text-blue-400" />} label="Usable Roof" value={roofAreaSqFt ? `${roofAreaSqFt.toLocaleString()} sq ft` : '—'} />
              <Metric icon={<Zap size={13} className="text-yellow-400" />} label="Annual Energy" value={yearlyEnergy ? `${Math.round(yearlyEnergy).toLocaleString()} kWh/yr` : '—'} />
              <Metric icon={<Clock size={13} className="text-cyan-400" />} label="Peak Sun Hours" value={solarData.maxSunshineHoursPerYear ? `${Math.round(solarData.maxSunshineHoursPerYear).toLocaleString()} hrs/yr` : '—'} />
              <Metric icon={<Sun size={13} className="text-green-400" />} label="CO₂ Offset" value={co2Offset > 0 ? `${Math.round(co2Offset).toLocaleString()} kg/yr` : '—'} />
              <Metric icon={<TreePine size={13} className="text-emerald-400" />} label="Equiv. Trees" value={equivalentTrees > 0 ? `~${equivalentTrees.toLocaleString()} trees` : '—'} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase text-gray-500 font-medium leading-none mb-0.5">{label}</p>
        <p className="text-[11px] text-white/80 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
