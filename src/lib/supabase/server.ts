import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-side client using service role key — full DB access, bypasses RLS
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
