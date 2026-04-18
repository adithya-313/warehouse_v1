"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Package, TrendingDown, Loader2 } from "lucide-react";
import { cn, formatNumber, formatDays } from "@/lib/utils";

type StockoutStatus = "critical" | "warning" | "healthy" | "cold_start";

interface StockoutRiskItem {
  product_id: string;
  product_name: string;
  category: string | null;
  current_stock: number;
  days_of_cover: number | null;
  stockout_date: string | null;
  status: StockoutStatus;
  burn_rate: number;
}

interface StockoutRiskResponse {
  items: StockoutRiskItem[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    healthy: number;
    cold_start: number;
  };
  top_risk: StockoutRiskItem[];
}

function statusConfig(status: StockoutStatus) {
  switch (status) {
    case "critical":
      return { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", label: "Critical" };
    case "warning":
      return { bg: "bg-yellow-500/15", border: "border-yellow-500/30", text: "text-yellow-400", label: "Warning" };
    case "healthy":
      return { bg: "bg-green-500/15", border: "border-green-500/30", text: "text-green-400", label: "Healthy" };
    case "cold_start":
      return { bg: "bg-slate-500/15", border: "border-slate-500/30", text: "text-slate-400", label: "No Forecast" };
  }
}

function Sparkline({ stock, burnRate }: { stock: number; burnRate: number }) {
  const maxDays = 14;
  const points: number[] = [];
  
  let currentStock = stock;
  for (let i = 0; i < maxDays; i++) {
    points.push(currentStock);
    currentStock -= burnRate;
    if (currentStock <= 0) break;
  }
  
  const maxVal = Math.max(stock, ...points.filter(p => p > 0), 1);
  const height = 32;
  const width = 80;
  
  const pathPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1 || 1)) * width;
      const y = height - (p / maxVal) * height;
      return `${x},${y}`;
    })
    .join(" ");
  
  const trendColor = stock <= 0 ? "stroke-red-500" : burnRate > stock / 7 ? "stroke-red-400" : burnRate > stock / 14 ? "stroke-yellow-400" : "stroke-green-400";
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkGrad-${stock}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColor.replace("stroke-", "")} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trendColor.replace("stroke-", "")} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {points.length > 1 && (
        <polygon
          points={`0,${height} ${pathPoints} ${width},${height}`}
          fill={`url(#sparkGrad-${stock})`}
        />
      )}
      {points.length > 1 && (
        <polyline
          points={pathPoints}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={trendColor}
        />
      )}
    </svg>
  );
}

function RiskRow({ item }: { item: StockoutRiskItem }) {
  const config = statusConfig(item.status);
  
  return (
    <div className={cn("flex items-center gap-4 p-3 rounded-lg border", config.bg, config.border)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.bg, config.text)}>
            {config.label}
          </span>
          <span className="text-sm font-medium text-slate-100 truncate">
            {item.product_name}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
          <span>Stock: {formatNumber(item.current_stock)}</span>
          <span>Burn: {item.burn_rate.toFixed(1)}/day</span>
        </div>
      </div>
      
      <div className="text-right">
        {item.status === "cold_start" ? (
          <span className="text-xs text-slate-500">No forecast</span>
        ) : (
          <>
            <div className={cn("text-lg font-bold", config.text)}>
              {item.days_of_cover !== null ? item.days_of_cover : "—"}
            </div>
            <div className="text-xs text-slate-500">days</div>
          </>
        )}
      </div>
      
      {item.status !== "cold_start" && item.burn_rate > 0 && (
        <Sparkline stock={item.current_stock} burnRate={item.burn_rate} />
      )}
    </div>
  );
}

export default function StockoutRiskWidget() {
  const [data, setData] = useState<StockoutRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics/stockout-risk")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => {
        console.error("[stockout-risk]", err);
        setError("Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-6 border-red-500/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>{error || "Error loading data"}</span>
        </div>
      </div>
    );
  }

  const { summary, top_risk } = data;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Stockout Risk</h2>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-400">{summary.critical}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-slate-400">{summary.warning}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-slate-400">{summary.cold_start}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        {top_risk.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <Package className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">No products with stockout risk</span>
          </div>
        ) : (
          top_risk.map((item) => (
            <RiskRow key={item.product_id} item={item} />
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing top 5 of {summary.total} products</span>
          <a
            href="/analytics/stockout-risk"
            className="text-cyan-400 hover:text-cyan-300 transition"
          >
            View all →
          </a>
        </div>
      </div>
    </div>
  );
}