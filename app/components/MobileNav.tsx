"use client";

import React, { useState } from "react";
import { LayoutDashboard, Globe, FolderOpen, DollarSign, MoreHorizontal, X } from "lucide-react";

interface MobileNavProps {
  tabs: { key: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

const PRIMARY_KEYS = ["dashboard", "site-explorer", "kanban", "commissions"];

export default function MobileNav({ tabs, activeTab, onTabChange }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTabs = tabs.filter((t) => PRIMARY_KEYS.includes(t.key));
  const moreTabs = tabs.filter((t) => !PRIMARY_KEYS.includes(t.key));

  return (
    <>
      {/* Slide-up sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[90] modal-backdrop md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 glass-card-elevated rounded-t-2xl p-4 pb-6 mobile-nav-safe animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-display font-semibold text-white/80">More</span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { onTabChange(tab.key); setMoreOpen(false); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                    activeTab === tab.key ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "text-gray-400 hover:bg-white/[0.04]"
                  }`}
                >
                  <tab.icon size={20} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[80] md:hidden glass-card-elevated border-t border-white/[0.06] mobile-nav-safe">
        <div className="flex items-center justify-around px-2 py-1.5">
          {primaryTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[56px] ${
                activeTab === tab.key ? "text-[var(--accent)]" : "text-gray-500"
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[9px] font-medium">{tab.label}</span>
              {activeTab === tab.key && <div className="w-4 h-0.5 rounded-full bg-[var(--accent)] mt-0.5" />}
            </button>
          ))}
          {moreTabs.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[56px] ${
                moreOpen || moreTabs.some((t) => t.key === activeTab) ? "text-[var(--accent)]" : "text-gray-500"
              }`}
            >
              <MoreHorizontal size={20} />
              <span className="text-[9px] font-medium">More</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
