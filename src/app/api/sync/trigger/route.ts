import { NextResponse } from "next/server";

export async function POST() {
  try {
    // In production this would spawn python cron_runner.py as a child process.
    // For local dev we return a helpful message since Python runs separately.
    return NextResponse.json({
      message: "Sync triggered. Run: python python/cron_runner.py to execute manually.",
      triggered_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[sync/trigger POST]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
