import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VALID_STATES = [
  "AP", "AR", "AS", "BR", "CH", "CT", "DD", "DL", "DN", "GA", "GJ", "HR", "HP",
  "JK", "JH", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD",
  "PB", "PY", "RJ", "SK", "TG", "TN", "TR", "TS", "UP", "UK", "WB"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { e_way_bill, state_from, state_to } = body;
    
    const issues: string[] = [];
    
    if (!e_way_bill) {
      return NextResponse.json({ valid: false, issues: ["E-way bill number is required"] });
    }
    
    if (!/^\d{12}$/.test(e_way_bill)) {
      issues.push("Invalid format: must be exactly 12 digits");
    }
    
    if (state_from && !VALID_STATES.includes(state_from)) {
      issues.push(`Invalid state_from code: ${state_from}`);
    }
    
    if (state_to && !VALID_STATES.includes(state_to)) {
      issues.push(`Invalid state_to code: ${state_to}`);
    }
    
    const isInterState = state_from && state_to && state_from !== state_to;
    
    if (isInterState && /^\d{12}$/.test(e_way_bill)) {
      const firstTwoDigits = parseInt(e_way_bill.substring(0, 2));
      if (firstTwoDigits < 1 || firstTwoDigits > 37) {
        issues.push("E-way bill state code prefix appears invalid");
      }
    }
    
    return NextResponse.json({
      valid: issues.length === 0,
      issues,
      is_inter_state: isInterState,
      e_way_bill_format_valid: /^\d{12}$/.test(e_way_bill)
    });
  } catch (err) {
    console.error("[validate-e-way-bill POST]", err);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
