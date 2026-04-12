import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = createServerClient();
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single();

    if (supplierError) return NextResponse.json({ error: supplierError.message }, { status: 500 });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    return NextResponse.json(supplier);
  } catch (error: any) {
    console.error("[suppliers/[id] GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, contact_person, email, phone, payment_terms, avg_lead_time_days, category, rating, status } = body;

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "rating must be between 1 and 5" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("suppliers")
      .update({
        ...(name && { name }),
        ...(contact_person !== undefined && { contact_person }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(payment_terms !== undefined && { payment_terms }),
        ...(avg_lead_time_days !== undefined && { avg_lead_time_days }),
        ...(category && { category }),
        ...(rating !== undefined && { rating }),
        ...(status && { status }),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[suppliers/[id] PATCH]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[suppliers/[id] DELETE]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
