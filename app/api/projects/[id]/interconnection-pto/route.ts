import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INTERCONNECTION_STATUSES = ['not_started', 'submitted', 'approved', 'denied'] as const;
const PTO_STATUSES = ['not_started', 'submitted', 'granted'] as const;

type InterconnectionStatus = typeof INTERCONNECTION_STATUSES[number];
type PtoStatus = typeof PTO_STATUSES[number];

async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET /api/projects/[id]/interconnection-pto
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('interconnection_status, interconnection_submitted_at, interconnection_approved_at, pto_status, pto_submitted_at, pto_granted_at, utility_name, utility_checklist')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/projects/[id]/interconnection-pto
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    const now = new Date().toISOString();

    // Validate and apply interconnection_status
    if (body.interconnection_status !== undefined) {
      if (!INTERCONNECTION_STATUSES.includes(body.interconnection_status)) {
        return NextResponse.json({ error: `Invalid interconnection_status. Must be one of: ${INTERCONNECTION_STATUSES.join(', ')}` }, { status: 400 });
      }
      updates.interconnection_status = body.interconnection_status;
      if (body.interconnection_status === 'submitted') {
        updates.interconnection_submitted_at = now;
      } else if (body.interconnection_status === 'approved') {
        updates.interconnection_approved_at = now;
      } else if (body.interconnection_status === 'not_started') {
        updates.interconnection_submitted_at = null;
        updates.interconnection_approved_at = null;
      }
    }

    // Validate and apply pto_status
    if (body.pto_status !== undefined) {
      if (!PTO_STATUSES.includes(body.pto_status)) {
        return NextResponse.json({ error: `Invalid pto_status. Must be one of: ${PTO_STATUSES.join(', ')}` }, { status: 400 });
      }
      updates.pto_status = body.pto_status;
      if (body.pto_status === 'submitted') {
        updates.pto_submitted_at = now;
      } else if (body.pto_status === 'granted') {
        updates.pto_granted_at = now;
      } else if (body.pto_status === 'not_started') {
        updates.pto_submitted_at = null;
        updates.pto_granted_at = null;
      }
    }

    // Apply utility_name
    if (body.utility_name !== undefined) {
      updates.utility_name = body.utility_name;
    }

    // Validate and apply utility_checklist
    if (body.utility_checklist !== undefined) {
      if (!Array.isArray(body.utility_checklist)) {
        return NextResponse.json({ error: 'utility_checklist must be an array' }, { status: 400 });
      }
      for (const item of body.utility_checklist) {
        if (typeof item.name !== 'string' || typeof item.required !== 'boolean' || typeof item.completed !== 'boolean') {
          return NextResponse.json({ error: 'Each checklist item must have: name (string), required (boolean), completed (boolean)' }, { status: 400 });
        }
      }
      updates.utility_checklist = body.utility_checklist;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select('id, interconnection_status, interconnection_submitted_at, interconnection_approved_at, pto_status, pto_submitted_at, pto_granted_at, utility_name, utility_checklist')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
