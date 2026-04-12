import { NextResponse } from "next/server";

export async function GET() {
  const savings = {
    shrinkage_prevented_pct: 40,
    labor_cut_pct: 30,
    compliance_automated_pct: 80,
    overstock_reduced_pct: 25,
    payback_months: 2,
  };

  return NextResponse.json({
    data: savings,
    summary: {
      message: "Based on industry benchmarks and our MVP performance",
      source: "Research + Battle-tested data",
    },
  });
}