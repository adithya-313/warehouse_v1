import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get("sort_by") || "risk";

    const { data, error } = await supabase
      .from("supplier_health_scores")
      .select("*")
      .order("overall_risk_score", { ascending: sortBy !== "risk" });

    if (error) {
      console.error("SUPPLIER_RISK_ERROR:", error.message, (error as any).stack);
      return NextResponse.json({ error: error.message, stack: (error as any).stack }, { status: 500 });
    }

    console.log("=== SUPPLIER_RISK_ALL DEBUG ===");
    console.log("Query executed");
    console.log("Raw data from query:", JSON.stringify(data, null, 2));
    console.log("Data length:", data?.length);
    console.log("Data type:", typeof data);
    console.log("================================");

    const mapped = (data || []).map(row => ({
      supplier_id: row.supplier_id,
      name: row.suppliers?.name,
      on_time_pct: row.on_time_pct || 0,
      quality_score: row.quality_score || 0,
      overall_risk_score: row.overall_risk_score,
      risk_level: row.risk_level
    }));

    return NextResponse.json(mapped, { status: 200 });
  } catch (error: any) {
    console.error("SUPPLIER_RISK_ERROR:", error.message, error.stack);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
