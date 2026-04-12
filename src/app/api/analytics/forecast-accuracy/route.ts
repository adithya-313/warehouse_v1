import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  const mockForecastData = [
    { product_name: "Basmati Rice 10kg", predicted_qty: 500, actual_qty: 485, accuracy_pct: 97 },
    { product_name: "Sunflower Oil 1L", predicted_qty: 300, actual_qty: 295, accuracy_pct: 98 },
    { product_name: "Paracetamol 500mg", predicted_qty: 2000, actual_qty: 1950, accuracy_pct: 98 },
    { product_name: "Packaged Water 1L", predicted_qty: 1500, actual_qty: 1420, accuracy_pct: 95 },
    { product_name: "Cough Syrup 100ml", predicted_qty: 150, actual_qty: 140, accuracy_pct: 93 },
    { product_name: "Amoxicillin 250mg", predicted_qty: 400, actual_qty: 380, accuracy_pct: 95 },
    { product_name: "Tomato Ketchup 1L", predicted_qty: 250, actual_qty: 230, accuracy_pct: 92 },
    { product_name: "Butter 500g", predicted_qty: 100, actual_qty: 95, accuracy_pct: 95 },
    { product_name: "HDMI Cable 2m", predicted_qty: 80, actual_qty: 75, accuracy_pct: 94 },
    { product_name: "Wireless Mouse", predicted_qty: 120, actual_qty: 110, accuracy_pct: 92 },
    { product_name: "USB-C Charger", predicted_qty: 200, actual_qty: 190, accuracy_pct: 95 },
    { product_name: "Laptop Stand", predicted_qty: 50, actual_qty: 48, accuracy_pct: 96 }
  ];

  const withinTolerance = mockForecastData.filter(d => d.accuracy_pct >= 90).length;
  const totalAccuracy = (mockForecastData.reduce((sum, d) => sum + d.accuracy_pct, 0) / mockForecastData.length);

  return NextResponse.json({
    data: mockForecastData,
    summary: {
      avg_accuracy: Math.round(totalAccuracy),
      accurate_within_10pct: withinTolerance,
      total_products: mockForecastData.length,
      high_confidence_count: mockForecastData.filter(d => d.accuracy_pct >= 95).length,
      message: `${withinTolerance} out of ${mockForecastData.length} predictions within 10% of actual`,
    },
  });
}