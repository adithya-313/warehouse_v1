import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { OverstockItem } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get("warehouse_id");

    if (!warehouse_id) {
      return NextResponse.json({ error: "warehouse_id required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: forecastData } = await supabase
      .from("demand_forecast")
      .select("*, products(id, name, category)")
      .eq("warehouse_id", warehouse_id)
      .eq("days_ahead", 30);

    const inventory = await supabase
      .from("inventory")
      .select("product_id, quantity")
      .in("product_id", (forecastData || []).map((f) => f.product_id));
    const invMap: Record<string, number> = {};
    for (const i of inventory.data || []) {
      invMap[i.product_id] = i.quantity;
    }

    const items: OverstockItem[] = [];

    for (const f of forecastData || []) {
      const currentQty = invMap[f.product_id] || 0;
      const predictedQty = f.predicted_qty;

      if (predictedQty <= 0) continue;

      const daysSupply = currentQty / predictedQty;
      if (daysSupply <= 60) continue;

      let recommendedDiscount = 15;
      let urgencyLevel: "low" | "medium" | "high" = "low";

      if (daysSupply > 120) {
        recommendedDiscount = 35;
        urgencyLevel = "high";
      } else if (daysSupply > 90) {
        recommendedDiscount = 25;
        urgencyLevel = "medium";
      }

      const capitalTiedUp = Math.round(currentQty * 10 * 100) / 100;
      const estRevenueLoss = Math.round(currentQty * (1 - f.confidence_score / 100) * 10 * 100) / 100;

      items.push({
        product_id: f.product_id,
        product_name: (f.products as { name: string })?.name || "Unknown",
        category: (f.products as { category: string })?.category || null,
        current_qty: currentQty,
        days_supply: Math.round(daysSupply * 100) / 100,
        predicted_qty_30: predictedQty,
        recommended_discount: recommendedDiscount,
        urgency_level: urgencyLevel,
        capital_tied_up: capitalTiedUp,
        estimated_revenue_loss: estRevenueLoss,
      });
    }

    items.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      const uDiff =
        urgencyOrder[a.urgency_level] - urgencyOrder[b.urgency_level];
      if (uDiff !== 0) return uDiff;
      return b.capital_tied_up - a.capital_tied_up;
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[overstock-analysis GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
