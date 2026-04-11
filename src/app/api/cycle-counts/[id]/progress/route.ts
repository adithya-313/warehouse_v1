import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: cc, error: ccError } = await supabase
      .from("cycle_counts")
      .select("status")
      .eq("id", params.id)
      .single();

    if (ccError || !cc) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("cycle_count_items")
      .select("id, status, variance, variance_pct, discrepancy_flag")
      .eq("cycle_count_id", params.id);

    if (itemsError) throw itemsError;

    const total_items = items?.length ?? 0;
    const counted = items?.filter((i) => i.status === "counted" || i.status === "verified").length ?? 0;
    const pending = items?.filter((i) => i.status === "pending").length ?? 0;
    const verified = items?.filter((i) => i.status === "verified").length ?? 0;
    const variance_count = items?.filter((i) => i.discrepancy_flag).length ?? 0;
    const avg_variance_pct = total_items > 0
      ? (items ?? []).reduce((sum, i) => sum + Math.abs(Number(i.variance_pct) || 0), 0) / total_items
      : 0;

    return NextResponse.json({
      cycle_count_id: params.id,
      status: cc.status,
      progress: {
        total_items,
        counted,
        pending,
        verified,
        variance_count,
        avg_variance_pct: Math.round(avg_variance_pct * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[cycle-counts/[id]/progress GET]", err);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}
