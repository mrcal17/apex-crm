import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function escapeIcal(str: string): string {
  return str.replace(/[\\;,\n]/g, (m) => {
    if (m === "\n") return "\\n";
    return "\\" + m;
  });
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(req: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch permits with expiration dates
  const { data: permits } = await supabase
    .from("permits")
    .select("id, agency, permit_number, status, expiration_date, projects(name)")
    .not("expiration_date", "is", null);

  // Fetch scheduled follow-ups
  const { data: followups } = await supabase
    .from("scheduled_followups")
    .select("id, title, description, due_at, channel, completed, projects(name)")
    .eq("completed", false);

  const events: string[] = [];

  // Permit expiration events
  for (const permit of permits || []) {
    if (!permit.expiration_date) continue;
    const expDate = new Date(permit.expiration_date);
    const projName = (permit.projects as any)?.name || "Unknown Project";
    const uid = `permit-${permit.id}@gchcrm`;
    events.push([
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${permit.expiration_date.replace(/-/g, "")}`,
      `SUMMARY:${escapeIcal(`Permit Expires: ${permit.agency || permit.permit_number || "Permit"} - ${projName}`)}`,
      `DESCRIPTION:${escapeIcal(`Permit #${permit.permit_number || "N/A"} for ${projName}. Status: ${permit.status}`)}`,
      "STATUS:CONFIRMED",
      `DTSTAMP:${formatIcalDate(new Date())}`,
      "END:VEVENT",
    ].join("\r\n"));
  }

  // Follow-up events
  for (const fu of followups || []) {
    if (!fu.due_at) continue;
    const dueDate = new Date(fu.due_at);
    const endDate = new Date(dueDate.getTime() + 3600000); // 1 hour duration
    const projName = (fu.projects as any)?.name || "";
    const uid = `followup-${fu.id}@gchcrm`;
    events.push([
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART:${formatIcalDate(dueDate)}`,
      `DTEND:${formatIcalDate(endDate)}`,
      `SUMMARY:${escapeIcal(`${fu.channel?.toUpperCase() || "FOLLOW-UP"}: ${fu.title}${projName ? ` - ${projName}` : ""}`)}`,
      `DESCRIPTION:${escapeIcal(fu.description || "")}`,
      "STATUS:CONFIRMED",
      `DTSTAMP:${formatIcalDate(new Date())}`,
      "END:VEVENT",
    ].join("\r\n"));
  }

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GCH CRM//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:GCH CRM Calendar",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gch-crm.ics"',
    },
  });
}
