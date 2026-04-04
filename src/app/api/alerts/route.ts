import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("alerts")
      .select(`
        id, type, severity, message, resolved, whatsapp_sent, created_at,
        products ( id, name, category ),
        actions ( id, recommendation, created_at )
      `)
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[alerts GET]", err);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("alerts")
      .update({ resolved: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[alerts PATCH]", err);
    return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 });
  }
}
