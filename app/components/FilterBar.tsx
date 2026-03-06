"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Save, ChevronDown, Trash2, Filter } from "lucide-react";

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface FilterState {
  conditions: FilterCondition[];
  logic: "and" | "or";
}

export interface SavedView {
  name: string;
  filters: FilterState;
}

interface FilterFieldDef {
  key: string;
  label: string;
  type: "select" | "text" | "date";
  options?: { value: string; label: string }[];
}

interface FilterBarProps {
  fields: FilterFieldDef[];
  storageKey: string;
  onFilterChange: (filters: FilterState) => void;
}

const EMPTY_FILTER: FilterState = { conditions: [], logic: "and" };

let nextId = 0;
function genId() { return `f_${++nextId}_${Date.now()}`; }

export function applyFilters<T extends Record<string, any>>(
  items: T[],
  filters: FilterState,
  getText: (item: T, field: string) => string
): T[] {
  if (filters.conditions.length === 0) return items;
  return items.filter((item) => {
    const results = filters.conditions.map((c) => {
      const val = getText(item, c.field);
      switch (c.operator) {
        case "is": return val === c.value;
        case "is_not": return val !== c.value;
        case "contains": return val.toLowerCase().includes(c.value.toLowerCase());
        case "not_contains": return !val.toLowerCase().includes(c.value.toLowerCase());
        case "after": return c.value ? new Date(val) >= new Date(c.value) : true;
        case "before": return c.value ? new Date(val) <= new Date(c.value) : true;
        default: return true;
      }
    });
    return filters.logic === "and" ? results.every(Boolean) : results.some(Boolean);
  });
}

function getOperators(type: string) {
  if (type === "select") return [{ value: "is", label: "is" }, { value: "is_not", label: "is not" }];
  if (type === "date") return [{ value: "after", label: "after" }, { value: "before", label: "before" }];
  return [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" },
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ];
}

export default function FilterBar({ fields, storageKey, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Load saved views from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`filter_views_${storageKey}`);
      if (stored) setSavedViews(JSON.parse(stored));
    } catch {}
  }, [storageKey]);

  // Close view dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) {
        setShowViewDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function persistViews(views: SavedView[]) {
    setSavedViews(views);
    try { localStorage.setItem(`filter_views_${storageKey}`, JSON.stringify(views)); } catch {}
  }

  function updateFilters(next: FilterState) {
    setFilters(next);
    onFilterChange(next);
  }

  function addCondition() {
    const field = fields[0];
    const ops = getOperators(field.type);
    updateFilters({
      ...filters,
      conditions: [...filters.conditions, { id: genId(), field: field.key, operator: ops[0].value, value: "" }],
    });
  }

  function removeCondition(id: string) {
    updateFilters({ ...filters, conditions: filters.conditions.filter((c) => c.id !== id) });
  }

  function updateCondition(id: string, updates: Partial<FilterCondition>) {
    updateFilters({
      ...filters,
      conditions: filters.conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...updates };
        // Reset operator and value when field changes
        if (updates.field && updates.field !== c.field) {
          const fieldDef = fields.find((f) => f.key === updates.field);
          const ops = getOperators(fieldDef?.type || "text");
          updated.operator = ops[0].value;
          updated.value = "";
        }
        return updated;
      }),
    });
  }

  function toggleLogic() {
    updateFilters({ ...filters, logic: filters.logic === "and" ? "or" : "and" });
  }

  function clearAll() {
    updateFilters(EMPTY_FILTER);
  }

  function saveView() {
    if (!saveName.trim()) return;
    const existing = savedViews.filter((v) => v.name !== saveName.trim());
    const next = [...existing, { name: saveName.trim(), filters: { ...filters } }];
    persistViews(next);
    setSaveName("");
    setShowSaveInput(false);
  }

  function loadView(view: SavedView) {
    updateFilters({ ...view.filters, conditions: view.filters.conditions.map((c) => ({ ...c, id: genId() })) });
    setShowViewDropdown(false);
  }

  function deleteView(name: string) {
    persistViews(savedViews.filter((v) => v.name !== name));
  }

  const fieldMap = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);

  if (filters.conditions.length === 0) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={addCondition}
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[var(--accent)] bg-white/[0.03] hover:bg-[var(--accent)]/10 border border-white/[0.06] hover:border-[var(--accent)]/20 rounded-lg px-2.5 py-1.5 transition-all">
          <Filter size={12} /> Add Filter
        </button>
        {savedViews.length > 0 && (
          <div className="relative" ref={viewDropdownRef}>
            <button onClick={() => setShowViewDropdown((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 transition-colors">
              Saved Views <ChevronDown size={10} className={showViewDropdown ? "rotate-180" : ""} />
            </button>
            {showViewDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[#0c1222] border border-white/[0.08] rounded-lg shadow-xl z-50 min-w-[160px] overflow-hidden">
                {savedViews.map((v) => (
                  <div key={v.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.04] group">
                    <button onClick={() => loadView(v)} className="text-[11px] text-gray-300 hover:text-white flex-1 text-left truncate">
                      {v.name}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteView(v.name); }}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-[var(--accent)] shrink-0" />
        {filters.conditions.map((cond, i) => {
          const fieldDef = fieldMap[cond.field] || fields[0];
          const ops = getOperators(fieldDef.type);
          return (
            <div key={cond.id} className="flex items-center gap-1">
              {i > 0 && (
                <button onClick={toggleLogic}
                  className="text-[10px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 rounded px-1.5 py-0.5 hover:bg-[var(--accent)]/20 transition-colors uppercase">
                  {filters.logic}
                </button>
              )}
              <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden">
                <select value={cond.field} onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                  className="bg-transparent text-[11px] text-gray-300 px-2 py-1 focus:outline-none border-r border-white/[0.06]">
                  {fields.map((f) => <option key={f.key} value={f.key} className="bg-[#0c1222]">{f.label}</option>)}
                </select>
                <select value={cond.operator} onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}
                  className="bg-transparent text-[11px] text-gray-400 px-1.5 py-1 focus:outline-none border-r border-white/[0.06]">
                  {ops.map((o) => <option key={o.value} value={o.value} className="bg-[#0c1222]">{o.label}</option>)}
                </select>
                {fieldDef.type === "select" && fieldDef.options ? (
                  <select value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    className="bg-transparent text-[11px] text-white px-2 py-1 focus:outline-none min-w-[80px]">
                    <option value="" className="bg-[#0c1222]">Any</option>
                    {fieldDef.options.map((o) => <option key={o.value} value={o.value} className="bg-[#0c1222]">{o.label}</option>)}
                  </select>
                ) : fieldDef.type === "date" ? (
                  <input type="date" value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    className="bg-transparent text-[11px] text-white px-2 py-1 focus:outline-none" />
                ) : (
                  <input type="text" value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    placeholder="value..." className="bg-transparent text-[11px] text-white px-2 py-1 focus:outline-none placeholder-gray-600 w-24" />
                )}
                <button onClick={() => removeCondition(cond.id)} className="px-1.5 text-gray-600 hover:text-red-400 transition-colors">
                  <X size={11} />
                </button>
              </div>
            </div>
          );
        })}
        <button onClick={addCondition}
          className="text-[11px] text-gray-500 hover:text-[var(--accent)] p-1 rounded hover:bg-[var(--accent)]/10 transition-all" title="Add filter">
          <Plus size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-white transition-colors">Clear all</button>
        <span className="text-gray-700">|</span>
        {!showSaveInput ? (
          <button onClick={() => setShowSaveInput(true)} className="text-[10px] text-gray-500 hover:text-[var(--accent)] flex items-center gap-0.5 transition-colors">
            <Save size={9} /> Save view
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="View name..."
              className="bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-white px-2 py-0.5 focus:outline-none focus:border-[var(--accent)]/40 placeholder-gray-600 w-28"
              onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setShowSaveInput(false); }}
              autoFocus />
            <button onClick={saveView} disabled={!saveName.trim()} className="text-[10px] text-[var(--accent)] hover:text-[var(--accent)]/80 disabled:opacity-40">Save</button>
            <button onClick={() => setShowSaveInput(false)} className="text-[10px] text-gray-600 hover:text-white">Cancel</button>
          </div>
        )}
        {savedViews.length > 0 && (
          <div className="relative" ref={viewDropdownRef}>
            <button onClick={() => setShowViewDropdown((v) => !v)}
              className="text-[10px] text-gray-500 hover:text-white flex items-center gap-0.5 transition-colors">
              Views <ChevronDown size={9} className={showViewDropdown ? "rotate-180" : ""} />
            </button>
            {showViewDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[#0c1222] border border-white/[0.08] rounded-lg shadow-xl z-50 min-w-[140px] overflow-hidden">
                {savedViews.map((v) => (
                  <div key={v.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.04] group">
                    <button onClick={() => loadView(v)} className="text-[10px] text-gray-300 hover:text-white flex-1 text-left truncate">
                      {v.name}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteView(v.name); }}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
