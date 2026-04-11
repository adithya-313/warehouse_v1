import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from_warehouse_id = searchParams.get("from_warehouse_id");
    const to_warehouse_id = searchParams.get("to_warehouse_id");
    const status = searchParams.get("status");

    const supabase = createServerClient();
    let query = supabase
      .from("transfers")
      .select(`
        *,
        from_warehouse:warehouses!from_warehouse_id(id, name, location),
        to_warehouse:warehouses!to_warehouse_id(id, name, location)
      `)
      .is("deleted_at", null)
      .order("initiated_date", { ascending: false });

    if (from_warehouse_id) {
      query = query.eq("from_warehouse_id", from_warehouse_id);
    }
    if (to_warehouse_id) {
      query = query.eq("to_warehouse_id", to_warehouse_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const transfers = await Promise.all(
      (data ?? []).map(async (t) => {
        const { data: items } = await supabase
          .from("transfer_items")
          .select("id, requested_qty, shipped_qty, received_qty, variance, status")
          .eq("transfer_id", t.id);

        const itemsArray = items ?? [];
        return {
          ...t,
          total_items: itemsArray.length,
          shipped_items: itemsArray.filter((i) => i.shipped_qty !== null).length,
          received_items: itemsArray.filter((i) => i.received_qty !== null).length,
          total_requested: itemsArray.reduce((sum, i) => sum + Number(i.requested_qty), 0),
          total_shipped: itemsArray.reduce((sum, i) => sum + (Number(i.shipped_qty) || 0), 0),
          total_received: itemsArray.reduce((sum, i) => sum + (Number(i.received_qty) || 0), 0),
          variance_count: itemsArray.filter((i) => i.variance !== null && Number(i.variance) !== 0).length,
        };
      })
    );

    return NextResponse.json(transfers);
  } catch (err) {
    console.error("[transfers GET]", err);
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { from_warehouse_id, to_warehouse_id, transfer_reason, notes, items, created_by } = await req.json();

    if (!from_warehouse_id || !to_warehouse_id) {
      return NextResponse.json({ error: "from_warehouse_id and to_warehouse_id are required" }, { status: 400 });
    }

    if (from_warehouse_id === to_warehouse_id) {
      return NextResponse.json({ error: "Cannot transfer to the same warehouse" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: transfer, error: transferError } = await supabase
      .from("transfers")
      .insert({
        from_warehouse_id,
        to_warehouse_id,
        transfer_reason: transfer_reason || "other",
        notes,
        created_by: created_by || "System",
        status: "draft",
        initiated_date: new Date().toISOString().split("T")[0],
      })
      .select(`
        *,
        from_warehouse:warehouses!from_warehouse_id(id, name, location),
        to_warehouse:warehouses!to_warehouse_id(id, name, location)
      `)
      .single();

    if (transferError) throw transferError;

    const itemsToInsert = items.map((item: { product_id: string; requested_qty: number }) => ({
      transfer_id: transfer.id,
      product_id: item.product_id,
      requested_qty: item.requested_qty,
      status: "pending" as const,
    }));

    const { error: itemsError } = await supabase
      .from("transfer_items")
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    await supabase.from("transfer_audit_log").insert({
      transfer_id: transfer.id,
      action: "created",
      performed_by: created_by || "System",
      details: { item_count: items.length },
    });

    const { data: fullTransfer } = await supabase
      .from("transfers")
      .select(`
        *,
        from_warehouse:warehouses!from_warehouse_id(id, name, location),
        to_warehouse:warehouses!to_warehouse_id(id, name, location)
      `)
      .eq("id", transfer.id)
      .single();

    const { data: transferItems } = await supabase
      .from("transfer_items")
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .eq("transfer_id", transfer.id);

    return NextResponse.json({ ...fullTransfer, items: transferItems ?? [] }, { status: 201 });
  } catch (err) {
    console.error("[transfers POST]", err);
    return NextResponse.json({ error: "Failed to create transfer" }, { status: 500 });
  }
}
