import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { received_by, received_items } = await req.json();
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

    if (transfer.status !== "in-transit") {
      return NextResponse.json({ error: "Only in-transit transfers can be received" }, { status: 400 });
    }

    const { data: items } = await supabase
      .from("transfer_items")
      .select("id, product_id, requested_qty, shipped_qty")
      .eq("transfer_id", params.id);

    const itemsUpdate: Record<string, { received_qty: number; variance: number; variance_pct: number; status: string }> = {};
    let hasOverReceive = false;
    let overReceiveItems: string[] = [];

    for (const item of items ?? []) {
      const receivedItem = received_items?.find((ri: { transfer_item_id: string }) => ri.transfer_item_id === item.id);
      const receivedQty = receivedItem?.received_qty ?? Number(item.shipped_qty);
      const shippedQty = Number(item.shipped_qty);

      if (receivedQty > shippedQty) {
        hasOverReceive = true;
        overReceiveItems.push(item.product_id);
      }

      const variance = receivedQty - shippedQty;
      const variancePct = shippedQty === 0 ? (receivedQty === 0 ? 0 : 100) : (variance / shippedQty) * 100;

      itemsUpdate[item.id] = {
        received_qty: receivedQty,
        variance,
        variance_pct: variancePct,
        status: variance !== 0 ? "received" : "received",
      };
    }

    if (hasOverReceive) {
      return NextResponse.json({
        error: "Received quantity cannot exceed shipped quantity",
        over_receive_items: overReceiveItems,
      }, { status: 400 });
    }

    for (const [itemId, update] of Object.entries(itemsUpdate)) {
      await supabase
        .from("transfer_items")
        .update(update)
        .eq("id", itemId);
    }

    for (const item of items ?? []) {
      const update = itemsUpdate[item.id];
      const { data: fromInventory } = await supabase
        .from("inventory")
        .select("id, quantity, reserved_qty")
        .eq("product_id", item.product_id)
        .eq("warehouse_id", transfer.from_warehouse_id)
        .single();

      if (fromInventory) {
        await supabase
          .from("inventory")
          .update({
            quantity: Number(fromInventory.quantity) - update.received_qty,
            reserved_qty: Math.max(0, (Number(fromInventory.reserved_qty) || 0) - Number(item.requested_qty)),
          })
          .eq("id", fromInventory.id);

        const { data: toInventory } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("product_id", item.product_id)
          .eq("warehouse_id", transfer.to_warehouse_id)
          .single();

        if (toInventory) {
          await supabase
            .from("inventory")
            .update({ quantity: Number(toInventory.quantity) + update.received_qty })
            .eq("id", toInventory.id);
        } else {
          await supabase
            .from("inventory")
            .insert({
              product_id: item.product_id,
              warehouse_id: transfer.to_warehouse_id,
              quantity: update.received_qty,
              reserved_qty: 0,
            });
        }
      }
    }

    const { data: updatedTransfer, error: updateError } = await supabase
      .from("transfers")
      .update({
        status: "received",
        received_by: received_by || "System",
        received_date: new Date().toISOString(),
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
      action: "received",
      performed_by: received_by || "System",
      details: { received_items: Object.entries(itemsUpdate).map(([id, u]) => ({ item_id: id, qty: u.received_qty, variance: u.variance })) },
    });

    const { data: transferItems } = await supabase
      .from("transfer_items")
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .eq("transfer_id", params.id);

    const varianceCount = Object.values(itemsUpdate).filter((u) => u.variance !== 0).length;

    return NextResponse.json({
      ...updatedTransfer,
      items: transferItems ?? [],
      summary: {
        total_items: items?.length ?? 0,
        received_items: Object.keys(itemsUpdate).length,
        variance_count: varianceCount,
      },
    });
  } catch (err) {
    console.error("[transfers/[id]/receive POST]", err);
    return NextResponse.json({ error: "Failed to receive transfer" }, { status: 500 });
  }
}
