import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { manager_id, action_taken } = await req.json();

    if (!manager_id) {
      return NextResponse.json({ error: "manager_id required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("liquidation_recommendations")
      .update({
        acknowledged_by: manager_id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, action_taken: action_taken || "acknowledged" });
  } catch (error: any) {
    console.error("[liquidation-recommendations/[id]/acknowledge POST]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
