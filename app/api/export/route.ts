import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const type = req.nextUrl.searchParams.get("type") || "invoices";

  if (type === "invoices") {
    const { data: projects } = await supabase
      .from("projects")
      .select("name, client_name, contract_value, revenue_collected, status, created_at, profiles(full_name)")
      .order("created_at", { ascending: false });

    const headers = ["Project", "Client", "Sales Rep", "Contract Value", "Collected", "Outstanding", "Status", "Date"];
    const rows = (projects || []).map((p: any) => [
      p.name || "",
      p.client_name || "",
      p.profiles?.full_name || "",
      String(p.contract_value || 0),
      String(p.revenue_collected || 0),
      String((p.contract_value || 0) - (p.revenue_collected || 0)),
      p.status || "",
      p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
    ]);

    return new NextResponse(toCSV(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  if (type === "commissions") {
    const { data: commissions } = await supabase
      .from("commissions")
      .select("amount, status, payout_date, created_at, profiles(full_name), projects(name)")
      .order("created_at", { ascending: false });

    const headers = ["Sales Rep", "Project", "Amount", "Status", "Payout Date", "Created"];
    const rows = (commissions || []).map((c: any) => [
      c.profiles?.full_name || "",
      c.projects?.name || "",
      String(c.amount || 0),
      c.status || "",
      c.payout_date ? new Date(c.payout_date).toLocaleDateString() : "",
      c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
    ]);

    return new NextResponse(toCSV(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="commissions-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  if (type === "payroll") {
    const { data: commissions } = await supabase
      .from("commissions")
      .select("sales_rep_id, amount, status, profiles(full_name)")
      .eq("status", "unpaid");

    // Aggregate by rep
    const byRep = new Map<string, { name: string; total: number; count: number }>();
    for (const c of commissions || []) {
      const entry = byRep.get(c.sales_rep_id) || { name: (c.profiles as any)?.full_name || "", total: 0, count: 0 };
      entry.total += Number(c.amount || 0);
      entry.count += 1;
      byRep.set(c.sales_rep_id, entry);
    }

    const headers = ["Sales Rep", "Unpaid Commissions", "Total Amount"];
    const rows = Array.from(byRep.values()).map((r) => [
      r.name,
      String(r.count),
      String(r.total.toFixed(2)),
    ]);

    return new NextResponse(toCSV(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-commissions-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid export type. Use: invoices, commissions, payroll" }, { status: 400 });
}
