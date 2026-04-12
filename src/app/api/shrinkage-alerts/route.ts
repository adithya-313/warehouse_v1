import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  
  const warehouseId = searchParams.get("warehouse_id");
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");
  
  try {
    let query = supabase
      .from("shrinkage_alerts")
      .select(`
        *,
        products (id, name, unit_cost, default_gst_rate),
        warehouses (id, name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }
    if (severity) {
      query = query.eq("severity", severity);
    }
    if (status) {
      query = query.eq("resolution_status", status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("[shrinkage-alerts GET]", err);
    return NextResponse.json({ error: "Failed to fetch shrinkage alerts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  
  try {
    const body = await req.json();
    const {
      warehouse_id,
      product_id,
      alert_type,
      expected_qty,
      actual_qty,
      bin_location,
      flagged_by_name,
      notes
    } = body;
    
    if (!warehouse_id || !alert_type) {
      return NextResponse.json({ error: "warehouse_id and alert_type are required" }, { status: 400 });
    }
    
    const variance_qty = expected_qty - actual_qty;
    const variance_pct = expected_qty > 0 ? variance_qty / expected_qty : 0;
    
    let severity = "medium";
    if (variance_pct > 0.10) severity = "critical";
    else if (variance_pct > 0.05) severity = "high";
    else if (variance_pct > 0.02) severity = "medium";
    else severity = "low";
    
    let zone = null, aisle = null;
    if (bin_location) {
      const parts = bin_location.split("-");
      zone = parts[0] || null;
      aisle = parts[1] || null;
    }
    
    const alert = {
      warehouse_id,
      product_id,
      alert_type,
      expected_qty,
      actual_qty,
      variance_qty,
      variance_pct,
      bin_location,
      zone,
      aisle,
      severity,
      resolution_status: "open",
      flagged_by_name: flagged_by_name || "manual_report",
      resolution_notes: notes
    };
    
    const { data, error } = await supabase
      .from("shrinkage_alerts")
      .insert(alert)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[shrinkage-alerts POST]", err);
    return NextResponse.json({ error: "Failed to create shrinkage alert" }, { status: 500 });
  }
}
