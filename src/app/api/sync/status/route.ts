import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("sync_logs")
      .select("synced_at,status,source,records_synced,error_message")
      .order("synced_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const log = data?.[0] ?? null;
    return NextResponse.json({
      last_synced_at:  log?.synced_at ?? null,
      status:          log?.status ?? null,
      source:          log?.source ?? null,
      records_synced:  log?.records_synced ?? 0,
      error_message:   log?.error_message ?? null,
    });
  } catch (err) {
    console.error("[sync/status]", err);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
}
