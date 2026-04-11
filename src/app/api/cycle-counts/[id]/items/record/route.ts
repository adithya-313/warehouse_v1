import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VARIANCE_THRESHOLD = 5;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { product_id, actual_qty, counted_by } = await req.json();

    if (!product_id || actual_qty === undefined || actual_qty === null) {
      return NextResponse.json({ error: "product_id and actual_qty are required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: cc, error: ccError } = await supabase
      .from("cycle_counts")
      .select("status")
      .eq("id", params.id)
      .single();

    if (ccError || !cc) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    if (cc.status !== "in-progress") {
      return NextResponse.json({ error: "Cycle count is not in progress" }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabase
      .from("cycle_count_items")
      .select("*")
      .eq("cycle_count_id", params.id)
      .eq("product_id", product_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found in this cycle count" }, { status: 404 });
    }

    const variance = actual_qty - Number(item.expected_qty);
    const variance_pct = Number(item.expected_qty) === 0
      ? (actual_qty === 0 ? 0 : 100)
      : (variance / Number(item.expected_qty)) * 100;
    const discrepancy_flag = Math.abs(variance_pct) > VARIANCE_THRESHOLD;

    const { data: updatedItem, error: updateError } = await supabase
      .from("cycle_count_items")
      .update({
        actual_qty,
        variance,
        variance_pct,
        discrepancy_flag,
        status: "counted",
        counted_by: counted_by || "System",
        counted_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updatedItem);
  } catch (err) {
    console.error("[cycle-counts/[id]/items/record POST]", err);
    return NextResponse.json({ error: "Failed to record item count" }, { status: 500 });
  }
}
