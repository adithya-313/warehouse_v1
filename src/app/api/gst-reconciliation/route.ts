import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  
  const warehouseId = searchParams.get("warehouse_id");
  const date = searchParams.get("date");
  
  if (!warehouseId) {
    return NextResponse.json({ error: "warehouse_id is required" }, { status: 400 });
  }
  
  try {
    let query = supabase
      .from("gst_reconciliation_log")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .order("reconciliation_date", { ascending: false });
    
    if (date) {
      query = query.eq("reconciliation_date", date);
    }
    
    const { data: logs, error: logError } = await query;
    
    if (logError) throw logError;
    
    const { data: lastRecon } = await supabase
      .from("gst_reconciliation_log")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .order("reconciliation_date", { ascending: false })
      .limit(1)
      .single();
    
    const { data: transactions, error: txnError } = await supabase
      .from("gst_transactions")
      .select(`
        *,
        products (id, name)
      `)
      .eq("warehouse_id", warehouseId)
      .eq("reconciled", false)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (txnError) throw txnError;
    
    const discrepancies = (transactions || []).filter(t => t.discrepancy_notes);
    
    return NextResponse.json({
      reconciliation_logs: logs || [],
      last_reconciliation: lastRecon,
      pending_discrepancies: discrepancies,
      summary: {
        total_pending: discrepancies.length,
        compliant: lastRecon?.audit_status === "compliant",
        needs_review: lastRecon?.audit_status === "needs_review"
      }
    });
  } catch (err) {
    console.error("[gst-reconciliation GET]", err);
    return NextResponse.json({ error: "Failed to fetch reconciliation data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  
  try {
    const body = await req.json();
    const { warehouse_id, reconciliation_date } = body;
    
    if (!warehouse_id || !reconciliation_date) {
      return NextResponse.json({ error: "warehouse_id and reconciliation_date are required" }, { status: 400 });
    }
    
    const reconDate = new Date(reconciliation_date);
    if (reconDate > new Date()) {
      return NextResponse.json({ error: "Cannot reconcile future dates" }, { status: 400 });
    }
    
    const startDate = reconciliation_date;
    const endDate = new Date(reconDate);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split("T")[0];
    
    const { data: transactions, error } = await supabase
      .from("gst_transactions")
      .select("*")
      .eq("warehouse_id", warehouse_id)
      .gte("created_at", startDate)
      .lt("created_at", endDateStr);
    
    if (error) throw error;
    
    let matchedCount = 0;
    let discrepancyCount = 0;
    const discrepancies: unknown[] = [];
    let totalTaxable = 0;
    let totalGst = 0;
    
    for (const txn of transactions || []) {
      totalTaxable += txn.taxable_amount || 0;
      totalGst += txn.gst_amount || 0;
      
      if (txn.reconciled) {
        matchedCount++;
      } else if (txn.discrepancy_notes) {
        discrepancyCount++;
        discrepancies.push({
          id: txn.id,
          invoice_number: txn.invoice_number,
          type: txn.transaction_type,
          issue: txn.discrepancy_notes
        });
      } else {
        if (txn.invoice_number) {
          const { data: stockMovements } = await supabase
            .from("stock_movements")
            .select("quantity")
            .eq("invoice_id", txn.invoice_number)
            .execute();
          
          const stockQty = (stockMovements || []).reduce((sum, m) => sum + (m.quantity || 0), 0);
          
          if (Math.abs(stockQty - txn.quantity) < 0.01) {
            matchedCount++;
            await supabase
              .from("gst_transactions")
              .update({ reconciled: true, reconciled_at: new Date().toISOString() })
              .eq("id", txn.id);
          } else {
            discrepancyCount++;
            discrepancies.push({
              id: txn.id,
              invoice_number: txn.invoice_number,
              type: "qty_mismatch",
              expected: txn.quantity,
              actual: stockQty
            });
          }
        } else {
          matchedCount++;
        }
      }
    }
    
    const gstVariance = Math.abs(totalGst - (totalTaxable * 0.18));
    const auditStatus = discrepancyCount > 0 ? "needs_review" : "compliant";
    
    const reconciliation = {
      warehouse_id,
      reconciliation_date,
      total_transactions: transactions?.length || 0,
      matched_count: matchedCount,
      discrepancy_count: discrepancyCount,
      gst_amount_variance: gstVariance,
      total_taxable_amount: totalTaxable,
      total_gst_amount: totalGst,
      audit_status: auditStatus
    };
    
    const { data: existing } = await supabase
      .from("gst_reconciliation_log")
      .select("id")
      .eq("warehouse_id", warehouse_id)
      .eq("reconciliation_date", reconciliation_date)
      .single();
    
    if (existing) {
      await supabase
        .from("gst_reconciliation_log")
        .update(reconciliation)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("gst_reconciliation_log")
        .insert(reconciliation);
    }
    
    return NextResponse.json({
      ...reconciliation,
      discrepancies
    });
  } catch (err) {
    console.error("[gst-reconciliation POST]", err);
    return NextResponse.json({ error: "Failed to run reconciliation" }, { status: 500 });
  }
}
