import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { picker_id } = await req.json();
    const supabase = createServerClient();

    const { data: batch, error: fetchError } = await supabase
      .from("pick_batches")
      .select(`
        *,
        warehouses ( id, name )
      `)
      .eq("id", params.id)
      .single();

    if (fetchError || !batch) {
      return NextResponse.json({ error: "Pick batch not found" }, { status: 404 });
    }

    if (batch.status !== "draft") {
      return NextResponse.json({ error: "Batch must be in draft status to assign" }, { status: 400 });
    }

    const { data: updatedBatch, error: updateError } = await supabase
      .from("pick_batches")
      .update({
        status: "assigned",
        picker_id,
        started_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select(`
        *,
        warehouses ( id, name )
      `)
      .single();

    if (updateError) throw updateError;

    await supabase.from("pick_audit_log").insert({
      pick_batch_id: params.id,
      action: "assigned",
      performed_by: picker_id,
      details: { picker_id },
    });

    const { data: items } = await supabase
      .from("pick_batch_items")
      .select(`
        *,
        products ( id, name, category, unit ),
        bin_locations ( id, aisle, rack, bin, zone )
      `)
      .eq("pick_batch_id", params.id)
      .order("sequence_order");

    return NextResponse.json({ ...updatedBatch, items: items ?? [] });
  } catch (err) {
    console.error("[pick-batches/[id]/assign POST]", err);
    return NextResponse.json({ error: "Failed to assign batch" }, { status: 500 });
  }
}
