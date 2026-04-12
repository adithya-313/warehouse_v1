import { NextResponse } from "next/server";

export async function GET() {
  const projections = [
    { year: 1, customers: 100, arr_crore: 5, tam_pct: 0.02 },
    { year: 2, customers: 300, arr_crore: 15, tam_pct: 0.06 },
    { year: 3, customers: 800, arr_crore: 40, tam_pct: 0.15 },
    { year: 4, customers: 1400, arr_crore: 70, tam_pct: 0.25 },
    { year: 5, customers: 2000, arr_crore: 100, tam_pct: 1.0 },
  ];

  const industryGrowth = { cagr: 20, source: "Industry benchmarks" };

  return NextResponse.json({
    data: projections,
    summary: {
      year_5_arr: 100,
      total_customers: 2000,
      tam_capture: "1%",
    },
  });
}