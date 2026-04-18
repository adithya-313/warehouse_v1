// Central Demand Simulation Engine
// Generates realistic demand forecasts with trend, seasonality, noise, floor, and confidence

export type TrendType = "rising" | "stable" | "falling";

export interface ForecastPoint {
  date: string;
  predicted_qty: number;
  confidence_lower: number;
  confidence_upper: number;
  trend: TrendType;
}

export interface SimulationConfig {
  baseValue: number;
  trend: TrendType;
  dailySlope: number; // e.g., 0.005 = 0.5% daily change
  seasonalityPeriod: number; // 7 for weekly
  noiseLevel: number; // e.g., 0.05 = ±5%
  floorValue: number; // minimum 5 units
  confidenceGrowth: number; // how fast uncertainty grows
}

const DEFAULT_CONFIG: SimulationConfig = {
  baseValue: 10,
  trend: "stable",
  dailySlope: 0.005,
  seasonalityPeriod: 7,
  noiseLevel: 0.05,
  floorValue: 5,
  confidenceGrowth: 0.008,
};

function gaussianNoise(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sineSeasonality(dayOffset: number, period: number): number {
  return Math.sin((2 * Math.PI * dayOffset) / period);
}

function linearTrend(dayOffset: number, slope: number, trend: TrendType): number {
  if (trend === "stable") return 1.0;
  if (trend === "rising") return 1 + (dayOffset * slope);
  // Falling: use log decay that bottoms out at floor ratio
  const decay = Math.log(1 + dayOffset * 0.08);
  return Math.max(0.1, 1 - (decay * slope * 20));
}

export function generateDemandSeries(
  days: number = 90,
  config: Partial<SimulationConfig> = {}
): ForecastPoint[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const today = new Date();
  const results: ForecastPoint[] = [];

  for (let dayOffset = 1; dayOffset <= days; dayOffset++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(today.getDate() + dayOffset);
    const dateStr = forecastDate.toISOString().split("T")[0];
    
    // Day of week for seasonality (0 = Sunday)
    const dayOfWeek = forecastDate.getDay();
    // Weekly pattern: Mon-Thu lower (0.8), Fri-Sun higher (1.3)
    let weekFactor = 1.0;
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      weekFactor = 0.8;
    } else {
      weekFactor = 1.3;
    }
    
    // Layer: Trend + Seasonality + Noise
    const trendFactor = linearTrend(dayOffset, cfg.dailySlope, cfg.trend);
    const seasonalWave = sineSeasonality(dayOffset, cfg.seasonalityPeriod) * 0.1;
    const noise = gaussianNoise() * cfg.noiseLevel;
    
    let predicted = cfg.baseValue * trendFactor * (weekFactor + seasonalWave) * (1 + noise);
    
    // Apply floor
    predicted = Math.max(cfg.floorValue, predicted);
    const finalPredicted = Math.round(predicted);
    
    // Funnel confidence: grows with time, minimum 30% of predicted
    const spreadBase = 0.15 + (dayOffset * cfg.confidenceGrowth);
    const spreadAmount = Math.max(
      Math.round(finalPredicted * 0.3), // minimum absolute spread
      Math.round(finalPredicted * spreadBase)
    );
    
    const confidenceLower = Math.max(0, finalPredicted - spreadAmount);
    const confidenceUpper = finalPredicted + spreadAmount;
    
    results.push({
      date: dateStr,
      predicted_qty: finalPredicted,
      confidence_lower: confidenceLower,
      confidence_upper: confidenceUpper,
      trend: cfg.trend,
    });
  }
  
  return results;
}

// Calculate trend using window comparison (first 7 vs last 7 days)
export function calculateTrendFromSeries(series: ForecastPoint[]): TrendType {
  if (series.length < 14) return "stable";
  
  const firstWeek = series.slice(0, 7);
  const lastWeek = series.slice(-7);
  
  const avgFirst = firstWeek.reduce((sum, p) => sum + p.predicted_qty, 0) / firstWeek.length;
  const avgLast = lastWeek.reduce((sum, p) => sum + p.predicted_qty, 0) / lastWeek.length;
  
  if (avgFirst === 0) return "stable";
  
  const ratio = avgLast / avgFirst;
  if (ratio > 1.15) return "rising";
  if (ratio < 0.85) return "falling";
  return "stable";
}

// Generate insight based on trend and inventory level
export function generateInsight(
  trend: TrendType,
  currentStock: number,
  avgPredicted: number
): string {
  if (trend === "rising" && currentStock < 50) {
    const daysToStockout = avgPredicted > 0 ? Math.floor(currentStock / avgPredicted) : 7;
    return `Potential stockout in ${daysToStockout} days. Increase reorder qty.`;
  }
  
  if (trend === "falling" && currentStock > 100) {
    return "Overstock risk. Recommend liquidation or promotional campaign.";
  }
  
  if (trend === "stable") {
    return "Demand is stable. Maintain current reorder frequency.";
  }
  
  const daysSupply = avgPredicted > 0 ? Math.floor(currentStock / avgPredicted) : 30;
  
  if (daysSupply < 14) {
    return `Low stock coverage (${daysSupply} days). Consider expedited reorder.`;
  }
  if (daysSupply > 60) {
    return `Excess stock coverage (${daysSupply} days). Review slow-moving inventory.`;
  }
  
  return "Stock levels adequate for forecasted demand.";
}