"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type TransactionType = "inbound" | "outbound" | "transfer" | "adjustment";

interface Product {
  id: string;
  name: string;
  default_gst_rate: number;
  unit_cost: number;
}

const VALID_GST_RATES = [5, 12, 18, 28];
const VALID_STATES = [
  { code: "MH", name: "Maharashtra" },
  { code: "DL", name: "Delhi" },
  { code: "KA", name: "Karnataka" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "GJ", name: "Gujarat" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "TS", name: "Telangana" },
  { code: "WB", name: "West Bengal" },
  { code: "RJ", name: "Rajasthan" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "PB", name: "Punjab" },
  { code: "HR", name: "Haryana" },
  { code: "KL", name: "Kerala" },
  { code: "OR", name: "Odisha" },
  { code: "BH", name: "Bihar" },
  { code: "AS", name: "Assam" },
  { code: "JH", name: "Jharkhand" },
];

export default function NewGstTransactionPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    transaction_type: "inbound" as TransactionType,
    product_id: "",
    quantity: "",
    gst_rate: "",
    taxable_amount: "",
    invoice_number: "",
    e_way_bill_number: "",
    state_from: "MH",
    state_to: "MH",
    notes: ""
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const errors: string[] = [];
    const warns: string[] = [];

    if (form.e_way_bill_number && !/^\d{12}$/.test(form.e_way_bill_number)) {
      errors.push("E-way bill must be exactly 12 digits");
    }

    if (form.state_from && form.state_to && form.state_from !== form.state_to) {
      warns.push("Inter-state transfer detected. IGST will be applied instead of CGST+SGST.");
    }

    if (form.state_from && form.state_to && form.state_from !== form.state_to && !form.e_way_bill_number) {
      errors.push("E-way bill is required for inter-state transfers");
    }

    if (form.gst_rate && !VALID_GST_RATES.includes(parseInt(form.gst_rate))) {
      errors.push(`Invalid GST rate. Must be one of: ${VALID_GST_RATES.join(", ")}`);
    }

    setValidationErrors(errors);
    setWarnings(warns);
  }, [form]);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
    setLoading(false);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      gst_rate: product?.default_gst_rate?.toString() || "18",
      taxable_amount: product?.unit_cost ? (parseFloat(form.quantity) * product.unit_cost).toFixed(2) : ""
    });
  };

  const handleQuantityChange = (qty: string) => {
    const product = products.find(p => p.id === form.product_id);
    const quantity = parseFloat(qty) || 0;
    const rate = parseFloat(form.gst_rate) || 18;
    
    let taxable = 0;
    if (product?.unit_cost) {
      taxable = quantity * product.unit_cost;
    } else if (form.taxable_amount) {
      taxable = parseFloat(form.taxable_amount);
    }

    setForm({
      ...form,
      quantity: qty,
      taxable_amount: taxable > 0 ? taxable.toFixed(2) : ""
    });
  };

  const calculateGST = () => {
    const taxable = parseFloat(form.taxable_amount) || 0;
    const rate = parseFloat(form.gst_rate) || 18;
    return (taxable * rate / 100).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validationErrors.length > 0) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/gst-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: "a1000000-0000-0000-0000-000000000001",
          transaction_type: form.transaction_type,
          product_id: form.product_id || null,
          quantity: parseFloat(form.quantity),
          gst_rate: parseFloat(form.gst_rate) || 18,
          taxable_amount: parseFloat(form.taxable_amount),
          invoice_number: form.invoice_number || null,
          e_way_bill_number: form.e_way_bill_number || null,
          state_from: form.state_from,
          state_to: form.state_to
        })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/gst-compliance"), 1500);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create transaction");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }

    setSubmitting(false);
  };

  const isInterState = form.state_from !== form.state_to;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/gst-compliance" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition">
        <ArrowLeft className="w-4 h-4" />
        Back to GST Compliance
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">New GST Transaction</h1>
        <p className="text-sm text-slate-500 mt-1">Log a new GST transaction with tax calculation</p>
      </div>

      {success && (
        <div className="card p-4 border border-green-500/30 bg-green-500/10 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-400">Transaction created successfully! Redirecting...</span>
        </div>
      )}

      {error && (
        <div className="card p-4 border border-red-500/30 bg-red-500/10 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Transaction Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transaction Type *</label>
              <select
                value={form.transaction_type}
                onChange={e => setForm({ ...form, transaction_type: e.target.value as TransactionType })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              >
                <option value="inbound">Inbound (Purchase)</option>
                <option value="outbound">Outbound (Sale)</option>
                <option value="transfer">Transfer (Inter-state)</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Product</label>
              <select
                value={form.product_id}
                onChange={e => handleProductChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Quantity *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={e => handleQuantityChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">GST Rate (%) *</label>
              <select
                value={form.gst_rate}
                onChange={e => setForm({ ...form, gst_rate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              >
                {VALID_GST_RATES.map(r => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Tax Calculation</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Taxable Amount (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.taxable_amount}
                onChange={e => setForm({ ...form, taxable_amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">GST Amount (₹)</label>
              <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-cyan-400 font-medium">
                ₹{calculateGST()}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">State From *</label>
              <select
                value={form.state_from}
                onChange={e => setForm({ ...form, state_from: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              >
                {VALID_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">State To *</label>
              <select
                value={form.state_to}
                onChange={e => setForm({ ...form, state_to: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              >
                {VALID_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isInterState && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400">
              <strong>Inter-state Transfer:</strong> IGST will be applied. CGST and SGST will be 0.
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-yellow-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Documentation</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Invoice Number</label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="INV-2026-001"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">E-way Bill Number</label>
              <input
                type="text"
                value={form.e_way_bill_number}
                onChange={e => setForm({ ...form, e_way_bill_number: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                placeholder="12-digit number"
                maxLength={12}
                className={cn(
                  "w-full px-3 py-2 bg-slate-900 border rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50",
                  form.e_way_bill_number && !/^\d{12}$/.test(form.e_way_bill_number) ? "border-red-500/50" : "border-slate-700"
                )}
              />
              <div className="text-xs text-slate-500 mt-1">{form.e_way_bill_number.length}/12 digits</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/gst-compliance" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || validationErrors.length > 0}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
