import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get("warehouse_id");
    const resolved = searchParams.get("resolved");
    const root_cause = searchParams.get("root_cause");

    let query = `
      *,
      products ( id, name, category ),
      warehouses ( id, name ),
      cycle_counts ( id, scheduled_date )
    `;

    const supabase = createServerClient();
    let dbQuery = supabase
      .from("inventory_discrepancies")
      .select(query);

    if (warehouse_id) {
      dbQuery = dbQuery.eq("warehouse_id", warehouse_id);
    }

    if (resolved !== null && resolved !== undefined) {
      dbQuery = dbQuery.eq("resolved", resolved === "true");
    }

    if (root_cause) {
      dbQuery = dbQuery.eq("root_cause", root_cause);
    }

    const { data, error } = await dbQuery.order("created_at", { ascending: false });

    console.log("SERVER_API_DISCREPANCIES_COUNT:", data?.length);
    
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[inventory-discrepancies GET]", err);
    return NextResponse.json({ error: "Failed to fetch discrepancies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { product_id, warehouse_id, cycle_count_id, expected_qty, actual_qty, root_cause } = await req.json();

    if (!product_id || !warehouse_id || !cycle_count_id) {
      return NextResponse.json({ error: "product_id, warehouse_id, and cycle_count_id are required" }, { status: 400 });
    }

    const variance = actual_qty - expected_qty;
    const variance_pct = expected_qty === 0
      ? (actual_qty === 0 ? 0 : 100)
      : (variance / expected_qty) * 100;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("inventory_discrepancies")
      .insert({
        product_id,
        warehouse_id,
        cycle_count_id,
        expected_qty,
        actual_qty,
        variance,
        variance_pct,
        root_cause: root_cause || "shrinkage",
        resolved: false,
      })
      .select(`
        *,
        products ( id, name, category ),
        warehouses ( id, name ),
        cycle_counts ( id, scheduled_date )
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[inventory-discrepancies POST]", err);
    return NextResponse.json({ error: "Failed to create discrepancy" }, { status: 500 });
  }
}
