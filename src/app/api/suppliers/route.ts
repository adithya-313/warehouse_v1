import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const supabase = createServerClient();
    let query = supabase
      .from("suppliers")
      .select("*, supplier_performance(*)")
      .order("name");

    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[suppliers GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, contact_person, email, phone, payment_terms, avg_lead_time_days, category, rating } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "rating must be between 1 and 5" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name,
        contact_person,
        email,
        phone,
        payment_terms: payment_terms || 30,
        avg_lead_time_days: avg_lead_time_days || 7,
        category: category || "secondary",
        rating,
        status: "active",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("[suppliers POST]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
