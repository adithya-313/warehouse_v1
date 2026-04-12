"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, TrendingUp, TrendingDown, Package, Search,
  CheckCircle, XCircle, Eye, FileText, Filter, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { cn, formatNumber, formatDate } from "@/lib/utils";

type AlertType = "ghost_inventory" | "qty_mismatch" | "unauthorized_removal" | "scan_error";
type Severity = "critical" | "high" | "medium" | "low";
type ResolutionStatus = "open" | "investigating" | "resolved" | "false_alarm";

interface ShrinkageAlert {
  id: string;
  warehouse_id: string;
  product_id: string;
  alert_type: AlertType;
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_pct: number;
  bin_location: string;
  zone: string;
  aisle: string;
  severity: Severity;
  resolution_status: ResolutionStatus;
  resolution_notes: string;
  flagged_by_name: string;
  resolved_by_name: string;
  created_at: string;
  resolved_at: string;
  products?: { id: string; name: string; unit_cost: number };
}

interface Analytics {
  period_days: number;
  total_alerts: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_product: Record<string, number>;
  by_bin: Record<string, number>;
  by_day: Record<string, number>;
  total_variance_value: number;
}

const severityColors: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const alertTypeLabels: Record<AlertType, string> = {
  ghost_inventory: "Ghost Inventory",
  qty_mismatch: "Qty Mismatch",
  unauthorized_removal: "Unauthorized Removal",
  scan_error: "Scan Error",
};

const statusColors: Record<ResolutionStatus, string> = {
  open: "bg-red-500/15 text-red-400",
  investigating: "bg-yellow-500/15 text-yellow-400",
  resolved: "bg-green-500/15 text-green-400",
  false_alarm: "bg-slate-500/15 text-slate-400",
};

const CHART_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#64748b", "#22c55e", "#8b5cf6"];

export default function ShrinkagePage() {
  const [activeTab, setActiveTab] = useState<"active" | "analytics" | "resolved">("active");
  const [alerts, setAlerts] = useState<ShrinkageAlert[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<ShrinkageAlert | null>(null);
  const [resolvingAlert, setResolvingAlert] = useState<ShrinkageAlert | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, analyticsRes] = await Promise.all([
        fetch("/api/shrinkage-alerts"),
        fetch("/api/shrinkage-analytics?warehouse_id=a1000000-0000-0000-0000-000000000001&days=30")
      ]);
      
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAlerts = alerts.filter(a => a.resolution_status === "open" || a.resolution_status === "investigating");
  const resolvedAlerts = alerts.filter(a => a.resolution_status === "resolved" || a.resolution_status === "false_alarm");

  const filteredActive = openAlerts.filter(a => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (search && !a.bin_location?.toLowerCase().includes(search.toLowerCase()) && !a.products?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredResolved = resolvedAlerts.filter(a => {
    if (search && !a.bin_location?.toLowerCase().includes(search.toLowerCase()) && !a.products?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleResolve = async (status: ResolutionStatus, notes: string) => {
    if (!resolvingAlert) return;
    
    try {
      const res = await fetch(`/api/shrinkage-alerts/${resolvingAlert.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution_status: status, resolution_notes: notes })
      });
      
      if (res.ok) {
        setResolvingAlert(null);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to resolve:", err);
    }
  };

  const severityChartData = analytics ? Object.entries(analytics.by_severity).map(([name, value]) => ({ name, value })) : [];
  const typeChartData = analytics ? Object.entries(analytics.by_type).map(([name, value]) => ({ name: alertTypeLabels[name as AlertType] || name, value })) : [];
  const dayChartData = analytics ? Object.entries(analytics.by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), count })) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Shrinkage Detection</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor and investigate inventory shrinkage</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
        {(["active", "analytics", "resolved"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-2 text-sm rounded-md transition capitalize", activeTab === tab ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            {tab === "active" ? "Active Alerts" : tab === "analytics" ? "Analytics" : "Resolved"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === "active" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" placeholder="Search by bin or product..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value as Severity | "all")} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200">
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {filteredActive.length === 0 ? (
                <div className="card p-12 flex flex-col items-center gap-3 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                  <div className="text-white font-medium">No active alerts</div>
                  <div className="text-sm text-slate-500">All clear! No shrinkage alerts require attention.</div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredActive.map(alert => (
                    <div key={alert.id} className={cn("card p-4 border", severityColors[alert.severity])}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="font-semibold text-white">{alertTypeLabels[alert.alert_type]}</span>
                            <span className={cn("pill text-xs", severityColors[alert.severity])}>{alert.severity}</span>
                            <span className={cn("pill text-xs", statusColors[alert.resolution_status])}>{alert.resolution_status}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <div className="text-slate-500">Product</div>
                              <div className="text-slate-200">{alert.products?.name || "Unknown"}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Bin Location</div>
                              <div className="text-slate-200">{alert.bin_location}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Expected</div>
                              <div className="text-slate-200">{formatNumber(alert.expected_qty)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Actual</div>
                              <div className="text-slate-200">{formatNumber(alert.actual_qty)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Variance</div>
                              <div className={cn("font-medium", alert.variance_pct > 0.1 ? "text-red-400" : alert.variance_pct > 0.05 ? "text-yellow-400" : "text-slate-200")}>
                                {(alert.variance_pct * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedAlert(alert)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
                            <Eye className="w-4 h-4 text-slate-400" />
                          </button>
                          <button onClick={() => setResolvingAlert(alert)} className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition">
                            <CheckCircle className="w-4 h-4 text-cyan-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "analytics" && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Alerts</div>
                  <div className="text-2xl font-bold text-white">{analytics.total_alerts}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Critical</div>
                  <div className="text-2xl font-bold text-red-400">{analytics.by_severity.critical || 0}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">High</div>
                  <div className="text-2xl font-bold text-yellow-400">{analytics.by_severity.high || 0}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Est. Loss</div>
                  <div className="text-2xl font-bold text-red-400">₹{formatNumber(analytics.total_variance_value)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Alerts by Severity</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={severityChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {severityChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Alerts by Type</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Daily Trend (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dayChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {Object.keys(analytics.by_bin).length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">High-Risk Bins</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.by_bin).slice(0, 5).map(([bin, count]) => (
                      <div key={bin} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                        <span className="text-slate-200">{bin}</span>
                        <span className="text-red-400 font-medium">{count} alerts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "resolved" && (
            <div className="space-y-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Search resolved cases..." value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-md pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50" />
              </div>

              {filteredResolved.length === 0 ? (
                <div className="card p-12 flex flex-col items-center gap-3 text-center">
                  <Package className="w-10 h-10 text-slate-500" />
                  <div className="text-white font-medium">No resolved cases</div>
                  <div className="text-sm text-slate-500">Resolved alerts will appear here.</div>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                        <th className="text-left px-4 py-3">Product</th>
                        <th className="text-left px-4 py-3">Bin</th>
                        <th className="text-left px-4 py-3">Type</th>
                        <th className="text-right px-4 py-3">Variance</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Resolution</th>
                        <th className="text-left px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResolved.map(alert => (
                        <tr key={alert.id} className="trow border-b border-slate-800/50">
                          <td className="px-4 py-3 text-slate-200">{alert.products?.name || "Unknown"}</td>
                          <td className="px-4 py-3 text-slate-400">{alert.bin_location}</td>
                          <td className="px-4 py-3 text-slate-400">{alertTypeLabels[alert.alert_type]}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{(alert.variance_pct * 100).toFixed(1)}%</td>
                          <td className="px-4 py-3"><span className={cn("pill text-xs", statusColors[alert.resolution_status])}>{alert.resolution_status.replace("_", " ")}</span></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{alert.resolution_notes || "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(alert.resolved_at || alert.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedAlert(null)}>
          <div className="card p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Alert Details</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-slate-500">Type:</span> <span className="text-slate-200">{alertTypeLabels[selectedAlert.alert_type]}</span></div>
                <div><span className="text-slate-500">Severity:</span> <span className={cn("font-medium", selectedAlert.severity === "critical" ? "text-red-400" : selectedAlert.severity === "high" ? "text-yellow-400" : "text-slate-200")}>{selectedAlert.severity}</span></div>
                <div><span className="text-slate-500">Bin:</span> <span className="text-slate-200">{selectedAlert.bin_location}</span></div>
                <div><span className="text-slate-500">Zone:</span> <span className="text-slate-200">{selectedAlert.zone}</span></div>
                <div><span className="text-slate-500">Expected Qty:</span> <span className="text-slate-200">{formatNumber(selectedAlert.expected_qty)}</span></div>
                <div><span className="text-slate-500">Actual Qty:</span> <span className="text-slate-200">{formatNumber(selectedAlert.actual_qty)}</span></div>
                <div><span className="text-slate-500">Variance:</span> <span className="text-red-400">{(selectedAlert.variance_pct * 100).toFixed(1)}%</span></div>
                <div><span className="text-slate-500">Flagged By:</span> <span className="text-slate-200">{selectedAlert.flagged_by_name}</span></div>
              </div>
              <div className="pt-3 border-t border-slate-700">
                <div className="text-slate-500 mb-1">Created</div>
                <div className="text-slate-200">{new Date(selectedAlert.created_at).toLocaleString()}</div>
              </div>
            </div>
            <button onClick={() => setSelectedAlert(null)} className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition">Close</button>
          </div>
        </div>
      )}

      {resolvingAlert && (
        <ResolveModal alert={resolvingAlert} onResolve={handleResolve} onClose={() => setResolvingAlert(null)} />
      )}
    </div>
  );
}

function ResolveModal({ alert, onResolve, onClose }: { alert: ShrinkageAlert; onResolve: (status: ResolutionStatus, notes: string) => void; onClose: () => void }) {
  const [status, setStatus] = useState<ResolutionStatus>("resolved");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-4">Resolve Alert</h2>
        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg text-sm">
          <div className="text-slate-400">{alert.products?.name} @ {alert.bin_location}</div>
          <div className="text-slate-500 text-xs">{(alert.variance_pct * 100).toFixed(1)}% variance</div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Resolution Status</label>
            <div className="flex gap-2">
              {(["resolved", "false_alarm"] as ResolutionStatus[]).map(s => (
                <button key={s} onClick={() => setStatus(s)} className={cn("flex-1 py-2 rounded-lg text-sm transition", status === s ? "bg-cyan-500 text-black" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
                  {s === "resolved" ? "Resolved" : "False Alarm"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Root cause or explanation..." className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition">Cancel</button>
            <button onClick={() => onResolve(status, notes)} className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition">Submit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
