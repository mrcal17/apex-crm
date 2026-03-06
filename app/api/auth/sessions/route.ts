import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST — register a new session (called on login)
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { sessionToken, deviceInfo } = await req.json();
    if (!sessionToken) return NextResponse.json({ error: 'sessionToken required' }, { status: 400 });

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'Unknown';
    const device = deviceInfo || 'Unknown';

    // Check for existing session with same user, IP, and device
    const { data: existing } = await supabaseAdmin
      .from('user_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('ip_address', ip)
      .eq('device_info', device)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update existing session instead of creating a duplicate
      const { error } = await supabaseAdmin
        .from('user_sessions')
        .update({ session_token: sessionToken, last_active_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (error) {
        console.error('Failed to update session:', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
      return NextResponse.json({ id: existing.id });
    }

    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .insert({
        user_id: user.id,
        session_token: sessionToken,
        device_info: device,
        ip_address: ip,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to register session:', error);
      return NextResponse.json({ error: 'Failed to register session' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET — list all sessions for the current user
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('id, device_info, ip_address, created_at, last_active_at')
      .eq('user_id', user.id)
      .order('last_active_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE — revoke a specific session
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { sessionId, sessionToken } = await req.json();
    if (!sessionId && !sessionToken) {
      return NextResponse.json({ error: 'sessionId or sessionToken required' }, { status: 400 });
    }

    // Only allow deleting own sessions
    let query = supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('user_id', user.id);
    if (sessionId) query = query.eq('id', sessionId);
    else query = query.eq('session_token', sessionToken);

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
