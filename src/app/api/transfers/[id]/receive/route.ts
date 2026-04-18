import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { received_by, received_items } = await req.json();
    const supabase = createServerClient();

    // 1. Fetch transfer for validation (read-only, non-locking)
    const { data: transfer, error: fetchError } = await supabase
      .from("transfers")
      .select("*, from_warehouse:id,name, to_warehouse:id,name")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.status !== "in-transit") {
      return NextResponse.json(
        { error: "Only in-transit transfers can be received" },
        { status: 400 }
      );
    }

    // 2. Build items JSON for RPC Execution
    // Ensures whatever payload the frontend sends is mapped safely for Postgres
    let itemsJson: Record<string, number> = {};
    if (Array.isArray(received_items)) {
      received_items.forEach((item: any) => {
        if (item.id && typeof item.quantity === 'number') {
          itemsJson[item.id] = item.quantity;
        }
      });
    } else if (typeof received_items === 'object' && received_items !== null) {
      itemsJson = received_items;
    }

    // 3. Execute the Atomic Postgres RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('atomic_transfer_receive', {
      p_transfer_id: params.id,
      p_received_by: received_by,
      p_received_items: itemsJson
    });

    // 4. Enforce Boundary: If the database throws an exception (e.g. quantity mismatch), catch it here
    if (rpcError) {
      console.error("[RPC_MUTATION_ERROR]", rpcError);
      return NextResponse.json(
        { error: "Transaction rolled back", details: rpcError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(rpcData, { status: 200 });

  } catch (err: any) {
    // Fatal Exception Boundary
    console.error("[endpoint_fatal]", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}