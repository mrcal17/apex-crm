import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// GET: List registered webhook endpoints
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "webhook_endpoints")
    .maybeSingle();

  const endpoints = data?.value ? JSON.parse(data.value) : [];
  return NextResponse.json({ endpoints });
}

// POST: Register a webhook endpoint OR emit a test event
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await req.json();

  if (body.action === "register") {
    const { url, events } = body;
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    // Load existing endpoints
    const { data: existing } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "webhook_endpoints")
      .maybeSingle();

    const endpoints = existing?.value ? JSON.parse(existing.value) : [];
    endpoints.push({
      id: crypto.randomUUID(),
      url,
      events: events || ["*"],
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("settings")
      .upsert({ key: "webhook_endpoints", value: JSON.stringify(endpoints), updated_at: new Date().toISOString() }, { onConflict: "key" });

    return NextResponse.json({ success: true, endpoints });
  }

  if (body.action === "test") {
    const { url } = body;
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          data: { message: "Test webhook from GCH CRM" },
        }),
      });
      return NextResponse.json({ success: true, status: res.status });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE: Remove a webhook endpoint
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await req.json();
  const { id } = body;

  const { data: existing } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "webhook_endpoints")
    .maybeSingle();

  let endpoints = existing?.value ? JSON.parse(existing.value) : [];
  endpoints = endpoints.filter((e: any) => e.id !== id);

  await supabase
    .from("settings")
    .upsert({ key: "webhook_endpoints", value: JSON.stringify(endpoints), updated_at: new Date().toISOString() }, { onConflict: "key" });

  return NextResponse.json({ success: true, endpoints });
}
