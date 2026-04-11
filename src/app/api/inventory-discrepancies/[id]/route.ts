import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("inventory_discrepancies")
      .select(`
        *,
        products ( id, name, category ),
        warehouses ( id, name ),
        cycle_counts ( id, scheduled_date )
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Discrepancy not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[inventory-discrepancies/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch discrepancy" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { resolved, resolution_notes, root_cause } = await req.json();

    const supabase = createServerClient();
    const updateData: Record<string, unknown> = {};

    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved) {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (resolution_notes !== undefined) {
      updateData.resolution_notes = resolution_notes;
    }

    if (root_cause !== undefined) {
      updateData.root_cause = root_cause;
    }

    const { data, error } = await supabase
      .from("inventory_discrepancies")
      .update(updateData)
      .eq("id", params.id)
      .select(`
        *,
        products ( id, name, category ),
        warehouses ( id, name ),
        cycle_counts ( id, scheduled_date )
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[inventory-discrepancies/[id] PATCH]", err);
    return NextResponse.json({ error: "Failed to update discrepancy" }, { status: 500 });
  }
}
