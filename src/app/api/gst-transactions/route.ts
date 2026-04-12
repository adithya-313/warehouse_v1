import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VALID_GST_RATES = [5, 12, 18, 28];
const VALID_STATES = [
  "AP", "AR", "AS", "BR", "CH", "CT", "DD", "DL", "DN", "GA", "GJ", "HR", "HP",
  "JK", "JH", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD",
  "PB", "PY", "RJ", "SK", "TG", "TN", "TR", "TS", "UP", "UK", "WB"
];

function validateEWayBillFormat(eWayBill: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!eWayBill) {
    return { valid: true, issues: [] };
  }
  
  if (!/^\d{12}$/.test(eWayBill)) {
    issues.push("E-way bill must be exactly 12 digits");
  }
  
  return { valid: issues.length === 0, issues };
}

function calculateGST(taxableAmount: number, gstRate: number, stateFrom: string, stateTo: string) {
  const isInterState = stateFrom !== stateTo;
  const gstAmount = Math.round(taxableAmount * (gstRate / 100) * 100) / 100;
  
  if (isInterState) {
    return {
      gst_amount: gstAmount,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      tax_type: "IGST"
    };
  }
  
  const halfGst = Math.round(gstAmount / 2 * 100) / 100;
  return {
    gst_amount: gstAmount,
    cgst: halfGst,
    sgst: halfGst,
    igst: 0,
    tax_type: "CGST+SGST"
  };
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  
  const warehouseId = searchParams.get("warehouse_id");
  const transactionType = searchParams.get("transaction_type");
  const reconciled = searchParams.get("reconciled");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const limit = parseInt(searchParams.get("limit") || "100");
  
  try {
    let query = supabase
      .from("gst_transactions")
      .select(`
        *,
        products (id, name, default_gst_rate),
        warehouses (id, name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (warehouseId) query = query.eq("warehouse_id", warehouseId);
    if (transactionType) query = query.eq("transaction_type", transactionType);
    if (reconciled !== null) query = query.eq("reconciled", reconciled === "true");
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("[gst-transactions GET]", err);
    return NextResponse.json({ error: "Failed to fetch GST transactions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  
  try {
    const body = await req.json();
    const {
      warehouse_id,
      transaction_type,
      product_id,
      quantity,
      gst_rate,
      taxable_amount,
      invoice_number,
      e_way_bill_number,
      state_from,
      state_to,
      reference_id,
      logged_by
    } = body;
    
    if (!warehouse_id || !transaction_type || !quantity || !taxable_amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    if (gst_rate && !VALID_GST_RATES.includes(gst_rate)) {
      return NextResponse.json({ error: `Invalid GST rate. Must be one of: ${VALID_GST_RATES.join(", ")}` }, { status: 400 });
    }
    
    if (state_from && !VALID_STATES.includes(state_from)) {
      return NextResponse.json({ error: "Invalid state_from code" }, { status: 400 });
    }
    
    if (state_to && !VALID_STATES.includes(state_to)) {
      return NextResponse.json({ error: "Invalid state_to code" }, { status: 400 });
    }
    
    if (e_way_bill_number) {
      const ewayValidation = validateEWayBillFormat(e_way_bill_number);
      if (!ewayValidation.valid) {
        return NextResponse.json({ 
          error: "Invalid e-way bill format", 
          issues: ewayValidation.issues 
        }, { status: 400 });
      }
    }
    
    let finalGstRate = gst_rate;
    if (!finalGstRate && product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("default_gst_rate")
        .eq("id", product_id)
        .single();
      
      if (product?.default_gst_rate) {
        finalGstRate = product.default_gst_rate;
      }
    }
    
    if (!finalGstRate) {
      finalGstRate = 18;
    }
    
    const finalStateFrom = state_from || "MH";
    const finalStateTo = state_to || "MH";
    const gstCalc = calculateGST(taxable_amount, finalGstRate, finalStateFrom, finalStateTo);
    
    const transaction = {
      warehouse_id,
      transaction_type,
      product_id,
      quantity,
      gst_rate: finalGstRate,
      taxable_amount,
      gst_amount: gstCalc.gst_amount,
      invoice_number,
      e_way_bill_number,
      state_from: finalStateFrom,
      state_to: finalStateTo,
      reference_id,
      reconciled: false,
      logged_by: logged_by || "api"
    };
    
    const { data, error } = await supabase
      .from("gst_transactions")
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      ...data,
      cgst: gstCalc.cgst,
      sgst: gstCalc.sgst,
      igst: gstCalc.igst,
      tax_type: gstCalc.tax_type,
      is_inter_state: finalStateFrom !== finalStateTo
    }, { status: 201 });
  } catch (err) {
    console.error("[gst-transactions POST]", err);
    return NextResponse.json({ error: "Failed to create GST transaction" }, { status: 500 });
  }
}
