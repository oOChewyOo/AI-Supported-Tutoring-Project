import { createClient } from "@supabase/supabase-js";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured yet.");
  }

  // Available for future client-side student interactions. Current student
  // reads and writes run through server components and server actions.
  return createClient(url, anonKey);
}
