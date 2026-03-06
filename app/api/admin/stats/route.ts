import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSuperadminProfile(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, approval_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile || profile.role !== 'superadmin' || profile.approval_status !== 'approved') {
    return null;
  }

  return profile;
}

export async function GET(req: NextRequest) {
  const profile = await getSuperadminProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Fetch all data in parallel
    const [
      { data: orgs },
      { data: profiles },
      { data: projects },
      { data: commissions },
      { data: recentActivity },
    ] = await Promise.all([
      supabaseAdmin.from('organizations').select('id, name, created_at'),
      supabaseAdmin.from('profiles').select('id, role, approval_status, organization_id, created_at'),
      supabaseAdmin.from('projects').select('id, status, contract_value, revenue_collected, organization_id, created_at'),
      supabaseAdmin.from('commissions').select('id, amount, status, organization_id, created_at'),
      supabaseAdmin.from('activity_log').select('id, entity_type, action, details, created_at, organization_id').order('created_at', { ascending: false }).limit(50),
    ]);

    const allOrgs = orgs || [];
    const allProfiles = profiles || [];
    const allProjects = projects || [];
    const allCommissions = commissions || [];

    // System-wide KPIs
    const totalOrgs = allOrgs.length;
    const totalUsers = allProfiles.length;
    const approvedUsers = allProfiles.filter(p => p.approval_status === 'approved').length;
    const pendingUsers = allProfiles.filter(p => p.approval_status === 'pending').length;
    const totalProjects = allProjects.length;
    const totalPipeline = allProjects.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
    const totalCollected = allProjects.reduce((s, p) => s + Number(p.revenue_collected ?? 0), 0);
    const totalCommissionValue = allCommissions.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const completedProjects = allProjects.filter(p => p.status === 'completed').length;
    const activeProjects = allProjects.filter(p => p.status === 'in_progress').length;

    // Growth: signups in last 30 days vs prior 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const recentSignups = allProfiles.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length;
    const priorSignups = allProfiles.filter(p => {
      const d = new Date(p.created_at);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    }).length;

    const recentProjects = allProjects.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length;
    const priorProjects = allProjects.filter(p => {
      const d = new Date(p.created_at);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    }).length;

    // Per-org breakdown
    const orgMap = new Map(allOrgs.map(o => [o.id, o.name]));
    const orgStats: Record<string, { name: string; members: number; projects: number; pipeline: number; collected: number }> = {};
    for (const org of allOrgs) {
      orgStats[org.id] = { name: org.name, members: 0, projects: 0, pipeline: 0, collected: 0 };
    }
    for (const p of allProfiles) {
      if (p.organization_id && orgStats[p.organization_id]) {
        orgStats[p.organization_id].members++;
      }
    }
    for (const p of allProjects) {
      if (p.organization_id && orgStats[p.organization_id]) {
        orgStats[p.organization_id].projects++;
        orgStats[p.organization_id].pipeline += Number(p.contract_value ?? 0);
        orgStats[p.organization_id].collected += Number(p.revenue_collected ?? 0);
      }
    }

    // Role distribution
    const roleCounts: Record<string, number> = {};
    for (const p of allProfiles) {
      roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
    }

    // Monthly signup trend (last 6 months)
    const monthlySignups: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = allProfiles.filter(p => {
        const cd = new Date(p.created_at);
        return cd >= d && cd < nextMonth;
      }).length;
      monthlySignups.push({
        month: d.toLocaleString('en', { month: 'short' }),
        count,
      });
    }

    // Resolve org names for activity log
    const activityWithOrg = (recentActivity || []).map(a => ({
      ...a,
      org_name: a.organization_id ? orgMap.get(a.organization_id) || 'Unknown' : 'System',
    }));

    return NextResponse.json({
      kpis: {
        totalOrgs,
        totalUsers,
        approvedUsers,
        pendingUsers,
        totalProjects,
        completedProjects,
        activeProjects,
        totalPipeline,
        totalCollected,
        totalCommissionValue,
        recentSignups,
        priorSignups,
        recentProjects,
        priorProjects,
      },
      orgStats: Object.values(orgStats),
      roleCounts,
      monthlySignups,
      recentActivity: activityWithOrg,
    });
  } catch (err: any) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
