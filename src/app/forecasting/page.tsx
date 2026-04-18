"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Package, AlertTriangle, Clock } from "lucide-react";
import { cn, formatNumber, formatDate } from "@/lib/utils";
import type { DemandForecast, ForecastSummary, DemandTrend, Warehouse } from "@/lib/types";

const trendIcon = {
  rising: TrendingUp,
  stable: Minus,
  falling: TrendingDown,
};

const trendColor = {
  rising: "text-green-400 bg-green-500/15",
  stable: "text-slate-400 bg-slate-500/15",
  falling: "text-red-400 bg-red-500/15",
};

function TrendBadge({ trend }: { trend?: DemandTrend | string | null }) {
  const safeTrend = trend || "stable";
  const Icon = trendIcon[safeTrend as DemandTrend] || Minus;
  const colorKey = safeTrend as keyof typeof trendColor;
  return (
    <span className={cn("pill gap-1.5", trendColor[colorKey] || trendColor.stable)}>
      <Icon className="w-3 h-3" />
      {safeTrend ? (safeTrend.charAt(0).toUpperCase() + safeTrend.slice(1)) : "Stable"}
    </span>
  );
}

function ConfidenceBar({ score = 0 }: { score?: number }) {
  const safeScore = score ?? 0;
  const color = safeScore >= 70 ? "bg-green-500" : safeScore >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${safeScore}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{(safeScore || 0).toFixed(0)}%</span>
    </div>
  );
}

export default function ForecastingPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "demand" | "overstock">("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => {
        setWarehouses(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          setSelectedWarehouse(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedWarehouse) return;
    setLoading(true);
    fetch(`/api/demand-forecast?warehouse_id=${selectedWarehouse}`)
      .then((r) => r.json())
      .then((fc) => {
        if (Array.isArray(fc)) {
          console.log("FORECAST_ITEM_SAMPLE:", fc[0]);
          
          // Add days_ahead calculation based on forecast_date
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const processedForecasts = fc.map((f: any) => {
            const forecastDate = new Date(f.forecast_date);
            const diffTime = forecastDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Calculate trend and ensure all numeric fields have fallbacks
            let trend: "rising" | "stable" | "falling" = "stable";
            if (diffDays > 0 && f.predicted_qty) {
              trend = f.trend || "stable";
            }
            return { 
              ...f, 
              days_ahead: diffDays, 
              trend,
              predicted_qty: f.predicted_qty ?? 0,
              confidence_upper: f.confidence_upper ?? 0,
              confidence_lower: f.confidence_lower ?? 0,
            };
          });
          
          setForecasts(processedForecasts);
          if (processedForecasts.length > 0) {
            const byProduct = new Map<string, any[]>();
            for (const f of processedForecasts) {
              if (!byProduct.has(f.product_id)) byProduct.set(f.product_id, []);
              byProduct.get(f.product_id)!.push(f);
            }
            const valid = Array.from(byProduct.values()).filter((arr) => arr.length >= 14);
            const trends = { rising: 0, stable: 0, falling: 0 };
            let totalConf = 0;
            let confCount = 0;
            for (const arr of valid) {
              // Sort by date to ensure correct ordering
              const sorted = [...arr].sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));
              // Window calculation: First 7 days vs Last 7 days
              const firstWeek = sorted.slice(0, 7);
              const lastWeek = sorted.slice(-7);
              const avgFirst = firstWeek.reduce((sum, f) => sum + (f.predicted_qty || 0), 0) / firstWeek.length;
              const avgLast = lastWeek.reduce((sum, f) => sum + (f.predicted_qty || 0), 0) / lastWeek.length;
              let productTrend = "stable";
              if (avgFirst > 0 && avgLast > 0) {
                const ratio = avgLast / avgFirst;
                if (ratio > 1.15) productTrend = "rising";
                else if (ratio < 0.85) productTrend = "falling";
              }
              if (productTrend === "rising") trends.rising++;
              else if (productTrend === "falling") trends.falling++;
              else trends.stable++;
              // Confidence from day 30 (or middle of forecast)
              const f30 = arr.find((f) => f.days_ahead >= 28 && f.days_ahead <= 32);
              if (f30?.confidence_upper != null && f30?.confidence_lower != null && f30?.predicted_qty) {
                const confidenceScore = 100 - (((f30.confidence_upper - f30.confidence_lower) / 2 / f30.predicted_qty) * 100);
                totalConf += Math.max(0, Math.min(100, confidenceScore));
                confCount++;
              }
            }
            setSummary({
              total_products: valid.length,
              forecasted: fc.length,
              errors: 0,
              rising: trends.rising,
              stable: trends.stable,
              falling: trends.falling,
              avg_confidence: confCount > 0 ? Math.round(totalConf / confCount) : 75,
              warehouse_id: selectedWarehouse,
              last_run: new Date().toISOString(),
            });
          } else {
            setSummary(null);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch forecasts:", err);
        setForecasts([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [selectedWarehouse]);

  const generateForecasts = async () => {
    if (!selectedWarehouse) return;
    setGenerating(true);
    try {
      const r = await fetch("/api/demand-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: selectedWarehouse }),
      });
      const result = await r.json();
      if (r.ok) {
        const refresh = await fetch(`/api/demand-forecast?warehouse_id=${selectedWarehouse}`);
        if (refresh.ok) {
          const fc = await refresh.json();
          setForecasts(Array.isArray(fc) ? fc : []);
          // Trigger a re-render to recalculate summary
          setSelectedWarehouse("");
          setTimeout(() => setSelectedWarehouse(selectedWarehouse), 100);
        }
      } else {
        console.error("Forecast generation failed:", result.error);
        alert(result.error || "Failed to generate forecasts");
      }
    } catch (err) {
      console.error("Forecast generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  const byProduct = useMemo(() => {
    const map = new Map<string, { forecasts: DemandForecast[]; product: any }>();
    for (const f of forecasts) {
      if (!map.has(f.product_id)) {
        map.set(f.product_id, { forecasts: [], product: (f as any).products });
      }
      map.get(f.product_id)!.forecasts.push(f);
    }
    return Array.from(map.values())
      .filter(({ forecasts: arr }) => arr.length >= 3)
      .filter(({ product }) => !search || product?.name?.toLowerCase().includes(search.toLowerCase()));
  }, [forecasts, search]);

  const urgencyOrder = { high: 0, medium: 1, low: 2 };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Demand Forecasting</h1>
          <p className="text-sm text-slate-500 mt-1">30/60/90-day predictions with Prophet</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={generateForecasts}
            disabled={generating || !selectedWarehouse}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
            {generating ? "Generating…" : "Generate Forecasts"}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
        {(["overview", "demand", "overstock"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition",
              activeTab === tab
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab === "overview" ? "Overview" : tab === "demand" ? "Demand Forecast" : "Overstock"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-5">
          {summary && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                      <Package className="w-4 h-4 text-cyan-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">{summary.total_products}</div>
                  <div className="text-sm text-slate-400 mt-0.5">Products Forecasted</div>
                </div>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">{summary.rising}</div>
                  <div className="text-sm text-slate-400 mt-0.5">Rising Demand</div>
                </div>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">{summary.falling}</div>
                  <div className="text-sm text-slate-400 mt-0.5">Falling Demand</div>
                </div>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-purple-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">{summary.avg_confidence.toFixed(0)}%</div>
                  <div className="text-sm text-slate-400 mt-0.5">Avg Confidence</div>
                </div>
              </div>

              <div className="card p-4">
                <div className="text-xs text-slate-500 mb-2">Last Run</div>
                <div className="text-sm text-slate-300">
                  {summary.last_run ? formatDate(summary.last_run) : "Never"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Rising", value: summary.rising, color: "text-green-400" },
                  { label: "Stable", value: summary.stable, color: "text-slate-400" },
                  { label: "Falling", value: summary.falling, color: "text-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card p-4 flex items-center justify-between">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className={cn("text-xl font-bold", color)}>{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {forecasts.length > 0 && (
            <div className="card p-3 bg-cyan-900/30 border border-cyan-500/30">
              <div className="text-sm text-cyan-400">
                DEBUG: Found {forecasts.length} forecast rows for Warehouse {selectedWarehouse}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          )}

          {!summary && !loading && (
            <div className="space-y-5">
              <div className="card p-12 flex flex-col items-center gap-3 text-center">
                <AlertTriangle className="w-10 h-10 text-yellow-400" />
                <div className="text-white font-medium">No forecasts generated yet</div>
                <div className="text-sm text-slate-500">
                  Generate forecasts to see demand predictions for this warehouse
                </div>
              </div>
              <button
                onClick={generateForecasts}
                disabled={generating || !selectedWarehouse}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
                {generating ? "Generating…" : "Generate Forecasts"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "demand" && (
        <div className="space-y-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-center px-4 py-3 font-medium">Trend</th>
                    <th className="text-right px-4 py-3 font-medium">30-Day</th>
                    <th className="text-right px-4 py-3 font-medium">60-Day</th>
                    <th className="text-right px-4 py-3 font-medium">90-Day</th>
                    <th className="text-center px-4 py-3 font-medium">Confidence</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                      </td>
                    </tr>
                  )}
                  {!loading && byProduct.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-600 text-sm">
                        {forecasts.length === 0 ? "No forecasts available" : "No products match your search"}
                      </td>
                    </tr>
                  )}
                  {byProduct.map(({ forecasts: arr, product }) => {
                    // Sort by forecast_date for proper window calculation
                    const sorted = [...arr].sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));
                    const firstWeek = sorted.slice(0, 7);
                    const lastWeek = sorted.slice(-7);
                    const avgFirst = firstWeek.reduce((sum, f) => sum + (f.predicted_qty || 0), 0) / firstWeek.length;
                    const avgLast = lastWeek.reduce((sum, f) => sum + (f.predicted_qty || 0), 0) / lastWeek.length;
                    
                    let displayTrend: "rising" | "stable" | "falling" = "stable";
                    let displayConfidence = 0;
                    
                    if (avgFirst > 0 && avgLast > 0) {
                      const ratio = avgLast / avgFirst;
                      displayTrend = ratio > 1.15 ? "rising" : ratio < 0.85 ? "falling" : "stable";
                    }
                    
                    // Confidence from day 30
                    const f30 = arr.find((f) => f.days_ahead >= 28 && f.days_ahead <= 32);
                    if (f30?.confidence_upper != null && f30?.confidence_lower != null && f30?.predicted_qty) {
                      const range = f30.confidence_upper - f30.confidence_lower;
                      const midpoint = range / 2;
                      displayConfidence = f30.predicted_qty > 0 
                        ? Math.max(0, Math.min(100, 100 - (midpoint / f30.predicted_qty * 100)))
                        : 75;
                    } else {
                      displayConfidence = 75;
                    }
                    
                    const f60 = arr.find((f) => f.days_ahead >= 58 && f.days_ahead <= 62);
                    const f90 = arr.find((f) => f.days_ahead >= 88 && f.days_ahead <= 92);
                    return (
                      <tr key={arr[0].product_id} className="trow">
                        <td className="px-4 py-3 font-medium text-slate-100">{product?.name || "Unknown"}</td>
                        <td className="px-4 py-3 text-center">
                          <TrendBadge trend={displayTrend} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                          {f30 ? formatNumber(f30.predicted_qty) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                          {f60 ? formatNumber(f60.predicted_qty) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                          {f90 ? formatNumber(f90.predicted_qty) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ConfidenceBar score={displayConfidence} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/analytics/demand-trends?product_id=${arr[0].product_id}&warehouse_id=${selectedWarehouse}`}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                          >
                            Trends →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "overstock" && (
        <OverstockTab warehouseId={selectedWarehouse} />
      )}
    </div>
  );
}

function OverstockTab({ warehouseId }: { warehouseId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!warehouseId) return;
    setLoading(true);
    fetch(`/api/overstock-analysis?warehouse_id=${warehouseId}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, [warehouseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center gap-3 text-center">
        <Package className="w-10 h-10 text-slate-500" />
        <div className="text-white font-medium">No overstock items</div>
        <div className="text-sm text-slate-500">All products are within healthy stock levels</div>
      </div>
    );
  }

  const urgencyColor: Record<string, string> = {
    high: "text-red-400 bg-red-500/15",
    medium: "text-yellow-400 bg-yellow-500/15",
    low: "text-blue-400 bg-blue-500/15",
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
              <th className="text-left px-4 py-3 font-medium">Product</th>
              <th className="text-center px-4 py-3 font-medium">Urgency</th>
              <th className="text-right px-4 py-3 font-medium">Current Qty</th>
              <th className="text-right px-4 py-3 font-medium">Days Supply</th>
              <th className="text-right px-4 py-3 font-medium">Discount</th>
              <th className="text-right px-4 py-3 font-medium">Capital Tied</th>
              <th className="text-right px-4 py-3 font-medium">Est. Loss</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.product_id} className="trow">
                <td className="px-4 py-3 font-medium text-slate-100">{item.product_name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("pill text-xs", urgencyColor[item.urgency_level])}>
                    {item.urgency_level.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                  {formatNumber(item.current_qty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                  {item.days_supply.toFixed(0)}d
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-400">
                  -{item.recommended_discount}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                  ${formatNumber(item.capital_tied_up)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-400">
                  ${formatNumber(item.estimated_revenue_loss)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
