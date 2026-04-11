import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: batch, error } = await supabase
      .from("pick_batches")
      .select(`
        *,
        warehouses ( id, name )
      `)
      .eq("id", params.id)
      .single();

    if (error || !batch) {
      return NextResponse.json({ error: "Pick batch not found" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("pick_batch_items")
      .select(`
        *,
        products ( id, name, category, unit ),
        bin_locations ( id, aisle, rack, bin, zone )
      `)
      .eq("pick_batch_id", params.id)
      .order("sequence_order");

    const { data: auditLog } = await supabase
      .from("pick_audit_log")
      .select("*")
      .eq("pick_batch_id", params.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ...batch,
      items: items ?? [],
      audit_log: auditLog ?? [],
    });
  } catch (err) {
    console.error("[pick-batches/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch pick batch" }, { status: 500 });
  }
}
