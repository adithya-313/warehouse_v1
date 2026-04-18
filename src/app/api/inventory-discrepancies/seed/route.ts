import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();

    const [productsRes, warehousesRes, cycleCountsRes] = await Promise.all([
      supabase.from("products").select("id").limit(10),
      supabase.from("warehouses").select("id").limit(5),
      supabase.from("cycle_counts").select("id").order("created_at", { ascending: false }).limit(5),
    ]);

    const products = productsRes.data || [];
    const warehouses = warehousesRes.data || [];
    const cycleCounts = cycleCountsRes.data || [];

    console.log("[SEED] Products:", products.length, "Warehouses:", warehouses.length, "CycleCounts:", cycleCounts.length);

    if (products.length === 0 || warehouses.length === 0) {
      return NextResponse.json({ error: "No products or warehouses found" }, { status: 400 });
    }

    const rootCauses = ["damage", "shrinkage", "data_entry_error", "supplier_short", "other"];
    const discrepancies = [];
    
    for (let i = 0; i < 8; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const warehouse = warehouses[0];
      const cycleCount = cycleCounts.length > 0 ? cycleCounts[Math.floor(Math.random() * cycleCounts.length)] : null;
      
      const expectedQty = Math.floor(Math.random() * 50) + 10;
      const actualQty = expectedQty + Math.floor(Math.random() * 25) - 15;
      const variance = actualQty - expectedQty;
      const variancePct = expectedQty === 0 ? 0 : (variance / expectedQty) * 100;
      
      const resolved = i < 3;
      
      discrepancies.push({
        product_id: product.id,
        warehouse_id: warehouse.id,
        cycle_count_id: cycleCount?.id || null,
        expected_qty: expectedQty,
        actual_qty: actualQty,
        variance: variance,
        variance_pct: variancePct,
        root_cause: rootCauses[Math.floor(Math.random() * rootCauses.length)],
        resolved: resolved,
        resolution_notes: resolved ? "Auto-resolved during seed" : null,
      });
    }

    const { data, error } = await supabase
      .from("inventory_discrepancies")
      .upsert(discrepancies, { onConflict: "id" })
      .select();

    if (error) {
      console.error("[SEED ERROR]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[SEED SUCCESS] Inserted discrepancies:", data?.length || discrepancies.length);
    return NextResponse.json({ 
      success: true, 
      count: data?.length || discrepancies.length,
      sample: data?.[0] 
    });
  } catch (err) {
    console.error("[SEED ERROR]", err);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}