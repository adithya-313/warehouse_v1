import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ZONE_ORDER = ["A", "B", "C", "D", "E", "F"];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: items, error } = await supabase
      .from("pick_batch_items")
      .select(`
        *,
        products ( id, name, category, unit ),
        bin_locations ( id, aisle, rack, bin, zone )
      `)
      .eq("pick_batch_id", params.id)
      .order("sequence_order");

    if (error) throw error;

    const routeItems = (items ?? [])
      .filter((item) => item.status === "pending" || item.status === "picked")
      .map((item) => ({
        ...item,
        products: item.products,
        bin_locations: item.bin_locations,
      }));

    const zones = [...new Set(routeItems.map((i) => (i.bin_locations as any)?.zone).filter(Boolean))].sort(
      (a, b) => ZONE_ORDER.indexOf(a) - ZONE_ORDER.indexOf(b)
    ) as string[];

    let prevZone = null;
    let zoneTransitions = 0;
    routeItems.forEach((item) => {
      const currZone = (item.bin_locations as any)?.zone;
      if (prevZone && currZone !== prevZone) zoneTransitions++;
      prevZone = currZone;
    });

    const currentZone = zones[0] || null;
    const nextZone = zones[zones.findIndex((z) => z === currentZone) + 1] || null;

    return NextResponse.json({
      items: routeItems,
      total_zones: zones,
      current_zone: currentZone,
      next_zone: nextZone,
      zone_transitions: zoneTransitions,
      estimated_distance: routeItems.length + zoneTransitions * 5,
      summary: {
        total_items: routeItems.length,
        zones_visited: zones.length,
        pending_in_current_zone: routeItems.filter((i) => (i.bin_locations as any)?.zone === currentZone).length,
      },
    });
  } catch (err) {
    console.error("[pick-batches/[id]/route GET]", err);
    return NextResponse.json({ error: "Failed to get optimized route" }, { status: 500 });
  }
}
