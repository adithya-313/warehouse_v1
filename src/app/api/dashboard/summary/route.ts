import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { DashboardSummary } from "@/lib/types";
import { calculateWeightedHealth, normalizeStockoutScore } from "@/lib/utils/health";

const WAREHOUSE_ID = "a1000000-0000-0000-0000-000000000001";

async function calculateProductHealth(
  supabase: ReturnType<typeof createServerClient>,
  product: { id: string; name?: string; expiry_date: string | null }
): Promise<{ health_score: number; health_label: string; days_to_stockout: number | null; burn_rate: number; classification: string }> {
  const [inventoryRes, forecastRes] = await Promise.all([
    supabase.from("inventory").select("quantity, reorder_point").eq("product_id", product.id).limit(1),
    supabase
      .from("demand_forecasts")
      .select("forecast_date, predicted_qty")
      .eq("product_id", product.id)
      .eq("warehouse_id", WAREHOUSE_ID)
      .order("forecast_date", { ascending: true }),
  ]);

  const currentStock = inventoryRes.data?.[0]?.quantity ?? 0;
  const reorderPoint = inventoryRes.data?.[0]?.reorder_point ?? 0;
  const forecastArray = forecastRes.data ?? [];

  if (forecastArray.length === 0 || currentStock === 0) {
    return { health_score: 70, health_label: "Monitor", days_to_stockout: null, burn_rate: 0.001, classification: "Slow Moving" };
  }

  const predictions = forecastArray.map((row: any) => ({
    date: row.forecast_date,
    quantity: row.predicted_qty
  }));

  const sum = predictions.reduce((acc: number, r: any) => acc + (r.quantity || 0), 0);
  const calculatedBurnRate = predictions.length > 0 ? sum / predictions.length : 0;
  const burnRate = Math.max(calculatedBurnRate, 0.001);

  const daysToStockout = burnRate > 0 ? Math.floor(currentStock / burnRate) : null;

  const stockoutScore = normalizeStockoutScore(daysToStockout);

  const healthResult = calculateWeightedHealth(
    currentStock,
    reorderPoint,
    daysToStockout,
    product.expiry_date,
    burnRate
  );

  console.log(`[HEALTH] Product: ${product.name || product.id} | RawDays: ${daysToStockout ?? 'null'} | NormalizedStockout: ${stockoutScore} | WeightedContrib: ${stockoutScore * 0.25}`);

  const classification = burnRate > 30 ? "Fast Moving" : burnRate > 15 ? "Medium Moving" : burnRate <= 0.001 ? "Dead Stock" : "Slow Moving";

  return { health_score: healthResult.score, health_label: healthResult.label, days_to_stockout: daysToStockout, burn_rate: burnRate, classification };
}

export async function GET() {
  try {
    const supabase = createServerClient();

    const [productsRes, warehousesRes, syncRes] = await Promise.all([
      supabase.from("products").select("id, name, expiry_date"),
      supabase.from("warehouses").select("id", { count: "exact", head: true }),
      supabase.from("sync_logs").select("synced_at,status").order("synced_at", { ascending: false }).limit(1),
    ]);

    const products = productsRes.data ?? [];
    const syncLog = syncRes.data?.[0] ?? null;

    const productHealthResults = await Promise.all(
      products.map((p) => calculateProductHealth(supabase, p))
    );

    let totalHealth = 0;
    let stockoutRiskCount = 0;
    let expiryRiskCount = 0;
    let deadStockCount = 0;
    let criticalAlertsCount = 0;
    let warningAlertsCount = 0;

    for (let i = 0; i < products.length; i++) {
      const health = productHealthResults[i];
      const product = products[i];

      totalHealth += health.health_score;

      if (health.days_to_stockout !== null && health.days_to_stockout < 14) {
        stockoutRiskCount++;
      }

      if (health.health_score < 40) {
        criticalAlertsCount++;
      } else if (health.health_score < 60) {
        warningAlertsCount++;
      }

      if (health.days_to_stockout !== null && health.days_to_stockout < 3) {
        expiryRiskCount++;
      }

      if (health.classification === "Dead Stock") {
        deadStockCount++;
      }
    }

    const avgHealthScore = products.length > 0 ? totalHealth / products.length : 0;

    const summary: DashboardSummary = {
      total_products: products.length,
      critical_alerts: criticalAlertsCount,
      warning_alerts: warningAlertsCount,
      warehouses_count: warehousesRes.count ?? 0,
      avg_health_score: Math.round(avgHealthScore * 10) / 10,
      stockout_risk_count: stockoutRiskCount,
      expiry_risk_count: expiryRiskCount,
      dead_stock_count: deadStockCount,
      last_synced_at: syncLog?.synced_at ?? null,
      last_sync_status: syncLog?.status ?? null,
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[dashboard/summary]", err);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}