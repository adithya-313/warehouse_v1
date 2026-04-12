"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Users,
  FileText,
  Warehouse,
  TrendingUp,
  Brain,
  ShoppingCart,
  Route,
  AlertTriangle,
  ArrowRightLeft,
  RefreshCcw,
  Target,
  Globe,
  IndianRupee,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Truck,
  Package,
  Clock,
  CreditCard,
  UsersRound,
  Smartphone,
  Database,
  Leaf,
  BarChart2,
} from "lucide-react";

const solutions = [
  {
    icon: ShieldAlert,
    title: "Real-Time Shrinkage Detection",
    problem: "Catch theft/damage same day, not in monthly audits",
    impact: "₹15-30 Lakh saved annually",
    category: "loss",
    color: "red",
  },
  {
    icon: Brain,
    title: "Demand Forecasting (Prophet)",
    problem: "Predict demand 90 days ahead, prevent overstock",
    impact: "₹10-15 Lakh overstock prevented",
    category: "planning",
    color: "green",
  },
  {
    icon: FileText,
    title: "GST Auto-Reconciliation",
    problem: "Audit-ready reports in seconds, not weeks",
    impact: "10+ hrs/week saved, ₹5 Lakh compliance cost",
    category: "loss",
    color: "red",
  },
  {
    icon: Route,
    title: "Picking Route Optimization",
    problem: "Cut picker travel by 30% with zone batching",
    impact: "₹12 Lakh labor savings",
    category: "operations",
    color: "blue",
  },
  {
    icon: ShoppingCart,
    title: "Smart Constrained Reordering",
    problem: "Handle supplier chaos + warehouse space limits",
    impact: "Zero overflow, zero stockouts",
    category: "planning",
    color: "green",
  },
  {
    icon: AlertTriangle,
    title: "Supplier Risk Prediction",
    problem: "Predict supplier failure 60 days ahead",
    impact: "Prevent ₹50 Lakh disruption crisis",
    category: "planning",
    color: "green",
  },
  {
    icon: ArrowRightLeft,
    title: "Multi-Warehouse Auto-Balancing",
    problem: "Transfer stock between warehouses intelligently",
    impact: "Unlock ₹20 Lakh working capital",
    category: "operations",
    color: "blue",
  },
  {
    icon: RefreshCcw,
    title: "Liquidation Recommendations",
    problem: "Identify dead stock, suggest discounts or transfers",
    impact: "Recover ₹5-10 Lakh from stale inventory",
    category: "planning",
    color: "green",
  },
  {
    icon: Target,
    title: "Staff Productivity Gamification",
    problem: "Motivate pickers with leaderboards & rewards",
    impact: "25% efficiency improvement",
    category: "operations",
    color: "blue",
  },
];

const competitors = [
  { feature: "Real-Time Shrinkage Detection", us: "✅", sap: "❌", netsuite: "❌", tally: "❌" },
  { feature: "GST Auto-Reconciliation", us: "✅ India-native", sap: "⚠️ Generic", netsuite: "⚠️ Generic", tally: "⚠️ Limited" },
  { feature: "Supplier Risk ML (Predictive)", us: "✅", sap: "❌", netsuite: "❌", tally: "❌" },
  { feature: "Picking Route Optimization (AI)", us: "✅", sap: "⚠️ Static", netsuite: "⚠️ Static", tally: "❌" },
  { feature: "Multi-Warehouse Auto-Balancing", us: "✅", sap: "⚠️ Manual", netsuite: "⚠️ Manual", tally: "⚠️ Manual" },
  { feature: "Deployment Speed", us: "✅ 1 week", sap: "❌ 6 months", netsuite: "❌ 4 months", tally: "✅ 2 weeks" },
  { feature: "Annual Cost", us: "₹5 Lakh", sap: "₹50 Lakh+", netsuite: "₹30 Lakh+", tally: "₹2 Lakh" },
];

const roadmap = [
  { phase: "Current", title: "MVP Live", desc: "11 features, battle-tested", status: "complete" },
  { phase: "Q2 2026", title: "Pilot Launch", desc: "5 customers, collect ROI data", status: "current" },
  { phase: "Q4 2026", title: "Scale Up", desc: "50 customers, ₹2.5-3.75 Cr ARR", status: "future" },
  { phase: "2027", title: "Series A", desc: "500 customers, ₹25+ Cr ARR", status: "future" },
  { phase: "2028", title: "Market Leader", desc: "2,000 customers, ₹100+ Cr ARR", status: "future" },
];

export default function PitchDemoPage() {
  const [mounted, setMounted] = useState(false);
  const [visibleSection, setVisibleSection] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-slate-900 to-blue-950" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              The AI That Transforms
            </span>
            <br />
            <span className="text-white">India's Warehouses</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-4 max-w-3xl mx-auto">
            Real-Time Intelligence. Real Savings. Real <span className="text-green-400 font-bold">ROI.</span>
          </p>

          <p className="text-lg text-slate-400 mb-10">
            Battle-tested on live warehouses. 11 features. 0 critical bugs.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold rounded-xl transition-all hover:scale-105 shadow-lg shadow-green-500/25"
            >
              <Package className="w-5 h-5" />
              See Live Demo
            </Link>
            <a
              href="https://github.com/adithya-313/warehouse_v1"
              target="_blank"
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white font-semibold rounded-xl border border-slate-700 transition-all hover:border-slate-600"
            >
              <Globe className="w-5 h-5" />
              View on GitHub
            </a>
          </div>

          <div className="mt-12 flex justify-center gap-8 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>11 Features</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Production Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>India-Built</span>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-900 to-red-950/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 rounded-full border border-red-500/30 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400 font-medium">THE PROBLEM</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              The <span className="text-red-400">₹3.5 Crore</span> Problem
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Every mid-market warehouse in India loses this much annually to preventable issues
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-red-900/60 to-slate-900 border border-red-500/30 hover:border-red-500/60 transition-all hover:-translate-y-1">
              <div className="absolute inset-0 bg-red-500/5 rounded-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <ShieldAlert className="w-8 h-8 text-red-400" />
                  <ArrowDownRight className="w-5 h-5 text-red-400/50" />
                </div>
                <div className="text-4xl font-bold text-white mb-2">₹7-40 Lakh</div>
                <div className="text-red-400 font-medium mb-2">Lost to Shrinkage</div>
                <div className="text-slate-500 text-sm">Theft, damage, errors — caught in audits, not prevented</div>
                <div className="mt-4 px-3 py-1 bg-red-500/20 rounded-full text-xs text-red-400">
                  📉 25% of warehouses affected
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-orange-900/60 to-slate-900 border border-orange-500/30 hover:border-orange-500/60 transition-all hover:-translate-y-1">
              <div className="absolute inset-0 bg-orange-500/5 rounded-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-8 h-8 text-orange-400" />
                  <ArrowDownRight className="w-5 h-5 text-orange-400/50" />
                </div>
                <div className="text-4xl font-bold text-white mb-2">₹5-10 Lakh</div>
                <div className="text-orange-400 font-medium mb-2">Wasted on Labor</div>
                <div className="text-slate-500 text-sm">Pickers walk 50% of shift — no route optimization</div>
                <div className="mt-4 px-3 py-1 bg-orange-500/20 rounded-full text-xs text-orange-400">
                  📍 50% labor time wasted
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-yellow-900/60 to-slate-900 border border-yellow-500/30 hover:border-yellow-500/60 transition-all hover:-translate-y-1">
              <div className="absolute inset-0 bg-yellow-500/5 rounded-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <FileText className="w-8 h-8 text-yellow-400" />
                  <ArrowDownRight className="w-5 h-5 text-yellow-400/50" />
                </div>
                <div className="text-4xl font-bold text-white mb-2">₹3-5 Lakh</div>
                <div className="text-yellow-400 font-medium mb-2">Audit/Compliance Risk</div>
                <div className="text-slate-500 text-sm">GST penalties, manual reconciliation, audit failures</div>
                <div className="mt-4 px-3 py-1 bg-yellow-500/20 rounded-full text-xs text-yellow-400">
                  ⚠️ 40% fail GST audits
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-blue-900/60 to-slate-900 border border-blue-500/30 hover:border-blue-500/60 transition-all hover:-translate-y-1">
              <div className="absolute inset-0 bg-blue-500/5 rounded-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <Warehouse className="w-8 h-8 text-blue-400" />
                  <ArrowUpRight className="w-5 h-5 text-blue-400/50" />
                </div>
                <div className="text-4xl font-bold text-white mb-2">50,000</div>
                <div className="text-blue-400 font-medium mb-2">Mid-Market Warehouses</div>
                <div className="text-slate-500 text-sm">In India alone — massive untapped market</div>
                <div className="mt-4 px-3 py-1 bg-blue-500/20 rounded-full text-xs text-blue-400">
                  TAM = ₹1,850 Crore
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION SECTION */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30 mb-4">
              <Brain className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">OUR SOLUTION</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              9 AI-Powered <span className="text-green-400">Features</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Purpose-built for India's warehouse reality — battle-tested, production-ready
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {solutions.map((sol, i) => (
              <div
                key={i}
                className={`group relative p-6 rounded-2xl border transition-all hover:-translate-y-1 ${
                  sol.color === "red"
                    ? "bg-gradient-to-br from-red-900/40 to-slate-900 border-red-500/20 hover:border-red-500/40"
                    : sol.color === "blue"
                    ? "bg-gradient-to-br from-blue-900/40 to-slate-900 border-blue-500/20 hover:border-blue-500/40"
                    : "bg-gradient-to-br from-green-900/40 to-slate-900 border-green-500/20 hover:border-green-500/40"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      sol.color === "red"
                        ? "bg-red-500/20"
                        : sol.color === "blue"
                        ? "bg-blue-500/20"
                        : "bg-green-500/20"
                    }`}
                  >
                    <sol.icon
                      className={`w-6 h-6 ${
                        sol.color === "red"
                          ? "text-red-400"
                          : sol.color === "blue"
                          ? "text-blue-400"
                          : "text-green-400"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      sol.color === "red"
                        ? "bg-red-500/20 text-red-400"
                        : sol.color === "blue"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {sol.category === "loss"
                      ? "Loss Prevention"
                      : sol.color === "blue"
                      ? "Operations"
                      : "Planning"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{sol.title}</h3>
                <p className="text-slate-400 text-sm mb-4">{sol.problem}</p>
                <div
                  className={`px-4 py-2 rounded-lg ${
                    sol.color === "red"
                      ? "bg-red-500/10 text-red-400"
                      : sol.color === "blue"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-green-500/10 text-green-400"
                  }`}
                >
                  <span className="font-bold">{sol.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPETITIVE ADVANTAGE */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-full border border-cyan-500/30 mb-4">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">COMPETITIVE ADVANTAGE</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              We Win on <span className="text-cyan-400">Every Metric</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Purpose-built for India — while others offer generic global solutions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Feature</th>
                  <th className="py-4 px-4 text-green-400 font-bold text-center">Our MVP</th>
                  <th className="py-4 px-4 text-slate-500 font-medium text-center">SAP</th>
                  <th className="py-4 px-4 text-slate-500 font-medium text-center">NetSuite</th>
                  <th className="py-4 px-4 text-slate-500 font-medium text-center">Tally</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-4 px-4 text-slate-300 font-medium">{row.feature}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-green-400 font-medium">{row.us}</span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-500">{row.sap}</td>
                    <td className="py-4 px-4 text-center text-slate-500">{row.netsuite}</td>
                    <td className="py-4 px-4 text-center text-slate-500">{row.tally}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 p-8 bg-gradient-to-r from-cyan-500/10 to-green-500/10 rounded-2xl border border-cyan-500/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Why We Win</h3>
            </div>
            <p className="text-slate-300 text-lg">
              SAP/NetSuite are designed for global enterprises with 6-12 month deployments. 
              We're a <span className="text-cyan-400 font-bold">modern SaaS built in 1 week</span> for India's 
              50,000 mid-market warehouses. We understand GST, E-way bills, and local logistics — they don't.
            </p>
          </div>
        </div>
      </section>

      {/* UNIT ECONOMICS */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30 mb-4">
              <BarChart3 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">UNIT ECONOMICS</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              ₹37-68 Lakh <span className="text-green-400">Annual Value</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Per warehouse — with 6-12x ROI in Year 1
            </p>
          </div>

          {/* Main Value Card */}
          <div className="mb-12 p-8 bg-gradient-to-br from-green-900/40 to-slate-900 rounded-2xl border border-green-500/30">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="text-green-400 text-sm font-medium mb-2">ANNUAL VALUE BREAKDOWN</div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Shrinkage Prevention (40%)</span>
                    <span className="text-green-400 font-bold">₹15-30 Lakh</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Labor Savings (30%)</span>
                    <span className="text-green-400 font-bold">₹12-20 Lakh</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Compliance (15%)</span>
                    <span className="text-green-400 font-bold">₹5-8 Lakh</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Forecasting (15%)</span>
                    <span className="text-green-400 font-bold">₹5-10 Lakh</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-6xl font-bold text-white mb-2">₹37-68L</div>
                <div className="text-green-400 font-medium">Annual Value Per Warehouse</div>
                <div className="text-slate-500 text-sm mt-2">($44k-80k USD)</div>
              </div>
            </div>
          </div>

          {/* ROI Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-center">
              <IndianRupee className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">₹5 Lakh</div>
              <div className="text-slate-500 text-sm">Annual Price</div>
            </div>
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-center">
              <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-green-400 mb-1">6-12x</div>
              <div className="text-slate-500 text-sm">ROI (Year 1)</div>
            </div>
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-center">
              <Clock className="w-8 h-8 text-orange-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">2 Months</div>
              <div className="text-slate-500 text-sm">Payback Period</div>
            </div>
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-center">
              <Database className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">₹25 Lakh</div>
              <div className="text-slate-500 text-sm">5-Year LTV</div>
            </div>
          </div>

          {/* Investor Metrics */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-to-br from-cyan-900/40 to-slate-900 rounded-xl border border-cyan-500/20">
              <div className="text-cyan-400 text-sm font-medium mb-2">CAC (Customer Acquisition)</div>
              <div className="text-3xl font-bold text-white">₹75k</div>
              <div className="text-slate-500 text-sm mt-1">Per customer</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-900/40 to-slate-900 rounded-xl border border-green-500/20">
              <div className="text-green-400 text-sm font-medium mb-2">LTV:CAC Ratio</div>
              <div className="text-4xl font-bold text-green-400">30-50x</div>
              <div className="text-slate-500 text-sm mt-1">Venture-scale!</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-purple-900/40 to-slate-900 rounded-xl border border-purple-500/20">
              <div className="text-purple-400 text-sm font-medium mb-2">Gross Margin</div>
              <div className="text-3xl font-bold text-white">75%</div>
              <div className="text-slate-500 text-sm mt-1">SaaS model</div>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET OPPORTUNITY */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500/30 mb-4">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">MARKET OPPORTUNITY</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              ₹1,850 Crore <span className="text-blue-400">TAM</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              India's logistics is exploding. We own this category.
            </p>
          </div>

          {/* Pyramid */}
          <div className="space-y-4">
            <div className="p-8 bg-gradient-to-r from-cyan-900/60 to-cyan-800/40 rounded-2xl border border-cyan-500/50 text-center">
              <div className="text-cyan-400 text-sm font-medium mb-2">TAM (Total Addressable Market)</div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">₹1,850-3,400 Crore</div>
              <div className="text-slate-400">50,000 mid-market warehouses × ₹37-68 Lakh</div>
            </div>

            <div className="flex justify-center">
              <div className="w-3/4 p-6 bg-gradient-to-r from-green-900/60 to-green-800/40 rounded-2xl border border-green-500/50 text-center">
                <div className="text-green-400 text-sm font-medium mb-2">SAM (Serviceable Addressable Market)</div>
                <div className="text-3xl font-bold text-white mb-2">₹370-680 Crore</div>
                <div className="text-slate-400">10,000 warehouses using or considering WMS</div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-1/2 p-6 bg-gradient-to-r from-orange-900/60 to-orange-800/40 rounded-2xl border border-orange-500/50 text-center">
                <div className="text-orange-400 text-sm font-medium mb-2">SOM (5-Year Target)</div>
                <div className="text-2xl font-bold text-white mb-2">₹18.5-34 Crore</div>
                <div className="text-slate-400">2,000 customers (2% penetration)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRACTION & ROADMAP */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30 mb-4">
              <Calendar className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">TRACTION & ROADMAP</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              From MVP to <span className="text-green-400">Market Leader</span>
            </h2>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-cyan-500 to-slate-700 transform -translate-x-1/2" />

            <div className="space-y-12">
              {roadmap.map((item, i) => (
                <div key={i} className={`flex items-center ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                  <div className={`w-1/2 ${i % 2 === 0 ? "pr-8 text-right" : "pl-8 text-left"}`}>
                    <div
                      className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                        item.status === "complete"
                          ? "bg-green-500/20 text-green-400"
                          : item.status === "current"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.phase}
                    </div>
                    <h3 className="text-xl font-bold text-white mt-3">{item.title}</h3>
                    <p className="text-slate-400 mt-1">{item.desc}</p>
                  </div>

                  <div className="relative z-10 w-4 h-4 rounded-full bg-slate-900 border-2 border-green-500 flex-shrink-0">
                    {item.status === "complete" && (
                      <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse" />
                    )}
                    {item.status === "current" && (
                      <div className="absolute inset-1 bg-cyan-500 rounded-full animate-ping" />
                    )}
                  </div>

                  <div className="w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THE ASK */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-900 to-green-950/30">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 mb-8">
            <CreditCard className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400 font-medium">THE ASK</span>
          </div>

          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Seeking <span className="text-orange-400">₹5 Crore</span>
          </h2>
          <p className="text-xl text-slate-400 mb-12">to scale India's warehouse revolution</p>

          {/* Use of Funds */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <UsersRound className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">40%</div>
              <div className="text-slate-400 mb-2">Sales & Marketing</div>
              <div className="text-cyan-400 font-medium">₹2 Crore</div>
              <div className="text-slate-500 text-sm mt-2">Build GTM, demand generation</div>
            </div>
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">40%</div>
              <div className="text-slate-400 mb-2">Engineering</div>
              <div className="text-green-400 font-medium">₹2 Crore</div>
              <div className="text-slate-500 text-sm mt-2">Mobile app, API integrations</div>
            </div>
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">20%</div>
              <div className="text-slate-400 mb-2">Operations</div>
              <div className="text-orange-400 font-medium">₹1 Crore</div>
              <div className="text-slate-500 text-sm mt-2">Customer success, pilots</div>
            </div>
          </div>

          {/* Deliverables */}
          <div className="p-8 bg-gradient-to-r from-green-900/40 to-cyan-900/40 rounded-2xl border border-green-500/30">
            <h3 className="text-2xl font-bold text-white mb-6">What We'll Deliver</h3>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-bold text-white">Year 1: 100 Customers</div>
                  <div className="text-slate-400 text-sm">₹5-7.5 Crore ARR</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-bold text-white">₹300 Cr+ Value Unlocked</div>
                  <div className="text-slate-400 text-sm">For customers</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-bold text-white">Series A Ready</div>
                  <div className="text-slate-400 text-sm">₹25+ Cr revenue (Year 2)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <section className="py-16 px-6 border-t border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-200" />
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-4">
            Built in India. For India. By engineers who get it.
          </h3>

          <p className="text-slate-400 mb-8">
            Battle-tested MVP. 11 features. Zero critical bugs. Production-ready.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition"
            >
              Schedule Demo
              <ChevronRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/adithya-313/warehouse_v1"
              target="_blank"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-700 transition"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Bottom Bar */}
      <div className="py-6 px-6 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div>© 2026 Warehouse AI — Built in India, for India</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            All systems operational (localhost:3000)
          </div>
        </div>
      </div>
    </div>
  );
}

function Lightbulb({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3 1.3 1.2 1.5 2 1.5 3.5 0 1.5-.5 2.5-1.5 3.5-.8.8-1.3 1.5-1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}