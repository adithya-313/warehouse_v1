import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { DemandForecast, ForecastSummary } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { warehouse_id } = await req.json();
  if (!warehouse_id) {
    return NextResponse.json({ error: "warehouse_id required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const inventory = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .eq("warehouse_id", warehouse_id)
    .execute();

  let forecasted = 0;
  let errors = 0;
  let rising = 0;
  let stable = 0;
  let falling = 0;
  const confidences: number[] = [];

  for (const item of inventory.data || []) {
    const movementsCount = await supabase
      .from("stock_movements")
      .select("id", { count: "exact" })
      .eq("product_id", item.product_id)
      .eq("warehouse_id", warehouse_id)
      .eq("type", "out")
      .gte("date", cutoffStr)
      .execute();

    if ((movementsCount.count || 0) < 30) continue;

    for (const days of [30, 60, 90] as const) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/demand-forecast/single`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: item.product_id,
              warehouse_id,
              days_ahead: days,
            }),
          }
        );

        if (response.ok) {
          const forecast = await response.json();
          await supabase
            .from("demand_forecast")
            .upsert(forecast, { onConflict: "product_id,warehouse_id,days_ahead" })
            .execute();
          forecasted++;
          if (forecast.trend === "rising") rising++;
          else if (forecast.trend === "falling") falling++;
          else stable++;
          confidences.push(forecast.confidence_score);
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }
  }

  const summary: ForecastSummary = {
    total_products: (inventory.data || []).length,
    forecasted,
    errors,
    rising,
    stable,
    falling,
    avg_confidence: confidences.length
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : 0,
    warehouse_id,
    last_run: new Date().toISOString(),
  };

  return NextResponse.json(summary);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const product_id = searchParams.get("product_id");
  const warehouse_id = searchParams.get("warehouse_id");
  const days_ahead = searchParams.get("days_ahead");

  const supabase = createServerClient();

  if (product_id && warehouse_id) {
    let query = supabase
      .from("demand_forecast")
      .select("*, products(id, name, category, unit), warehouses(id, name, location)")
      .eq("product_id", product_id)
      .eq("warehouse_id", warehouse_id)
      .order("days_ahead");

    if (days_ahead) {
      query = query.eq("days_ahead", parseInt(days_ahead));
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (warehouse_id) {
    const { data, error } = await supabase
      .from("demand_forecast")
      .select("*, products(id, name, category, unit), warehouses(id, name, location)")
      .eq("warehouse_id", warehouse_id)
      .order("product_id")
      .order("days_ahead");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "warehouse_id required" }, { status: 400 });
}
