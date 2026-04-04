import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { id }   = params;

    const [productRes, analyticsRes, inventoryRes, movementsRes, alertsRes] =
      await Promise.all([
        supabase
          .from("products")
          .select("*, suppliers(*)")
          .eq("id", id)
          .single(),
        supabase
          .from("product_analytics")
          .select("*")
          .eq("product_id", id)
          .single(),
        supabase
          .from("inventory")
          .select("*, warehouses(name,location)")
          .eq("product_id", id),
        supabase
          .from("stock_movements")
          .select("type,quantity,date")
          .eq("product_id", id)
          .order("date", { ascending: true })
          .limit(60),
        supabase
          .from("alerts")
          .select("*, actions(*)")
          .eq("product_id", id)
          .eq("resolved", false)
          .order("created_at", { ascending: false }),
      ]);

    if (productRes.error) throw productRes.error;

    return NextResponse.json({
      product:    productRes.data,
      analytics:  analyticsRes.data ?? null,
      inventory:  inventoryRes.data ?? [],
      movements:  movementsRes.data ?? [],
      alerts:     alertsRes.data ?? [],
    });
  } catch (err) {
    console.error("[analytics/:id]", err);
    return NextResponse.json({ error: "Failed to fetch product analytics" }, { status: 500 });
  }
}
