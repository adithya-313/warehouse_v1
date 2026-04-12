import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { supplier_id } = body;

    if (!supplier_id) {
      return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
    }

    const { stdout, stderr } = await execAsync(`python python/supplier_risk_engine.py predict ${supplier_id}`);

    if (stderr && !stdout) {
      console.error("Python Stderr:", stderr);
      return NextResponse.json({ error: "Failed to predict supplier risk" }, { status: 500 });
    }

    const result = JSON.parse(stdout.trim());

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    if (Object.keys(result).length === 0) {
      return NextResponse.json({ error: "Insufficient data to predict failure probability" }, { status: 400 });
    }

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate'
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
