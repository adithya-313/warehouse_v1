import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { DemandTrendData } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product_id = searchParams.get("product_id");
    const warehouse_id = searchParams.get("warehouse_id");

    if (!product_id || !warehouse_id) {
      return NextResponse.json(
        { error: "product_id and warehouse_id required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const todayStr = today.toISOString().split("T")[0];
    const startStr = start.toISOString().split("T")[0];

    const { data: movements } = await supabase
      .from("stock_movements")
      .select("quantity, date")
      .eq("product_id", product_id)
      .eq("warehouse_id", warehouse_id)
      .eq("type", "out")
      .gte("date", startStr)
      .lte("date", todayStr)
      .order("date");

    const dailyMap: Record<string, number> = {};
    for (const m of movements || []) {
      dailyMap[m.date] = (dailyMap[m.date] || 0) + m.quantity;
    }

    const historical = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, quantity]) => ({ date, quantity }));

    const forecasts = await supabase
      .from("demand_forecast")
      .select("*, products(id, name, category)")
      .eq("product_id", product_id)
      .eq("warehouse_id", warehouse_id)
      .order("days_ahead");

    const forecast = forecasts.data?.[0];
    const trend: "rising" | "stable" | "falling" = forecast?.trend || "stable";

    const forecastData: DemandTrendData["forecast"] = [];
    if (forecast) {
      const baseDate = new Date();
      const predQty = forecast.predicted_qty / 90;
      const range = forecast.confidence_upper - forecast.confidence_lower;

      for (let i = 1; i <= 90; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dailyPred = predQty * i;
        forecastData.push({
          date: dateStr,
          predicted: Math.round(dailyPred * 100) / 100,
          lower: Math.round(Math.max(0, dailyPred - range * (i / 90)) * 100) / 100,
          upper: Math.round((dailyPred + range * (i / 90)) * 100) / 100,
        });
      }
    }

    const result: DemandTrendData = {
      historical,
      forecast: forecastData,
      trend,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[demand-trends GET]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
