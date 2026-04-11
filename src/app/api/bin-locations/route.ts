import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get("warehouse_id");
    const zone = searchParams.get("zone");

    const supabase = createServerClient();
    let query = supabase
      .from("bin_locations")
      .select(`
        *,
        products ( id, name, category, unit ),
        warehouses ( id, name )
      `)
      .order("zone")
      .order("aisle")
      .order("rack")
      .order("bin");

    if (warehouse_id) query = query.eq("warehouse_id", warehouse_id);
    if (zone) query = query.eq("zone", zone);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[bin-locations GET]", err);
    return NextResponse.json({ error: "Failed to fetch bin locations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { warehouse_id, aisle, rack, bin, zone, product_id, qty_on_hand } = await req.json();

    if (!warehouse_id || !aisle || !rack || !bin) {
      return NextResponse.json({ error: "warehouse_id, aisle, rack, and bin are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bin_locations")
      .insert({
        warehouse_id,
        aisle,
        rack,
        bin,
        zone: zone || "A",
        product_id,
        qty_on_hand: qty_on_hand || 0,
      })
      .select(`
        *,
        products ( id, name, category, unit ),
        warehouses ( id, name )
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[bin-locations POST]", err);
    return NextResponse.json({ error: "Failed to create bin location" }, { status: 500 });
  }
}
