import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { calculateWeightedHealth, normalizeStockoutScore } from "@/lib/utils/health";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { id }   = params;

    const WAREHOUSE_ID = "a1000000-0000-0000-0000-000000000001";

    const [productRes, forecastRes, inventoryRes, movementsRes, alertsRes] =
      await Promise.all([
        supabase
          .from("products")
          .select("*, suppliers(*)")
          .eq("id", id)
          .single(),
        supabase
          .from("demand_forecasts")
          .select("forecast_date, predicted_qty")
          .eq("product_id", id)
          .eq("warehouse_id", WAREHOUSE_ID)
          .order("forecast_date", { ascending: true }),
        supabase
          .from("inventory")
          .select("*, warehouses(name,location)")
          .eq("product_id", id),
        supabase
          .from("stock_movements")
          .select("type,quantity,date")
          .eq("product_id", id)
          .order("date", { ascending: false })
          .limit(90),
        supabase
          .from("alerts")
          .select("*, actions(*)")
          .eq("product_id", id)
          .eq("resolved", false)
          .order("created_at", { ascending: false }),
      ]);

    console.log("[DEBUG RAW PRODUCT]", JSON.stringify(productRes.data, null, 2));

    let analytics: any = null;
    const forecastArray = forecastRes.data ?? [];
    console.log("[DEBUG analytics/:id] Forecast count:", forecastArray.length);

    const inv = inventoryRes.data?.[0];
    const currentStock = inv?.quantity ?? 0;
    const reorderPoint = inv?.reorder_point ?? 0;

    if (forecastArray.length > 0) {
      const predictions = forecastArray.map((row: any) => ({
        date: row.forecast_date,
        quantity: row.predicted_qty
      }));
      
      const sum = predictions.reduce((acc: number, r: any) => acc + (r.quantity || 0), 0);
      const calculatedBurnRate = predictions.length > 0 ? sum / predictions.length : 0;
      const burnRate = Math.max(calculatedBurnRate, 0.001);
      
      let runningStock = currentStock;
      let predictedStockoutDate: string | null = null;
      for (const pred of predictions) {
        runningStock -= (pred.quantity || 0);
        if (runningStock <= 0) {
          predictedStockoutDate = pred.date;
          break;
        }
      }
      
      const daysToStockout = burnRate > 0 ? Math.floor(currentStock / burnRate) : null;

      const stockoutScore = normalizeStockoutScore(daysToStockout);

      const healthResult = calculateWeightedHealth(
        currentStock,
        reorderPoint,
        daysToStockout,
        productRes.data?.expiry_date,
        burnRate
      );

      console.log(`[HEALTH] Product: ${productRes.data?.name || id} | RawDays: ${daysToStockout ?? 'null'} | NormalizedStockout: ${stockoutScore} | WeightedContrib: ${stockoutScore * 0.25}`);

      const healthScore = healthResult.score;
      const healthLabel = healthResult.label;

      const dynamicAlerts: any[] = [];

      if (currentStock < reorderPoint && reorderPoint > 0) {
        dynamicAlerts.push({
          id: "alert-reorder",
          severity: "warning",
          type: "Low Stock",
          message: "Current stock is below reorder point",
          actions: [],
        });
      }

      if (daysToStockout !== null && daysToStockout < 7) {
        dynamicAlerts.push({
          id: "alert-stockout",
          severity: daysToStockout < 3 ? "critical" : "warning",
          type: "Stockout Risk",
          message: daysToStockout < 3 
            ? `Critical: Stockout in ${daysToStockout} days` 
            : `High risk of stockout in ${daysToStockout} days`,
          actions: [{ recommendation: "Consider expedited reorder" }],
        });
      }

      if (healthScore < 40) {
        dynamicAlerts.push({
          id: "alert-health",
          severity: "critical",
          type: "Low Stock",
          message: `Critical health score: ${healthScore}`,
          actions: [{ recommendation: "Immediate restocking required" }],
        });
      }

      const productExpiry = productRes.data?.expiry_date;
      if (productExpiry) {
        const expiryDate = new Date(productExpiry);
        const today = new Date();
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 30) {
          dynamicAlerts.push({
            id: "alert-expiry",
            severity: daysUntilExpiry < 7 ? "critical" : "warning",
            type: "Expiry Risk",
            message: daysUntilExpiry < 0 
              ? "Product has expired" 
              : `Expires in ${daysUntilExpiry} days`,
            actions: [{ recommendation: "Prioritize for liquidation or use" }],
          });
        }
      }

      const existingAlerts = alertsRes.data ?? [];
      const allAlerts = [...dynamicAlerts, ...existingAlerts];
      
      analytics = {
        burn_rate: burnRate,
        predicted_stockout_date: predictedStockoutDate,
        forecast_series: predictions,
        days_to_stockout: daysToStockout,
        health_score: healthScore,
        health_label: healthLabel,
        demand_trend: burnRate > 0 ? "rising" : "stable",
        classification: burnRate > 30 ? "Fast Moving" : burnRate > 15 ? "Medium Moving" : "Slow Moving",
        supplier: productRes.data?.suppliers?.[0] || null,
      };

      return NextResponse.json({
        product:    productRes.data,
        analytics:  analytics,
        inventory:  inventoryRes.data ?? [],
        movements:  movementsRes.data ?? [],
        alerts:     allAlerts,
      });
    }

    const dynamicAlerts: any[] = [];

    if (currentStock < reorderPoint && reorderPoint > 0) {
      dynamicAlerts.push({
        id: "alert-reorder",
        severity: "warning",
        type: "Low Stock",
        message: "Current stock is below reorder point",
        actions: [],
      });
    }

    const productExpiry = productRes.data?.expiry_date;
    if (productExpiry) {
      const expiryDate = new Date(productExpiry);
      const today = new Date();
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 30) {
        dynamicAlerts.push({
          id: "alert-expiry",
          severity: daysUntilExpiry < 7 ? "critical" : "warning",
          type: "Expiry Risk",
          message: daysUntilExpiry < 0 
            ? "Product has expired" 
            : `Expires in ${daysUntilExpiry} days`,
          actions: [{ recommendation: "Prioritize for liquidation or use" }],
        });
      }
    }

    const existingAlerts = alertsRes.data ?? [];
    const allAlerts = [...dynamicAlerts, ...existingAlerts];

    analytics = {
      burn_rate: 0.001,
      predicted_stockout_date: null,
      forecast_series: [],
      days_to_stockout: null,
      health_score: 70,
      health_label: "Monitor",
      demand_trend: "stable",
      classification: "Slow Moving",
      supplier: productRes.data?.suppliers?.[0] || null,
    };

    return NextResponse.json({
      product:    productRes.data,
      analytics:  analytics,
      inventory:  inventoryRes.data ?? [],
      movements:  movementsRes.data ?? [],
      alerts:     allAlerts,
    });
  } catch (err) {
    console.error("[analytics/:id]", err);
    return NextResponse.json({ error: "Failed to fetch product analytics" }, { status: 500 });
  }
}
