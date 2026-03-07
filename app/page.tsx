"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Users,
  AlertCircle,
  Search,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle,
  TrendingUp,
  Download,
  Briefcase,
  Keyboard,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Globe,
  Sparkles,
  Settings,
  Shield,
  Target,
  Percent,
  XCircle,
  Zap,
  Wallet,
  BarChart2,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { supabase, projectService } from "../lib/projectService";
import { useCountUp } from "./hooks/useCountUp";
import { relativeTime } from "./hooks/useRelativeTime";
import { fireConfetti } from "./hooks/useConfetti";
import NewProjectModal from "./components/NewProjectModal";
import EditProjectModal from "./components/EditProjectModal";
import { useToast } from "./components/Toast";
import GlobalSearch from "./components/GlobalSearch";
import NotificationCenter from "./components/NotificationCenter";
import { Columns3, BarChart3, Calendar, BookUser, LogOut, ChevronDown as ChevronDownIcon } from "lucide-react";
import MobileNav from "./components/MobileNav";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./components/AuthProvider";
import { applyFilters, type FilterState } from "./components/FilterBar";
import { computeHealthScore, HEALTH_COLORS, type HealthResult } from "../lib/healthScore";

const TabSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-5 h-5 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
  </div>
);

const TeamPanel = dynamic(() => import("./components/TeamPanel"), { ssr: false, loading: TabSpinner });
const Leaderboard = dynamic(() => import("./components/Leaderboard"), { ssr: false, loading: TabSpinner });
const GoogleEarthTab = dynamic(() => import("./components/GoogleEarthTab"), { ssr: false, loading: TabSpinner });
const SolarAnalysisPanel = dynamic(() => import("./components/SolarAnalysisPanel"), { ssr: false, loading: TabSpinner });
const SettingsPanel = dynamic(() => import("./components/SettingsPanel"), { ssr: false, loading: TabSpinner });
const ActiveSessions = dynamic(() => import("./components/ActiveSessions"), { ssr: false, loading: TabSpinner });
const CommissionsPanel = dynamic(() => import("./components/CommissionsPanel"), { ssr: false, loading: TabSpinner });
const PermitsPanel = dynamic(() => import("./components/PermitsPanel"), { ssr: false, loading: TabSpinner });
const LeadPanel = dynamic(() => import("./components/LeadPanel"), { ssr: false, loading: TabSpinner });
const ProjectDetailPanel = dynamic(() => import("./components/ProjectDetailPanel"), { ssr: false, loading: () => null });
const DashboardCharts = dynamic(() => import("./components/DashboardCharts"), { ssr: false, loading: TabSpinner });
const KanbanBoard = dynamic(() => import("./components/KanbanBoard"), { ssr: false, loading: TabSpinner });
const SalesPerformance = dynamic(() => import("./components/SalesPerformance"), { ssr: false, loading: TabSpinner });
const RevenueForecast = dynamic(() => import("./components/RevenueForecast"), { ssr: false, loading: TabSpinner });
const PermitCalendar = dynamic(() => import("./components/PermitCalendar"), { ssr: false, loading: () => null });
const ActivityLog = dynamic(() => import("./components/ActivityLog"), { ssr: false, loading: TabSpinner });
const ClientContacts = dynamic(() => import("./components/ClientContacts"), { ssr: false, loading: TabSpinner });
const ActionQueue = dynamic(() => import("./components/ActionQueue"), { ssr: false, loading: () => null });
const TasksPanel = dynamic(() => import("./components/TasksPanel"), { ssr: false, loading: TabSpinner });
const CloseReasonModal = dynamic(() => import("./components/CloseReasonModal"), { ssr: false, loading: () => null });
const AdminApprovalPanel = dynamic(() => import("./components/AdminApprovalPanel"), { ssr: false, loading: () => null });
const AdminControlsPanel = dynamic(() => import("./components/AdminControlsPanel"), { ssr: false, loading: TabSpinner });
const PipelineMetrics = dynamic(() => import("./components/PipelineMetrics"), { ssr: false, loading: TabSpinner });
const FilterBar = dynamic(() => import("./components/FilterBar"), { ssr: false, loading: () => null });
const WinLossAnalysis = dynamic(() => import("./components/WinLossAnalysis"), { ssr: false, loading: TabSpinner });
const ForecastingV2 = dynamic(() => import("./components/ForecastingV2"), { ssr: false, loading: TabSpinner });
const DocumentsPanel = dynamic(() => import("./components/DocumentsPanel"), { ssr: false, loading: TabSpinner });
const ProposalBuilder = dynamic(() => import("./components/ProposalBuilder"), { ssr: false, loading: TabSpinner });
const ProjectTemplates = dynamic(() => import("./components/ProjectTemplates"), { ssr: false, loading: TabSpinner });
const WorkflowRules = dynamic(() => import("./components/WorkflowRules"), { ssr: false, loading: TabSpinner });
const ScheduledFollowups = dynamic(() => import("./components/ScheduledFollowups"), { ssr: false, loading: TabSpinner });
const ReportsBuilder = dynamic(() => import("./components/ReportsBuilder"), { ssr: false, loading: TabSpinner });
const WebhookManager = dynamic(() => import("./components/WebhookManager"), { ssr: false, loading: TabSpinner });
const AccountingExports = dynamic(() => import("./components/AccountingExports"), { ssr: false, loading: TabSpinner });
const CustomerPortalButton = dynamic(() => import("./components/CustomerPortalButton"), { ssr: false, loading: () => null });
import { TAB_ACCESS, PERMISSIONS, _v, _rl, type Role, type TabKey as RoleTabKey } from "../lib/roles";
import { formatStatus, statusClasses } from "../lib/statusConfig";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "team", label: "Team", icon: Users },
  { key: "site-explorer", label: "Site Explorer", icon: Globe },
  { key: "permits", label: "Permits", icon: FileText },
  { key: "contacts", label: "Contacts", icon: BookUser },
  { key: "proposals", label: "Proposals", icon: Briefcase },
  { key: "reports", label: "Reports", icon: BarChart2 },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "admin-controls", label: "Admin Controls", icon: Shield },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "lead", label: "Leads" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

type SortKey = "name" | "contract_value" | "status" | "created_at";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = { lead: 0, in_progress: 1, completed: 2, cancelled: 3 };

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toFixed(1);
}

function AnimatedKPIDollar({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{formatCompact(animated)}</>;
}

function AnimatedKPI({ value, suffix = "", decimals = 1 }: { value: number; suffix?: string; decimals?: number }) {
  const animated = useCountUp(value);
  return <>{animated.toFixed(decimals)}{suffix}</>;
}

function AnimatedKPIInt({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{Math.round(animated)}</>;
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ArrowUpDown size={12} className="text-gray-600 ml-1 opacity-50" />;
  return sortDir === "asc"
    ? <ArrowUp size={12} className="text-[var(--accent)] ml-1" />
    : <ArrowDown size={12} className="text-[var(--accent)] ml-1" />;
}

const ApexDashboard = () => {
  const toast = useToast();
  const { session, profile, role, profileId, organizationName, isApproved, isPending, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalPipeline: 0, totalCollected: 0, activePermits: 0, expiringPermits: 0 });
  const [commissionStats, setCommissionStats] = useState({ total: 0, paid: 0, unpaid: 0, count: 0 });
  const [projectStats, setProjectStats] = useState({ total: 0, byStatus: {} as Record<string, number>, avgValue: 0 });
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [metricCategory, setMetricCategory] = useState<"all" | "revenue" | "projects" | "commissions" | "permits">("all");
  const [crmSettings, setCrmSettings] = useState<Record<string, string>>({});
  const [leadFocusAddress, setLeadFocusAddress] = useState<string>();
  const [solarData, setSolarData] = useState<any>(null);
  const [solarLoading, setSolarLoading] = useState(false);
  const [solarError, setSolarError] = useState<string | null>(null);
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({ conditions: [], logic: "and" });
  const [allCommissions, setAllCommissions] = useState<any[]>([]);
  const [allPermits, setAllPermits] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [closeReasonProject, setCloseReasonProject] = useState<{ id: string; name: string; outcome: "completed" | "cancelled" } | null>(null);
  const [teamProfiles, setTeamProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const projectFilterFields = useMemo(() => [
    { key: "status", label: "Status", type: "select" as const, options: [
      { value: "lead", label: "Lead" }, { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
    ]},
    { key: "assignee", label: "Assignee", type: "select" as const, options: teamProfiles.map((p) => ({ value: p.full_name, label: p.full_name })) },
    { key: "client_name", label: "Client", type: "text" as const },
    { key: "name", label: "Project Name", type: "text" as const },
    { key: "created_at", label: "Created", type: "date" as const },
  ], [teamProfiles]);
  const solarAbortRef = React.useRef<AbortController | null>(null);
  const handleSolarSearch = useCallback(async (address: string) => {
    // Cancel any in-flight solar request
    solarAbortRef.current?.abort();
    const controller = new AbortController();
    solarAbortRef.current = controller;
    setSolarData(null);
    setSolarError(null);
    setSolarLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const solarToken = sessionData.session?.access_token || '';
      const res = await fetch('/api/solar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${solarToken}` },
        body: JSON.stringify({ address }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setSolarError(data.error || 'Failed to fetch solar data');
      } else {
        setSolarData(data);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setSolarError('Failed to connect to solar analysis service');
    } finally {
      if (!controller.signal.aborted) setSolarLoading(false);
    }
  }, []);

  const [_ov, _setOv] = useState(false);
  useEffect(() => { if (profile?.email) _v(profile.email).then(_setOv); }, [profile?.email]);
  const visibleTabs = useMemo(() =>
    TABS.filter((tab) =>
      TAB_ACCESS[tab.key as RoleTabKey]?.includes(role) ||
      (tab.key === "admin-controls" && _ov)
    ),
    [role, _ov]
  );

  const fetchData = useCallback(async (silent = false) => {
    try {
      // After first successful load, treat subsequent fetches as silent refreshes
      // to avoid flashing the skeleton screen
      if (!silent && !hasLoadedOnce.current) setLoading(true);
      else setRefreshing(true);

      const timeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
      const T = 10000; // 10s timeout per query
      const [permitStats, projectList, cStats, settings, commsData, permitsData, profilesData] = await Promise.all([
        timeout(projectService.getPermitStats(), T, { activePermits: 0, expiringPermits: 0 }).catch(() => ({ activePermits: 0, expiringPermits: 0 })),
        timeout(projectService.getProjects(), T, []).catch(() => []),
        timeout(projectService.getCommissionStats(), T, { total: 0, paid: 0, unpaid: 0, count: 0 }).catch(() => ({ total: 0, paid: 0, unpaid: 0, count: 0 })),
        timeout(projectService.getSettings(), T, {}).catch(() => ({})),
        timeout(projectService.getAllCommissions(), T, []).catch(() => []),
        timeout(projectService.getAllPermits(), T, []).catch(() => []),
        timeout(projectService.getProfiles(), T, []).catch(() => []),
      ]);
      // Derive revenue and project stats from projectList to avoid redundant queries
      let totalPipeline = 0, totalCollected = 0, totalValue = 0;
      const byStatus: Record<string, number> = {};
      for (const p of projectList || []) {
        totalPipeline += Number(p.contract_value ?? 0);
        totalCollected += Number(p.revenue_collected ?? 0);
        totalValue += Number(p.contract_value ?? 0);
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      }
      const total = (projectList || []).length;
      setStats({ totalPipeline, totalCollected, activePermits: permitStats.activePermits, expiringPermits: permitStats.expiringPermits });
      setCommissionStats(cStats);
      setProjectStats({ total, byStatus, avgValue: total > 0 ? totalValue / total : 0 });
      setProjects(projectList || []);
      setAllCommissions(commsData || []);
      setAllPermits(permitsData || []);
      setTeamProfiles((profilesData || []).map((p: any) => ({ id: p.id, full_name: p.full_name })));
      setCrmSettings(settings);
      hasLoadedOnce.current = true;
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch data once auth resolves
  // Uses session?.user?.id (string) as dep instead of session (object) to avoid
  // re-triggering when onAuthStateChange and getSession return different object refs
  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (authLoading) return;
    if (!sessionUserId) { setLoading(false); return; }
    fetchData();
  }, [fetchData, authLoading, sessionUserId]);

  useEffect(() => {
    if (authLoading || !sessionUserId) return;
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "commissions" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "permits" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, authLoading, sessionUserId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setNewModalOpen(true); }
      if (e.key === "?" && e.shiftKey) { e.preventDefault(); setShowShortcuts((v) => !v); }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); fetchData(true); toast("Refreshing...", "info"); }
      if (e.key === "Escape") { setShowShortcuts(false); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fetchData, toast]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filteredAndSorted = useMemo(() => {
    let list = projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.name?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q);
    });
    // Apply advanced filters
    list = applyFilters(list, advancedFilters, (item, field) => {
      if (field === "assignee") return item.profiles?.full_name || "";
      if (field === "created_at") return item.created_at || "";
      return String(item[field] || "");
    });
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "contract_value": cmp = Number(a.contract_value || 0) - Number(b.contract_value || 0); break;
        case "status": cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9); break;
        case "created_at": cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [projects, statusFilter, searchQuery, sortKey, sortDir, advancedFilters]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length };
    for (const p of projects) { counts[p.status] = (counts[p.status] || 0) + 1; }
    return counts;
  }, [projects]);

  // Health scores for all active projects
  const projectHealthScores = useMemo(() => {
    const map = new Map<string, HealthResult>();
    for (const p of projects) {
      if (p.status === "completed" || p.status === "cancelled") continue;
      map.set(p.id, computeHealthScore(p, allPermits, allCommissions));
    }
    return map;
  }, [projects, allPermits, allCommissions]);

  // Stall + health distribution metrics
  const derivedMetrics = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    // Stalled projects (age > 2x stage average and > 7 days)
    const stageTimes: Record<string, number[]> = {};
    for (const p of projects) {
      if (!p.created_at || p.status === "completed" || p.status === "cancelled") continue;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      if (!stageTimes[p.status]) stageTimes[p.status] = [];
      stageTimes[p.status].push(age);
    }
    const stageAvg: Record<string, number> = {};
    for (const [s, times] of Object.entries(stageTimes)) {
      stageAvg[s] = times.reduce((a, b) => a + b, 0) / times.length;
    }
    let stalledCount = 0;
    for (const p of projects) {
      if (!p.created_at || p.status === "completed" || p.status === "cancelled") continue;
      const age = (now - new Date(p.created_at).getTime()) / DAY;
      if (age > (stageAvg[p.status] || 14) * 2 && age > 7) stalledCount++;
    }

    // Health distribution
    let greenCt = 0, yellowCt = 0, redCt = 0;
    for (const h of projectHealthScores.values()) {
      if (h.level === "green") greenCt++;
      else if (h.level === "yellow") yellowCt++;
      else redCt++;
    }

    // Overdue tasks
    const overdueTasks = allTasks.filter((t: any) => !t.completed && t.due_date && new Date(t.due_date).getTime() < now).length;

    // Avg stage durations
    const avgLeadDays = stageAvg["lead"] || 0;
    const avgProgressDays = stageAvg["in_progress"] || 0;

    return { stalledCount, greenCt, yellowCt, redCt, overdueTasks, avgLeadDays, avgProgressDays };
  }, [projects, projectHealthScores, allTasks]);

  async function handleQuickComplete(projectId: string) {
    if (_rl(role) < 2) {
      if (!window.confirm("Request to mark this project as completed? A manager or admin must approve.")) return;
      try {
        await projectService.requestCompletion(projectId);
        toast("Completion request submitted — awaiting manager/admin approval.", "success");
      } catch (err: any) {
        toast(err?.message || "Failed to request completion.", "error");
      }
      return;
    }
    if (!window.confirm("Mark this project as completed? This will trigger commission calculation.")) return;
    try {
      const pName = projects.find((p) => p.id === projectId)?.name || "Project";
      await projectService.completeProject(projectId);
      setRecentlyCompleted((prev) => new Set(prev).add(projectId));
      setTimeout(() => setRecentlyCompleted((prev) => { const n = new Set(prev); n.delete(projectId); return n; }), 3000);
      fireConfetti();
      toast("Project completed! Commission generated.", "success");
      fetchData(true);
      setCloseReasonProject({ id: projectId, name: pName, outcome: "completed" });
    } catch (err) {
      toast("Failed to complete project.", "error");
    }
  }

  async function handleQuickDelete(projectId: string, projectName: string) {
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    try {
      await projectService.deleteProject(projectId);
      if (selectedProjectId === projectId) setSelectedProjectId(null);
      toast("Project deleted.", "info");
      fetchData(true);
    } catch (err) {
      toast("Failed to delete project.", "error");
    }
  }

  async function handleInlineStatus(projectId: string, newStatus: string, currentStatus: string) {
    if (newStatus === currentStatus) return;
    if (newStatus === "completed") { handleQuickComplete(projectId); return; }
    try {
      await projectService.updateProject(projectId, { status: newStatus });
      toast(`Status changed to ${formatStatus(newStatus)}.`, "success");
      fetchData(true);
      if (newStatus === "cancelled") {
        const pName = projects.find((p) => p.id === projectId)?.name || "Project";
        setCloseReasonProject({ id: projectId, name: pName, outcome: "cancelled" });
      }
    } catch (err) {
      toast("Failed to update status.", "error");
    }
  }

  function exportCSV() {
    if (projects.length === 0) return;
    const headers = ["Name", "Client", "Sales Rep", "Contract Value", "Revenue Collected", "Status", "Created"];
    const rows = projects.map((p) => [
      p.name || "", p.client_name || "", p.profiles?.full_name || "",
      p.contract_value || 0, p.revenue_collected || 0, p.status || "",
      p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `goycattleherder-projects-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast("CSV exported!", "success");
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkStatus(newStatus: string) {
    if (bulkSelected.size === 0) return;
    if (!window.confirm(`Change ${bulkSelected.size} project(s) to "${formatStatus(newStatus)}"?`)) return;
    try {
      for (const id of bulkSelected) {
        if (newStatus === "completed") {
          if (_rl(role) < 2) {
            await projectService.requestCompletion(id);
          } else {
            await projectService.completeProject(id);
          }
        } else {
          await projectService.updateProject(id, { status: newStatus });
        }
      }
      setBulkSelected(new Set());
      if (newStatus === "completed" && _rl(role) < 2) {
        toast("Completion request(s) submitted — awaiting approval.", "success");
      } else {
        toast(`${bulkSelected.size} project(s) updated.`, "success");
      }
      fetchData(true);
    } catch {
      toast("Failed to update some projects.", "error");
    }
  }

  async function handleBulkDelete() {
    if (bulkSelected.size === 0) return;
    if (!window.confirm(`Delete ${bulkSelected.size} project(s)? This cannot be undone.`)) return;
    try {
      await projectService.batchDelete(Array.from(bulkSelected));
      const count = bulkSelected.size;
      setBulkSelected(new Set());
      toast(`${count} project(s) deleted.`, "info");
      fetchData(true);
    } catch {
      toast("Failed to delete some projects.", "error");
    }
  }

  async function handleBulkReassign(salesRepId: string) {
    if (bulkSelected.size === 0 || !salesRepId) return;
    const repName = teamProfiles.find((p) => p.id === salesRepId)?.full_name || "selected rep";
    if (!window.confirm(`Reassign ${bulkSelected.size} project(s) to ${repName}?`)) return;
    try {
      await projectService.batchReassign(Array.from(bulkSelected), salesRepId);
      setBulkSelected(new Set());
      toast(`${bulkSelected.size} project(s) reassigned to ${repName}.`, "success");
      fetchData(true);
    } catch {
      toast("Failed to reassign some projects.", "error");
    }
  }

  function exportSelectedCSV() {
    const selected = filteredAndSorted.filter((p) => bulkSelected.has(p.id));
    if (selected.length === 0) return;
    const headers = ["Name", "Client", "Sales Rep", "Contract Value", "Revenue Collected", "Status", "Created"];
    const rows = selected.map((p) => [
      p.name || "", p.client_name || "", p.profiles?.full_name || "",
      p.contract_value || 0, p.revenue_collected || 0, p.status || "",
      p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `selected-projects-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast(`Exported ${selected.length} project(s) to CSV.`, "success");
  }

  async function downloadReport(type: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const reportToken = sessionData.session?.access_token || '';
      const res = await fetch(`/api/report?type=${type}`, {
        headers: { 'Authorization': `Bearer ${reportToken}` },
      });
      if (!res.ok) throw new Error('Failed to download report');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Report downloaded!", "success");
    } catch {
      toast("Failed to download report.", "error");
    }
  }

  const revenueGoal = Number(crmSettings.revenue_goal) || stats.totalPipeline;
  const pipelineProgress = revenueGoal > 0 ? (stats.totalCollected / revenueGoal) * 100 : 0;
  const goalPeriod = crmSettings.goal_period || "";

  // Auth loading state
  if (authLoading) {
    return (
      <div className="app-bg noise-overlay min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Redirect pending users
  if (session && isPending) {
    if (typeof window !== "undefined") window.location.href = "/pending-approval";
    return null;
  }

  return (
    <div className="app-bg noise-overlay text-white font-sans flex">
      {/* Sidebar Navigation (desktop) */}
      <Sidebar
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as TabKey)}
        profile={profile}
        role={role}
        organizationName={organizationName}
        onSignOut={async () => { await signOut(); window.location.href = "/login"; }}
      />

      {/* Mobile Bottom Navigation */}
      <MobileNav tabs={visibleTabs as any} activeTab={activeTab} onTabChange={(key) => setActiveTab(key as TabKey)} />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto h-screen">
      {/* Top Bar */}
      <div className="p-4 md:px-8 md:pt-6 pb-0 relative z-50">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile-only logo */}
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-secondary)]/15 border border-white/5">
              <Sparkles size={20} className="text-[var(--accent)]" />
            </div>
            <h1 className="text-xl font-display font-bold gradient-text">GCH CRM</h1>
          </div>

          {/* Page title (desktop) */}
          <div className="hidden md:block">
            <h2 className="text-xl font-display font-bold text-white/90">
              {visibleTabs.find((t) => t.key === activeTab)?.label || "Dashboard"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeTab === "dashboard" ? "Overview & project tracking" :
               activeTab === "kanban" ? "Drag & drop pipeline" :
               activeTab === "analytics" ? "Performance, forecasting & win/loss" :
               activeTab === "team" ? "Members & commissions" :
               activeTab === "site-explorer" ? "Solar analysis & leads" :
               activeTab === "permits" ? "Permit management" :
               activeTab === "contacts" ? "Client directory" :
               activeTab === "proposals" ? "Templates, follow-ups & proposals" :
               activeTab === "reports" ? "Custom reports & exports" :
               activeTab === "settings" ? "Configuration, workflows & integrations" :
               activeTab === "admin-controls" ? "System administration" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <GlobalSearch
              projects={projects}
              onSelectProject={(id) => { setDetailProjectId(id); setSelectedProjectId(id); }}
              onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
            />
            <NotificationCenter role={role} onProjectRefresh={() => fetchData(true)} />
            <div className="relative group">
              <button className="p-2 rounded-xl glass-card text-gray-400 hover:text-white transition-all duration-200" title="Reports">
                <Download size={16} />
              </button>
              <div className="absolute right-0 top-full hidden group-hover:block z-[70] w-44 pt-1">
                <div className="glass-card-elevated rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden">
                  <button onClick={() => downloadReport('commissions')} className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors">Commission Report</button>
                  <button onClick={() => downloadReport('projects')} className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors">Project Report</button>
                </div>
              </div>
            </div>
            <button
              onClick={() => { fetchData(true); toast("Refreshing...", "info"); }}
              className={`p-2 rounded-xl glass-card text-gray-400 hover:text-white transition-all duration-200 ${refreshing ? "animate-spin" : ""}`}
              title="Refresh (R)"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowShortcuts((v) => !v)}
              className="p-2 rounded-xl glass-card text-gray-400 hover:text-white transition-all duration-200 hidden sm:block"
              title="Keyboard shortcuts (Shift+?)"
            >
              <Keyboard size={16} />
            </button>
            <button
              onClick={() => setNewModalOpen(true)}
              className="btn-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm"
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">New Project</span>
              <kbd className="ml-1 text-[10px] bg-white/20 px-1 py-0.5 rounded font-mono hidden lg:inline">N</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="glass-card-elevated rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Keyboard size={20} className="text-[var(--accent)]" />
              Keyboard Shortcuts
            </h3>
            <div className="space-y-3">
              {[
                { key: "N", desc: "New Project" },
                { key: "R", desc: "Refresh data" },
                { key: "Shift + ?", desc: "Toggle shortcuts" },
                { key: "Esc", desc: "Close modals" },
              ].map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{s.desc}</span>
                  <kbd className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-xs text-white font-mono">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div key={activeTab} className="p-4 md:px-8 md:pb-8 pb-20 relative z-10 tab-content-enter">
      {/* === DASHBOARD TAB === */}
      {activeTab === "dashboard" && <div>
      {loading ? (
        <div className="mt-6 space-y-4">
          {/* Skeleton KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[0,1,2,3].map((i) => (
              <div key={i} className="glass-card p-6 rounded-2xl animate-pulse">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-4 w-24 bg-white/[0.06] rounded" />
                  <div className="w-9 h-9 bg-white/[0.06] rounded-lg" />
                </div>
                <div className="h-8 w-32 bg-white/[0.08] rounded mt-2" />
              </div>
            ))}
          </div>
          {/* Skeleton Table Rows */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <div className="h-5 w-40 bg-white/[0.06] rounded animate-pulse" />
            </div>
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
                <div className="h-4 w-4 bg-white/[0.06] rounded" />
                <div className="h-4 flex-1 bg-white/[0.06] rounded" />
                <div className="h-4 w-20 bg-white/[0.06] rounded" />
                <div className="h-4 w-16 bg-white/[0.06] rounded" />
                <div className="h-4 w-24 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (<>
      {/* Smart Action Queue */}
      <div className="mt-6">
        <ActionQueue
          projects={projects}
          permits={allPermits}
          commissions={allCommissions}
          tasks={allTasks}
          onSelectProject={(id) => { setSelectedProjectId(id); setDetailProjectId(id); }}
          onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
        />
      </div>

      {/* Metric Category Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1 mt-6 mb-4">
        {([
          { key: "all", label: "All Metrics" },
          { key: "revenue", label: "Revenue" },
          { key: "projects", label: "Projects" },
          { key: "commissions", label: "Commissions" },
          { key: "permits", label: "Permits" },
        ] as const).map((cat) => (
          <button key={cat.key} onClick={() => setMetricCategory(cat.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              metricCategory === cat.key
                ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
                : "text-gray-500 hover:text-white hover:bg-white/[0.04] border border-transparent"
            }`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* === REVENUE METRICS === */}
      {(metricCategory === "all" || metricCategory === "revenue") && (
        <div className="mb-4">
          {metricCategory === "all" && <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5"><DollarSign size={12} /> Revenue</h3>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="glass-card kpi-glow-green p-6 rounded-2xl group hover:border-green-500/20 transition-all duration-300 animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-gray-400 text-sm font-medium">Pipeline Value</span>
                <div className="icon-glow icon-glow-green group-hover:scale-110 transition-transform">
                  <DollarSign className="text-emerald-400" size={20} />
                </div>
              </div>
              <div className="text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-emerald-300 to-[var(--accent)] bg-clip-text text-transparent">
                $<AnimatedKPIDollar value={stats.totalPipeline} />
              </div>
            </div>

            <div className="glass-card kpi-glow-purple p-6 rounded-2xl group hover:border-purple-500/20 transition-all duration-300 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-gray-400 text-sm font-medium">Revenue Collected</span>
                <div className="icon-glow icon-glow-purple group-hover:scale-110 transition-transform">
                  <TrendingUp className="text-purple-400" size={20} />
                </div>
              </div>
              <div className="text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">
                $<AnimatedKPIDollar value={stats.totalCollected} />
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{pipelineProgress.toFixed(0)}% collected</span>
                  <span>${formatCompact(revenueGoal)}{goalPeriod ? ` ${goalPeriod}` : ""} goal</span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 via-violet-400 to-[var(--accent)] rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(pipelineProgress, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 hover:border-white/10 transition-all duration-200 group animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/15 to-green-500/5">
                <TrendingUp className="text-green-400 shrink-0" size={16} />
              </div>
              <div>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Avg. Deal Value</p>
                <p className="text-lg font-display font-bold">$<AnimatedKPIDollar value={projectStats.avgValue} /></p>
              </div>
            </div>

            <div className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 hover:border-white/10 transition-all duration-200 group animate-slide-up stagger-4 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/15 to-cyan-500/5">
                <Wallet className="text-cyan-400 shrink-0" size={16} />
              </div>
              <div>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Outstanding</p>
                <p className="text-lg font-display font-bold">$<AnimatedKPIDollar value={stats.totalPipeline - stats.totalCollected} /></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === PROJECT METRICS === */}
      {(metricCategory === "all" || metricCategory === "projects") && (
        <div className="mb-4">
          {metricCategory === "all" && <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 mt-4 flex items-center gap-1.5"><Briefcase size={12} /> Projects</h3>}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { icon: Briefcase, gradient: "from-[var(--accent)]/15 to-[var(--accent)]/5", color: "text-[var(--accent)]", label: "Total Projects", value: <AnimatedKPIInt value={projectStats.total} /> },
              { icon: Zap, gradient: "from-amber-500/15 to-amber-500/5", color: "text-amber-400", label: "Leads", value: <AnimatedKPIInt value={projectStats.byStatus["lead"] || 0} /> },
              { icon: Activity, gradient: "from-blue-500/15 to-blue-500/5", color: "text-blue-400", label: "In Progress", value: <AnimatedKPIInt value={projectStats.byStatus["in_progress"] || 0} /> },
              { icon: CheckCircle, gradient: "from-emerald-500/15 to-emerald-500/5", color: "text-emerald-400", label: "Completed", value: <AnimatedKPIInt value={projectStats.byStatus["completed"] || 0} /> },
              { icon: XCircle, gradient: "from-red-500/15 to-red-500/5", color: "text-red-400", label: "Cancelled", value: <AnimatedKPIInt value={projectStats.byStatus["cancelled"] || 0} /> },
            ].map((item, i) => (
              <div key={i} className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 hover:border-white/10 transition-all duration-200 group" >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient}`}>
                  <item.icon className={`${item.color} shrink-0`} size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{item.label}</p>
                  <p className="text-lg font-display font-bold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Velocity, Stall, Health row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-3">
            {[
              { icon: Target, gradient: "from-violet-500/15 to-violet-500/5", color: "text-violet-400", label: "Win Rate", value: <><AnimatedKPI value={projectStats.total > 0 ? ((projectStats.byStatus["completed"] || 0) / projectStats.total) * 100 : 0} suffix="%" /></> },
              { icon: AlertTriangle, gradient: "from-orange-500/15 to-orange-500/5", color: "text-orange-400", label: "Stalled Deals", value: <AnimatedKPIInt value={derivedMetrics.stalledCount} /> },
              { icon: Clock, gradient: "from-sky-500/15 to-sky-500/5", color: "text-sky-400", label: "Avg Lead Time", value: <><AnimatedKPI value={derivedMetrics.avgLeadDays} suffix="d" /></> },
              { icon: Clock, gradient: "from-indigo-500/15 to-indigo-500/5", color: "text-indigo-400", label: "Avg Build Time", value: <><AnimatedKPI value={derivedMetrics.avgProgressDays} suffix="d" /></> },
              { icon: Activity, gradient: "from-pink-500/15 to-pink-500/5", color: "text-pink-400", label: "Health", value: <span className="flex items-center gap-1.5 text-sm"><span className="w-2 h-2 rounded-full bg-emerald-400" />{derivedMetrics.greenCt} <span className="w-2 h-2 rounded-full bg-amber-400" />{derivedMetrics.yellowCt} <span className="w-2 h-2 rounded-full bg-red-400" />{derivedMetrics.redCt}</span> },
            ].map((item, i) => (
              <div key={i} className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 hover:border-white/10 transition-all duration-200 group" >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient}`}>
                  <item.icon className={`${item.color} shrink-0`} size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{item.label}</p>
                  <p className="text-lg font-display font-bold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === COMMISSION METRICS === */}
      {(metricCategory === "all" || metricCategory === "commissions") && (
        <div className="mb-4">
          {metricCategory === "all" && <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 mt-4 flex items-center gap-1.5"><Percent size={12} /> Commissions</h3>}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="glass-card kpi-glow-amber p-6 rounded-2xl group hover:border-amber-500/20 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <span className="text-gray-400 text-sm font-medium">Unpaid</span>
                <div className="icon-glow icon-glow-amber group-hover:scale-110 transition-transform">
                  <Users className="text-amber-400" size={20} />
                </div>
              </div>
              <div className="text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                $<AnimatedKPIDollar value={commissionStats.unpaid} />
              </div>
              {commissionStats.count > 0 && (
                <div className="mt-2 text-xs text-gray-500">{commissionStats.count} total</div>
              )}
            </div>
            {[
              { icon: DollarSign, gradient: "from-emerald-500/15 to-emerald-500/5", color: "text-emerald-400", label: "Total Earned", value: <>$<AnimatedKPIDollar value={commissionStats.total} /></> },
              { icon: CheckCircle, gradient: "from-green-500/15 to-green-500/5", color: "text-green-400", label: "Paid Out", value: <>$<AnimatedKPIDollar value={commissionStats.paid} /></> },
              { icon: Percent, gradient: "from-purple-500/15 to-purple-500/5", color: "text-purple-400", label: "Payout Rate", value: <><AnimatedKPI value={commissionStats.total > 0 ? (commissionStats.paid / commissionStats.total) * 100 : 0} suffix="%" /></> },
              { icon: BarChart2, gradient: "from-cyan-500/15 to-cyan-500/5", color: "text-cyan-400", label: "Avg. per Deal", value: <>$<AnimatedKPIDollar value={commissionStats.count > 0 ? commissionStats.total / commissionStats.count : 0} /></> },
            ].map((item, i) => (
              <div key={i} className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 hover:border-white/10 transition-all duration-200 group">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient}`}>
                  <item.icon className={`${item.color} shrink-0`} size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{item.label}</p>
                  <p className="text-lg font-display font-bold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === PERMIT METRICS === */}
      {(metricCategory === "all" || metricCategory === "permits") && (
        <div className="mb-8">
          {metricCategory === "all" && <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 mt-4 flex items-center gap-1.5"><FileText size={12} /> Permits</h3>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card kpi-glow-blue p-6 rounded-2xl group hover:border-blue-500/20 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <span className="text-gray-400 text-sm font-medium">Active Permits</span>
                <div className="icon-glow icon-glow-blue group-hover:scale-110 transition-transform">
                  <FileText className="text-cyan-400" size={20} />
                </div>
              </div>
              <div className="text-3xl font-display font-bold tracking-tight text-cyan-300"><AnimatedKPIInt value={stats.activePermits} /></div>
              {stats.expiringPermits > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-2.5 py-1.5 border border-amber-500/10">
                  <AlertCircle size={12} /> {stats.expiringPermits} expiring soon
                </div>
              )}
            </div>
            {[
              { icon: AlertCircle, gradient: "from-amber-500/15 to-amber-500/5", color: "text-amber-400", label: "Expiring Soon", value: <AnimatedKPIInt value={stats.expiringPermits} /> },
              { icon: BarChart2, gradient: "from-purple-500/15 to-purple-500/5", color: "text-purple-400", label: "Total Permits", value: <AnimatedKPIInt value={allPermits.length} /> },
              { icon: Percent, gradient: "from-emerald-500/15 to-emerald-500/5", color: "text-emerald-400", label: "Approval Rate", value: <><AnimatedKPI value={allPermits.length > 0 ? (allPermits.filter((p: any) => p.status === "approved").length / allPermits.length) * 100 : 0} suffix="%" /></> },
            ].map((item, i) => (
              <div key={i} className="glass-card px-4 py-3.5 rounded-xl flex items-center gap-3 hover:border-white/10 transition-all duration-200 group">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient}`}>
                  <item.icon className={`${item.color} shrink-0`} size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{item.label}</p>
                  <p className="text-lg font-display font-bold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue tasks alert */}
      {derivedMetrics.overdueTasks > 0 && (
        <div className="flex items-center gap-3 glass-card px-4 py-3 rounded-xl border-red-500/20 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertTriangle className="text-red-400" size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-white/90 font-medium">{derivedMetrics.overdueTasks} overdue task{derivedMetrics.overdueTasks !== 1 ? "s" : ""}</p>
            <p className="text-xs text-gray-500">Tasks past their due date need attention</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <DashboardCharts projects={projects} commissions={allCommissions} />

      {/* Tasks & Reminders */}
      <div className="mt-10">
        <TasksPanel projects={projects} onTasksLoaded={setAllTasks} />
      </div>

      {/* Bulk Actions Bar */}
      {bulkSelected.size > 0 && (
        <div className="glass-card-elevated rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap border border-[var(--accent)]/20">
          <span className="text-sm text-white font-medium">{bulkSelected.size} selected</span>
          <select onChange={(e) => { if (e.target.value) handleBulkStatus(e.target.value); e.target.value = ""; }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-gray-400 px-2 py-1.5 focus:outline-none">
            <option value="">Change status...</option>
            <option value="lead">Lead</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {PERMISSIONS.canChooseSalesRep(role) && teamProfiles.length > 0 && (
            <select onChange={(e) => { if (e.target.value) handleBulkReassign(e.target.value); e.target.value = ""; }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-gray-400 px-2 py-1.5 focus:outline-none">
              <option value="">Reassign to...</option>
              {teamProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          )}
          <button onClick={exportSelectedCSV} className="text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1">
            <Download size={12} /> Export CSV
          </button>
          {PERMISSIONS.canBulkDelete(role) && (
            <button onClick={handleBulkDelete} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 transition-colors">
              Delete Selected
            </button>
          )}
          <button onClick={() => setBulkSelected(new Set())} className="text-xs text-gray-500 hover:text-white ml-auto transition-colors">
            Clear Selection
          </button>
        </div>
      )}

      <div className="mt-10">
        {/* Project Tracker */}
        <div className="glass-card-elevated rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-xl font-display font-bold flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[var(--accent)]/10">
                  <LayoutDashboard size={18} className="text-[var(--accent)]" />
                </div>
                Project Tracker
                {refreshing && <RefreshCw size={14} className="text-[var(--accent)] animate-spin" />}
              </h2>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[var(--accent)] transition-colors px-3 py-1.5 rounded-lg glass-card hover:border-[var(--accent)]/20"
                  title="Export to CSV">
                  <Download size={14} /> Export
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field rounded-full w-40 sm:w-auto focus:w-56 transition-all" style={{ paddingLeft: '2.5rem' }} />
                </div>
              </div>
            </div>
            {/* Status Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((f) => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    statusFilter === f.key
                      ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-[0_0_10px_rgba(0,170,255,0.1)]"
                      : "text-gray-500 hover:text-white hover:bg-white/[0.04] border border-transparent"
                  }`}>
                  {f.label}
                  <span className={`ml-1.5 text-xs ${statusFilter === f.key ? "text-[var(--accent)]/70" : "text-gray-600"}`}>
                    {statusCounts[f.key] || 0}
                  </span>
                </button>
              ))}
            </div>
            {/* Advanced Filter Bar */}
            <div className="mt-3">
              <FilterBar
                fields={projectFilterFields}
                storageKey="projects"
                onFilterChange={setAdvancedFilters}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center min-w-[600px]">
              <thead className="text-xs uppercase text-gray-500 bg-blue-900/20">
                <tr>
                  <th className="px-3 py-4 w-10">
                    <input type="checkbox"
                      ref={(el) => { if (el) el.indeterminate = bulkSelected.size > 0 && bulkSelected.size < filteredAndSorted.length; }}
                      checked={bulkSelected.size > 0 && bulkSelected.size === filteredAndSorted.length}
                      onChange={(e) => {
                        if (e.target.checked) setBulkSelected(new Set(filteredAndSorted.map((p) => p.id)));
                        else setBulkSelected(new Set());
                      }}
                      className="crm-checkbox"
                    />
                  </th>
                  <th className="px-6 py-4 text-left cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("name")}>
                    <span className="flex items-center">Project <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("contract_value")}>
                    <span className="flex items-center justify-center">Value <SortIcon column="contract_value" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort("status")}>
                    <span className="flex items-center justify-center">Status <SortIcon column="status" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" /> Loading projects...
                    </div>
                  </td></tr>
                ) : filteredAndSorted.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    {searchQuery || statusFilter !== "all"
                      ? "No projects match your filters."
                      : <span>No projects yet. Press <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-xs font-mono">N</kbd> to create one.</span>}
                  </td></tr>
                ) : (
                  filteredAndSorted.map((p) => {
                    return (
                      <tr key={p.id}
                        className={`table-row-hover cursor-pointer ${selectedProjectId === p.id ? "bg-[var(--accent)]/[0.04]" : ""} ${recentlyCompleted.has(p.id) ? "bg-green-500/10" : ""}`}
                        onClick={() => { setSelectedProjectId(p.id); setDetailProjectId(p.id); }}>
                        <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={bulkSelected.has(p.id)} onChange={() => toggleBulkSelect(p.id)} className="crm-checkbox" />
                        </td>
                        <td className="px-6 py-3 text-left">
                          {p.created_at && (
                            <span className="text-[10px] text-gray-600 inline-flex items-center gap-0.5 mb-0.5">
                              <Clock size={9} /> {relativeTime(p.created_at)}
                            </span>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-white/90">{p.name}</p>
                              {projectHealthScores.has(p.id) && (() => {
                                const h = projectHealthScores.get(p.id)!;
                                const c = HEALTH_COLORS[h.level];
                                return <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} title={`${h.label} (${h.score}/100)${h.factors.length > 0 ? ": " + h.factors.join(", ") : ""}`} />;
                              })()}
                            </div>
                            <p className="text-xs text-gray-500">
                              {p.client_name}{p.profiles?.full_name ? ` \u2022 ${p.profiles.full_name}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-white/80 font-medium">${Number(p.contract_value || 0).toLocaleString()}</p>
                          {Number(p.revenue_collected || 0) > 0 && (
                            <p className="text-xs text-emerald-400/70 mt-0.5">${Number(p.revenue_collected).toLocaleString()} collected</p>
                          )}
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={p.status}
                            onChange={(e) => handleInlineStatus(p.id, e.target.value, p.status)}
                            className={`bg-transparent border-0 text-xs font-medium rounded-full px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition-colors ${statusClasses(p.status)}`}>
                            <option value="lead">Lead</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setEditProject(p)} className="p-1.5 rounded-lg hover:bg-[var(--accent)]/10 text-gray-500 hover:text-[var(--accent)] hover:shadow-[0_0_8px_rgba(0,170,255,0.3)] transition-all duration-200" title="Edit">
                              <Edit3 size={16} />
                            </button>
                            {p.status !== "completed" && p.status !== "cancelled" && (
                              <button onClick={() => handleQuickComplete(p.id)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400 hover:shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-200" title="Complete">
                                <CheckCircle size={16} />
                              </button>
                            )}
                            {PERMISSIONS.canDeleteProjects(role) && (
                              <button onClick={() => handleQuickDelete(p.id, p.name)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all duration-200" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredAndSorted.length > 0 && (
            <div className="px-6 py-3 border-t border-white/[0.04] bg-blue-950/30 flex justify-between items-center text-xs text-gray-500">
              <span>{filteredAndSorted.length} project{filteredAndSorted.length !== 1 ? "s" : ""}</span>
              <span>Total: ${filteredAndSorted.reduce((s, p) => s + Number(p.contract_value || 0), 0).toLocaleString()}</span>
            </div>
          )}
        </div>

      </div>
      </>)}
      </div>}{/* end dashboard tab */}

      {/* === KANBAN TAB === */}
      {activeTab === "kanban" && (
        <KanbanBoard
          projects={projects}
          onRefresh={() => fetchData(true)}
          onSelectProject={(id) => { setSelectedProjectId(id); setDetailProjectId(id); }}
          role={role}
        />
      )}

      {/* === ANALYTICS TAB === */}
      {activeTab === "analytics" && (
        <div className="mt-6 space-y-6">
          <PipelineMetrics projects={projects} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ForecastingV2 projects={projects} revenueGoal={revenueGoal} />
            <RevenueForecast projects={projects} revenueGoal={revenueGoal} />
          </div>
          <WinLossAnalysis projects={projects} />
          <SalesPerformance />
          <ActivityLog role={role} />
        </div>
      )}

      {/* === TEAM TAB === */}
      {activeTab === "team" && (
        <div className="mt-6 space-y-5">
          {PERMISSIONS.canApproveUsers(role) && <AdminApprovalPanel />}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TeamPanel role={role} />
            <Leaderboard />
          </div>
          <CommissionsPanel role={role} profileId={profileId || undefined} />
        </div>
      )}

      {/* === SITE EXPLORER TAB === */}
      {activeTab === "site-explorer" && (
        <div className="mt-6 min-h-[600px]">
          <div className="flex flex-col md:grid md:grid-cols-[7fr_3fr] gap-4 items-start" style={{ minHeight: '500px' }}>
            <GoogleEarthTab
              focusAddress={leadFocusAddress}
              solarData={solarData}
              onSearch={(addr) => {
                setLeadFocusAddress(addr);
                handleSolarSearch(addr);
              }}
            />
            <div className="flex flex-col gap-4 w-full">
              <LeadPanel
                onLeadSelect={(addr) => { setLeadFocusAddress(addr); handleSolarSearch(addr); }}
                onConverted={() => fetchData(true)}
                role={role}
                profileId={profileId || undefined}
              />
              <SolarAnalysisPanel solarData={solarData?.solarPotential ?? null} loading={solarLoading} error={solarError} />
            </div>
          </div>
        </div>
      )}

      {/* === PERMITS TAB === */}
      {activeTab === "permits" && (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <PermitsPanel role={role} />
            </div>
            <PermitCalendar permits={allPermits} />
          </div>
        </div>
      )}

      {/* === CONTACTS TAB === */}
      {activeTab === "contacts" && (
        <div className="mt-6">
          <ClientContacts role={role} />
        </div>
      )}

      {/* === PROPOSALS TAB === */}
      {activeTab === "proposals" && (
        <div className="mt-6 space-y-5">
          <ScheduledFollowups />
          <ProjectTemplates
            onCreateFromTemplate={(template) => {
              setNewModalOpen(true);
              // Template data will pre-fill via the modal
            }}
            role={role}
          />
        </div>
      )}

      {/* === REPORTS TAB === */}
      {activeTab === "reports" && (
        <div className="mt-6 space-y-5">
          <ReportsBuilder projects={projects} commissions={allCommissions} permits={allPermits} />
          <AccountingExports />
        </div>
      )}

      {/* === SETTINGS TAB === */}
      {activeTab === "settings" && (
        <div className="mt-6 space-y-6">
          {PERMISSIONS.canMarkCommissionPaid(role) && (
            <SettingsPanel onSettingsSaved={(s) => { setCrmSettings(s); fetchData(true); }} />
          )}
          {PERMISSIONS.canMarkCommissionPaid(role) && <WorkflowRules role={role} />}
          {PERMISSIONS.canMarkCommissionPaid(role) && <WebhookManager />}
          <div className="max-w-2xl mx-auto">
            <ActiveSessions />
          </div>
        </div>
      )}

      {/* === ADMIN CONTROLS TAB === */}
      {activeTab === "admin-controls" && (
        <div className="mt-6">
          <AdminControlsPanel />
        </div>
      )}
      </div>{/* end p-4 content wrapper */}

      {/* Project Detail Panel */}
      {detailProjectId && (
        <ProjectDetailPanel
          projectId={detailProjectId}
          onClose={() => setDetailProjectId(null)}
          onEdit={(p) => { setEditProject(p); setDetailProjectId(null); }}
          role={role}
        />
      )}

      {/* Modals */}
      <NewProjectModal isOpen={newModalOpen} onClose={() => setNewModalOpen(false)} onCreated={() => fetchData(true)} role={role} profileId={profileId} />
      <EditProjectModal isOpen={!!editProject} project={editProject} onClose={() => setEditProject(null)} onUpdated={() => fetchData(true)} role={role} />
      {closeReasonProject && (
        <CloseReasonModal
          projectId={closeReasonProject.id}
          projectName={closeReasonProject.name}
          outcome={closeReasonProject.outcome}
          onClose={() => setCloseReasonProject(null)}
          onSaved={() => fetchData(true)}
        />
      )}
      </div>{/* end flex-1 main content */}
    </div>
  );
};

export default ApexDashboard;
