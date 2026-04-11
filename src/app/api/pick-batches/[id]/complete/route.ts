import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { picker_id } = await req.json();
    const supabase = createServerClient();

    const { data: batch, error: batchError } = await supabase
      .from("pick_batches")
      .select(`
        *,
        warehouses ( id, name )
      `)
      .eq("id", params.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Pick batch not found" }, { status: 404 });
    }

    if (batch.status === "completed") {
      return NextResponse.json({ error: "Batch is already completed" }, { status: 400 });
    }

    const { data: items } = await supabase
      .from("pick_batch_items")
      .select("id, status, requested_qty, picked_qty")
      .eq("pick_batch_id", params.id);

    const pendingItems = (items ?? []).filter((i) => i.status === "pending");
    if (pendingItems.length > 0) {
      return NextResponse.json({
        error: `Cannot complete batch: ${pendingItems.length} items still pending`,
        pending_items: pendingItems.length,
      }, { status: 400 });
    }

    const startTime = batch.started_at ? new Date(batch.started_at).getTime() : new Date().getTime();
    const endTime = Date.now();
    const durationMinutes = (endTime - startTime) / (1000 * 60);
    const picksCompleted = (items ?? []).filter((i) => i.status === "picked" || i.status === "verified").length;
    const efficiencyScore = durationMinutes > 0 ? picksCompleted / durationMinutes : 0;

    const { data: updatedBatch, error: updateError } = await supabase
      .from("pick_batches")
      .update({
        status: "completed",
        completed_date: new Date().toISOString(),
        total_picks_completed: picksCompleted,
        efficiency_score: Math.round(efficiencyScore * 100) / 100,
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
      action: "completed",
      performed_by: picker_id,
      details: {
        picks_completed: picksCompleted,
        duration_minutes: Math.round(durationMinutes * 100) / 100,
        efficiency_score: Math.round(efficiencyScore * 100) / 100,
      },
    });

    const { data: fullItems } = await supabase
      .from("pick_batch_items")
      .select(`
        *,
        products ( id, name, category, unit ),
        bin_locations ( id, aisle, rack, bin, zone )
      `)
      .eq("pick_batch_id", params.id)
      .order("sequence_order");

    return NextResponse.json({
      ...updatedBatch,
      items: fullItems ?? [],
      completion_summary: {
        picks_completed: picksCompleted,
        duration_minutes: Math.round(durationMinutes * 100) / 100,
        efficiency_score: Math.round(efficiencyScore * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[pick-batches/[id]/complete POST]", err);
    return NextResponse.json({ error: "Failed to complete batch" }, { status: 500 });
  }
}
