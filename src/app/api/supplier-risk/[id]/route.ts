import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("supplier_risk_scores")
      .select("*, suppliers(name)")
      .eq("supplier_id", params.id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
         return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    const result = {
      supplier_id: data.supplier_id,
      name: data.suppliers?.name,
      health_score: data.overall_risk_score,
      failure_probability_6m: data.failure_probability_6m,
      risk_level: data.risk_level,
      key_risk_factors: data.key_risk_factors,
      recommendation: data.recommendation,
      assessment_date: data.risk_assessment_date
    };
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[supplier-risk/[id] GET]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
