import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { DashboardSummary } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createServerClient();

    const [
      productsRes,
      alertsRes,
      warehousesRes,
      analyticsRes,
      syncRes,
    ] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("alerts").select("severity").eq("resolved", false),
      supabase.from("warehouses").select("id", { count: "exact", head: true }),
      supabase.from("product_analytics").select("health_score,classification,days_to_stockout,expiry_risk_score"),
      supabase.from("sync_logs").select("synced_at,status").order("synced_at", { ascending: false }).limit(1),
    ]);

    const alerts      = alertsRes.data ?? [];
    const analytics   = analyticsRes.data ?? [];
    const syncLog     = syncRes.data?.[0] ?? null;

    const avgHealth   = analytics.length
      ? analytics.reduce((s, r) => s + (r.health_score ?? 0), 0) / analytics.length
      : 0;

    const summary: DashboardSummary = {
      total_products:      productsRes.count ?? 0,
      critical_alerts:     alerts.filter((a) => a.severity === "critical").length,
      warning_alerts:      alerts.filter((a) => a.severity === "warning").length,
      warehouses_count:    warehousesRes.count ?? 0,
      avg_health_score:    Math.round(avgHealth * 10) / 10,
      stockout_risk_count: analytics.filter((r) => r.days_to_stockout !== null && r.days_to_stockout < 14).length,
      expiry_risk_count:   analytics.filter((r) => (r.expiry_risk_score ?? 0) > 70).length,
      dead_stock_count:    analytics.filter((r) => r.classification === "Dead Stock").length,
      last_synced_at:      syncLog?.synced_at ?? null,
      last_sync_status:    syncLog?.status ?? null,
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[dashboard/summary]", err);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
