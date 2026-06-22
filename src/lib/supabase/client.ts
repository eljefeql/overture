import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client — the real backend behind src/lib/api/client.ts.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local (see .env.local.example). While those are unset, the app keeps
 * running entirely on the mock data layer; `isSupabaseConfigured` is the
 * switch the API layer checks during the incremental migration.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
    );
  }
  if (!_client) {
    _client = createClient(url!, anonKey!);
  }
  return _client;
}
