import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: transfer, error } = await supabase
      .from("transfers")
      .select(`
        *,
        from_warehouse:warehouses!from_warehouse_id(id, name, location),
        to_warehouse:warehouses!to_warehouse_id(id, name, location)
      `)
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (error || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("transfer_items")
      .select(`
        *,
        products ( id, name, category, unit )
      `)
      .eq("transfer_id", params.id);

    const { data: auditLog } = await supabase
      .from("transfer_audit_log")
      .select("*")
      .eq("transfer_id", params.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ ...transfer, items: items ?? [], audit_log: auditLog ?? [] });
  } catch (err) {
    console.error("[transfers/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch transfer" }, { status: 500 });
  }
}
