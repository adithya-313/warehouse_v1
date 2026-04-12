"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Calculator,
  Clock,
  Users,
  DollarSign,
  ArrowUpRight,
  RefreshCcw,
  Target,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

interface RoiData {
  shrinkage_prevented_pct: number;
  labor_cut_pct: number;
  compliance_automated_pct: number;
  overstock_reduced_pct: number;
  payback_months: number;
}

interface RevenueProjection {
  year: number;
  customers: number;
  arr_crore: number;
  tam_pct: number;
}

interface CustomerEconomics {
  cac: number;
  ltv: number;
  ltv_cat_ratio: number;
  payback_months: number;
  gross_margin: number;
  arpu_monthly: number;
  nrr: number;
  churn_rate: number;
  expansion_revenue_pct: number;
}

const COLORS = {
  green: "#10b981",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
};

function formatCurrency(value: number): string {
  if (value >= 100) return `₹${(value / 100).toFixed(1)} Cr`;
  return `₹${value.toFixed(1)} Lakh`;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export default function FinancialImpactPage() {
  const [loading, setLoading] = useState(true);
  const [roiData, setRoiData] = useState<RoiData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueProjection[]>([]);
  const [customerData, setCustomerData] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [investmentAmount, setInvestmentAmount] = useState(2000000);
  const [monthlySavings, setMonthlySavings] = useState(100000);

  const fetchAllData = async () => {
    try {
      const [roiRes, revenueRes, customerRes] = await Promise.all([
        fetch("/api/analytics/roi-calculator"),
        fetch("/api/analytics/revenue-projection"),
        fetch("/api/analytics/customer-economics"),
      ]);

      const roiJson = await roiRes.json();
      const revenueJson = await revenueRes.json();
      const customerJson = await customerRes.json();

      if (roiJson.data) setRoiData(roiJson.data);
      if (revenueJson.data) setRevenueData(revenueJson.data);
      if (customerJson.data) setCustomerData(customerJson);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch financial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const calculatedPayback = investmentAmount / monthlySavings;
  const projectedAnnualSavings = monthlySavings * 12;
  const roi = ((projectedAnnualSavings - investmentAmount) / investmentAmount) * 100;

  const fundAllocation = [
    { name: "Product Development", value: 35, color: COLORS.blue },
    { name: "Sales & Marketing", value: 30, color: COLORS.purple },
    { name: "Operations", value: 20, color: COLORS.cyan },
    { name: "Reserve", value: 15, color: COLORS.green },
  ];

  const savingsBreakdown = [
    { category: "Shrinkage Prevention", value: 40, amount: monthlySavings * 0.4, color: COLORS.red },
    { category: "Labor Optimization", value: 30, amount: monthlySavings * 0.3, color: COLORS.blue },
    { category: "Compliance Automation", value: 15, amount: monthlySavings * 0.15, color: COLORS.purple },
    { name: "Inventory Optimization", value: 15, amount: monthlySavings * 0.15, color: COLORS.green },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-slate-800 animate-pulse rounded mb-8" />
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-800 animate-pulse rounded-2xl" />)}
          </div>
          <div className="h-80 bg-slate-800 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Financial Impact</h1>
            <p className="text-slate-400 mt-1">ROI Calculator & Investor Projections</p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-slate-500 text-xs">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchAllData}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm transition"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* SECTION 1: ROI Calculator */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">ROI Calculator</h2>
              <p className="text-slate-400 text-sm">Calculate your investment returns</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Investment Amount (₹)</label>
              <input
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-slate-500 text-xs">One-time implementation cost</p>
            </div>
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Monthly Savings (₹)</label>
              <input
                type="number"
                value={monthlySavings}
                onChange={(e) => setMonthlySavings(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-slate-500 text-xs">Expected monthly value unlock</p>
            </div>
            <div className="space-y-2">
              <label className="text-slate-400 text-sm">Investment Horizon</label>
              <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500">
                <option>12 Months</option>
                <option>24 Months</option>
                <option>36 Months</option>
              </select>
              <p className="text-slate-500 text-xs">Project over 1-3 years</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-green-900/40 to-slate-900 rounded-xl p-4 border border-green-500/30">
              <div className="text-green-400 text-sm mb-1">Payback Period</div>
              <div className="text-3xl font-bold text-white">{calculatedPayback.toFixed(1)}</div>
              <div className="text-slate-500 text-xs">months</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 rounded-xl p-4 border border-blue-500/30">
              <div className="text-blue-400 text-sm mb-1">Annual Savings</div>
              <div className="text-3xl font-bold text-white">{formatCurrency(projectedAnnualSavings / 100)}</div>
              <div className="text-slate-500 text-xs">per year</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 rounded-xl p-4 border border-purple-500/30">
              <div className="text-purple-400 text-sm mb-1">Year 1 ROI</div>
              <div className="text-3xl font-bold text-white">{roi.toFixed(0)}%</div>
              <div className="text-slate-500 text-xs">return on investment</div>
            </div>
            <div className="bg-gradient-to-br from-orange-900/40 to-slate-900 rounded-xl p-4 border border-orange-500/30">
              <div className="text-orange-400 text-sm mb-1">3-Year NPV</div>
              <div className="text-3xl font-bold text-white">{formatCurrency((projectedAnnualSavings * 2.5 - investmentAmount) / 100)}</div>
              <div className="text-slate-500 text-xs">net present value</div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Value Drivers */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Value Drivers</h2>
              <p className="text-slate-400 text-sm">Breakdown of monthly savings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {savingsBreakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-white">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">{formatINR(item.amount)}</div>
                    <div className="text-slate-500 text-xs">{item.value}% contribution</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={savingsBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {savingsBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* SECTION 3: Revenue Projections */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Revenue Projections</h2>
                <p className="text-slate-400 text-sm">5-year growth trajectory</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">₹100 Cr</div>
              <div className="text-slate-500 text-xs">Year 5 ARR Target</div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorArr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={(v) => `Y${v}`} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}Cr`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  formatter={(value: number) => [`₹${value} Cr`, "ARR"]}
                />
                <Area type="monotone" dataKey="arr_crore" stroke={COLORS.purple} fill="url(#colorArr)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-5 gap-4 mt-4">
            {revenueData.map((d, i) => (
              <div key={i} className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-purple-400 font-bold">Year {d.year}</div>
                <div className="text-white text-lg">{d.customers}</div>
                <div className="text-slate-500 text-xs">customers</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: Customer Economics */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Customer Economics</h2>
              <p className="text-slate-400 text-sm">Unit economics & cohort analysis</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-900/40 to-slate-900 rounded-xl p-4 border border-green-500/30">
              <div className="text-green-400 text-sm mb-1">LTV:CAC Ratio</div>
              <div className="text-3xl font-bold text-white">10:1</div>
              <div className="text-slate-500 text-xs">Customer lifetime value</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 rounded-xl p-4 border border-blue-500/30">
              <div className="text-blue-400 text-sm mb-1">Payback Period</div>
              <div className="text-3xl font-bold text-white">3 mo</div>
              <div className="text-slate-500 text-xs">CAC payback</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 rounded-xl p-4 border border-purple-500/30">
              <div className="text-purple-400 text-sm mb-1">NRR</div>
              <div className="text-3xl font-bold text-white">115%</div>
              <div className="text-slate-500 text-xs">Net revenue retention</div>
            </div>
            <div className="bg-gradient-to-br from-orange-900/40 to-slate-900 rounded-xl p-4 border border-orange-500/30">
              <div className="text-orange-400 text-sm mb-1">Churn Rate</div>
              <div className="text-3xl font-bold text-white">5%</div>
              <div className="text-slate-500 text-xs">Monthly churn</div>
            </div>
          </div>

          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerData?.cohort_data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                />
                <Bar dataKey="revenue" name="Revenue (₹)" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="retained" name="Retention %" fill={COLORS.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SECTION 5: Fund Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <PieChartIcon className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Fund Allocation</h2>
                <p className="text-slate-400 text-sm">₹2 Crore raise breakdown</p>
              </div>
            </div>

            <div className="h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={fundAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {fundAllocation.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Investment Thesis</h2>
                <p className="text-slate-400 text-sm">Why invest now</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <ArrowUpRight className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="text-green-400 font-medium">Proven ROI</div>
                  <div className="text-slate-400 text-sm">3-month payback with 500%+ ROI potential</div>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <ArrowUpRight className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="text-blue-400 font-medium">Scalable Model</div>
                  <div className="text-slate-400 text-sm">₹100Cr ARR potential in 5 years</div>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <ArrowUpRight className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="text-purple-400 font-medium">Strong Unit Economics</div>
                  <div className="text-slate-400 text-sm">10:1 LTV:CAC with 115% NRR</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-slate-500 text-sm">
          <p>Data based on MVP performance and industry benchmarks • Powered by Supabase</p>
        </div>
      </div>
    </div>
  );
}
