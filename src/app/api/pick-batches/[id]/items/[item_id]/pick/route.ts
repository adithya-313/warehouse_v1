import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function fallbackToSupabase(
  params: { id: string; item_id: string },
  picked_qty: number,
  picker_id: string
) {
  const supabase = createServerClient();

  const { data: batch } = await supabase
    .from("pick_batches")
    .select("status")
    .eq("id", params.id)
    .single();

  if (!batch) throw new Error("Pick batch not found");

  const { data: item } = await supabase
    .from("pick_batch_items")
    .select("*, bin_locations(zone)")
    .eq("id", params.item_id)
    .eq("pick_batch_id", params.id)
    .single();

  if (!item) throw new Error("Item not found in batch");

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

  const pickedCount = (allItems ?? []).filter(
    (i) => i.status === "picked" || i.status === "verified"
  ).length;
  await supabase
    .from("pick_batches")
    .update({ total_picks_completed: pickedCount })
    .eq("id", params.id);

  return updatedItem;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; item_id: string } }
) {
  try {
    const { picked_qty, picker_id } = await req.json();

    const payload = {
      batch_id: params.id,
      item_id: params.item_id,
      quantity: picked_qty,
      worker_id: picker_id,
      timestamp: new Date().toISOString(),
    };

    try {
      await redis.xadd("stream:warehouse:picks", "*", payload);
      return NextResponse.json(
        { message: "Pick event queued", payload },
        { status: 202 }
      );
    } catch (redisError) {
      console.warn("[Redis] Failed, falling back to Supabase:", redisError);
      const result = await fallbackToSupabase(params, picked_qty, picker_id);
      return NextResponse.json(result);
    }
  } catch (err) {
    console.error("[pick-batches/[id]/items/[item_id]/pick POST]", err);
    return NextResponse.json({ error: "Failed to pick item" }, { status: 500 });
  }
}