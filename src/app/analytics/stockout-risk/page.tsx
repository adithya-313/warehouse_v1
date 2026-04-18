"use client";

import { useEffect, useState } from "react";
import { 
  TrendingDown, 
  RefreshCw, 
  AlertTriangle, 
  Package, 
  Loader2,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

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
  forecast: { date: string; predicted: number }[];
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

function statusBadge(status: StockoutStatus) {
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

export default function StockoutRiskPage() {
  const [data, setData] = useState<StockoutRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StockoutStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [runningProduct, setRunningProduct] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/stockout-risk", { cache: 'no-store' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      console.log("[stockout-risk] Fetched Items Count:", json.items?.length ?? 0);
      setData(json);
    } catch (err) {
      console.error("[stockout-risk] Fetch error:", err);
      setError("Failed to load stockout risk data");
    } finally {
      setLoading(false);
    }
  };

  const runForecast = async (productId: string) => {
    console.log("=== [Forecast] Button clicked for product:", productId, "===");
    setRunningProduct(productId);
    try {
      console.log("Sending POST to /api/demand-forecast with:", { product_id: productId });
      
      const res = await fetch("/api/demand-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          product_id: productId,
          warehouse_id: "a1000000-0000-0000-0000-000000000001"
        }),
      });
      
      const result = await res.json();
      console.log("[Forecast] Response status:", res.status);
      console.log("[Forecast] Response body:", result);
      
      if (!res.ok) {
        throw new Error(result.error || "Forecast failed");
      }
      
      await fetchData();
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error("[Forecast] Error:", err.message);
      setError(err.message);
    } finally {
      setRunningProduct(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = data?.items.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    if (search && !item.product_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 border-red-500/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const { summary } = data ?? { summary: { total: 0, critical: 0, warning: 0, healthy: 0, cold_start: 0 } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Inventory Burn Rate & Stockout Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">
            Prophet-powered demand forecasting with stockout risk prediction
          </p>
        </div>
        <button
          onClick={() => runForecast("all-products")}
          disabled={runningProduct !== null}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white rounded-lg text-sm transition"
        >
          {runningProduct !== null ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Running Forecast...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" /> Run Forecast
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Critical Risk", value: summary.critical, color: "text-red-400" },
          { label: "Warning", value: summary.warning, color: "text-yellow-400" },
          { label: "Healthy", value: summary.healthy, color: "text-green-400" },
          { label: "No Forecast", value: summary.cold_start, color: "text-slate-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <div className={cn("text-2xl font-bold", color)}>{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StockoutStatus | "all")}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Status</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="healthy">Healthy</option>
          <option value="cold_start">No Forecast</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-right px-4 py-3 font-medium">Current Stock</th>
                <th className="text-right px-4 py-3 font-medium">Burn Rate</th>
                <th className="text-center px-4 py-3 font-medium">Days of Cover</th>
                <th className="text-left px-4 py-3 font-medium">Stockout Date</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No products match your filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const config = statusBadge(item.status);
                  return (
                    <tr key={item.product_id} className="trow">
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.category ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                        {formatNumber(item.current_stock)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {item.burn_rate > 0 ? `${item.burn_rate.toFixed(1)}/day` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.status === "cold_start" ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span className={cn(
                            "font-bold",
                            item.days_of_cover !== null && item.days_of_cover < 3 ? "text-red-400" :
                            item.days_of_cover !== null && item.days_of_cover < 7 ? "text-yellow-400" :
                            "text-green-400"
                          )}>
                            {item.days_of_cover ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.stockout_date ? (
                          item.stockout_date
                        ) : item.days_of_cover !== null && item.days_of_cover !== undefined && item.days_of_cover > 0 ? (
                          <span className="text-yellow-400" title="Linear projection beyond ML horizon">
                            {(() => {
                              const d = new Date();
                              d.setDate(d.getDate() + item.days_of_cover);
                              return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
                            })()}
                            <span className="ml-1 text-[10px] text-yellow-500">(Est.)</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("pill text-xs", config.bg, config.text)}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {runningProduct === item.product_id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-cyan-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> Running...
                          </span>
                        ) : (
                          <button
                            onClick={() => runForecast(item.product_id)}
                            className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded transition"
                            disabled={runningProduct !== null}
                          >
                            {item.status === "cold_start" ? "Run" : "Re-run"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600">
          Showing {filteredItems.length} of {summary.total} products
        </div>
      </div>
    </div>
  );
}