import { NextResponse } from "next/server";

export async function GET() {
  const metrics = {
    cac: 50000,
    ltv: 500000,
    ltv_cac_ratio: 10,
    payback_months: 3,
    gross_margin: 65,
    arpu_monthly: 10000,
    nrr: 115,
    churn_rate: 5,
    expansion_revenue_pct: 15,
  };

  const breakdown = [
    { category: "One-time Setup", amount: 20000, pct: 40 },
    { category: "Implementation", amount: 15000, pct: 30 },
    { category: "Training", amount: 10000, pct: 20 },
    { category: "Onboarding", amount: 5000, pct: 10 },
  ];

  const cohortData = [
    { month: "M1", revenue: 10000, retained: 100 },
    { month: "M3", revenue: 11500, retained: 95 },
    { month: "M6", revenue: 13225, retained: 90 },
    { month: "M12", revenue: 15208, retained: 85 },
  ];

  return NextResponse.json({
    data: metrics,
    breakdown,
    cohort_data: cohortData,
    summary: {
      unit_economics: "Strong LTV:CAC ratio of 10:1",
      payback: "3 months payback period",
      retention: "115% NRR (expansion revenue included)",
    },
  });
}
