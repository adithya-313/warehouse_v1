import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateDemandSeries, TrendType } from "@/lib/simulation-engine";

const WAREHOUSE_ID = "a1000000-0000-0000-0000-000000000001";

export async function POST() {
  try {
    const supabase = createServerClient();

    // First, wipe all existing forecasts
    await supabase
      .from("demand_forecasts")
      .delete()
      .eq("warehouse_id", WAREHOUSE_ID);

    console.log("[FORECAST] Wiped existing forecasts");

    const productsRes = await supabase
      .from("products")
      .select("id, name, category")
      .limit(50);

    if (productsRes.error) throw productsRes.error;
    const products = productsRes.data || [];

    const inventoryRes = await supabase
      .from("inventory")
      .select("product_id, quantity");

    if (inventoryRes.error) throw inventoryRes.error;
    const inventoryMap = new Map(
      inventoryRes.data?.map((i) => [i.product_id, i.quantity]) || []
    );

    const forecasts: any[] = [];

    for (const product of products) {
      const currentStock = inventoryMap.get(product.id) || 100;
      
      // Determine trend based on inventory level
      let trend: TrendType = "stable";
      let baseValue = 10;
      let dailySlope = 0.005;
      
      if (currentStock > 100) {
        trend = "rising";
        baseValue = Math.max(5, Math.round(currentStock / 30));
        dailySlope = 0.008;
      } else if (currentStock < 50) {
        trend = "falling";
        baseValue = Math.max(3, Math.round(currentStock / 40));
        dailySlope = 0.01;
      } else {
        // stable
        baseValue = Math.max(5, Math.round(currentStock / 25));
        dailySlope = 0.003;
      }

      const series = generateDemandSeries(90, {
        baseValue,
        trend,
        dailySlope,
        seasonalityPeriod: 7,
        noiseLevel: 0.05,
        floorValue: 5,
        confidenceGrowth: 0.008,
      });

      for (const point of series) {
        forecasts.push({
          product_id: product.id,
          warehouse_id: WAREHOUSE_ID,
          forecast_date: point.date,
          predicted_qty: point.predicted_qty,
          confidence_lower: point.confidence_lower,
          confidence_upper: point.confidence_upper,
        });
      }
    }

    if (forecasts.length > 0) {
      const { error: insertError } = await supabase
        .from("demand_forecasts")
        .upsert(forecasts, {
          onConflict: "product_id,warehouse_id,forecast_date",
        });

      if (insertError) {
        console.error("[FORECAST INSERT ERROR]", insertError);
        throw insertError;
      }

      console.log("[FORECAST GENERATED] Total forecasts:", forecasts.length);
    }

    return NextResponse.json({
      success: true,
      forecasts_generated: forecasts.length,
      products_affected: products.length,
    });
  } catch (err: any) {
    console.error("[FORECAST GENERATE ERROR]", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate forecasts" },
      { status: 500 }
    );
  }
}