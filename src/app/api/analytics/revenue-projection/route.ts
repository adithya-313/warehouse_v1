import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Revenue projection model: 3x YoY growth from 5 pilot customers
    const projections = [
      { year: 1, customers: 5,    arr_crore: 0.25,  tam_pct: 0.01 },
      { year: 2, customers: 25,   arr_crore: 1.25,  tam_pct: 0.05 },
      { year: 3, customers: 100,  arr_crore: 5.0,   tam_pct: 0.2  },
      { year: 4, customers: 350,  arr_crore: 17.5,  tam_pct: 0.7  },
      { year: 5, customers: 1000, arr_crore: 50.0,  tam_pct: 2.0  },
    ];

    return NextResponse.json({ data: projections });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}