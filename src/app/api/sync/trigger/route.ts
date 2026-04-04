import { NextResponse } from "next/server";

export async function POST() {
  // In production this would spawn python cron_runner.py as a child process.
  // For local dev we return a helpful message since Python runs separately.
  return NextResponse.json({
    message: "Sync triggered. Run: python python/cron_runner.py to execute manually.",
    triggered_at: new Date().toISOString(),
  });
}
