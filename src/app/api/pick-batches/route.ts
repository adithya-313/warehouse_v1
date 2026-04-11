import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ZONE_ORDER = ["A", "B", "C", "D", "E", "F"];

function sortByZoneAndLocation(a: any, b: any) {
  const zoneCompare = ZONE_ORDER.indexOf(a.bin_locations?.zone) - ZONE_ORDER.indexOf(b.bin_locations?.zone);
  if (zoneCompare !== 0) return zoneCompare;
  const aisleCompare = a.bin_locations?.aisle.localeCompare(b.bin_locations?.aisle);
  if (aisleCompare !== 0) return aisleCompare;
  return a.bin_locations?.rack.localeCompare(b.bin_locations?.rack);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get("warehouse_id");
    const status = searchParams.get("status");

    const supabase = createServerClient();
    let query = supabase
      .from("pick_batches")
      .select(`
        *,
        warehouses ( id, name )
      `)
      .order("created_date", { ascending: false });

    if (warehouse_id) query = query.eq("warehouse_id", warehouse_id);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const batches = await Promise.all(
      (data ?? []).map(async (batch) => {
        const { data: items } = await supabase
          .from("pick_batch_items")
          .select("id, status, requested_qty, picked_qty, bin_locations(zone)")
          .eq("pick_batch_id", batch.id);

        const itemsArray = items ?? [];
        const picked = itemsArray.filter((i) => i.status === "picked" || i.status === "verified").length;
        const pending = itemsArray.filter((i) => i.status === "pending").length;
        const zones = [...new Set(itemsArray.map((i) => (i.bin_locations as any)?.zone).filter(Boolean))];

        return {
          ...batch,
          picked_count: picked,
          pending_count: pending,
          progress_pct: itemsArray.length > 0 ? Math.round((picked / itemsArray.length) * 100) : 0,
          current_zone: zones[0] || null,
        };
      })
    );

    return NextResponse.json(batches);
  } catch (err) {
    console.error("[pick-batches GET]", err);
    return NextResponse.json({ error: "Failed to fetch pick batches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { warehouse_id, order_ids, notes } = await req.json();

    if (!warehouse_id) {
      return NextResponse.json({ error: "warehouse_id is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: binLocations } = await supabase
      .from("bin_locations")
      .select(`
        id, product_id, warehouse_id, aisle, rack, bin, zone,
        products ( id, name, category, unit )
      `)
      .eq("warehouse_id", warehouse_id)
      .not("product_id", "is", null)
      .gt("qty_on_hand", 0);

    if (!binLocations || binLocations.length === 0) {
      return NextResponse.json({ error: "No bin locations found for this warehouse" }, { status: 400 });
    }

    const { data: inventory } = await supabase
      .from("inventory")
      .select("id, product_id, quantity, warehouse_id")
      .eq("warehouse_id", warehouse_id)
      .gt("quantity", 0);

    const inventoryMap = new Map((inventory ?? []).map((inv) => [inv.product_id, inv]));

    const itemsToCreate: any[] = [];
    const productLocations = new Map();

    for (const bin of binLocations ?? []) {
      const inv = inventoryMap.get(bin.product_id);
      if (inv && !itemsToCreate.find((i) => i.product_id === bin.product_id)) {
        itemsToCreate.push({
          product_id: bin.product_id,
          requested_qty: Math.min(10, Number(inv.quantity)),
          location_id: bin.id,
          zone: bin.zone,
          aisle: bin.aisle,
          rack: bin.rack,
          bin: bin.bin,
          products: bin.products,
          bin_locations: bin,
        });
      }
    }

    itemsToCreate.sort(sortByZoneAndLocation);
    itemsToCreate.forEach((item, idx) => {
      item.sequence_order = idx + 1;
    });

    const { data: batch, error: batchError } = await supabase
      .from("pick_batches")
      .insert({
        warehouse_id,
        status: "draft",
        order_ids: order_ids || [],
        notes,
        total_items: itemsToCreate.length,
        created_date: new Date().toISOString().split("T")[0],
      })
      .select(`
        *,
        warehouses ( id, name )
      `)
      .single();

    if (batchError) throw batchError;

    const batchItems = itemsToCreate.map((item) => ({
      pick_batch_id: batch.id,
      product_id: item.product_id,
      location_id: item.location_id,
      requested_qty: item.requested_qty,
      sequence_order: item.sequence_order,
      status: "pending" as const,
    }));

    const { error: itemsError } = await supabase
      .from("pick_batch_items")
      .insert(batchItems);

    if (itemsError) throw itemsError;

    await supabase.from("pick_audit_log").insert({
      pick_batch_id: batch.id,
      action: "created",
      details: { item_count: itemsToCreate.length, warehouse_id },
    });

    const { data: fullItems } = await supabase
      .from("pick_batch_items")
      .select(`
        *,
        products ( id, name, category, unit ),
        bin_locations ( id, aisle, rack, bin, zone )
      `)
      .eq("pick_batch_id", batch.id)
      .order("sequence_order");

    return NextResponse.json({ ...batch, items: fullItems ?? [] }, { status: 201 });
  } catch (err) {
    console.error("[pick-batches POST]", err);
    return NextResponse.json({ error: "Failed to create pick batch" }, { status: 500 });
  }
}
