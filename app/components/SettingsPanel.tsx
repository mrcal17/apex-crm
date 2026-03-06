"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Loader2, Building2, Copy, Check, Plus, Trash2 } from "lucide-react";
import { projectService, supabase } from "../../lib/projectService";
import { useAuth } from "./AuthProvider";
import { _rl } from "../../lib/roles";

interface SettingsPanelProps {
  onSettingsSaved?: (settings: Record<string, string>) => void;
}

const SETTING_KEYS = {
  revenue_goal: "revenue_goal",
  goal_period: "goal_period",
  default_commission_rate: "default_commission_rate",
  permit_expiry_warning_days: "permit_expiry_warning_days",
  company_name: "company_name",
  currency_symbol: "currency_symbol",
};

const DEFAULT_VALUES: Record<string, string> = {
  revenue_goal: "",
  goal_period: "monthly",
  default_commission_rate: "10",
  permit_expiry_warning_days: "30",
  company_name: "",
  currency_symbol: "$",
};

type CommissionTier = { upTo: number | null; rate: number };

export default function SettingsPanel({ onSettingsSaved }: SettingsPanelProps) {
  const { organizationId, organizationName, role, refreshProfile } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({ ...DEFAULT_VALUES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);

  // Org settings
  const [orgName, setOrgName] = useState(organizationName || "");
  const [joinCode, setJoinCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const settings = await projectService.getSettings();
        setForm((prev) => ({ ...prev, ...settings }));
        if (settings.commission_tiers) {
          try { setTiers(JSON.parse(settings.commission_tiers)); } catch { setTiers([]); }
        }

        // Fetch org details
        if (organizationId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name, slug, join_code")
            .eq("id", organizationId)
            .single();
          if (org) {
            setOrgName(org.name);
            setJoinCode(org.join_code);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const promises = Object.entries(form).map(([key, value]) =>
        projectService.upsertSetting(key, value)
      );
      if (tiers.length > 0) {
        promises.push(projectService.upsertSetting("commission_tiers", JSON.stringify(tiers)));
      }
      await Promise.all(promises);
      setSaved(true);
      onSettingsSaved?.(form);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      console.error("Failed to save settings:", err?.message || err);
    } finally {
      setSaving(false);
    }
  }

  async function handleOrgNameSave() {
    if (!organizationId || !orgName.trim()) return;
    setOrgSaving(true);
    try {
      await supabase
        .from("organizations")
        .update({ name: orgName.trim() })
        .eq("id", organizationId);
      await refreshProfile();
    } catch (err: any) {
      console.error("Failed to update org name:", err?.message || err);
    } finally {
      setOrgSaving(false);
    }
  }

  function copyJoinCode() {
    navigator.clipboard.writeText(joinCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
        <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Organization Settings */}
      {_rl(role as any) >= 3 && organizationId && (
        <div className="glass-card-elevated rounded-2xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Building2 size={18} className="text-purple-400" />
              </div>
              Organization
            </h2>
            <p className="text-gray-500 text-sm mt-1">Manage your organization settings and team access.</p>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Org Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Organization Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your Organization"
                  className="input-field w-full rounded-xl"
                />
                <button
                  onClick={handleOrgNameSave}
                  disabled={orgSaving || orgName === organizationName}
                  className="btn-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {orgSaving ? <Loader2 size={16} className="animate-spin" /> : "Update"}
                </button>
              </div>
            </div>

            {/* Join Code */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Team Join Code</label>
              <div className="flex items-center gap-2">
                <div className="input-field rounded-xl px-4 py-2.5 font-mono tracking-widest text-[var(--accent)] text-lg select-all flex-1">
                  {joinCode}
                </div>
                <button
                  onClick={copyJoinCode}
                  className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-white transition-all duration-200"
                  title="Copy join code"
                >
                  {codeCopied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">Share this code with teammates so they can join your organization during signup.</p>
            </div>
          </div>
        </div>
      )}

      {/* CRM Settings */}
      <div className="glass-card-elevated rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
              <Settings size={18} className="text-[var(--accent)]" />
            </div>
            CRM Settings
          </h2>
          <p className="text-gray-500 text-sm mt-1">Configure your dashboard and CRM defaults.</p>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Company Name</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
              placeholder="Your Company"
              className="input-field w-full rounded-xl"
            />
          </div>

          {/* Revenue Goal + Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Revenue Goal ({form.currency_symbol || "$"})</label>
              <input
                type="number"
                value={form.revenue_goal}
                onChange={(e) => update("revenue_goal", e.target.value)}
                placeholder="e.g. 500000"
                min="0"
                className="input-field w-full rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Goal Period</label>
              <select
                value={form.goal_period}
                onChange={(e) => update("goal_period", e.target.value)}
                className="input-field w-full rounded-xl"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          {/* Default Commission Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Default Commission Rate (%)</label>
            <input
              type="number"
              value={form.default_commission_rate}
              onChange={(e) => update("default_commission_rate", e.target.value)}
              placeholder="10"
              min="0"
              max="100"
              step="0.5"
              className="input-field w-full rounded-xl"
            />
            <p className="text-xs text-gray-600 mt-1">Applied as the default when adding new sales reps.</p>
          </div>

          {/* Tiered Commission Rates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-gray-300">Tiered Commission Rates</label>
                <p className="text-xs text-gray-600 mt-0.5">If configured, tiers override individual rep rates on project completion.</p>
              </div>
              <button
                type="button"
                onClick={() => setTiers((prev) => [...prev, { upTo: null, rate: 0.10 }])}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Plus size={12} /> Add Tier
              </button>
            </div>
            {tiers.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No tiers set — flat per-rep rates will be used.</p>
            ) : (
              <div className="space-y-2">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 glass-card rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-500 shrink-0">Up to $</span>
                      <input
                        type="number"
                        placeholder="∞ (top tier)"
                        value={tier.upTo ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          setTiers((prev) => prev.map((t, j) => j === i ? { ...t, upTo: val } : t));
                        }}
                        className="w-28 bg-transparent text-sm text-white focus:outline-none placeholder-gray-600"
                        min="0"
                      />
                      <span className="text-xs text-gray-500 shrink-0 ml-auto">Rate:</span>
                      <input
                        type="number"
                        value={(tier.rate * 100).toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          setTiers((prev) => prev.map((t, j) => j === i ? { ...t, rate: isNaN(val) ? 0 : val } : t));
                        }}
                        className="w-16 bg-transparent text-sm text-white text-right focus:outline-none"
                        min="0" max="100" step="0.5"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-gray-600">The matching tier for a deal's total value determines its commission rate (threshold-based, not bracketed).</p>
              </div>
            )}
          </div>

          {/* Permit Expiry Warning */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Permit Expiry Warning (days)</label>
            <input
              type="number"
              value={form.permit_expiry_warning_days}
              onChange={(e) => update("permit_expiry_warning_days", e.target.value)}
              placeholder="30"
              min="1"
              className="input-field w-full rounded-xl"
            />
            <p className="text-xs text-gray-600 mt-1">Show warnings for permits expiring within this many days.</p>
          </div>

          {/* Currency Symbol */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Currency Symbol</label>
            <input
              type="text"
              value={form.currency_symbol}
              onChange={(e) => update("currency_symbol", e.target.value)}
              placeholder="$"
              maxLength={3}
              className="input-field w-24 rounded-xl"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="p-5 sm:p-6 border-t border-white/[0.06] bg-gradient-to-r from-white/[0.01] to-transparent flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-emerald-400 text-sm font-medium animate-pulse">
              Settings saved!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
