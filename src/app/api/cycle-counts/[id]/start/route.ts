import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: cc, error: fetchError } = await supabase
      .from("cycle_counts")
      .select("id, status, warehouse_id")
      .eq("id", params.id)
      .single();

    if (fetchError || !cc) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    if (cc.status === "in-progress") {
      return NextResponse.json({ error: "Cycle count is already in progress" }, { status: 400 });
    }

    if (cc.status === "completed") {
      return NextResponse.json({ error: "Cannot start a completed cycle count" }, { status: 400 });
    }

    const { data: inventory } = await supabase
      .from("inventory")
      .select("product_id, quantity, warehouse_id")
      .eq("warehouse_id", cc.warehouse_id)
      .gt("quantity", 0);

    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ error: "No inventory items found to count" }, { status: 400 });
    }

    const itemsToInsert = inventory.map((inv) => ({
      cycle_count_id: params.id,
      product_id: inv.product_id,
      warehouse_id: inv.warehouse_id,
      expected_qty: inv.quantity,
      status: "pending" as const,
      discrepancy_flag: false,
    }));

    const { error: insertError } = await supabase
      .from("cycle_count_items")
      .insert(itemsToInsert);

    if (insertError) throw insertError;

    const { data: startedCc, error: updateError } = await supabase
      .from("cycle_counts")
      .update({
        status: "in-progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select(`
        *,
        warehouses ( id, name, location )
      `)
      .single();

    if (updateError) throw updateError;

    const { data: items } = await supabase
      .from("cycle_count_items")
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .eq("cycle_count_id", params.id);

    return NextResponse.json({ ...startedCc, items: items ?? [] });
  } catch (err) {
    console.error("[cycle-counts/[id]/start POST]", err);
    return NextResponse.json({ error: "Failed to start cycle count" }, { status: 500 });
  }
}
