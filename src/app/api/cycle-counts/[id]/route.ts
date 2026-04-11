import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VARIANCE_THRESHOLD = 5;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cycle_counts")
      .select(`
        *,
        warehouses ( id, name, location )
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("cycle_count_items")
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .eq("cycle_count_id", params.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ ...data, items: items ?? [] });
  } catch (err) {
    console.error("[cycle-counts/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch cycle count" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: cc, error: fetchError } = await supabase
      .from("cycle_counts")
      .select("status")
      .eq("id", params.id)
      .single();

    if (fetchError || !cc) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    if (cc.status === "completed") {
      return NextResponse.json({ error: "Cannot delete a completed cycle count" }, { status: 400 });
    }

    const { error } = await supabase
      .from("cycle_counts")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[cycle-counts/[id] DELETE]", err);
    return NextResponse.json({ error: "Failed to delete cycle count" }, { status: 500 });
  }
}
