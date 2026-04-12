import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    const supabase = createServerClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    const { data: alerts, error } = await supabase
      .from("shrinkage_alerts")
      .select("created_at, variance_qty, severity, products(unit_cost)")
      .gte("created_at", startDateStr)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Calculate actual value lost using variance_qty * product cost (avg ₹50/unit)
    const avgUnitCost = 50;
    const dailyData: Record<string, { amount: number; alerts_count: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dateKey = d.toISOString().split("T")[0];
      dailyData[dateKey] = { amount: 0, alerts_count: 0 };
    }

    let totalAmount = 0;
    let totalAlerts = 0;

    for (const alert of alerts || []) {
      const dateKey = alert.created_at.split("T")[0];
      if (dailyData[dateKey]) {
        const unitCost = (alert as any).products?.unit_cost || avgUnitCost;
        const amount = Math.abs(alert.variance_qty || 0) * unitCost;
        dailyData[dateKey].amount += amount;
        dailyData[dateKey].alerts_count += 1;
        totalAmount += amount;
        totalAlerts++;
      }
    }

    const trendData = Object.entries(dailyData).map(([date, data]) => ({
      date,
      amount: Math.round(data.amount),
      alerts_count: data.alerts_count,
    }));

    const last7Days = trendData.slice(-7);
    const movingAvg = last7Days.reduce((sum, d) => sum + d.amount, 0) / 7;

    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(startDate);

    const prevAlerts = await supabase
      .from("shrinkage_alerts")
      .select("variance_qty")
      .gte("created_at", prevStart.toISOString())
      .lt("created_at", prevEnd.toISOString());

    const prevAmount = (prevAlerts.data || []).reduce((sum, a) => sum + Math.abs(a.variance_qty || 0) * avgUnitCost, 0);
    const trend = prevAmount > 0 ? ((totalAmount - prevAmount) / prevAmount) * 100 : 0;

    return NextResponse.json({
      data: trendData,
      summary: {
        total_alerts: totalAlerts,
        total_amount: Math.round(totalAmount),
        moving_avg_7d: Math.round(movingAvg),
        trend_pct: Math.round(trend * 10) / 10,
      },
    });
  } catch (err) {
    console.error("[shrinkage-trend]", err);
    return NextResponse.json({ error: "Failed to fetch shrinkage trend" }, { status: 500 });
  }
}