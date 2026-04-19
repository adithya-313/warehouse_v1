import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const movements = body.movements;

    if (!movements || !Array.isArray(movements) || movements.length === 0) {
      return NextResponse.json(
        { error: "movements array is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const formattedMovements = movements.map((m: any) => ({
      product_id: m.product_id,
      quantity_change: m.quantity_change ?? m.quantity,
      movement_type: m.movement_type ?? m.type ?? "in",
      metadata: m.metadata ?? {},
      warehouse_id: m.warehouse_id,
      note: m.note ?? null,
      created_at: m.created_at ?? new Date().toISOString(),
      date: m.date ? new Date(m.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    }));

    const { data, error } = await supabase
      .from("stock_movements")
      .upsert(formattedMovements, { onConflict: "id", ignoreDuplicates: true })
      .select("id, product_id, quantity_change, movement_type");

    if (error) {
      console.error("[movements] Bulk insert error:", error);
      throw error;
    }

    console.log(`[movements] Processed ${data?.length ?? formattedMovements.length} items`);

    return NextResponse.json(
      {
        status: "success",
        processed: data?.length ?? formattedMovements.length,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[movements POST] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process movements" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product_id = searchParams.get("product_id");
    const limit = searchParams.get("limit") || "100";

    const supabase = createServerClient();
    let query = supabase
      .from("stock_movements")
      .select("*, products(name, category)")
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));

    if (product_id) {
      query = query.eq("product_id", product_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error("[movements GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}