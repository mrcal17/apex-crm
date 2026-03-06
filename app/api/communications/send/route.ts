import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, organization_id, role, full_name, email')
    .eq('auth_user_id', user.id)
    .eq('approval_status', 'approved')
    .single();

  if (!profile || !profile.organization_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { channel, to, subject, message, project_id, contact_id } = body;

  if (!channel || !to || !message) {
    return NextResponse.json({ error: 'Missing required fields: channel, to, message' }, { status: 400 });
  }

  if (channel !== 'email' && channel !== 'sms') {
    return NextResponse.json({ error: 'Channel must be "email" or "sms"' }, { status: 400 });
  }

  // Validate project belongs to user's org
  if (project_id) {
    const { data: proj } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('organization_id', profile.organization_id)
      .single();
    if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Validate contact belongs to user's org
  if (contact_id) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('id', contact_id)
      .eq('organization_id', profile.organization_id)
      .single();
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  try {
    let status = 'sent';

    if (channel === 'email') {
      // Stub: integrate SendGrid or similar when API keys are configured
      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (sendgridKey) {
        // TODO: Real SendGrid integration
        console.log(`[Email] Sending to ${to}: ${subject}`);
      } else {
        console.log(`[Email Stub] To: ${to}, Subject: ${subject}, Body: ${message}`);
      }
    } else {
      // Stub: integrate Twilio or similar when API keys are configured
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      if (twilioSid) {
        // TODO: Real Twilio integration
        console.log(`[SMS] Sending to ${to}: ${message}`);
      } else {
        console.log(`[SMS Stub] To: ${to}, Body: ${message}`);
      }
    }

    // Record the communication
    const { data: comm, error: insertError } = await supabaseAdmin
      .from('communications')
      .insert([{
        project_id: project_id || null,
        contact_id: contact_id || null,
        channel,
        direction: 'outbound',
        subject: subject || null,
        body: message,
        from: profile.email || profile.full_name,
        to,
        status,
        organization_id: profile.organization_id,
        metadata: { sent_by: profile.id, sent_by_name: profile.full_name },
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, communication: comm });
  } catch (err: any) {
    console.error('[Communications] Send error:', err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
