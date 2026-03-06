import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_IPS = (process.env.AUTO_CONFIRM_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get client IP from headers (Vercel/proxy sets these)
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '';

    if (!ALLOWED_IPS.includes(clientIp)) {
      // Not a whitelisted IP — silently return OK (don't reveal the check)
      return NextResponse.json({ confirmed: false });
    }

    // Auto-confirm the user's email via admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) {
      console.error('Auto-confirm failed:', error.message);
      return NextResponse.json({ confirmed: false });
    }

    return NextResponse.json({ confirmed: true });
  } catch {
    return NextResponse.json({ confirmed: false });
  }
}
