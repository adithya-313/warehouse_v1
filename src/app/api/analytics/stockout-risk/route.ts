import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface StockoutRiskItem {
  product_id: string;
  product_name: string;
  category: string | null;
  current_stock: number;
  days_of_cover: number | null;
  stockout_date: string | null;
  status: "critical" | "warning" | "healthy" | "cold_start";
  forecast: { date: string; predicted: number }[];
  burn_rate: number;
}

export async function GET() {
  try {
    const supabase = createServerClient();

    const today = new Date().toISOString().split("T")[0];
    const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const inventoryRes = await supabase
      .from("inventory")
      .select("product_id, quantity, warehouse_id, warehouses!inner(name)")
      .gt("quantity", 0);

    if (inventoryRes.error) throw inventoryRes.error;

    const productsRes = await supabase
      .from("products")
      .select("id, name, category, unit");

    if (productsRes.error) throw productsRes.error;

    const forecastsRes = await supabase
      .from("demand_forecasts")
      .select("product_id, forecast_date, predicted_qty")
      .gte("forecast_date", today)
      .lte("forecast_date", twoWeeksLater)
      .order("product_id")
      .order("forecast_date");

    if (forecastsRes.error) throw forecastsRes.error;

    const inventoryMap = new Map<string, { qty: number; warehouse: string }>();
    for (const inv of inventoryRes.data ?? []) {
      const key = inv.product_id;
      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, { qty: Number(inv.quantity), warehouse: inv.warehouses?.name ?? "" });
      } else {
        const existing = inventoryMap.get(key)!;
        existing.qty += Number(inv.quantity);
      }
    }

    const productMap = new Map<string, { name: string; category: string | null; unit: string }>();
    for (const p of productsRes.data ?? []) {
      productMap.set(p.id, { name: p.name, category: p.category, unit: p.unit });
    }

    const forecastMap = new Map<string, { date: string; predicted: number }[]>();
    for (const f of forecastsRes.data ?? []) {
      const key = f.product_id;
      if (!forecastMap.has(key)) {
        forecastMap.set(key, []);
      }
      forecastMap.get(key)!.push({
        date: f.forecast_date,
        predicted: Number(f.predicted_qty),
      });
    }

    const results: StockoutRiskItem[] = [];

    for (const [productId, inv] of inventoryMap) {
      const product = productMap.get(productId);
      const forecasts = forecastMap.get(productId) ?? [];

      if (!product) continue;

      let daysOfCover: number | null = null;
      let stockoutDate: string | null = null;
      let status: "critical" | "warning" | "healthy" | "cold_start" = "healthy";
      let burnRate = 0;

      if (forecasts.length > 0) {
        let cumulativeStock = inv.qty;
        burnRate = forecasts.reduce((sum, f) => sum + f.predicted, 0) / forecasts.length;
        burnRate = Math.round(burnRate / 14 * 100) / 100;

        for (let i = 0; i < forecasts.length; i++) {
          cumulativeStock -= forecasts[i].predicted;
          if (cumulativeStock <= 0) {
            stockoutDate = forecasts[i].date;
            daysOfCover = i + 1;
            break;
          }
        }

        if (daysOfCover === null) {
          daysOfCover = burnRate > 0 ? Math.round(inv.qty / burnRate) : 999;
        }
      } else {
        status = "cold_start";
        daysOfCover = null;
      }

      if (status !== "cold_start") {
        if (daysOfCover !== null && daysOfCover < 3) {
          status = "critical";
        } else if (daysOfCover !== null && daysOfCover < 7) {
          status = "warning";
        } else {
          status = "healthy";
        }
      }

      results.push({
        product_id: productId,
        product_name: product.name,
        category: product.category,
        current_stock: inv.qty,
        days_of_cover: daysOfCover,
        stockout_date: stockoutDate,
        status,
        forecast: forecasts,
        burn_rate: burnRate,
      });
    }

    results.sort((a, b) => {
      if (a.status === "critical" && b.status !== "critical") return -1;
      if (b.status === "critical" && a.status !== "critical") return 1;
      if (a.status === "warning" && b.status === "healthy") return -1;
      if (b.status === "warning" && a.status === "healthy") return 1;
      if (a.status === "cold_start" && b.status !== "cold_start") return 1;
      if (b.status === "cold_start" && a.status !== "cold_start") return -1;
      return (a.days_of_cover ?? 999) - (b.days_of_cover ?? 999);
    });

    const criticalCount = results.filter((r) => r.status === "critical").length;
    const warningCount = results.filter((r) => r.status === "warning").length;
    const coldStartCount = results.filter((r) => r.status === "cold_start").length;

    return NextResponse.json({
      items: results.slice(0, 50),
      summary: {
        total: results.length,
        critical: criticalCount,
        warning: warningCount,
        cold_start: coldStartCount,
        healthy: results.length - criticalCount - warningCount - coldStartCount,
      },
      top_risk: results.slice(0, 5),
    });
  } catch (err) {
    console.error("[analytics/stockout-risk]", err);
    return NextResponse.json({ error: "Failed to fetch stockout risk data" }, { status: 500 });
  }
}