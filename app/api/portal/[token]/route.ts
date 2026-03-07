import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { token } = params;

  // Look up portal token
  const { data: tokenRecord, error: tokenErr } = await supabase
    .from("portal_tokens")
    .select("project_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRecord) {
    return NextResponse.json({ error: "Invalid portal link" }, { status: 404 });
  }

  // Check expiration
  if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.json({ error: "This portal link has expired" }, { status: 410 });
  }

  // Fetch project (limited fields for security)
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, client_name, status, contract_value, revenue_collected, created_at, address, interconnection_status, pto_status")
    .eq("id", tokenRecord.project_id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch permits
  const { data: permits } = await supabase
    .from("permits")
    .select("id, agency, permit_number, status, expiration_date")
    .eq("project_id", tokenRecord.project_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ project, permits: permits || [] });
}
