import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  
  const warehouseId = searchParams.get("warehouse_id");
  const days = parseInt(searchParams.get("days") || "30");
  
  if (!warehouseId) {
    return NextResponse.json({ error: "warehouse_id is required" }, { status: 400 });
  }
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data: alerts, error } = await supabase
      .from("shrinkage_alerts")
      .select(`
        *,
        products (id, name, unit_cost, default_gst_rate)
      `)
      .eq("warehouse_id", warehouseId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    const byBin: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    
    let totalVarianceValue = 0;
    
    for (const alert of alerts || []) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byType[alert.alert_type] = (byType[alert.alert_type] || 0) + 1;
      byBin[alert.bin_location] = (byBin[alert.bin_location] || 0) + 1;
      
      const day = alert.created_at?.split("T")[0] || "";
      byDay[day] = (byDay[day] || 0) + 1;
      
      const product = alert.products;
      if (product?.unit_cost) {
        totalVarianceValue += Math.abs(alert.variance_qty || 0) * product.unit_cost;
      }
      
      if (product?.name) {
        byProduct[product.name] = (byProduct[product.name] || 0) + 1;
      }
    }
    
    const sortedProducts = Object.entries(byProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    
    const sortedBins = Object.entries(byBin)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    
    return NextResponse.json({
      period_days: days,
      total_alerts: alerts?.length || 0,
      by_severity: bySeverity,
      by_type: byType,
      by_product: sortedProducts,
      by_bin: sortedBins,
      by_day: byDay,
      total_variance_value: totalVarianceValue,
      critical_rate: (bySeverity.critical || 0) / (alerts?.length || 1)
    });
  } catch (err) {
    console.error("[shrinkage-analytics GET]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
