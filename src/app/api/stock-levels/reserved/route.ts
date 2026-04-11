import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get("warehouse_id");

    const supabase = createServerClient();

    let query = supabase
      .from("inventory")
      .select(`
        product_id,
        warehouse_id,
        quantity,
        reserved_qty,
        products ( id, name, category, unit )
      `)
      .gt("quantity", 0);

    if (warehouse_id) {
      query = query.eq("warehouse_id", warehouse_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stockLevels = (data ?? []).map((item) => ({
      product_id: item.product_id,
      warehouse_id: item.warehouse_id,
      product_name: (item.products as any)?.name ?? "Unknown",
      category: (item.products as any)?.category ?? null,
      unit: (item.products as any)?.unit ?? "units",
      current_qty: Number(item.quantity),
      reserved_qty: Number(item.reserved_qty) || 0,
      available_qty: Number(item.quantity) - (Number(item.reserved_qty) || 0),
    }));

    return NextResponse.json(stockLevels);
  } catch (err) {
    console.error("[stock-levels/reserved GET]", err);
    return NextResponse.json({ error: "Failed to fetch stock levels" }, { status: 500 });
  }
}
