import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("supplier_orders")
      .select("*, suppliers(id, name), products(id, name, category)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[supplier-orders/[id]/receive GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { actual_delivery, received_qty, quality_issues, received_by } = body;

    if (!actual_delivery) {
      return NextResponse.json({ error: "actual_delivery is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: existingOrder, error: fetchError } = await supabase
      .from("supplier_orders")
      .select("order_date, ordered_qty, supplier_id, unit_cost, status")
      .eq("id", id)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existingOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (existingOrder.status === "received") {
      return NextResponse.json({ error: "Order already received" }, { status: 400 });
    }

    const actualDate = new Date(actual_delivery);
    const orderDate = new Date(existingOrder.order_date);
    if (actualDate < orderDate) {
      return NextResponse.json(
        { error: "actual_delivery cannot be before order_date" },
        { status: 400 }
      );
    }

    const maxOverage = existingOrder.ordered_qty * 1.05;
    if (received_qty !== undefined && received_qty > maxOverage) {
      return NextResponse.json(
        { error: `received_qty cannot exceed ordered_qty + 5% (max: ${maxOverage.toFixed(2)})` },
        { status: 400 }
      );
    }

    const expectedDate = await supabase
      .from("supplier_orders")
      .select("expected_delivery")
      .eq("id", id)
      .single();

    const on_time = actualDate <= new Date(expectedDate.data?.expected_delivery || 0);
    const actualReceivedQty = received_qty ?? existingOrder.ordered_qty;
    const total_cost = actualReceivedQty * existingOrder.unit_cost;

    const { data, error } = await supabase
      .from("supplier_orders")
      .update({
        actual_delivery,
        received_qty: actualReceivedQty,
        quality_issues: quality_issues || false,
        on_time,
        total_cost,
        status: "received",
        received_by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await updateSupplierPerformance(supabase, existingOrder.supplier_id);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[supplier-orders/[id]/receive POST]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

async function updateSupplierPerformance(supabase: ReturnType<typeof createServerClient>, supplierId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data: orders } = await supabase
    .from("supplier_orders")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("status", "received")
    .gte("order_date", cutoffStr);

  if (!orders || orders.length === 0) {
    await supabase
      .from("supplier_performance")
      .upsert({
        supplier_id: supplierId,
        on_time_delivery_pct: 0,
        quality_score: 100,
        avg_lead_time_days: 0,
        last_30_days_orders: 0,
        total_cost_30_days: 0,
        reliability_score: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "supplier_id" });
    return;
  }

  const onTimeCount = orders.filter((o) => o.on_time).length;
  const onTimeDeliveryPct = (onTimeCount / orders.length) * 100;

  const qualityIssuesCount = orders.filter((o) => o.quality_issues).length;
  const qualityScore = Math.max(0, Math.min(100, 100 - qualityIssuesCount * 10));

  let totalLeadTime = 0;
  let validLeadTimeCount = 0;
  for (const order of orders) {
    if (order.actual_delivery && order.order_date) {
      const lead = new Date(order.actual_delivery).getTime() - new Date(order.order_date).getTime();
      totalLeadTime += lead / (1000 * 60 * 60 * 24);
      validLeadTimeCount++;
    }
  }
  const avgLeadTimeDays = validLeadTimeCount > 0 ? totalLeadTime / validLeadTimeCount : 0;

  const totalCost30Days = orders.reduce((sum, o) => sum + (o.total_cost || 0), 0);

  const reliabilityScore = (onTimeDeliveryPct * 0.6) + (qualityScore * 0.4);

  await supabase
    .from("supplier_performance")
    .upsert({
      supplier_id: supplierId,
      on_time_delivery_pct: Math.round(onTimeDeliveryPct * 100) / 100,
      quality_score: Math.round(qualityScore * 100) / 100,
      avg_lead_time_days: Math.round(avgLeadTimeDays * 100) / 100,
      last_30_days_orders: orders.length,
      total_cost_30_days: Math.round(totalCost30Days * 100) / 100,
      reliability_score: Math.round(reliabilityScore * 100) / 100,
      updated_at: new Date().toISOString(),
    }, { onConflict: "supplier_id" });
}
