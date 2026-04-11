import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cycle_counts")
      .select(`
        *,
        warehouses ( id, name, location )
      `)
      .order("scheduled_date", { ascending: false });

    if (error) throw error;

    const cycleCounts = await Promise.all(
      (data ?? []).map(async (cc) => {
        const { data: items } = await supabase
          .from("cycle_count_items")
          .select("id, status, discrepancy_flag")
          .eq("cycle_count_id", cc.id);

        const itemsArray = items ?? [];
        return {
          ...cc,
          total_items: itemsArray.length,
          counted_items: itemsArray.filter((i) => i.status === "counted" || i.status === "verified").length,
          flagged_items: itemsArray.filter((i) => i.discrepancy_flag).length,
          variance_count: itemsArray.filter((i) => i.status === "counted" && i.discrepancy_flag).length,
        };
      })
    );

    return NextResponse.json(cycleCounts);
  } catch (err) {
    console.error("[cycle-counts GET]", err);
    return NextResponse.json({ error: "Failed to fetch cycle counts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { warehouse_id, count_type, notes, created_by } = await req.json();

    if (!warehouse_id) {
      return NextResponse.json({ error: "warehouse_id is required" }, { status: 400 });
    }

    if (!["full", "zone-based"].includes(count_type)) {
      return NextResponse.json({ error: "Invalid count_type" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cycle_counts")
      .insert({
        warehouse_id,
        count_type,
        notes,
        created_by: created_by || "System",
        status: "scheduled",
        scheduled_date: new Date().toISOString().split("T")[0],
      })
      .select(`
        *,
        warehouses ( id, name, location )
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[cycle-counts POST]", err);
    return NextResponse.json({ error: "Failed to create cycle count" }, { status: 500 });
  }
}
