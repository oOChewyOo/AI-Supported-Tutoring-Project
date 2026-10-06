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

export async function learnerMapping(session: NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>) {
  const { data, error } = await session.supabase.from("learner_accounts")
    .select("auth_user_id,student_id,active").eq("auth_user_id", session.user.id).eq("active", true).maybeSingle();
  if (error || !data || data.auth_user_id !== session.user.id || data.active !== true || !data.student_id) return null;
  return { authUserId: session.user.id, studentId: data.student_id as string };
}

/** No caller-supplied student identity; tutor membership grants no learner access. */
export async function requireLearner() {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  const learner = await learnerMapping(session);
  if (!learner) redirect("/login?error=access");
  return { ...session, ...learner };
}

/** Login routing only. Each destination still checks its own authorization. */
export async function accessDestination(session: NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>) {
  const { data, error } = await session.supabase.from("tutors")
    .select("id").eq("id", session.user.id).eq("active", true).maybeSingle();
  if (!error && data) return "/dashboard";
  if (await learnerMapping(session)) return "/learn";
  return null;
}
