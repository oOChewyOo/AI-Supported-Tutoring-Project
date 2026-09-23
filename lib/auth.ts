import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/** Request-local verified identity; never cache a session across requests. */
export async function getVerifiedSession() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  // getUser validates with Auth; a cookie's unverified getSession user is not trusted.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  return { supabase, user };
}

/** Revalidate identity and tutor approval for every data/action entry point. */
export async function requireTutor() {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  const { supabase, user } = session;
  const { data: tutor, error: tutorError } = await supabase
    .from("tutors").select("id").eq("id", user.id).eq("active", true).maybeSingle();
  if (tutorError || !tutor) redirect("/login?error=access");
  return { supabase, user };
}
