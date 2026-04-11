import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { shipped_by, shipped_items } = await req.json();
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

    if (transfer.status !== "approved") {
      return NextResponse.json({ error: "Only approved transfers can be shipped" }, { status: 400 });
    }

    const { data: items } = await supabase
      .from("transfer_items")
      .select("id, product_id, requested_qty")
      .eq("transfer_id", params.id);

    if (shipped_items && shipped_items.length > 0) {
      for (const si of shipped_items) {
        await supabase
          .from("transfer_items")
          .update({
            shipped_qty: si.shipped_qty,
            status: "shipped",
          })
          .eq("id", si.transfer_item_id);
      }
    } else {
      for (const item of items ?? []) {
        await supabase
          .from("transfer_items")
          .update({
            shipped_qty: item.requested_qty,
            status: "shipped",
          })
          .eq("id", item.id);
      }
    }

    const { data: updatedTransfer, error: updateError } = await supabase
      .from("transfers")
      .update({
        status: "in-transit",
        shipped_by: shipped_by || "System",
        shipped_date: new Date().toISOString(),
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
      action: "shipped",
      performed_by: shipped_by || "System",
      details: { shipped_items: items?.map((i) => ({ product_id: i.product_id, qty: i.requested_qty })) },
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
    console.error("[transfers/[id]/ship POST]", err);
    return NextResponse.json({ error: "Failed to ship transfer" }, { status: 500 });
  }
}
