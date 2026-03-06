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

// GET: list users across all orgs
// ?filter=pending (default) — pending first-account users only
// ?filter=all — all users for management
export async function GET(req: NextRequest) {
  const profile = await getSuperadminProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const filter = req.nextUrl.searchParams.get('filter') || 'pending';

  if (filter === 'all') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, approval_status, organization_id, created_at, organizations!profiles_organization_id_fkey(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  }

  // Default: pending first-account users
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, approval_status, organization_id, created_at, organizations!profiles_organization_id_fkey(name)')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: approvedProfiles } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('approval_status', 'approved');

  const orgsWithApprovedMembers = new Set<string>();
  for (const p of approvedProfiles || []) {
    if (p.organization_id) orgsWithApprovedMembers.add(p.organization_id);
  }

  const filtered = (data || []).filter((user) =>
    !user.organization_id || !orgsWithApprovedMembers.has(user.organization_id)
  );

  return NextResponse.json(filtered);
}

// PATCH: approve or reject a user (superadmin cross-org)
export async function PATCH(req: NextRequest) {
  const profile = await getSuperadminProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { profileId, action, role } = await req.json();
  if (!profileId || !action) {
    return NextResponse.json({ error: 'profileId and action are required' }, { status: 400 });
  }

  if (action === 'approve') {
    const assignRole = role || 'admin';
    const validRoles = ['admin', 'manager', 'sales_rep'];
    if (!validRoles.includes(assignRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        approval_status: 'approved',
        role: assignRole,
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('id', profileId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// PUT: update user role or deactivate (for all-users management)
export async function PUT(req: NextRequest) {
  const profile = await getSuperadminProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { profileId, role, deactivate } = await req.json();
  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  // Don't allow modifying self
  if (profileId === profile.id) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 });
  }

  const updates: Record<string, any> = {};

  if (deactivate === true) {
    updates.approval_status = 'rejected';
  } else if (deactivate === false) {
    updates.approval_status = 'approved';
  }

  if (role) {
    const validRoles = ['admin', 'manager', 'sales_rep'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    updates.role = role;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
