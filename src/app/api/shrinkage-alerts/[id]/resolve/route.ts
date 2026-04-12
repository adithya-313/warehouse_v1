import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { id } = params;
  
  try {
    const body = await req.json();
    const { resolution_status, resolution_notes, resolved_by_name } = body;
    
    if (!resolution_status) {
      return NextResponse.json({ error: "resolution_status is required" }, { status: 400 });
    }
    
    const validStatuses = ["open", "investigating", "resolved", "false_alarm"];
    if (!validStatuses.includes(resolution_status)) {
      return NextResponse.json({ error: "Invalid resolution_status" }, { status: 400 });
    }
    
    const update: Record<string, unknown> = {
      resolution_status,
      resolution_notes,
      resolved_at: new Date().toISOString()
    };
    
    if (resolved_by_name) {
      update.resolved_by_name = resolved_by_name;
    }
    
    const { data, error } = await supabase
      .from("shrinkage_alerts")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err) {
    console.error("[shrinkage-alerts resolve]", err);
    return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 });
  }
}
