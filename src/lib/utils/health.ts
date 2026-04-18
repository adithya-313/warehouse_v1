export function normalizeStockScore(currentStock: number, reorderPoint: number): number {
  if (currentStock > reorderPoint) return 100;
  return 30;
}

export function normalizeStockoutScore(daysToStockout: number | null): number {
  if (daysToStockout === null) return 70;
  if (daysToStockout >= 14) return 100;
  if (daysToStockout <= 0) return 0;
  return Math.max(0, Math.min(100, (daysToStockout / 14) * 100));
}

export function normalizeExpiryScore(expiryDate: string | null | undefined): number {
  if (!expiryDate) return 100;
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry <= 0) return 0;
  if (daysUntilExpiry >= 90) return 100;
  if (daysUntilExpiry <= 7) return 10;
  if (daysUntilExpiry <= 30) return 30;
  if (daysUntilExpiry <= 60) return 60;
  return 80;
}

export function normalizeDemandScore(burnRate: number): number {
  if (burnRate <= 0.001) return 30;
  if (burnRate >= 30) return 100;
  if (burnRate >= 15) return 80;
  if (burnRate >= 5) return 60;
  return 40;
}

export function calculateWeightedHealth(
  currentStock: number,
  reorderPoint: number,
  daysToStockout: number | null,
  expiryDate: string | null | undefined,
  burnRate: number
): { score: number; label: string; components: { label: string; raw: number; normalized: number; weight: number; contribution: number }[] } {
  const stockScore = normalizeStockScore(currentStock, reorderPoint);
  const stockoutScore = normalizeStockoutScore(daysToStockout);
  const expiryScore = normalizeExpiryScore(expiryDate);
  const demandScore = normalizeDemandScore(burnRate);

  const weights = { stock: 0.30, stockout: 0.25, expiry: 0.25, demand: 0.20 };

  const components = [
    { label: "Stock vs Reorder", raw: currentStock, normalized: stockScore, weight: weights.stock, contribution: stockScore * weights.stock },
    { label: "Stockout Risk", raw: daysToStockout ?? -1, normalized: stockoutScore, weight: weights.stockout, contribution: stockoutScore * weights.stockout },
    { label: "Expiry Risk", raw: expiryDate ? new Date(expiryDate).getTime() : -1, normalized: expiryScore, weight: weights.expiry, contribution: expiryScore * weights.expiry },
    { label: "Demand Trend", raw: burnRate, normalized: demandScore, weight: weights.demand, contribution: demandScore * weights.demand },
  ];

  const overallScore = Math.round(
    stockScore * weights.stock +
    stockoutScore * weights.stockout +
    expiryScore * weights.expiry +
    demandScore * weights.demand
  );

  let label = "Monitor";
  if (overallScore < 40) label = "Critical";
  else if (overallScore < 60) label = "Warning";
  else if (overallScore < 80) label = "Monitor";
  else label = "Healthy";

  return { score: overallScore, label, components };
}