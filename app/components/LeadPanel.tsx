"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { UserPlus, X, User, Search, ChevronDown, ArrowRightCircle } from "lucide-react";
import { leadService, type Lead } from "../../lib/leadService";
import { projectService, supabase } from "../../lib/projectService";

function scoreLead(lead: Lead): { score: number; label: "Hot" | "Warm" | "Cold"; color: string; bg: string } {
  let score = 0;
  if (lead.email) score += 25;
  if (lead.phone) score += 20;
  if (lead.street && lead.city && lead.state && lead.zip) score += 25;
  else if (lead.street || lead.city) score += 10;
  if (lead.created_at) {
    const days = (Date.now() - new Date(lead.created_at).getTime()) / 86400000;
    if (days <= 7) score += 30;
    else if (days <= 30) score += 20;
    else if (days <= 90) score += 10;
  }
  const label = score >= 60 ? "Hot" : score >= 30 ? "Warm" : "Cold";
  const color = score >= 60 ? "text-red-400" : score >= 30 ? "text-amber-400" : "text-blue-400";
  const bg = score >= 60 ? "bg-red-500/10 border-red-500/20" : score >= 30 ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-500/10 border-blue-500/20";
  return { score, label, color, bg };
}
import type { Role } from "../../lib/roles";

interface LeadPanelProps {
  onLeadSelect?: (address: string) => void;
  onConverted?: () => void;
  role?: Role;
  profileId?: string;
}

export default function LeadPanel({ onLeadSelect, onConverted, role = "sales_rep", profileId }: LeadPanelProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ name: "", street: "", city: "", state: "", zip: "", phone: "", email: "" });
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    leadService.getActiveLeads().then(setLeads).catch(console.error);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("leads-panel-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        leadService.getActiveLeads().then(setLeads).catch(console.error);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (dropdownOpen && searchRef.current) searchRef.current.focus();
  }, [dropdownOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLead = useMemo(() => leads.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);
  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter((l) =>
      l.name.toLowerCase().includes(term) ||
      l.email?.toLowerCase().includes(term) ||
      l.phone?.includes(searchTerm)
    );
  }, [leads, searchTerm]);

  function buildAddress(lead: Lead): string {
    return [lead.street, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
  }

  function selectLead(id: string) {
    setSelectedId(id);
    setDropdownOpen(false);
    setSearchTerm("");
    const lead = leads.find((l) => l.id === id);
    if (lead && onLeadSelect) {
      const addr = buildAddress(lead);
      if (addr) onLeadSelect(addr);
    }
  }

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    try {
      const newLead = await leadService.createLead(form);
      setLeads((prev) => [...prev, newLead].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(newLead.id);
      setForm({ name: "", street: "", city: "", state: "", zip: "", phone: "", email: "" });
      setAdding(false);
      if (onLeadSelect) {
        const addr = buildAddress(newLead);
        if (addr) onLeadSelect(addr);
      }
    } catch (err) {
      console.error("Failed to create lead:", err);
    }
  }

  const [showConvert, setShowConvert] = useState(false);
  const [convertValue, setConvertValue] = useState("");
  const [converting, setConverting] = useState(false);

  async function handleConvert() {
    if (!selectedLead || !convertValue.trim()) return;
    setConverting(true);
    try {
      const addr = buildAddress(selectedLead);
      await projectService.createProject({
        name: selectedLead.name + (addr ? ` - ${addr}` : ""),
        client: selectedLead.name,
        value: parseFloat(convertValue) || 0,
        salesRepId: profileId || "",
      });
      await leadService.archiveLead(selectedLead.id);
      setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
      setSelectedId("");
      setShowConvert(false);
      setConvertValue("");
      if (onConverted) onConverted();
    } catch (err) {
      console.error("Failed to convert lead:", err);
    } finally {
      setConverting(false);
    }
  }

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-white placeholder-gray-600 px-2 py-0.5 focus:outline-none focus:border-violet-500/40";

  return (
    <div className="glass-card-elevated rounded-2xl overflow-visible flex flex-col flex-1">
      {/* Header */}
      <div className="px-3 py-4 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/[0.04] to-transparent rounded-t-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white/90 flex items-center gap-1.5">
            <User size={12} className="text-violet-400" />
            Leads
            <span className="text-[10px] text-gray-600 font-normal ml-1">{leads.length}</span>
          </h3>
          <button
            onClick={() => { setAdding((v) => !v); setDropdownOpen(false); }}
            className="p-0.5 rounded-md hover:bg-violet-500/15 text-gray-500 hover:text-violet-400 hover:shadow-[0_0_6px_rgba(139,92,246,0.3)] transition-all"
            title="Add Lead"
          >
            {adding ? <X size={12} /> : <UserPlus size={12} />}
          </button>
        </div>
      </div>

      {/* Select a Lead — unified combobox */}
      {!adding && (
        <div ref={containerRef} className="relative px-3 py-2 border-b border-white/[0.06]">
          <div
            className={`bg-[#0c1222] border rounded-lg overflow-hidden transition-all ${
              dropdownOpen ? "border-violet-500/40 shadow-2xl shadow-black/50" : "border-white/[0.06] hover:border-violet-500/40"
            }`}
          >
            {/* Toggle / Search row — always visible as the top of the unit */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
              onClick={() => { if (!dropdownOpen) setDropdownOpen(true); }}
            >
              <Search size={10} className="text-gray-600 shrink-0" />
              {dropdownOpen ? (
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent text-[10px] text-white focus:outline-none placeholder-gray-600"
                />
              ) : (
                <span className="flex-1 text-[10px] text-white/80 truncate">
                  {selectedLead ? selectedLead.name : "Select a lead..."}
                </span>
              )}
              {dropdownOpen ? (
                <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); setSearchTerm(""); }} className="text-gray-600 hover:text-white">
                  <X size={10} />
                </button>
              ) : (
                <ChevronDown size={10} className="text-gray-600 shrink-0" />
              )}
            </div>

            {/* Lead list — part of the same box */}
            {dropdownOpen && (
              <div className="border-t border-white/[0.06] max-h-52 overflow-y-auto">
                {filteredLeads.length === 0 ? (
                  <div className="px-3 py-3 text-[10px] text-gray-600 text-center">
                    {leads.length === 0 ? "No leads yet" : "No matches"}
                  </div>
                ) : (
                  filteredLeads.map((l) => {
                    const { label, color, bg } = scoreLead(l);
                    return (
                      <div
                        key={l.id}
                        onClick={() => selectLead(l.id)}
                        className={`px-3 py-1.5 cursor-pointer transition-colors border-b border-white/[0.03] last:border-b-0 ${
                          selectedId === l.id
                            ? "bg-violet-500/15 text-white"
                            : "hover:bg-white/[0.05] text-white/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[10px] font-medium truncate">{l.name}</p>
                          <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${color} ${bg}`}>{label}</span>
                        </div>
                        <p className="text-[9px] text-gray-600 truncate">
                          {l.email || l.phone || buildAddress(l) || "No contact info"}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Form */}
      {adding && (
        <div className="px-2.5 py-2 space-y-1 border-b border-white/[0.06]">
          <input type="text" placeholder="Name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} className={inputCls} />
          <input type="text" placeholder="Street Address" value={form.street} onChange={(e) => handleChange("street", e.target.value)} className={inputCls} />
          <div className="flex gap-1">
            <input type="text" placeholder="City" value={form.city} onChange={(e) => handleChange("city", e.target.value)} className={`flex-1 ${inputCls}`} />
            <select value={form.state} onChange={(e) => handleChange("state", e.target.value)}
              className="w-14 bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-white px-0.5 py-0.5 focus:outline-none focus:border-violet-500/40 text-center">
              <option value="" disabled className="bg-[#0c1222]">ST</option>
              {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map((s) => (
                <option key={s} value={s} className="bg-[#0c1222]">{s}</option>
              ))}
            </select>
          </div>
          <input type="text" placeholder="Zip Code" value={form.zip} onChange={(e) => handleChange("zip", e.target.value)} className={inputCls} />
          <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className={inputCls} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className={inputCls} />
          <button onClick={handleAdd} disabled={!form.name.trim()}
            className="w-full flex items-center justify-center gap-1 text-[10px] font-medium text-white bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 rounded px-2 py-0.5 mt-0.5 transition-colors">
            <UserPlus size={10} /> Add Lead
          </button>
        </div>
      )}

      {/* Selected Lead Profile */}
      {selectedLead && !adding && (
        <div className="px-2.5 py-2 border-t border-white/[0.06]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-semibold text-white truncate">{selectedLead.name}</p>
              {(() => { const { label, color, bg, score } = scoreLead(selectedLead); return (
                <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${color} ${bg}`} title={`Lead score: ${score}/100`}>{label}</span>
              ); })()}</div>
            {selectedLead.street && (
              <div>
                <p className="text-[9px] uppercase text-gray-600 font-medium leading-none mb-0.5">Address</p>
                <p className="text-[10px] text-gray-400 leading-tight">
                  {selectedLead.street}<br />
                  {[selectedLead.city, selectedLead.state].filter(Boolean).join(", ")} {selectedLead.zip}
                </p>
              </div>
            )}
            {selectedLead.phone && (
              <div>
                <p className="text-[9px] uppercase text-gray-600 font-medium leading-none mb-0.5">Phone</p>
                <p className="text-[10px] text-gray-400">{selectedLead.phone}</p>
              </div>
            )}
            {selectedLead.email && (
              <div>
                <p className="text-[9px] uppercase text-gray-600 font-medium leading-none mb-0.5">Email</p>
                <p className="text-[10px] text-gray-400 break-all">{selectedLead.email}</p>
              </div>
            )}

            {!showConvert && (
              <button
                onClick={() => setShowConvert(true)}
                className="w-full flex items-center justify-center gap-1 text-[10px] font-medium text-white bg-emerald-600/80 hover:bg-emerald-600 rounded px-2 py-1 mt-1.5 transition-colors"
              >
                <ArrowRightCircle size={10} /> Convert to Project
              </button>
            )}

            {showConvert && (
              <div className="mt-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <p className="text-[9px] uppercase text-gray-600 font-medium">Contract Value ($)</p>
                <input
                  type="number"
                  placeholder="e.g. 25000"
                  value={convertValue}
                  onChange={(e) => setConvertValue(e.target.value)}
                  className={inputCls}
                />
                <div className="flex gap-1">
                  <button onClick={() => setShowConvert(false)} className="flex-1 text-[10px] text-gray-500 hover:text-white py-0.5 transition-colors">Cancel</button>
                  <button
                    onClick={handleConvert}
                    disabled={converting || !convertValue.trim()}
                    className="flex-1 text-[10px] font-medium text-white bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 rounded px-2 py-0.5 transition-colors"
                  >
                    {converting ? "Converting..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {leads.length === 0 && !adding && !dropdownOpen && (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <User size={16} className="text-gray-700 mb-1" />
          <p className="text-[10px] text-gray-600">No leads yet</p>
        </div>
      )}
    </div>
  );
}
