"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || email.length > 320 || password.length > 4096) redirect("/login?error=credentials");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || data.user.is_anonymous) redirect("/login?error=credentials");
  const { data: tutor, error: tutorError } = await supabase
    .from("tutors").select("id").eq("id", data.user.id).eq("active", true).maybeSingle();
  if (tutorError || !tutor) {
    await supabase.auth.signOut({ scope: "local" });
    revalidatePath("/", "layout");
    redirect("/login?error=access");
  }
  // Invalidate visited pages and the shared header before changing accounts.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    revalidatePath("/", "layout");
    if (error) redirect("/login?error=signout");
  }
  redirect("/login");
}
