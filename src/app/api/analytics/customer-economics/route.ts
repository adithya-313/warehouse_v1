import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cohort_data = [
      { month: 'M1',  revenue: 41667,  retained: 100 },
      { month: 'M2',  revenue: 43750,  retained: 105 },
      { month: 'M3',  revenue: 45000,  retained: 108 },
      { month: 'M4',  revenue: 47500,  retained: 114 },
      { month: 'M5',  revenue: 50000,  retained: 120 },
      { month: 'M6',  revenue: 52083,  retained: 125 },
    ];

    return NextResponse.json({
      data: {
        cac: 75000,
        ltv: 750000,
        ltv_cat_ratio: 10,
        payback_months: 3,
        gross_margin: 75,
        arpu_monthly: 41667,
        nrr: 115,
        churn_rate: 5,
        expansion_revenue_pct: 20,
      },
      cohort_data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
