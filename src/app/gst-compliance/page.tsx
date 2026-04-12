"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, CheckCircle, AlertTriangle, FileText, Download, Search } from "lucide-react";
import { cn, formatNumber, formatDate } from "@/lib/utils";

type TransactionType = "inbound" | "outbound" | "transfer" | "adjustment";
type AuditStatus = "pending" | "compliant" | "needs_review";

interface GstTransaction {
  id: string;
  warehouse_id: string;
  transaction_type: TransactionType;
  product_id: string;
  quantity: number;
  gst_rate: number;
  taxable_amount: number;
  gst_amount: number;
  invoice_number: string;
  e_way_bill_number: string;
  state_from: string;
  state_to: string;
  reconciled: boolean;
  discrepancy_notes: string;
  created_at: string;
  products?: { id: string; name: string };
}

interface ReconciliationData {
  reconciliation_logs: Array<{
    id: string;
    reconciliation_date: string;
    total_transactions: number;
    matched_count: number;
    discrepancy_count: number;
    gst_amount_variance: number;
    audit_status: AuditStatus;
  }>;
  last_reconciliation: any;
  pending_discrepancies: GstTransaction[];
  summary: {
    total_pending: number;
    compliant: boolean;
    needs_review: boolean;
  };
}

const txnTypeColors: Record<TransactionType, string> = {
  inbound: "bg-green-500/15 text-green-400",
  outbound: "bg-red-500/15 text-red-400",
  transfer: "bg-blue-500/15 text-blue-400",
  adjustment: "bg-yellow-500/15 text-yellow-400",
};

const statusColors: Record<AuditStatus, string> = {
  compliant: "bg-green-500/15 text-green-400",
  needs_review: "bg-yellow-500/15 text-yellow-400",
  pending: "bg-slate-500/15 text-slate-400",
};

export default function GstCompliancePage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions" | "discrepancies" | "audit">("dashboard");
  const [transactions, setTransactions] = useState<GstTransaction[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [reconciling, setReconciling] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txnRes, reconRes] = await Promise.all([
        fetch("/api/gst-transactions?limit=100"),
        fetch("/api/gst-reconciliation?warehouse_id=a1000000-0000-0000-0000-000000000001")
      ]);
      
      if (txnRes.ok) setTransactions(await txnRes.json());
      if (reconRes.ok) setReconciliation(await reconRes.json());
    } catch (err) {
      console.error("Failed to fetch:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/gst-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: "a1000000-0000-0000-0000-000000000001",
          reconciliation_date: today
        })
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Reconciliation failed:", err);
    }
    setReconciling(false);
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Product", "Qty", "GST Rate", "Taxable Amount", "GST Amount", "Invoice #", "E-way Bill", "Reconciled"];
    const rows = filteredTransactions.map(t => [
      t.created_at.split("T")[0],
      t.transaction_type,
      t.products?.name || "Unknown",
      t.quantity,
      t.gst_rate + "%",
      t.taxable_amount,
      t.gst_amount,
      t.invoice_number || "—",
      t.e_way_bill_number || "—",
      t.reconciled ? "Yes" : "No"
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const filteredTransactions = transactions.filter(t => {
    if (typeFilter !== "all" && t.transaction_type !== typeFilter) return false;
    if (search && !t.invoice_number?.toLowerCase().includes(search.toLowerCase()) && !t.products?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const discrepancyCount = reconciliation?.pending_discrepancies?.length || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">GST Compliance</h1>
          <p className="text-sm text-slate-500 mt-1">Manage GST transactions and reconciliation</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link href="/gst-transactions/new" className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition">
            <Plus className="w-4 h-4" />
            New Transaction
          </Link>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
        {(["dashboard", "transactions", "discrepancies", "audit"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-2 text-sm rounded-md transition capitalize", activeTab === tab ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            {tab === "dashboard" ? "Dashboard" : tab === "transactions" ? "Transactions" : tab === "discrepancies" ? "Discrepancies" : "Audit Report"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === "dashboard" && reconciliation && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Transactions</div>
                  <div className="text-2xl font-bold text-white">{reconciliation.reconciliation_logs.reduce((sum, r) => sum + r.total_transactions, 0)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Compliance Rate</div>
                  <div className="text-2xl font-bold text-green-400">
                    {reconciliation.reconciliation_logs.length > 0
                      ? Math.round((reconciliation.reconciliation_logs.reduce((sum, r) => sum + r.matched_count, 0) / Math.max(1, reconciliation.reconciliation_logs.reduce((sum, r) => sum + r.total_transactions, 0))) * 100)
                      : 100}%
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Discrepancies</div>
                  <div className="text-2xl font-bold text-yellow-400">{discrepancyCount}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Status</div>
                  <span className={cn("pill", statusColors[reconciliation.last_reconciliation?.audit_status || "pending"])}>
                    {reconciliation.last_reconciliation?.audit_status || "pending"}
                  </span>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-300">Last Reconciliation</h3>
                  <button
                    onClick={handleReconcile}
                    disabled={reconciling}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm rounded-lg transition disabled:opacity-50"
                  >
                    {reconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Run Reconciliation
                  </button>
                </div>
                {reconciliation.last_reconciliation ? (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Date</div>
                      <div className="text-slate-200">{reconciliation.last_reconciliation.reconciliation_date}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Total Txns</div>
                      <div className="text-slate-200">{reconciliation.last_reconciliation.total_transactions}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Matched</div>
                      <div className="text-green-400">{reconciliation.last_reconciliation.matched_count}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Discrepancies</div>
                      <div className={cn(reconciliation.last_reconciliation.discrepancy_count > 0 ? "text-yellow-400" : "text-slate-200")}>
                        {reconciliation.last_reconciliation.discrepancy_count}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Status</div>
                      <span className={cn("pill text-xs", statusColors[reconciliation.last_reconciliation.audit_status])}>
                        {reconciliation.last_reconciliation.audit_status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">No reconciliation run yet. Click "Run Reconciliation" to start.</div>
                )}
              </div>

              {discrepancyCount > 0 && (
                <div className="card p-5 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-yellow-400">Pending Discrepancies ({discrepancyCount})</h3>
                  </div>
                  <div className="space-y-2">
                    {reconciliation.pending_discrepancies.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg text-sm">
                        <div>
                          <span className="text-slate-200">{t.invoice_number || t.products?.name}</span>
                          <span className="text-slate-500 ml-2">{t.discrepancy_notes}</span>
                        </div>
                        <span className="text-yellow-400">₹{formatNumber(t.gst_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" placeholder="Search invoice or product..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TransactionType | "all")} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200">
                  <option value="all">All Types</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Adjustment</option>
                </select>
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-right px-4 py-3">Qty</th>
                      <th className="text-right px-4 py-3">GST Rate</th>
                      <th className="text-right px-4 py-3">Taxable</th>
                      <th className="text-right px-4 py-3">GST Amount</th>
                      <th className="text-left px-4 py-3">Invoice #</th>
                      <th className="text-left px-4 py-3">E-way Bill</th>
                      <th className="text-center px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(txn => (
                      <tr key={txn.id} className="trow border-b border-slate-800/50">
                        <td className="px-4 py-3 text-slate-400">{formatDate(txn.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("pill text-xs", txnTypeColors[txn.transaction_type])}>{txn.transaction_type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{txn.products?.name || "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{formatNumber(txn.quantity)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{txn.gst_rate}%</td>
                        <td className="px-4 py-3 text-right text-slate-200">₹{formatNumber(txn.taxable_amount)}</td>
                        <td className="px-4 py-3 text-right text-cyan-400">₹{formatNumber(txn.gst_amount)}</td>
                        <td className="px-4 py-3 text-slate-400">{txn.invoice_number || "—"}</td>
                        <td className="px-4 py-3 text-slate-400">{txn.e_way_bill_number || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {txn.reconciled ? (
                            <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                          ) : txn.discrepancy_notes ? (
                            <AlertTriangle className="w-4 h-4 text-yellow-400 mx-auto" />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "discrepancies" && (
            <div className="space-y-4">
              {discrepancyCount === 0 ? (
                <div className="card p-12 flex flex-col items-center gap-3 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                  <div className="text-white font-medium">All Clear!</div>
                  <div className="text-sm text-slate-500">No discrepancies found. All transactions are reconciled.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {reconciliation?.pending_discrepancies.map(txn => (
                    <div key={txn.id} className="card p-4 border border-yellow-500/20">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            <span className="font-medium text-slate-200">{txn.invoice_number || "No Invoice"}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">{txn.products?.name}</span>
                          </div>
                          <div className="text-sm text-yellow-400">{txn.discrepancy_notes}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-cyan-400 font-medium">₹{formatNumber(txn.gst_amount)}</div>
                          <div className="text-xs text-slate-500">{formatDate(txn.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-6">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Monthly Audit Report</h3>
                <div className="flex items-end gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Select Month</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <button
                    onClick={() => window.open(`/api/gst-reconciliation/audit-report?warehouse_id=a1000000-0000-0000-0000-000000000001&month=${selectedMonth}`, "_blank")}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition"
                  >
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Reconciliation History</h3>
                <div className="space-y-2">
                  {reconciliation?.reconciliation_logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-200">{log.reconciliation_date}</span>
                        <span className="text-slate-500">{log.total_transactions} txns</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400">{log.matched_count} matched</span>
                        {log.discrepancy_count > 0 && <span className="text-yellow-400">{log.discrepancy_count} issues</span>}
                        <span className={cn("pill text-xs", statusColors[log.audit_status])}>{log.audit_status}</span>
                      </div>
                    </div>
                  ))}
                  {(!reconciliation?.reconciliation_logs || reconciliation.reconciliation_logs.length === 0) && (
                    <div className="text-slate-500 text-sm text-center py-4">No reconciliation history available.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
