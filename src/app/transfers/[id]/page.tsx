"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowRightLeft, Check, CheckCircle2,
  Clock, MapPin, Package, Truck, X, XCircle, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransferWithItems, TransferStatus, TransferItemStatus, TransferItem } from "@/lib/types";

const statusConfig: Record<TransferStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:       { label: "Draft",       color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30", icon: Clock },
  approved:    { label: "Approved",    color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30",  icon: Check },
  "in-transit": { label: "In Transit", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", icon: Truck },
  received:    { label: "Received",    color: "text-green-400", bg: "bg-green-500/15 border-green-500/30", icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   color: "text-red-400",  bg: "bg-red-500/15 border-red-500/30",   icon: XCircle },
};

const itemStatusConfig: Record<TransferItemStatus, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "text-slate-400" },
  shipped:  { label: "Shipped",  color: "text-yellow-400" },
  received: { label: "Received", color: "text-green-400" },
  rejected: { label: "Rejected", color: "text-red-400" },
};

type Tab = "overview" | "items" | "actions";

export default function TransferDetailPage({ params }: { params: { id: string } }) {
  const [transfer, setTransfer] = useState<TransferWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  const fetchTransfer = useCallback(async () => {
    const r = await fetch(`/api/transfers/${params.id}`);
    if (r.ok) {
      const data = await r.json();
      setTransfer(data);
      const initialReceived: Record<string, number> = {};
      (data.items ?? []).forEach((item: TransferItem) => {
        initialReceived[item.id] = Number(item.shipped_qty ?? item.requested_qty);
      });
      setReceivedQuantities(initialReceived);
    } else {
      setError("Failed to load transfer");
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchTransfer(); }, [fetchTransfer]);

  const performAction = async (action: string, body?: object) => {
    setActionLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/transfers/${params.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || `Failed to ${action}`);
      }
      await fetchTransfer();
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const handleReceive = async () => {
    const received_items = Object.entries(receivedQuantities).map(([id, qty]) => ({
      transfer_item_id: id,
      received_qty: qty,
    }));
    await performAction("receive", { received_items });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-400">Transfer not found</p>
        <Link href="/transfers" className="text-cyan-400 text-sm mt-2 inline-block">Back to Transfers</Link>
      </div>
    );
  }

  const status = statusConfig[transfer.status];
  const StatusIcon = status.icon;
  const fromWh = (transfer as any).from_warehouse;
  const toWh = (transfer as any).to_warehouse;
  const auditLog = (transfer as any).audit_log ?? [];

  const totalRequested = transfer.items?.reduce((s, i) => s + Number(i.requested_qty), 0) ?? 0;
  const totalShipped = transfer.items?.reduce((s, i) => s + (Number(i.shipped_qty) || 0), 0) ?? 0;
  const totalReceived = transfer.items?.reduce((s, i) => s + (Number(i.received_qty) || 0), 0) ?? 0;
  const varianceCount = transfer.items?.filter((i) => i.variance !== null && Number(i.variance) !== 0).length ?? 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "items", label: `Items (${transfer.items?.length ?? 0})` },
    { id: "actions", label: "Actions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transfers" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Transfers
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("pill text-xs border", status.bg, status.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </span>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                Transfer
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1 capitalize">
              {transfer.transfer_reason.replace(/_/g, " ")} • Created {new Date(transfer.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition",
              activeTab === tab.id
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-medium text-white">Transfer Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-1">From</div>
                <div className="flex items-center gap-2 text-slate-200">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  {fromWh?.name ?? "—"}
                </div>
                <div className="text-xs text-slate-500 ml-6">{fromWh?.location ?? ""}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">To</div>
                <div className="flex items-center gap-2 text-slate-200">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  {toWh?.name ?? "—"}
                </div>
                <div className="text-xs text-slate-500 ml-6">{toWh?.location ?? ""}</div>
              </div>
            </div>
            {transfer.notes && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Notes</div>
                <div className="text-sm text-slate-300">{transfer.notes}</div>
              </div>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-medium text-white">Summary</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{transfer.items?.length ?? 0}</div>
                <div className="text-xs text-slate-500">Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{totalShipped || "—"}</div>
                <div className="text-xs text-slate-500">Shipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{totalReceived || "—"}</div>
                <div className="text-xs text-slate-500">Received</div>
              </div>
            </div>
            {varianceCount > 0 && (
              <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-center">
                <span className="text-amber-400 text-sm">{varianceCount} item(s) with variance</span>
              </div>
            )}
          </div>

          <div className="card p-6 lg:col-span-2">
            <h2 className="text-sm font-medium text-white mb-4">Timeline</h2>
            <div className="flex items-center justify-between">
              {[
                { key: "created", label: "Created", date: transfer.created_at },
                { key: "approved", label: "Approved", date: transfer.approved_date },
                { key: "shipped", label: "Shipped", date: transfer.shipped_date },
                { key: "received", label: "Received", date: transfer.received_date },
              ].map((event, idx) => {
                const isCompleted = event.date || (event.key === "created");
                const isCurrent = transfer.status === event.key || (event.key === "approved" && transfer.status === "in-transit") || (event.key === "shipped" && transfer.status === "received");
                return (
                  <div key={event.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border-2",
                        isCompleted ? "bg-cyan-500/20 border-cyan-500" : "bg-slate-800 border-slate-700",
                        isCurrent && "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950"
                      )}>
                        {isCompleted ? (
                          <Check className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-2">{event.label}</div>
                      <div className="text-xs text-slate-600">
                        {event.date ? new Date(event.date).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    {idx < 3 && (
                      <div className={cn(
                        "w-16 h-0.5 mx-2",
                        isCompleted ? "bg-cyan-500" : "bg-slate-700"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "items" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50">
                <tr className="text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Requested</th>
                  <th className="text-right px-4 py-3 font-medium">Shipped</th>
                  <th className="text-right px-4 py-3 font-medium">Received</th>
                  <th className="text-right px-4 py-3 font-medium">Variance</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transfer.items?.map((item) => {
                  const variance = Number(item.variance);
                  const hasVariance = variance !== 0 && item.variance !== null;
                  return (
                    <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-200">{(item as any).products?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{(item as any).products?.category ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{item.requested_qty}</td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{item.shipped_qty ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-200 tabular-nums">{item.received_qty ?? "—"}</td>
                      <td className={cn(
                        "px-4 py-3 text-right tabular-nums",
                        hasVariance ? (variance > 0 ? "text-green-400" : "text-red-400") : "text-slate-500"
                      )}>
                        {item.variance !== null ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("text-xs", itemStatusConfig[item.status].color)}>
                          {itemStatusConfig[item.status].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "actions" && (
        <div className="space-y-6">
          {transfer.status === "draft" && (
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">Draft Actions</h2>
              <p className="text-sm text-slate-500">Approve this transfer to reserve stock, or cancel it.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => performAction("approve")}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition text-sm font-medium border border-blue-500/30 disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Approve & Reserve"}
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2.5 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition text-sm font-medium border border-red-500/30"
                >
                  Cancel Transfer
                </button>
              </div>
            </div>
          )}

          {transfer.status === "approved" && (
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">Approved - Ready to Ship</h2>
              <p className="text-sm text-slate-500">Stock has been reserved. Mark as shipped when items leave the warehouse.</p>
              <div className="p-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-sm text-blue-400">
                Reserved quantities have been locked in the source warehouse.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => performAction("ship")}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-yellow-500/15 text-yellow-400 rounded-lg hover:bg-yellow-500/25 transition text-sm font-medium border border-yellow-500/30 disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Mark as Shipped"}
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2.5 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition text-sm font-medium border border-red-500/30"
                >
                  Cancel Transfer
                </button>
              </div>
            </div>
          )}

          {transfer.status === "in-transit" && (
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">In Transit - Receive Items</h2>
              <p className="text-sm text-slate-500">Enter the quantity received for each item. Cannot exceed shipped quantity.</p>
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/50">
                    <tr className="text-xs uppercase text-slate-500">
                      <th className="text-left px-4 py-2 font-medium">Product</th>
                      <th className="text-right px-4 py-2 font-medium">Shipped</th>
                      <th className="text-right px-4 py-2 font-medium w-32">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfer.items?.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="px-4 py-2 text-slate-200">{(item as any).products?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-400 tabular-nums">{item.shipped_qty}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={receivedQuantities[item.id] ?? 0}
                            onChange={(e) => setReceivedQuantities({
                              ...receivedQuantities,
                              [item.id]: parseFloat(e.target.value) || 0,
                            })}
                            max={Number(item.shipped_qty)}
                            min={0}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 text-right focus:outline-none focus:border-cyan-500/50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleReceive}
                disabled={actionLoading}
                className="w-full px-4 py-2.5 bg-green-500/15 text-green-400 rounded-lg hover:bg-green-500/25 transition text-sm font-medium border border-green-500/30 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Confirm Receipt"}
              </button>
            </div>
          )}

          {transfer.status === "received" && (
            <div className="card p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h2 className="text-lg font-medium text-white mb-1">Transfer Complete</h2>
              <p className="text-sm text-slate-500">
                {totalReceived} units received. {varianceCount > 0 && `${varianceCount} item(s) had variance.`}
              </p>
            </div>
          )}

          {transfer.status === "cancelled" && (
            <div className="card p-6 text-center">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-medium text-white mb-1">Transfer Cancelled</h2>
              <p className="text-sm text-slate-500">
                {transfer.cancel_reason && `Reason: ${transfer.cancel_reason}`}
              </p>
            </div>
          )}

          {auditLog.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-medium text-white mb-4">Audit Log</h2>
              <div className="space-y-2">
                {auditLog.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                    <span className="text-slate-400 capitalize">{log.action}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">{log.performed_by ?? "System"}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-600 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-medium text-white">Cancel Transfer</h2>
            <p className="text-sm text-slate-500">
              {transfer.status === "approved" && "This will unreserve the quantities from the source warehouse."}
              {transfer.status === "draft" && "The transfer will be marked as cancelled."}
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 text-sm text-slate-400 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition"
              >
                Keep Transfer
              </button>
              <button
                onClick={() => {
                  performAction("cancel", { reason: cancelReason });
                  setShowCancelModal(false);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 text-sm text-red-400 bg-red-500/15 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition disabled:opacity-50"
              >
                {actionLoading ? "..." : "Cancel Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
