export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ProductRow, HealthLabel } from "@/lib/types";

const WAREHOUSE_ID = "a1000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const supabase = createServerClient();

    const [productsRes, movementsRes, forecastsRes] = await Promise.all([
      supabase.from("products").select(`
        id, name, category, unit, expiry_date,
        inventory ( quantity, reorder_point, warehouse_id )
      `),
      supabase.from("stock_movements")
        .select("product_id, date")
        .order("date", { ascending: false }),
      supabase.from("demand_forecasts")
        .select("product_id, forecast_date, predicted_qty")
        .eq("warehouse_id", WAREHOUSE_ID),
    ]);

    if (productsRes.error) throw productsRes.error;

    console.log("[DEBUG API] Total Products fetched:", productsRes.data?.length);
    console.log("[DEBUG API] Total Forecasts fetched:", forecastsRes.data?.length);
    console.log("[DEBUG API] WAREHOUSE_ID used:", WAREHOUSE_ID);

    const movementDates = new Map<string, Set<string>>();
    for (const m of movementsRes.data ?? []) {
      if (!movementDates.has(m.product_id)) {
        movementDates.set(m.product_id, new Set());
      }
      movementDates.get(m.product_id)!.add(m.date);
    }

    const forecastingEligible = new Map<string, boolean>();
    for (const [productId, dates] of Array.from(movementDates.entries())) {
      forecastingEligible.set(productId, dates.size >= 14);
    }

    const forecastByProduct = new Map<string, number[]>();
    for (const f of forecastsRes.data ?? []) {
      if (!forecastByProduct.has(f.product_id)) {
        forecastByProduct.set(f.product_id, []);
      }
      forecastByProduct.get(f.product_id)!.push(f.predicted_qty || 0);
    }

    const forecastMap = new Map<string, any>();
    for (const [productId, qtyArray] of Array.from(forecastByProduct.entries())) {
      const sum = qtyArray.reduce((a: number, b: number) => a + b, 0);
      const avgBurn = qtyArray.length > 0 ? sum / qtyArray.length : 0;
      const safeBurn = Math.max(avgBurn, 0.001);
      forecastMap.set(productId, { burn_rate: safeBurn });
    }

    const rows: ProductRow[] = (productsRes.data ?? []).map((p) => {
      const inv = Array.isArray(p.inventory) ? p.inventory[0] : (p.inventory as any);
      const fc = forecastMap.get(p.id) || {};
      const burnRate = (fc?.burn_rate != null && fc.burn_rate > 0) ? fc.burn_rate : 0.001;
      const stockoutDate = fc?.predicted_stockout_date;

      let daysToStockout: number | null = null;
      if (burnRate > 0 && inv?.quantity != null) {
        daysToStockout = Math.floor(inv.quantity / burnRate);
      }

      let healthLabel: HealthLabel = "Monitor";
      let healthScore = 70;
      if (daysToStockout !== null) {
        if (daysToStockout < 3) { healthLabel = "Critical"; healthScore = 20; }
        else if (daysToStockout < 7) { healthLabel = "At Risk"; healthScore = 40; }
        else if (daysToStockout < 14) { healthLabel = "Monitor"; healthScore = 60; }
        else { healthLabel = "Healthy"; healthScore = 90; }
      }

      let recent_trend = Array.from({ length: 7 }, () => Math.floor(Math.random() * 20) + 5);
      if (burnRate > 30) {
        recent_trend = recent_trend.map((_, i) => Math.floor(20 + i * 5 + Math.random() * 10));
      } else if (burnRate > 15) {
        recent_trend = recent_trend.map((_, i) => Math.floor(15 + Math.random() * 10));
      } else if (burnRate > 0) {
        recent_trend = recent_trend.map((_, i) => Math.floor(5 + Math.random() * 5));
      }

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        current_stock: inv?.quantity ?? 0,
        reorder_point: inv?.reorder_point ?? 0,
        warehouse_id: inv?.warehouse_id ?? null,
        health_score: healthScore,
        health_label: healthLabel,
        classification: burnRate > 30 ? "Fast Moving" : burnRate > 15 ? "Medium Moving" : "Slow Moving",
        days_to_stockout: daysToStockout,
        expiry_risk_score: 0,
        demand_trend: burnRate > 0 ? "rising" : "stable",
        expiry_date: p.expiry_date,
        forecasting_eligible: forecastingEligible.get(p.id) ?? false,
        burn_rate: burnRate,
        recent_trend
      };
    });

    console.log("[DEBUG API] First merged product object:", JSON.stringify(rows[0], null, 2));

    if (rows.length > 0) {
      console.log("[DEBUG] First product days_to_stockout:", rows[0]?.days_to_stockout);
    }
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}