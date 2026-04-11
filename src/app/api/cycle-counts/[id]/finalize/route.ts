import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VARIANCE_THRESHOLD = 5;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: cc, error: ccError } = await supabase
      .from("cycle_counts")
      .select("id, status, warehouse_id")
      .eq("id", params.id)
      .single();

    if (ccError || !cc) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    if (cc.status === "scheduled") {
      return NextResponse.json({ error: "Cannot finalize a scheduled cycle count. Start it first." }, { status: 400 });
    }

    if (cc.status === "completed") {
      return NextResponse.json({ error: "Cycle count is already finalized" }, { status: 400 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("cycle_count_items")
      .select("*")
      .eq("cycle_count_id", params.id);

    if (itemsError) throw itemsError;

    const pendingItems = (items ?? []).filter((i) => i.status === "pending");
    if (pendingItems.length > 0) {
      return NextResponse.json({
        error: "Cannot finalize: there are still pending items to count",
        pending_count: pendingItems.length,
      }, { status: 400 });
    }

    const flaggedItems = (items ?? []).filter((i) => i.discrepancy_flag);

    if (flaggedItems.length > 0) {
      const discrepanciesToInsert = flaggedItems.map((item) => ({
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        cycle_count_id: params.id,
        expected_qty: Number(item.expected_qty),
        actual_qty: Number(item.actual_qty),
        variance: Number(item.variance),
        variance_pct: Number(item.variance_pct),
        root_cause: "shrinkage" as const,
        resolved: false,
      }));

      const { error: discError } = await supabase
        .from("inventory_discrepancies")
        .insert(discrepanciesToInsert);

      if (discError) throw discError;
    }

    const { data: completedCc, error: updateError } = await supabase
      .from("cycle_counts")
      .update({
        status: "completed",
        completed_date: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select(`
        *,
        warehouses ( id, name, location )
      `)
      .single();

    if (updateError) throw updateError;

    const varianceUnits = (items ?? []).reduce((sum, i) => sum + Math.abs(Number(i.variance) || 0), 0);
    const avgVariancePct = (items ?? []).length > 0
      ? (items ?? []).reduce((sum, i) => sum + Math.abs(Number(i.variance_pct) || 0), 0) / (items ?? []).length
      : 0;

    return NextResponse.json({
      cycle_count: completedCc,
      summary: {
        total_items: items?.length ?? 0,
        flagged_items: flaggedItems.length,
        discrepancies_created: flaggedItems.length,
        total_variance_units: varianceUnits,
        avg_variance_pct: Math.round(avgVariancePct * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[cycle-counts/[id]/finalize POST]", err);
    return NextResponse.json({ error: "Failed to finalize cycle count" }, { status: 500 });
  }
}
