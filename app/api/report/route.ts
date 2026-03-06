import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: NextRequest) {
  // Auth check: verify the user's token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's org for scoping
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .eq('approval_status', 'approved')
    .single();

  if (!profile || !profile.organization_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = supabaseAdmin;
  const orgId = profile.organization_id;
  const userRole = profile.role;
  const type = req.nextUrl.searchParams.get('type') || 'commissions';
  const format = req.nextUrl.searchParams.get('format') || 'csv';

  // Get user's profile ID for role-based filtering
  const { data: fullProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  try {
    if (type === 'commissions') {
      let commQuery = supabase
        .from('commissions')
        .select('*, profiles(full_name), projects!inner(name, organization_id)')
        .eq('projects.organization_id', orgId)
        .order('created_at', { ascending: false });

      // Sales reps can only see their own commissions
      if (userRole === 'sales_rep' && fullProfile) {
        commQuery = commQuery.eq('profile_id', fullProfile.id);
      }

      const { data: commissions } = await commQuery;

      if (format === 'csv') {
        const lines: string[] = [csvRow(['Sales Rep', 'Project', 'Amount', 'Status', 'Date'])];
        for (const c of commissions || []) {
          lines.push(csvRow([
            c.profiles?.full_name || 'Unknown',
            c.projects?.name || 'Unknown',
            Number(c.amount ?? 0).toFixed(2),
            c.status,
            c.payout_date ? new Date(c.payout_date).toLocaleDateString() : c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
          ]));
        }
        return new NextResponse(lines.join('\n'), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="commission-report-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }

      const lines: string[] = [];
      lines.push('COMMISSION PAYOUT REPORT');
      lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
      lines.push('='.repeat(80));
      lines.push('');
      let totalPaid = 0, totalUnpaid = 0;
      lines.push(padRow(['Sales Rep', 'Project', 'Amount', 'Status', 'Date']));
      lines.push('-'.repeat(80));
      for (const c of commissions || []) {
        const amt = Number(c.amount ?? 0);
        if (c.status === 'paid') totalPaid += amt;
        else totalUnpaid += amt;
        lines.push(padRow([
          c.profiles?.full_name || 'Unknown', c.projects?.name || 'Unknown',
          `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, c.status,
          c.payout_date ? new Date(c.payout_date).toLocaleDateString() : c.created_at ? new Date(c.created_at).toLocaleDateString() : '—',
        ]));
      }
      lines.push('-'.repeat(80));
      lines.push('');
      lines.push(`Total Paid:   $${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      lines.push(`Total Unpaid: $${totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      lines.push(`Grand Total:  $${(totalPaid + totalUnpaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="commission-report-${new Date().toISOString().split('T')[0]}.txt"`,
        },
      });
    }

    if (type === 'projects') {
      let projQuery = supabase
        .from('projects')
        .select('*, profiles(full_name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      // Sales reps can only see their own projects
      if (userRole === 'sales_rep' && fullProfile) {
        projQuery = projQuery.eq('assigned_to', fullProfile.id);
      }

      const { data: projects } = await projQuery;

      if (format === 'csv') {
        const lines: string[] = [csvRow(['Project', 'Client', 'Sales Rep', 'Contract Value', 'Revenue Collected', 'Status', 'Created'])];
        for (const p of projects || []) {
          lines.push(csvRow([
            p.name || '', p.client_name || '', p.profiles?.full_name || '',
            Number(p.contract_value ?? 0).toFixed(2), Number(p.revenue_collected ?? 0).toFixed(2),
            p.status || '', p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
          ]));
        }
        return new NextResponse(lines.join('\n'), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="project-report-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }

      const lines: string[] = [];
      lines.push('PROJECT SUMMARY REPORT');
      lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
      lines.push('='.repeat(90));
      lines.push('');

      lines.push(padRow(['Project', 'Client', 'Sales Rep', 'Value', 'Collected', 'Status'], [25, 20, 15, 12, 12, 10]));
      lines.push('-'.repeat(90));

      let totalPipeline = 0, totalCollected = 0;
      for (const p of projects || []) {
        const val = Number(p.contract_value ?? 0);
        const col = Number(p.revenue_collected ?? 0);
        totalPipeline += val;
        totalCollected += col;
        lines.push(padRow([
          p.name || '—',
          p.client_name || '—',
          p.profiles?.full_name || '—',
          `$${val.toLocaleString()}`,
          `$${col.toLocaleString()}`,
          p.status || '—',
        ], [25, 20, 15, 12, 12, 10]));
      }

      lines.push('-'.repeat(90));
      lines.push('');
      lines.push(`Total Pipeline:  $${totalPipeline.toLocaleString()}`);
      lines.push(`Total Collected: $${totalCollected.toLocaleString()}`);
      lines.push(`Projects: ${(projects || []).length}`);

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="project-report-${new Date().toISOString().split('T')[0]}.txt"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function csvRow(cols: string[]): string {
  return cols.map(c => escapeCsv(c)).join(',');
}

function padRow(cols: string[], widths?: number[]): string {
  const defaultWidths = [18, 18, 15, 15, 12];
  const w = widths || defaultWidths;
  return cols.map((c, i) => c.substring(0, w[i] || 15).padEnd(w[i] || 15)).join(' ');
}
