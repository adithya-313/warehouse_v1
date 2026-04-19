export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { createServerClient } from "@/lib/supabase/server";
import path from "path";
import fs from "fs";

const { join } = path;
const { existsSync } = fs;

const getPythonScriptPath = () => {
  const possiblePaths = [
    join(process.cwd(), "python", "demand_forecaster.py"),
    join(process.cwd(), "..", "python", "demand_forecaster.py"),
    "C:\\Users\\sinne\\Downloads\\warehouse_v1\\warehouse_v1\\python\\demand_forecaster.py",
  ];
  
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return possiblePaths[0];
};

const PYTHON_DIR = join(process.cwd(), "python");
const PYTHON_SCRIPT = getPythonScriptPath();
const PYTHON_PATH = process.platform === "win32" ? "python" : "python3";
const TIMEOUT_MS = 60000;

function runPythonForecast(productId: string, warehouseId?: string): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    if (!existsSync(PYTHON_SCRIPT)) {
      reject(new Error(`Python script not found at: ${PYTHON_SCRIPT}`));
      return;
    }

    console.log("[forecast] ==================");
    console.log("[forecast] Windows Path Check:", process.platform);
    console.log("[forecast] Script Path:", PYTHON_SCRIPT);
    console.log("[forecast] Script Exists:", existsSync(PYTHON_SCRIPT));
    console.log("[forecast] Product ID:", productId);
    console.log("[forecast] Command:", PYTHON_PATH, PYTHON_SCRIPT, productId);
    console.log("[forecast] ==================");
    
    const args = [PYTHON_SCRIPT, productId];
    if (warehouseId) {
      args.push(warehouseId);
    }

    const child = spawn(PYTHON_PATH, args, {
      cwd: PYTHON_DIR,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      console.error("[forecast] Process killed - timeout after 60s");
      reject(new Error("Forecast timeout - process killed after 60 seconds"));
    }, TIMEOUT_MS);

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (killed) return;
      
      console.log("[forecast] Process exited with code:", code);
      resolve({ output: stdout, exitCode: code ?? 0 });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      console.error("[forecast] Spawn error:", err.message);
      reject(err);
    });
  });
}

const DEFAULT_WAREHOUSE_ID = "a1000000-0000-0000-0000-000000000001";

async function fetchAllProductIds(supabase: any): Promise<string[]> {
  const { data, error } = await supabase.from("products").select("id").limit(30);
  if (error || !data) return [];
  return data.map((p: any) => p.id);
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let product_id = body?.product_id;
  let warehouse_id = body?.warehouse_id || DEFAULT_WAREHOUSE_ID;
  
  // Handle "generate all products" trigger (when only warehouse_id is provided)
  if (!product_id && warehouse_id) {
    console.log("[forecast] ====== GENERATE ALL PRODUCTS FOR WAREHOUSE ======");
    console.log("[forecast] Warehouse ID:", warehouse_id);
    
    const supabase = createServerClient();
    
    // Get warehouse to validate it exists
    const { data: warehouse, error: whError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("id", warehouse_id)
      .single();
    
    if (whError || !warehouse) {
      return NextResponse.json({ error: "Invalid warehouse_id" }, { status: 400 });
    }
    
    const productIds = await fetchAllProductIds(supabase);
    console.log(`[forecast] Found ${productIds.length} products to forecast`);
    
    // Use existing forecasts or generate simple ones if Python fails
    const results = [];
    for (const pid of productIds) {
      try {
        const result = await runPythonForecast(pid, warehouse_id);
        results.push({ product_id: pid, success: result.exitCode === 0 });
      } catch (e: any) {
        results.push({ product_id: pid, success: false, error: e.message });
      }
    }
    
    return NextResponse.json({
      status: "success",
      processed: results.length,
      results,
      warehouse_id,
      timestamp: new Date().toISOString(),
    });
  }
  
  if (!product_id) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }

  // Handle "all-products" trigger
  if (product_id === "all-products") {
    console.log("[forecast] ====== FORECAST ALL PRODUCTS ======");
    const supabase = createServerClient();
    const productIds = await fetchAllProductIds(supabase);
    console.log(`[forecast] Found ${productIds.length} products to forecast`);
    
    const results = [];
    for (const pid of productIds) {
      try {
        const result = await runPythonForecast(pid, warehouse_id);
        results.push({ product_id: pid, success: result.exitCode === 0 });
      } catch (e: any) {
        results.push({ product_id: pid, success: false, error: e.message });
      }
    }
    
    return NextResponse.json({
      status: "success",
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  }

  console.log("[forecast] ====== FORECAST TRIGGER START ======");
  console.log("[forecast] Product:", product_id);
  console.log("[forecast] Warehouse:", warehouse_id);

  try {
    const result = await runPythonForecast(product_id, warehouse_id);
    
    if (result.exitCode !== 0) {
      console.error("[forecast] Python script failed:", result.exitCode);
      return NextResponse.json(
        { error: "Forecast script failed", exitCode: result.exitCode, output: result.output },
        { status: 500 }
      );
    }

    console.log("[forecast] ====== FORECAST TRIGGER SUCCESS ======");
    
    return NextResponse.json({
      status: "success",
      product_id,
      warehouse_id,
      exitCode: result.exitCode,
      output: result.output,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[forecast] ====== FORECAST TRIGGER FAILED ======");
    console.error("[forecast] Error:", err.message);
    
    return NextResponse.json(
      { error: err.message || "Forecast failed" },
      { status: 500 }
    );
  }
}

export interface ForecastResponse {
  product_id: string;
  date: string;
  predicted_qty: number;
  confidence_lower: number;
  confidence_upper: number;
  trend: "rising" | "falling" | "stable";
}

export async function GET(req: NextRequest) {
  const warehouse_id = req.nextUrl.searchParams.get("warehouse_id") || "a1000000-0000-0000-0000-000000000001";
  const product_id = req.nextUrl.searchParams.get("product_id");
  const days_ahead = req.nextUrl.searchParams.get("days_ahead");

  const supabase = createServerClient();

  try {
    let query = supabase
      .from("demand_forecasts")
      .select("product_id, forecast_date, predicted_qty, confidence_lower, confidence_upper")
      .eq("warehouse_id", warehouse_id);

    if (product_id) {
      query = query.eq("product_id", product_id);
    }

    if (days_ahead) {
      query = query.eq("days_ahead", parseInt(days_ahead));
    }

    query = query.order("forecast_date");

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const mappedData: ForecastResponse[] = (data || []).map((row) => ({
      product_id: row.product_id,
      date: row.forecast_date,
      predicted_qty: row.predicted_qty ?? 0,
      confidence_lower: row.confidence_lower ?? 0,
      confidence_upper: row.confidence_upper ?? 0,
      trend: row.trend || "stable",
    }));

    return NextResponse.json(mappedData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}