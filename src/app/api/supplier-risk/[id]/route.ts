import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const BAYESIAN_PRIOR_SCORE = 75.0;
const BAYESIAN_PRIOR_LEVEL = "Standard";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const supplierId = params.id;
    
    if (!supplierId) {
      return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from("supplier_risk_scores")
      .select("*, suppliers(name)")
      .eq("supplier_id", supplierId)
      .order("risk_assessment_date", { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          supplier_id: supplierId,
          risk_score: BAYESIAN_PRIOR_SCORE,
          risk_level: BAYESIAN_PRIOR_LEVEL,
          status: "Insufficient Data - Default Prior Applied",
          factors: {
            reason: "no_historical_data",
            prior_applied: true
          },
          message: "No risk assessment found. Using Bayesian prior (75.0) for this supplier. Schedule a fresh risk assessment."
        }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({
        supplier_id: supplierId,
        risk_score: BAYESIAN_PRIOR_SCORE,
        risk_level: BAYESIAN_PRIOR_LEVEL,
        status: "Insufficient Data - Default Prior Applied",
        factors: { reason: "no_data", prior_applied: true }
      }, { status: 200 });
    }
    
    const riskScore = data.overall_risk_score ?? data.financial_risk_score;
    const riskLevel = data.risk_level ?? "medium";
    
    let status = "Active";
    if (riskLevel === "low" || riskScore >= 90) {
      status = "Preferred";
    } else if (riskLevel === "high" || riskScore < 50) {
      status = "Critical";
    } else if (riskLevel === "critical") {
      status = "Critical";
    }
    
    const result = {
      supplier_id: data.supplier_id,
      name: data.suppliers?.name,
      risk_score: riskScore,
      risk_level: riskLevel,
      status: status,
      operational_risk_score: data.operational_risk_score,
      financial_risk_score: data.financial_risk_score,
      market_risk_score: data.market_risk_score,
      failure_probability_6m: data.failure_probability_6m,
      factors: data.key_risk_factors,
      recommendation: data.recommendation,
      assessment_date: data.risk_assessment_date,
      calculated_at: data.created_at
    };
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[supplier-risk/[id] GET]", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}