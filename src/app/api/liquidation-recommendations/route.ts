import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get("warehouse_id");
    const urgency = searchParams.get("urgency");

    if (!warehouse_id) {
      return NextResponse.json({ error: "warehouse_id required" }, { status: 400 });
    }

    const supabase = createServerClient();
    let query = supabase
      .from("liquidation_recommendations")
      .select("*, products(id, name, category, unit), warehouses(id, name, location)")
      .eq("warehouse_id", warehouse_id)
      .is("acknowledged_by", null)
      .order("urgency_level")
      .order("estimated_revenue_loss", { ascending: false });

    if (urgency) {
      query = query.eq("urgency_level", urgency);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    const sorted = (data || []).sort(
      (a, b) =>
        urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] -
        urgencyOrder[b.urgency_level as keyof typeof urgencyOrder]
    );

    return NextResponse.json(sorted);
  } catch (error: any) {
    console.error("[liquidation-recommendations GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { warehouse_id } = body;

    if (!warehouse_id) {
      return NextResponse.json({ error: "warehouse_id required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: forecastData } = await supabase
      .from("demand_forecast")
      .select("*")
      .eq("warehouse_id", warehouse_id)
      .eq("status", "active");

    const inventory = await supabase
      .from("inventory")
      .select("product_id, quantity")
      .in("product_id", (forecastData || []).map((f) => f.product_id));
    const invMap: Record<string, number> = {};
    for (const i of inventory.data || []) {
      invMap[i.product_id] = i.quantity;
    }

    const products = await supabase.from("products").select("id, expiry_date");
    const productMap: Record<string, { expiry_date?: string }> = {};
    for (const p of products.data || []) {
      productMap[p.id] = p;
    }

    const recommendations: Record<string, object> = {};

    for (const f of forecastData || []) {
      const pid = f.product_id;
      const currentQty = invMap[pid] || 0;
      const predictedQty = f.predicted_qty;

      if (predictedQty <= 0) continue;

      const daysSupply = currentQty / predictedQty;
      if (daysSupply <= 60) continue;

      const lastMovement = await supabase
        .from("stock_movements")
        .select("date")
        .lte("date", todayStr);

      const daysSinceMovement = lastMovement.data?.[0]
        ? Math.floor(
            (Date.now() - new Date(lastMovement.data[0].date).getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;

      if (daysSinceMovement && daysSinceMovement <= 45) continue;
      if (currentQty <= predictedQty * 1.5) continue;

      let urgency: "low" | "medium" | "high" = "low";
      let discountPct = 15;
      let action: "liquidate_discount" | "bundle_promotion" = "bundle_promotion";

      if (daysSupply > 120) {
        urgency = "high";
        discountPct = 35;
        action = "liquidate_discount";
      } else if (daysSupply > 90) {
        urgency = "medium";
        discountPct = 25;
        action = "liquidate_discount";
      }

      const expiryStr = productMap[pid]?.expiry_date;
      const daysToExpiry = expiryStr
        ? Math.floor((new Date(expiryStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      const estLoss = Math.round(currentQty * (1 - f.confidence_score / 100) * 10 * 100) / 100;

      recommendations[pid] = {
        product_id: pid,
        warehouse_id,
        current_qty: currentQty,
        days_to_expiry: daysToExpiry,
        recommended_action: action,
        discount_pct: Math.min(50, Math.max(10, discountPct)),
        urgency_level: urgency,
        estimated_revenue_loss: estLoss,
      };
    }

    await supabase.from("liquidation_recommendations").delete().eq("warehouse_id", warehouse_id);

    const recs = Object.values(recommendations);
    if (recs.length > 0) {
      await supabase.from("liquidation_recommendations").insert(recs);
    }

    return NextResponse.json({ count: recs.length });
  } catch (err: any) {
    console.error("[liquidation-recommendations POST]", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
