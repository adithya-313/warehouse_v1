import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ProductRow } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createServerClient();

    // Join products ← inventory ← product_analytics in one query
    const { data, error } = await supabase
      .from("products")
      .select(`
        id, name, category, unit, expiry_date,
        inventory ( quantity, reorder_point, warehouse_id ),
        product_analytics (
          health_score, health_label, classification,
          days_to_stockout, expiry_risk_score, demand_trend
        )
      `);

    if (error) throw error;

    const rows: ProductRow[] = (data ?? []).map((p) => {
      const inv = Array.isArray(p.inventory) ? p.inventory[0] : (p.inventory as any);
      const ana = Array.isArray(p.product_analytics)
        ? p.product_analytics[0]
        : (p.product_analytics as any);

      return {
        id:                p.id,
        name:              p.name,
        category:          p.category,
        current_stock:     inv?.quantity ?? 0,
        reorder_point:     inv?.reorder_point ?? 0,
        warehouse_id:      inv?.warehouse_id ?? null,
        health_score:      ana?.health_score ?? 0,
        health_label:      ana?.health_label ?? "Monitor",
        classification:    ana?.classification ?? "Slow Moving",
        days_to_stockout:  ana?.days_to_stockout ?? null,
        expiry_risk_score: ana?.expiry_risk_score ?? 0,
        demand_trend:      ana?.demand_trend ?? "stable",
        expiry_date:       p.expiry_date,
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
