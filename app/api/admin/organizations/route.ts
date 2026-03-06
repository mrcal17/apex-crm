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

  const { data: orgs, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, join_code, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  // Get member counts per org
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('organization_id');

  const countMap: Record<string, number> = {};
  for (const p of profiles || []) {
    if (p.organization_id) {
      countMap[p.organization_id] = (countMap[p.organization_id] || 0) + 1;
    }
  }

  const orgsWithCounts = (orgs || []).map((org) => ({
    ...org,
    member_count: countMap[org.id] || 0,
  }));

  return NextResponse.json(orgsWithCounts);
}

export async function POST(req: NextRequest) {
  const profile = await getSuperadminProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Generate join code
  const { data: codeResult } = await supabaseAdmin.rpc('generate_join_code');
  const joinCode = codeResult || `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .insert({ name: name.trim(), slug, join_code: joinCode, created_by: profile.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  return NextResponse.json(org);
}

export async function DELETE(req: NextRequest) {
  const profile = await getSuperadminProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { orgId } = await req.json();
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  // Get all profile IDs in this org (for cascading deletes on FK tables)
  const { data: orgProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId);

  const profileIds = (orgProfiles || []).map((p) => p.id);

  // Delete org-scoped data
  await supabaseAdmin.from('activity_log').delete().eq('organization_id', orgId);
  await supabaseAdmin.from('client_contacts').delete().eq('organization_id', orgId);
  await supabaseAdmin.from('settings').delete().eq('organization_id', orgId);
  await supabaseAdmin.from('leads').delete().eq('organization_id', orgId);

  // Delete project-dependent data (permits, commissions, blueprints, project_notes) via projects
  const { data: orgProjects } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('organization_id', orgId);

  const projectIds = (orgProjects || []).map((p) => p.id);

  if (projectIds.length > 0) {
    await supabaseAdmin.from('permits').delete().in('project_id', projectIds);
    await supabaseAdmin.from('commissions').delete().in('project_id', projectIds);
    await supabaseAdmin.from('blueprints').delete().in('project_id', projectIds);
    await supabaseAdmin.from('project_notes').delete().in('project_id', projectIds);
  }

  // Delete projects
  await supabaseAdmin.from('projects').delete().eq('organization_id', orgId);

  // Delete profiles
  await supabaseAdmin.from('profiles').delete().eq('organization_id', orgId);

  // Delete the organization
  const { error } = await supabaseAdmin.from('organizations').delete().eq('id', orgId);

  if (error) {
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
