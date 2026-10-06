import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Separate service client, used only after current tutor ownership checks. */
export function packageServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Assignment persistence unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}
