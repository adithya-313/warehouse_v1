import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplier_id = searchParams.get("supplier_id");
    const days = parseInt(searchParams.get("days") || "30");

    const supabase = createServerClient();
    let query = supabase
      .from("supplier_orders")
      .select("*, suppliers(id, name), products(id, name, category)")
      .order("order_date", { ascending: false });

    if (supplier_id) query = query.eq("supplier_id", supplier_id);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    query = query.gte("order_date", cutoff.toISOString().split("T")[0]);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[supplier-orders GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      supplier_id,
      product_id,
      order_date,
      expected_delivery,
      ordered_qty,
      unit_cost,
      logged_by,
    } = body;

    if (!supplier_id || !product_id || !order_date || !expected_delivery || !ordered_qty || !unit_cost) {
      return NextResponse.json(
        { error: "supplier_id, product_id, order_date, expected_delivery, ordered_qty, and unit_cost are required" },
        { status: 400 }
      );
    }

    const orderDateObj = new Date(order_date);
    const expectedDateObj = new Date(expected_delivery);
    if (expectedDateObj < orderDateObj) {
      return NextResponse.json(
        { error: "expected_delivery cannot be before order_date" },
        { status: 400 }
      );
    }

    const total_cost = ordered_qty * unit_cost;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("supplier_orders")
      .insert({
        supplier_id,
        product_id,
        order_date,
        expected_delivery,
        ordered_qty,
        unit_cost,
        total_cost,
        status: "pending",
        logged_by,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("[supplier-orders POST]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
