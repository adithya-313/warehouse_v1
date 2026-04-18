"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  Calendar,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  cn, healthColor, healthScoreGradient, severityColor, formatDate,
  formatNumber,
} from "@/lib/utils";
import { normalizeStockScore, normalizeStockoutScore, normalizeExpiryScore, normalizeDemandScore, calculateWeightedHealth } from "@/lib/utils/health";
import type { HealthLabel, AlertSeverity } from "@/lib/types";

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "rising") return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (trend === "falling") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
};

function buildChartData(movements: { date: string; type: string; quantity: number }[]) {
  const map: Record<string, number> = {};
  for (const m of movements) {
    if (!map[m.date]) map[m.date] = 0;
    map[m.date] += m.type === "in" ? m.quantity : -m.quantity;
  }
  let running = 0;
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, delta]) => {
      running += delta;
      return { date, stock: Math.max(running, 0) };
    });
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    if (!id) return;
    setLoading(true);
    fetch("/api/analytics/" + id, { cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(json) {
        console.log("[products/[id]] Fetched Data:", JSON.stringify(json, null, 2).slice(0, 500));
        setData(json);
      })
      .catch(function(err) { console.error("[products/[id]] Fetch error:", err); })
      .finally(function() { setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.product) {
    return <div className="text-slate-400 text-sm p-6">Product not found or still loading...</div>;
  }

  const product = data.product || {};
  const analytics = data.analytics || null;
  const inventory = data.inventory || [];
  const movements = data.movements || [];
  const alerts = data.alerts || [];
  const supplier = analytics?.suppliers?.[0] || analytics?.suppliers || analytics?.supplier || null;
  const chartData = buildChartData(movements);
  const totalStock = inventory.reduce(function(s: number, i: any) { return s + (i?.quantity || 0); }, 0);
  const currentStock = (inventory[0]?.quantity) || 0;
  const reorderPoint = (inventory[0]?.reorder_point) || 0;

  const computedBurnRate = (analytics?.burn_rate) || 0.001;
  const computedDaysToStockout = computedBurnRate > 0 ? Math.floor(currentStock / computedBurnRate) : null;
  const daysToStockoutForCalc = computedDaysToStockout ?? analytics?.days_to_stockout ?? null;

  console.log("HEALTH_INPUT_CHECK:", { 
    stock: currentStock, 
    reorder: reorderPoint, 
    daysOut: daysToStockoutForCalc, 
    expiry: product.expiry_date,
    burnRate: computedBurnRate,
    analyticsHasDays: analytics?.days_to_stockout
  });

  var healthResult = calculateWeightedHealth(
    currentStock,
    reorderPoint,
    daysToStockoutForCalc,
    product.expiry_date,
    computedBurnRate
  );

  var healthComponents = healthResult.components.map(function(c: any) {
    return { label: c.label, score: c.normalized, weight: (c.weight * 100).toFixed(0) + "%" };
  });

  var overallHealthScore = healthResult.score;

  console.log("[DEBUG] Health Components:", healthComponents, "Overall:", overallHealthScore);

  var forecastChartData = (analytics?.forecast_series || []).map(function(f: any) {
    return { date: f.date, stock: f.quantity };
  });

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{product.name || "Loading..."}</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-sm text-slate-400">{product.category || "—"}</span>
            <span className="text-slate-700">·</span>
            <span className="text-sm text-slate-400">Unit: {product.unit || "—"}</span>
            {product.expiry_date && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-sm flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Expires: {formatDate(product.expiry_date)}
                </span>
              </>
            )}
          </div>
        </div>

        {analytics ? (
          <span className={cn("pill text-base px-3 py-1", healthColor(healthResult.label))}>
            Health {overallHealthScore} — {healthResult.label}
          </span>
        ) : (
          <span className="pill text-base px-3 py-1 bg-slate-500/15 text-slate-400">No Forecast</span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Current Stock", value: formatNumber(totalStock) + " " + (product.unit || "units") },
          { label: "Burn Rate", value: formatNumber(computedBurnRate, 1) + "/day" },
          { label: "Days to Stockout", value: computedDaysToStockout != null ? computedDaysToStockout + " days" : "—" },
          { label: "Classification", value: (computedBurnRate || 0) > 30 ? "Fast Moving" : (computedBurnRate || 0) > 15 ? "Medium Moving" : "Slow Moving" },
        ].map(function(_a) {
          var label = _a.label;
          var value = _a.value;
          return (
            <div key={label} className="card p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-lg font-bold text-white">{value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Stock Movement History</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendIcon trend={analytics?.demand_trend || "stable"} />
              {analytics?.demand_trend || "stable"} trend
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-600 text-sm">No movement data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#06b6d4" }}
                />
                <Area type="monotone" dataKey="stock" stroke="#06b6d4" strokeWidth={2} fill="url(#stockGrad)" />
                {forecastChartData.length > 0 && (
                  <Area type="monotone" dataKey="stock" data={forecastChartData} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" fill="url(#forecastGrad)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Health Score Breakdown</h2>
          <div className="space-y-4">
            {healthComponents.map(function(c) {
              return (
                <div key={c.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{c.label}</span>
                    <span className="text-slate-500">{c.weight} weight — {Math.round(c.score)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all", healthScoreGradient(c.score))}
                      style={{ width: c.score + "%" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-500 mb-1">Overall Health Score</div>
            <div className="text-3xl font-bold text-white">{overallHealthScore}</div>
            <div className="text-sm text-slate-400">{healthResult.label}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Supplier Info</h2>
          {supplier ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="text-slate-200">{supplier.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="text-slate-200">{supplier.email || supplier.contact_person || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Lead Time</span><span className="text-slate-200">{supplier.avg_lead_time_days} days</span></div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Scanning database for supplier...</div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Active Alerts ({alerts.length})</h2>
          {alerts.length === 0 && (
            <div className="text-sm text-slate-600">No active alerts for this product.</div>
          )}
          <div className="space-y-2">
            {alerts.map(function(a) {
              return (
                <div key={a.id} className={cn("p-2.5 rounded-lg border text-xs", severityColor(a.severity as AlertSeverity))}>
                  <div className="font-semibold mb-0.5">{a.severity.toUpperCase()}: {a.type}</div>
                  <div className="opacity-80">{a.message}</div>
                  {a.actions && a.actions[0] && (
                    <div className="mt-1.5 opacity-60">→ {a.actions[0].recommendation}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}