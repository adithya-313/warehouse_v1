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
    for (const [productId, dates] of movementDates) {
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
    for (const [productId, qtyArray] of forecastByProduct) {
      const sum = qtyArray.reduce((a, b) => a + b, 0);
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
        else if (daysToStockout < 7) { healthLabel = "Warning"; healthScore = 40; }
        else if (daysToStockout < 14) { healthLabel = "Monitor"; healthScore = 60; }
        else { healthLabel = "Healthy"; healthScore = 90; }
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
      };
    });

    console.log("[DEBUG API] First merged product object:", JSON.stringify(rows[0], null, 2));

    if (rows.length > 0) {
      console.log("[DEBUG] First product burn_rate:", rows[0]?.burn_rate, "days_to_stockout:", rows[0]?.days_to_stockout);
    }
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}