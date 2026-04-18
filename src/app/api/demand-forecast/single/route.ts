import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { product_id, warehouse_id, days_ahead } = await req.json();

    if (!product_id || !warehouse_id || !days_ahead) {
      return NextResponse.json(
        { error: "product_id, warehouse_id, and days_ahead required" },
        { status: 400 }
      );
    }

    if (![30, 60, 90].includes(days_ahead)) {
      return NextResponse.json(
        { error: "days_ahead must be 30, 60, or 90" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const movements = await supabase
      .from("stock_movements")
      .select("quantity, date")
      .eq("product_id", product_id)
      .eq("warehouse_id", warehouse_id)
      .eq("type", "out")
      .gte("date", cutoffStr)
      .order("date")
      .execute();

    if ((movements.data || []).length < 30) {
      return NextResponse.json(
        { error: "Insufficient history: need 30+ days of data" },
        { status: 400 }
      );
    }

    const dailyMap: Record<string, number> = {};
    for (const m of movements.data!) {
      dailyMap[m.date] = (dailyMap[m.date] || 0) + m.quantity;
    }

    const dates = Object.keys(dailyMap).sort();
    const dailyData = dates.map((d) => ({ ds: d, y: dailyMap[d] }));

    const firstWeek = dailyData.slice(0, 7);
    const lastWeek = dailyData.slice(-7);
    const firstAvg = firstWeek.reduce((a, b) => a + b.y, 0) / firstWeek.length;
    const lastAvg = lastWeek.reduce((a, b) => a + b.y, 0) / lastWeek.length;

    const predictedQty = lastAvg * days_ahead;
    const confidenceRange = predictedQty * 0.3;
    const confidenceScore = Math.min(100, Math.max(0, (1 - confidenceRange / (predictedQty + 1)) * 100));

    let trend: "rising" | "stable" | "falling" = "stable";
    if (lastAvg > firstAvg * 1.3) trend = "rising";
    else if (lastAvg < firstAvg * 0.7) trend = "falling";

    const forecast = {
      product_id,
      warehouse_id,
      forecast_date: new Date().toISOString().split("T")[0],
      days_ahead,
      predicted_qty: Math.round(predictedQty * 100) / 100,
      confidence_lower: Math.round(Math.max(0, predictedQty - confidenceRange) * 100) / 100,
      confidence_upper: Math.round((predictedQty + confidenceRange) * 100) / 100,
      confidence_score: Math.round(confidenceScore * 100) / 100,
      trend,
    };

    return NextResponse.json(forecast);
  } catch (err: any) {
    console.error("[demand-forecast/single POST]", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
