"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, Minus, Package, Calendar } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { DemandTrendData, DemandTrend } from "@/lib/types";

const trendIcon = {
  rising: TrendingUp,
  stable: Minus,
  falling: TrendingDown,
};

const trendColor = {
  rising: "text-green-400",
  stable: "text-slate-400",
  falling: "text-red-400",
};

export default function DemandTrendsPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("product_id") || "";
  const warehouseId = searchParams.get("warehouse_id") || "";

  const [data, setData] = useState<DemandTrendData | null>(null);
  const [productName, setProductName] = useState("Loading…");
  const [loading, setLoading] = useState(true);
  const [daysView, setDaysView] = useState<30 | 60 | 90>(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId || !warehouseId) return;
    setLoading(true);
    fetch(`/api/demand-trends?product_id=${productId}&warehouse_id=${warehouseId}`)
      .then((r) => r.json())
      .then(async (result) => {
        if (result.error) {
          console.error("Demand trends API error:", result.error);
          setError(result.error);
          setData(null);
        } else {
          setError(null);
          setData(result);
        }
        const prodRes = await fetch(`/api/products/${productId}`);
        if (prodRes.ok) {
          const prod = await prodRes.json();
          setProductName(prod.name || "Unknown Product");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch demand trends:", err);
        setError("Failed to load demand trends");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [productId, warehouseId]);

  const chartData = useMemo(() => {
    if (!data) return [];

    const historical = data.historical.slice(-30).map((d) => ({
      date: d.date,
      value: d.quantity,
      type: "historical" as const,
    }));

    const forecastSlice = data.forecast.slice(0, daysView);
    const forecast = forecastSlice.map((d) => ({
      date: d.date,
      value: d.predicted,
      lower: d.lower,
      upper: d.upper,
      type: "forecast" as const,
    }));

    return [...historical, ...forecast];
  }, [data, daysView]);

  const Icon = trendIcon[data?.trend || "stable"];

  if (!productId || !warehouseId) {
    return (
      <div className="space-y-5">
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Package className="w-10 h-10 text-slate-500" />
          <div className="text-white font-medium">Missing Parameters</div>
          <div className="text-sm text-slate-500">
            Navigate to Demand Forecast page and click "Trends →" on a product
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Package className="w-10 h-10 text-red-400" />
          <div className="text-white font-medium">Failed to load data</div>
          <div className="text-sm text-slate-500">{error}</div>
        </div>
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center gap-3 text-center">
        <Package className="w-10 h-10 text-slate-500" />
        <div className="text-white font-medium">No data available</div>
        <div className="text-sm text-slate-500">Generate forecasts first to view trends</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Demand Trends</h1>
          <p className="text-sm text-slate-500 mt-1">{productName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900", trendColor[data.trend])}>
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium capitalize">{data.trend} Demand</span>
          </div>
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDaysView(d)}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition",
                  daysView === d
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-cyan-400" />
            <span className="text-xs text-slate-400">Historical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-amber-400" />
            <span className="text-xs text-slate-400">Forecast</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
            />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(v) => formatDate(v)}
              formatter={(value: number, name: string) => {
                if (name === "lower" || name === "upper") return null;
                return [value.toFixed(1), name === "value" && chartData.find((d) => d.value === value)?.type === "historical" ? "Historical" : "Forecast"];
              }}
            />
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="url(#forecastGradient)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="none"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#06b6d4" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Historical Data Points", value: data.historical.length },
          { label: "Forecast Period", value: `${daysView} days` },
          { label: "Current Trend", value: data.trend },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-lg font-bold text-white">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
