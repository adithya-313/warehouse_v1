import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; item_id: string } }
) {
  try {
    const { picked_qty, picker_id } = await req.json();
    const supabase = createServerClient();

    const { data: batch, error: batchError } = await supabase
      .from("pick_batches")
      .select("status")
      .eq("id", params.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Pick batch not found" }, { status: 404 });
    }

    if (batch.status !== "assigned" && batch.status !== "in-progress") {
      return NextResponse.json({ error: "Batch must be assigned or in-progress to pick items" }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabase
      .from("pick_batch_items")
      .select("*, bin_locations(zone)")
      .eq("id", params.item_id)
      .eq("pick_batch_id", params.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found in batch" }, { status: 404 });
    }

    if (picked_qty > Number(item.requested_qty)) {
      return NextResponse.json({ error: "Cannot pick more than requested quantity" }, { status: 400 });
    }

    const newStatus = picked_qty >= Number(item.requested_qty) ? "picked" : "pending";

    const { data: updatedItem, error: updateError } = await supabase
      .from("pick_batch_items")
      .update({
        picked_qty,
        status: newStatus,
        picked_by: picker_id,
        picked_at: new Date().toISOString(),
      })
      .eq("id", params.item_id)
      .select(`
        *,
        products ( id, name, category, unit ),
        bin_locations ( id, aisle, rack, bin, zone )
      `)
      .single();

    if (updateError) throw updateError;

    if (batch.status === "assigned") {
      await supabase
        .from("pick_batches")
        .update({ status: "in-progress" })
        .eq("id", params.id);

      await supabase.from("pick_audit_log").insert({
        pick_batch_id: params.id,
        action: "started",
        performed_by: picker_id,
      });
    }

    await supabase.from("pick_audit_log").insert({
      pick_batch_id: params.id,
      pick_item_id: params.item_id,
      action: "item_picked",
      performed_by: picker_id,
      details: { picked_qty, new_status: newStatus },
    });

    const { data: allItems } = await supabase
      .from("pick_batch_items")
      .select("status")
      .eq("pick_batch_id", params.id);

    const pickedCount = (allItems ?? []).filter((i) => i.status === "picked" || i.status === "verified").length;
    await supabase
      .from("pick_batches")
      .update({ total_picks_completed: pickedCount })
      .eq("id", params.id);

    return NextResponse.json(updatedItem);
  } catch (err) {
    console.error("[pick-batches/[id]/items/[item_id]/pick POST]", err);
    return NextResponse.json({ error: "Failed to pick item" }, { status: 500 });
  }
}
