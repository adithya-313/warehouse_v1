import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  
  const warehouseId = searchParams.get("warehouse_id");
  const month = searchParams.get("month");
  
  if (!warehouseId) {
    return NextResponse.json({ error: "warehouse_id is required" }, { status: 400 });
  }
  
  if (!month) {
    return NextResponse.json({ error: "month is required (format: YYYY-MM)" }, { status: 400 });
  }
  
  try {
    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    
    let endDate: string;
    if (parseInt(mon) === 12) {
      endDate = `${parseInt(year) + 1}-01-01`;
    } else {
      endDate = `${year}-${(parseInt(mon) + 1).toString().padStart(2, "0")}-01`;
    }
    
    const { data: transactions, error: txnError } = await supabase
      .from("gst_transactions")
      .select(`
        *,
        products (id, name, default_gst_rate)
      `)
      .eq("warehouse_id", warehouseId)
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at");
    
    if (txnError) throw txnError;
    
    const { data: reconciliations, error: reconError } = await supabase
      .from("gst_reconciliation_log")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .gte("reconciliation_date", startDate)
      .lt("reconciliation_date", endDate);
    
    if (reconError) throw reconError;
    
    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("name, state_code")
      .eq("id", warehouseId)
      .single();
    
    let totalTaxable = 0;
    let totalGst = 0;
    const byType: Record<string, number> = {};
    const byRate: Record<string, number> = {};
    let reconciledCount = 0;
    let discrepancyCount = 0;
    
    for (const txn of transactions || []) {
      totalTaxable += txn.taxable_amount || 0;
      totalGst += txn.gst_amount || 0;
      
      byType[txn.transaction_type] = (byType[txn.transaction_type] || 0) + 1;
      byRate[String(txn.gst_rate)] = (byRate[String(txn.gst_rate)] || 0) + 1;
      
      if (txn.reconciled) reconciledCount++;
      if (txn.discrepancy_notes) discrepancyCount++;
    }
    
    const compliantDays = (reconciliations || []).filter(r => r.audit_status === "compliant").length;
    const needsReviewDays = (reconciliations || []).filter(r => r.audit_status === "needs_review").length;
    
    const report = {
      report_month: month,
      generated_at: new Date().toISOString(),
      warehouse: warehouse || { name: "Unknown", state_code: null },
      summary: {
        total_transactions: transactions?.length || 0,
        total_taxable_amount: Math.round(totalTaxable * 100) / 100,
        total_gst_amount: Math.round(totalGst * 100) / 100,
        reconciled_transactions: reconciledCount,
        discrepancy_count: discrepancyCount,
        compliance_rate: transactions?.length ? Math.round((reconciledCount / transactions.length) * 10000) / 100 : 100,
        compliant_days: compliantDays,
        needs_review_days: needsReviewDays
      },
      by_transaction_type: byType,
      by_gst_rate: byRate,
      by_reconciliation_status: {
        compliant: compliantDays,
        needs_review: needsReviewDays,
        pending: (reconciliations?.length || 0) - compliantDays - needsReviewDays
      },
      transactions: transactions?.slice(0, 200) || [],
      reconciliations: reconciliations || [],
      status: needsReviewDays === 0 ? "compliant" : "needs_review",
      certified_by: null,
      certification_date: null
    };
    
    return NextResponse.json(report);
  } catch (err) {
    console.error("[audit-report GET]", err);
    return NextResponse.json({ error: "Failed to generate audit report" }, { status: 500 });
  }
}
