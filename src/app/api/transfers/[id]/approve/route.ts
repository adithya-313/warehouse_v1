import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { approved_by } = await req.json();
    const supabase = createServerClient();

    const { data: transfer, error: fetchError } = await supabase
      .from("transfers")
      .select(`
        *,
        from_warehouse:warehouses!from_warehouse_id(id, name, location),
        to_warehouse:warehouses!to_warehouse_id(id, name, location)
      `)
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.status !== "draft") {
      return NextResponse.json({ error: "Only draft transfers can be approved" }, { status: 400 });
    }

    const { data: items } = await supabase
      .from("transfer_items")
      .select("product_id, requested_qty")
      .eq("transfer_id", params.id);

    for (const item of items ?? []) {
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, quantity, reserved_qty")
        .eq("product_id", item.product_id)
        .eq("warehouse_id", transfer.from_warehouse_id)
        .single();

      if (!inventory) {
        return NextResponse.json({
          error: `Product not found in source warehouse: ${item.product_id}`,
        }, { status: 400 });
      }

      const available = Number(inventory.quantity) - Number(inventory.reserved_qty || 0);
      if (available < Number(item.requested_qty)) {
        return NextResponse.json({
          error: `Insufficient available stock for product ${item.product_id}. Available: ${available}, Requested: ${item.requested_qty}`,
        }, { status: 400 });
      }
    }

    for (const item of items ?? []) {
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, reserved_qty")
        .eq("product_id", item.product_id)
        .eq("warehouse_id", transfer.from_warehouse_id)
        .single();

      await supabase
        .from("inventory")
        .update({ reserved_qty: (Number(inventory?.reserved_qty) || 0) + Number(item.requested_qty) })
        .eq("id", inventory?.id);
    }

    const { data: updatedTransfer, error: updateError } = await supabase
      .from("transfers")
      .update({
        status: "approved",
        approved_by: approved_by || "System",
        approved_date: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select(`
        *,
        from_warehouse:warehouses!from_warehouse_id(id, name, location),
        to_warehouse:warehouses!to_warehouse_id(id, name, location)
      `)
      .single();

    if (updateError) throw updateError;

    await supabase.from("transfer_audit_log").insert({
      transfer_id: params.id,
      action: "approved",
      performed_by: approved_by || "System",
      details: { reserved_items: items?.map((i) => ({ product_id: i.product_id, qty: i.requested_qty })) },
    });

    const { data: transferItems } = await supabase
      .from("transfer_items")
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .eq("transfer_id", params.id);

    return NextResponse.json({ ...updatedTransfer, items: transferItems ?? [] });
  } catch (err) {
    console.error("[transfers/[id]/approve POST]", err);
    return NextResponse.json({ error: "Failed to approve transfer" }, { status: 500 });
  }
}
