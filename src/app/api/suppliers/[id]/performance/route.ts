import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    const supabase = createServerClient();

    const { data: performance, error: perfError } = await supabase
      .from("supplier_performance")
      .select("*")
      .eq("supplier_id", id)
      .single();

    if (perfError && perfError.code !== "PGRST116") {
      return NextResponse.json({ error: perfError.message }, { status: 500 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const { data: orders, error: ordersError } = await supabase
      .from("supplier_orders")
      .select("*, products(id, name, category)")
      .eq("supplier_id", id)
      .gte("order_date", cutoffStr)
      .order("order_date", { ascending: false });

    if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

    const dailyOnTime: Record<string, { on_time: number; total: number }> = {};
    for (const order of orders || []) {
      if (order.status === "received") {
        const dateKey = order.order_date;
        if (!dailyOnTime[dateKey]) dailyOnTime[dateKey] = { on_time: 0, total: 0 };
        dailyOnTime[dateKey].total++;
        if (order.on_time) dailyOnTime[dateKey].on_time++;
      }
    }

    const chartData = Object.entries(dailyOnTime)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { on_time, total }]) => ({
        date,
        on_time_pct: total > 0 ? Math.round((on_time / total) * 100) : 0,
        orders_count: total,
      }));

    return NextResponse.json({
      performance: performance || {
        on_time_delivery_pct: 0,
        quality_score: 100,
        avg_lead_time_days: 0,
        last_30_days_orders: 0,
        total_cost_30_days: 0,
        reliability_score: 0,
      },
      orders: orders || [],
      chart_data: chartData,
    });
  } catch (error: any) {
    console.error("[suppliers/[id]/performance GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
