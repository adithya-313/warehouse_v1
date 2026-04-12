import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get("severity");
    
    let query = supabase
      .from("supplier_risk_alerts")
      .select("supplier_id, alert_type, severity, message, created_at")
      .order("created_at", { ascending: false });
      
    if (severity) {
      query = query.eq("severity", severity);
    }
    
    const { data, error } = await query;
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json(data || [], { status: 200 });
  } catch (error: any) {
    console.error("[supplier-risk/alerts GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
