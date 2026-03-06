"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, LogOut, Sparkles } from "lucide-react";

interface SidebarProps {
  tabs: readonly { key: string; label: string; icon: React.ComponentType<any> }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  profile: any;
  role: string;
  organizationName?: string | null;
  onSignOut: () => void;
}

export default function Sidebar({ tabs, activeTab, onTabChange, profile, role, organizationName, onSignOut }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  const initials = (profile?.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 z-40 sidebar-glass border-r border-white/[0.06] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        collapsed ? "w-[68px]" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 pt-5 pb-4 ${collapsed ? "justify-center" : ""}`}>
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-secondary)]/15 border border-white/5 shrink-0">
          <Sparkles size={18} className="text-[var(--accent)]" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-display font-bold gradient-text whitespace-nowrap leading-tight">GCH CRM</h1>
            {organizationName && <p className="text-[10px] text-white/30 truncate">{organizationName}</p>}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-white/[0.05]" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`group relative w-full flex items-center gap-3 rounded-xl transition-all duration-200 ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              } ${
                isActive
                  ? "sidebar-item-active text-[var(--accent)]"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
              title={collapsed ? tab.label : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--accent)] sidebar-indicator" />
              )}
              <tab.icon size={18} className={`shrink-0 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-105"}`} />
              {!collapsed && (
                <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden">{tab.label}</span>
              )}
              {/* Tooltip on collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-white/[0.08] text-xs text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                  {tab.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-white/[0.05]" />

      {/* Bottom: User + Collapse toggle */}
      <div className="p-3 space-y-2">
        {/* User info */}
        <div className={`flex items-center gap-2.5 rounded-xl p-2 hover:bg-white/[0.03] transition-colors ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-secondary)]/15 border border-white/10 flex items-center justify-center text-[11px] font-display font-bold text-[var(--accent)] shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">{profile?.full_name || "User"}</p>
              <p className="text-[10px] text-gray-500 capitalize">{role.replace("_", " ")}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center justify-center py-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.03] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
