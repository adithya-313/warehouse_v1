import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { reason, cancelled_by } = await req.json();
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

    if (transfer.status === "in-transit" || transfer.status === "received") {
      return NextResponse.json({
        error: `Cannot cancel a transfer that is ${transfer.status}. Only draft, approved, or pending transfers can be cancelled.`,
      }, { status: 400 });
    }

    if (transfer.status === "approved") {
      const { data: items } = await supabase
        .from("transfer_items")
        .select("product_id, requested_qty")
        .eq("transfer_id", params.id);

      for (const item of items ?? []) {
        const { data: inventory } = await supabase
          .from("inventory")
          .select("id, reserved_qty")
          .eq("product_id", item.product_id)
          .eq("warehouse_id", transfer.from_warehouse_id)
          .single();

        if (inventory) {
          await supabase
            .from("inventory")
            .update({ reserved_qty: Math.max(0, (Number(inventory.reserved_qty) || 0) - Number(item.requested_qty)) })
            .eq("id", inventory.id);
        }
      }
    }

    const { data: updatedTransfer, error: updateError } = await supabase
      .from("transfers")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || "No reason provided",
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
      action: "cancelled",
      performed_by: cancelled_by || "System",
      details: { reason: reason || "No reason provided", unreserved: transfer.status === "approved" },
    });

    return NextResponse.json(updatedTransfer);
  } catch (err) {
    console.error("[transfers/[id]/cancel POST]", err);
    return NextResponse.json({ error: "Failed to cancel transfer" }, { status: 500 });
  }
}
