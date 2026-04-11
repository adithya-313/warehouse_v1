import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("warehouses")
      .select("id, name, location, capacity, created_at")
      .order("name");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[warehouses GET]", err);
    return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
  }
}
