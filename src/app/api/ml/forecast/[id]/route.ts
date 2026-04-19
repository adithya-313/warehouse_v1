import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface ForecastResult {
  product_id: string;
  model_type: "TFT" | "XGBoost" | "baseline";
  forecast: Array<{
    date: string;
    predicted_qty: number;
    confidence_lower: number;
    confidence_upper: number;
  }>;
  trend: "rising" | "stable" | "falling";
  generated_at: string;
  source: "model" | "circuit_breaker" | "fallback";
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half_open";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_DURATION_MS = 60000;

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  state: "closed",
};

function resetCircuitBreaker() {
  circuitBreaker.failures = 0;
  circuitBreaker.state = "closed";
}

function recordFailure() {
  circuitBreaker.failures += 1;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitBreaker.state = "open";
    sendCircuitBreakerAlert("CIRCUIT_OPEN", `Failures: ${circuitBreaker.failures}`);
  }
}

function canAttemptRequest(): boolean {
  if (circuitBreaker.state === "closed") {
    return true;
  }

  if (circuitBreaker.state === "open") {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceLastFailure >= CIRCUIT_OPEN_DURATION_MS) {
      circuitBreaker.state = "half_open";
      return true;
    }
    return false;
  }

  return circuitBreaker.state === "half_open";
}

async function sendCircuitBreakerAlert(alertType: string, message: string) {
  if (!ALERT_WEBHOOK_URL) {
    console.log(`[circuit-breaker] No webhook configured for alerts`);
    return;
  }

  try {
    const payload = {
      text: `ML Forecast Alert: ${alertType}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${alertType}* :warning:\n${message}\nCircuit State: ${circuitBreaker.state}`,
          },
        },
      ],
    };

    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[circuit-breaker] Failed to send alert:", e);
  }
}

async function callEdgeFunction(functionName: string, productId: string): Promise<any> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ product_id: productId }),
    }
  );

  if (!response.ok) {
    throw new Error(`Edge function ${functionName} failed: ${response.statusText}`);
  }

  return response.json();
}

async function getBaselineForecast(
  supabase: ReturnType<typeof createServerClient>,
  productId: string,
  analytics: any
): Promise<ForecastResult> {
  const baseQty = analytics?.avg_daily_demand ?? 10;
  const trend = analytics?.demand_trend || "stable";

  const forecast: ForecastResult["forecast"] = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    forecast.push({
      date: date.toISOString().split("T")[0],
      predicted_qty: Math.round(baseQty),
      confidence_lower: Math.round(baseQty * 0.7),
      confidence_upper: Math.round(baseQty * 1.3),
    });
  }

  return {
    product_id: productId,
    model_type: "baseline",
    forecast,
    trend,
    generated_at: new Date().toISOString(),
    source: "circuit_breaker",
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: product_id } = await params;

    if (!product_id) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    if (!canAttemptRequest()) {
      console.log(`[ml-forecast] Circuit breaker OPEN, returning baseline data`);

      const supabase = createServerClient();
      const { data: analytics } = await supabase
        .from("product_analytics")
        .select("classification, avg_daily_demand, demand_trend")
        .eq("product_id", product_id)
        .single();

      const baseline = await getBaselineForecast(supabase, product_id, analytics);
      return NextResponse.json(baseline);
    }

    const supabase = createServerClient();

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, category")
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { data: analytics, error: analyticsError } = await supabase
      .from("product_analytics")
      .select("classification, avg_daily_demand, demand_trend")
      .eq("product_id", product_id)
      .single();

    const classification = analytics?.classification || "Slow Moving";
    const isStrategic = 
      classification === "Fast Moving" || 
      classification === "STRATEGIC" ||
      (analytics?.avg_daily_demand ?? 0) > 100;

    const modelType = isStrategic ? "TFT" : "XGBoost";
    
    console.log(`[ml-forecast] Routing SKU ${product_id} (${classification}) to ${modelType}`);

    let forecastData: ForecastResult["forecast"];
    let trend: ForecastResult["trend"] = "stable";
    let source: ForecastResult["source"] = "model";

    try {
      if (modelType === "TFT") {
        const tftResult = await callEdgeFunction("tft-inference", product_id);
        forecastData = tftResult.forecast || [];
        trend = tftResult.trend || "stable";
      } else {
        const xgbResult = await callEdgeFunction("xgboost-inference", product_id);
        forecastData = xgbResult.forecast || [];
        trend = xgbResult.trend || "stable";
      }

      if (circuitBreaker.state === "half_open") {
        resetCircuitBreaker();
        console.log(`[ml-forecast] Circuit breaker CLOSED after successful request`);
      }
    } catch (modelError: any) {
      console.error(`[ml-forecast] Model inference failed:`, modelError.message);
      recordFailure();
      
      forecastData = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        forecastData.push({
          date: date.toISOString().split("T")[0],
          predicted_qty: analytics?.avg_daily_demand ?? 0,
          confidence_lower: (analytics?.avg_daily_demand ?? 0) * 0.8,
          confidence_upper: (analytics?.avg_daily_demand ?? 0) * 1.2,
        });
      }
      trend = analytics?.demand_trend || "stable";
      source = "fallback";
    }

    const result: ForecastResult = {
      product_id,
      model_type: modelType,
      forecast: forecastData,
      trend,
      generated_at: new Date().toISOString(),
      source,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[ml-forecast] Error:", err);
    recordFailure();
    sendCircuitBreakerAlert("REQUEST_ERROR", err.message);
    
    return NextResponse.json(
      { error: err.message || "Forecast generation failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "reset-circuit") {
      resetCircuitBreaker();
      return NextResponse.json({
        status: "success",
        state: circuitBreaker.state,
        message: "Circuit breaker reset",
      });
    }

    if (action === "status") {
      return NextResponse.json({
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
        lastFailure: circuitBreaker.lastFailure,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}